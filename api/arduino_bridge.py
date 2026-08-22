"""Bridge to the combined car/sensor/actuator sketch
(car_4wd_serial/car_4wd_serial.ino) plus the full detect -> classify ->
Grad-CAM -> CADRI analysis endpoint.

The sketch runs on the Uno Q's own microcontroller, which the board's
Arduino Router service owns exclusively -- there's no raw /dev/ttyUSB0 to
open directly. Instead the router exposes the sketch's plain Serial stream
as a local TCP passthrough ("monitor proxy") on 127.0.0.1:7500 (see
api/car_router.py for the same mechanism used for movement commands). This
module holds the one persistent connection to that proxy for the whole
backend -- car_router.py sends its movement commands through this same
`bridge` rather than opening a second connection, since a background reader
thread here is already consuming everything the proxy sends.

A background thread continuously reads the sketch's newline-delimited JSON
sensor lines and caches the latest reading in a lock-protected dict, so
GET /sensors is always non-blocking and never depends on the connection
being up at request time. Two locks are used deliberately: `_state_lock`
guards the cached readings (read/written on every loop iteration and every
request), while `_serial_lock` guards the socket itself so a command write
from a request handler can't interleave with the reader thread's reconnect
logic.

Requires: fastapi, pillow (already a project dependency via
src/cropguardian/inference/predictor.py).
"""

from __future__ import annotations

import json
import logging
import socket
import threading
import time
from datetime import datetime
from io import BytesIO
from typing import Literal

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel

from pipeline.cadri_engine import compute_decision
from src.cropguardian.inference.pipeline import DiseasePipeline

logger = logging.getLogger(__name__)

ROUTER_MONITOR_HOST = "127.0.0.1"
ROUTER_MONITOR_PORT = 7500
READ_TIMEOUT_SECONDS = 1.0
RECONNECT_INTERVAL_SECONDS = 2.0
# The sketch reports every 2s. A board-side power hiccup (relay coil load,
# a swapped power source) can silently kill the monitor proxy's link to the
# MCU without ever closing our TCP socket -- recv() just times out forever,
# "connected" stays true, and the cache goes stale with no error logged. If
# we haven't seen a single byte in this long, the connection is presumed
# dead and gets torn down so the next loop iteration reconnects fresh.
STALE_CONNECTION_SECONDS = 10.0

Command = Literal["SPRAY_OFF", "SPRAY_LIGHT", "SPRAY_MODERATE", "SPRAY_FULL", "FAN_ON", "FAN_OFF"]

# Which spray command a CADRI decision should trigger. manual_inspection and
# sensors_unavailable map to SPRAY_OFF too -- an ambiguous prediction or a
# missing environmental reading is never a reason to start spraying, only
# ever to stop and flag for a human. sensors_unavailable is never actually
# looked up here though -- /analyze skips send_command entirely in that case.
DECISION_TO_COMMAND: dict[str, Command] = {
    "full_spray": "SPRAY_FULL",
    "moderate_spray": "SPRAY_MODERATE",
    "light_spray": "SPRAY_LIGHT",
    "no_spray": "SPRAY_OFF",
    "manual_inspection": "SPRAY_OFF",
    "sensors_unavailable": "SPRAY_OFF",
}
# Most urgent first, for picking one command when a photo contains several
# leaves with different decisions.
DECISION_PRIORITY = ["full_spray", "moderate_spray", "light_spray", "no_spray", "manual_inspection", "sensors_unavailable"]

SENSOR_FIELDS = ("temperature", "humidity", "soil_moisture", "gas_level", "fan_state", "pump_state")

# Minimum time to wait before /analyze is allowed to send another spray
# command, keyed by the command/decision that started the cooldown -- avoids
# re-triggering a spray every 2s (the Arduino's sensor-report cadence) while
# an earlier spray is still physically running or just finished.
SPRAY_COOLDOWN_SECONDS = {
    "SPRAY_LIGHT": 10,
    "SPRAY_MODERATE": 12,
    "SPRAY_FULL": 15,
    "no_spray": 0,
    "manual_inspection": 0,
}


class CommandRequest(BaseModel):
    command: Command


class SensorReading(BaseModel):
    temperature: float | None
    humidity: float | None
    soil_moisture: float | None
    gas_level: float | None
    fan_state: bool | None
    pump_state: bool | None
    last_spray_command: str | None
    cooldown_active: bool
    cooldown_seconds_remaining: float
    last_updated: str | None
    serial_connected: bool


class ArduinoBridge:
    """Owns the monitor-proxy connection, the background reader thread, and
    the latest-sensor-reading cache."""

    def __init__(self, host: str = ROUTER_MONITOR_HOST, port: int = ROUTER_MONITOR_PORT):
        self.host = host
        self.port = port
        self._sock: socket.socket | None = None
        self._recv_buffer = b""
        self._last_data_time = 0.0
        self._serial_lock = threading.Lock()
        self._state_lock = threading.Lock()
        self._state: dict = dict.fromkeys(SENSOR_FIELDS, None) | {
            "last_updated": None,
            "last_spray_command": None,
            "last_spray_time": 0.0,
        }
        self._stop_event = threading.Event()
        self._reader_thread: threading.Thread | None = None

    @property
    def connected(self) -> bool:
        return self._sock is not None

    def _connect(self) -> None:
        try:
            sock = socket.create_connection((self.host, self.port), timeout=READ_TIMEOUT_SECONDS)
            sock.settimeout(READ_TIMEOUT_SECONDS)
            self._sock = sock
            self._recv_buffer = b""
            self._last_data_time = time.time()
            logger.info("Connected to Arduino router monitor proxy at %s:%s", self.host, self.port)
        except OSError as exc:
            logger.warning("Could not reach Arduino router monitor proxy: %s", exc)
            self._sock = None

    def _disconnect(self) -> None:
        if self._sock is not None:
            try:
                self._sock.close()
            except OSError:
                pass
            self._sock = None
        self._recv_buffer = b""

    def start(self) -> None:
        with self._serial_lock:
            self._connect()
        self._stop_event.clear()
        self._reader_thread = threading.Thread(target=self._read_loop, daemon=True)
        self._reader_thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._reader_thread is not None:
            self._reader_thread.join(timeout=READ_TIMEOUT_SECONDS + 1)
        with self._serial_lock:
            self._disconnect()

    def _read_loop(self) -> None:
        # Raw recv() into a manual line buffer, rather than socket.makefile():
        # a buffered file object wrapping a timeout-enabled socket does not
        # recover cleanly from a read timeout (subsequent reads fail with
        # "cannot read from timed out object"), but a plain socket handles
        # repeated timeouts on recv() fine.
        while not self._stop_event.is_set():
            with self._serial_lock:
                if not self.connected:
                    self._connect()
                sock = self._sock
            if sock is None:
                self._stop_event.wait(RECONNECT_INTERVAL_SECONDS)
                continue

            try:
                chunk = sock.recv(4096)
            except socket.timeout:
                if time.time() - self._last_data_time > STALE_CONNECTION_SECONDS:
                    logger.warning(
                        "No data from monitor proxy in over %.0fs, presuming the link died silently -- reconnecting",
                        STALE_CONNECTION_SECONDS,
                    )
                    with self._serial_lock:
                        self._disconnect()
                continue  # no data yet, connection is still fine
            except OSError as exc:
                logger.warning("Monitor proxy read failed, will reconnect: %s", exc)
                with self._serial_lock:
                    self._disconnect()
                continue

            if not chunk:
                # Empty read (not a timeout) means the peer closed the
                # connection.
                logger.warning("Monitor proxy connection closed, will reconnect")
                with self._serial_lock:
                    self._disconnect()
                continue

            self._last_data_time = time.time()
            self._recv_buffer += chunk
            while b"\n" in self._recv_buffer:
                line, self._recv_buffer = self._recv_buffer.split(b"\n", 1)
                self._ingest_line(line.decode("utf-8", errors="ignore"))

    def _ingest_line(self, raw: str) -> None:
        line = raw.strip()
        if not line:
            return
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            return
        with self._state_lock:
            for field in SENSOR_FIELDS:
                if field in payload:
                    self._state[field] = payload[field]
            self._state["last_updated"] = datetime.now().isoformat(timespec="seconds")

    def latest(self) -> dict:
        with self._state_lock:
            state = dict(self._state)
        state.pop("last_spray_time", None)
        remaining = self.cooldown_remaining_seconds()
        state["serial_connected"] = self.connected
        state["cooldown_active"] = remaining > 0
        state["cooldown_seconds_remaining"] = round(remaining, 1)
        return state

    def has_sensor_data(self) -> bool:
        """Whether the four environmental readings CADRI needs are usable --
        false if the Arduino isn't connected, or its last report never got
        past all-zero/uninitialized values."""
        if not self.connected:
            return False
        with self._state_lock:
            readings = (
                self._state["temperature"],
                self._state["humidity"],
                self._state["soil_moisture"],
                self._state["gas_level"],
            )
        return not all(v is None or v == 0 for v in readings)

    def cooldown_remaining_seconds(self) -> float:
        with self._state_lock:
            last_cmd = self._state["last_spray_command"]
            last_time = self._state["last_spray_time"]
        if last_cmd is None:
            return 0.0
        cooldown = SPRAY_COOLDOWN_SECONDS.get(last_cmd, 0)
        return max(0.0, cooldown - (time.time() - last_time))

    def is_in_cooldown(self) -> bool:
        with self._state_lock:
            last_cmd = self._state["last_spray_command"]
            last_time = self._state["last_spray_time"]
        if last_cmd is None:
            return False
        cooldown = SPRAY_COOLDOWN_SECONDS.get(last_cmd, 0)
        return (time.time() - last_time) < cooldown

    def record_spray(self, command: str) -> None:
        with self._state_lock:
            self._state["last_spray_command"] = command
            self._state["last_spray_time"] = time.time()

    def send_command(self, command: str) -> None:
        with self._serial_lock:
            if not self.connected:
                raise ConnectionError("Arduino router monitor proxy is not connected")
            try:
                self._sock.sendall(f"{command}\n".encode("utf-8"))
            except OSError as exc:
                self._disconnect()
                raise ConnectionError(f"Could not reach the Arduino router: {exc}") from exc


bridge = ArduinoBridge()
_pipeline: DiseasePipeline | None = None


def _get_pipeline() -> DiseasePipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = DiseasePipeline()
    return _pipeline


router = APIRouter(tags=["arduino"])


@router.get("/sensors", response_model=SensorReading)
def get_sensors() -> SensorReading:
    return SensorReading(**bridge.latest())


@router.post("/command")
def post_command(request: CommandRequest) -> dict:
    try:
        bridge.send_command(request.command)
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"status": "sent", "command": request.command}


def analyze_image(pil_image: Image.Image) -> dict:
    """The shared detect -> classify -> Grad-CAM -> CADRI pipeline, used by
    both POST /analyze (a manually uploaded photo) and POST /camera/analyze
    (the latest frame pushed by a live camera feed) -- same decision logic,
    same spray side effects, just a different source for the image."""
    sensors = bridge.latest()
    sensors_available = bridge.has_sensor_data()

    if sensors["pump_state"]:
        return {"skipped": True, "reason": "pump_already_running", "sensor_readings": sensors}

    if bridge.is_in_cooldown():
        return {
            "skipped": True,
            "reason": "cooldown_active",
            "cooldown_seconds_remaining": round(bridge.cooldown_remaining_seconds(), 1),
            "sensor_readings": sensors,
        }

    # Everything from here on is the actual detect -> classify -> Grad-CAM ->
    # CADRI pipeline. Any unhandled exception in it (a bad model input, a
    # transient inference failure, etc.) is real backend breakage rather than
    # a client error, but it shouldn't take the whole endpoint down with a
    # raw 500 traceback either -- log it and hand back a structured error.
    try:
        leaf_results = _get_pipeline().run(pil_image)

        if not leaf_results:
            return {"leaves": [], "primary_decision": None, "command_sent": None, "sensors": sensors}

        leaves = []
        for leaf in leaf_results:
            top_probs = sorted(leaf.probabilities.values(), reverse=True)
            top2_confidence = top_probs[1] if len(top_probs) > 1 else 0.0
            decision = compute_decision(
                disease_class=leaf.class_name,
                confidence=leaf.class_confidence,
                top2_confidence=top2_confidence,
                Sv=leaf.severity_score,
                temperature=sensors["temperature"] if sensors_available else None,
                humidity=sensors["humidity"] if sensors_available else None,
                soil_moisture=sensors["soil_moisture"] if sensors_available else None,
                air_quality=sensors["gas_level"] if sensors_available else None,
            )
            leaves.append(
                {
                    "box_xyxy": leaf.box_xyxy,
                    "detection_confidence": round(leaf.detection_confidence, 4),
                    **decision,
                }
            )

        primary_decision = min(leaves, key=lambda leaf: DECISION_PRIORITY.index(leaf["decision"]))
        command_sent = None
        if primary_decision["decision"] != "sensors_unavailable":
            command = DECISION_TO_COMMAND[primary_decision["decision"]]
            try:
                bridge.send_command(command)
                command_sent = command
                bridge.record_spray(command)
            except ConnectionError:
                command_sent = None

        return {
            "leaves": leaves,
            "primary_decision": primary_decision,
            "command_sent": command_sent,
            "sensors": sensors,
        }
    except Exception as exc:
        logger.exception("Unhandled error in analyze pipeline")
        return {"error": True, "message": str(exc)}


@router.post("/analyze")
async def analyze(image: UploadFile = File(...)) -> dict:
    contents = await image.read()
    try:
        pil_image = Image.open(BytesIO(contents)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    result = analyze_image(pil_image)
    if result.get("error"):
        return JSONResponse(status_code=500, content=result)
    return result

"""Serial bridge to the Arduino sensor/actuator controller
(Arduino/car_4wd_serial/car_4wd_serial.ino) plus the full detect -> classify
-> Grad-CAM -> CADRI analysis endpoint.

A background thread continuously reads the Arduino's newline-delimited JSON
sensor lines and caches the latest reading in a lock-protected dict, so
GET /sensors is always non-blocking and never depends on the serial port
being up at request time. Two locks are used deliberately: `_state_lock`
guards the cached readings (read/written on every loop iteration and every
request), while `_serial_lock` guards the `serial.Serial` handle itself so a
command write from a request handler can't interleave with the reader
thread's reconnect logic.

Requires: pyserial, fastapi, pillow (already a project dependency via
src/cropguardian/inference/predictor.py).
"""

from __future__ import annotations

import json
import logging
import sys
import threading
import time
from datetime import datetime
from io import BytesIO
from typing import Literal

import serial
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel
from serial.tools import list_ports

from pipeline.cadri_engine import compute_decision
from src.cropguardian.inference.pipeline import DiseasePipeline

logger = logging.getLogger(__name__)

BAUD_RATE = 9600
FALLBACK_PORT = "COM3" if sys.platform.startswith("win") else "/dev/ttyUSB0"
READ_TIMEOUT_SECONDS = 1.0
RECONNECT_INTERVAL_SECONDS = 2.0

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
    "SPRAY_LIGHT": 15,
    "SPRAY_MODERATE": 30,
    "SPRAY_FULL": 60,
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
    """Owns the serial connection, the background reader thread, and the
    latest-sensor-reading cache."""

    def __init__(self, baud_rate: int = BAUD_RATE, fallback_port: str = FALLBACK_PORT):
        self.baud_rate = baud_rate
        self.fallback_port = fallback_port
        self._conn: serial.Serial | None = None
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
        return self._conn is not None and self._conn.is_open

    def _detect_port(self) -> str:
        ports = list(list_ports.comports())
        for port in ports:
            haystack = f"{port.description} {port.manufacturer or ''} {port.hwid}".lower()
            if "arduino" in haystack:
                return port.device
        # No description match (common with generic USB-serial chips like the
        # CH340) -- fall back to device-name heuristics for the common
        # platform-specific Arduino port name patterns.
        for port in ports:
            name = port.device.lower()
            if "usbmodem" in name or "usbserial" in name or "ttyacm" in name or "ttyusb" in name:
                return port.device
        return self.fallback_port

    def _connect(self) -> None:
        port = self._detect_port()
        try:
            self._conn = serial.Serial(port, self.baud_rate, timeout=READ_TIMEOUT_SECONDS)
            logger.info("Connected to Arduino on %s", port)
        except serial.SerialException as exc:
            logger.warning("Could not open serial port %s: %s", port, exc)
            self._conn = None

    def _disconnect(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            except serial.SerialException:
                pass
            self._conn = None

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
        while not self._stop_event.is_set():
            with self._serial_lock:
                if not self.connected:
                    self._connect()
                    conn = None
                else:
                    conn = self._conn
            if conn is None:
                self._stop_event.wait(RECONNECT_INTERVAL_SECONDS)
                continue

            try:
                raw = conn.readline()
            except (serial.SerialException, OSError) as exc:
                logger.warning("Serial read failed, will reconnect: %s", exc)
                with self._serial_lock:
                    self._disconnect()
                continue

            if not raw:
                continue  # readline() timeout, no data yet
            self._ingest_line(raw)

    def _ingest_line(self, raw: bytes) -> None:
        line = raw.decode("utf-8", errors="ignore").strip()
        if not line:
            return
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            return
        if "error" in payload:
            # e.g. {"error": "DHT22_READ_FAILED"} -- keep the last known
            # good readings rather than overwriting them with nulls.
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
                raise ConnectionError("Arduino is not connected")
            self._conn.write(f"{command}\n".encode("utf-8"))


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


@router.post("/analyze")
async def analyze(image: UploadFile = File(...)) -> dict:
    contents = await image.read()
    try:
        pil_image = Image.open(BytesIO(contents)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

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
        logger.exception("Unhandled error in /analyze pipeline")
        return JSONResponse(status_code=500, content={"error": True, "message": str(exc)})

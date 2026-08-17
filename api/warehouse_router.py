"""Warehouse ventilation monitoring endpoints.

Stateless: each GET /warehouse/status call reads the arduino_bridge's
latest cached sensor reading, runs it through compute_warehouse_decision(),
and pushes the resulting fan command -- no polling loop of its own, no
cooldown/state tracking like the spray side. The dashboard drives the
polling cadence.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from api.arduino_bridge import bridge
from pipeline.warehouse_engine import compute_warehouse_decision

logger = logging.getLogger(__name__)

router = APIRouter(tags=["warehouse"])

# Returned instead of a decision when the Arduino is disconnected or hasn't
# reported real readings yet -- "unknown" rather than "optimal", since we
# have no basis to claim the storage vault is actually fine.
NO_DATA_STATUS = {
    "temperature": None,
    "humidity": None,
    "gas_level": None,
    "fan_action": "FAN_OFF",
    "reasons": [],
    "status": {"temperature": "unknown", "humidity": "unknown", "gas": "unknown"},
}


@router.get("/status")
def get_status() -> dict:
    sensors = bridge.latest()
    if not bridge.has_sensor_data():
        return {**NO_DATA_STATUS, "serial_connected": False}

    decision = compute_warehouse_decision(
        temperature=sensors["temperature"],
        humidity=sensors["humidity"],
        gas_level=sensors["gas_level"],
    )

    try:
        bridge.send_command(decision["fan_action"])
    except ConnectionError as exc:
        logger.warning("Could not send %s: %s", decision["fan_action"], exc)

    return {**decision, "serial_connected": True}


@router.get("/mode")
def get_mode() -> dict:
    return {"mode": "warehouse", "active": True}

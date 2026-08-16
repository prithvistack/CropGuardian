"""Warehouse ventilation monitoring endpoints.

Stateless: each GET /warehouse/status call reads the arduino_bridge's
latest cached sensor reading, runs it through compute_warehouse_decision(),
and pushes the resulting fan command -- no polling loop of its own, no
cooldown/state tracking like the spray side. The dashboard drives the
polling cadence.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from api.arduino_bridge import bridge
from pipeline.warehouse_engine import compute_warehouse_decision

logger = logging.getLogger(__name__)

router = APIRouter(tags=["warehouse"])


@router.get("/status")
def get_status() -> dict:
    sensors = bridge.latest()
    if any(sensors[field] is None for field in ("temperature", "humidity", "gas_level")):
        raise HTTPException(status_code=503, detail="No sensor readings available yet")

    decision = compute_warehouse_decision(
        temperature=sensors["temperature"],
        humidity=sensors["humidity"],
        gas_level=sensors["gas_level"],
    )

    try:
        bridge.send_command(decision["fan_action"])
    except ConnectionError as exc:
        logger.warning("Could not send %s: %s", decision["fan_action"], exc)

    return decision


@router.get("/mode")
def get_mode() -> dict:
    return {"mode": "warehouse", "active": True}

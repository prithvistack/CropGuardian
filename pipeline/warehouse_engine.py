"""Warehouse ventilation decision engine.

Independent of the field CADRI pipeline (cadri_engine.py) -- warehouse
storage cares about triggering ventilation to protect stored produce, not
about disease classification, so this is a flat threshold check rather than
a scored model.
"""

from __future__ import annotations

TEMP_THRESHOLD = 25.0  # deg C
HUMIDITY_THRESHOLD = 70.0  # %
GAS_THRESHOLD = 60.0  # %


def compute_warehouse_decision(temperature: float, humidity: float, gas_level: float) -> dict:
    reasons = []
    if temperature > TEMP_THRESHOLD:
        reasons.append("temperature_high")
    if humidity > HUMIDITY_THRESHOLD:
        reasons.append("humidity_high")
    if gas_level > GAS_THRESHOLD:
        reasons.append("gas_high")

    fan_on = bool(reasons)

    return {
        "temperature": temperature,
        "humidity": humidity,
        "gas_level": gas_level,
        "fan_action": "FAN_ON" if fan_on else "FAN_OFF",
        "reasons": reasons,
        "status": {
            "temperature": "critical" if temperature > TEMP_THRESHOLD else "optimal",
            "humidity": "critical" if humidity > HUMIDITY_THRESHOLD else "optimal",
            "gas": "critical" if gas_level > GAS_THRESHOLD else "optimal",
        },
    }

"""Manual 4WD car control.

Talks to car_4wd_serial.ino running on the UNO Q's own microcontroller --
the same combined car/sensor/actuator sketch that api/arduino_bridge.py
already holds a persistent connection to (the board's Arduino Router
service exposes the sketch's plain Serial stream as a local TCP passthrough
on 127.0.0.1:7500). Movement commands go through that same `bridge` rather
than opening a second connection to the proxy, since arduino_bridge's
background reader thread is already consuming everything the proxy sends --
a second independent connection would just be racing it for the same
bytes. Sending F/B/L/R/S there reaches Serial.read() in the sketch exactly
as it would over a wired connection.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.arduino_bridge import bridge

CarCommand = Literal["F", "B", "L", "R", "S", "+", "-"]


class CarCommandRequest(BaseModel):
    command: CarCommand


router = APIRouter(tags=["car"])


@router.post("/move")
def move(request: CarCommandRequest) -> dict:
    try:
        bridge.send_command(request.command)
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"status": "sent", "command": request.command}

"""Live camera feed from a phone mounted on the rover chassis.

Stateless and deliberately simple: the camera phone's browser captures a
frame from its own camera every couple of seconds and POSTs it here; the
latest one is held in memory (last-write-wins, no history) for the driver's
phone to poll and display, and optionally run through the real CADRI
pipeline on demand via /camera/analyze -- it reuses arduino_bridge's
analyze_image() rather than duplicating the detect -> classify -> Grad-CAM ->
CADRI pipeline, so a frame from the camera feed gets exactly the same
decision (and the same spray side effects) a manually uploaded photo would.
"""

from __future__ import annotations

import threading
from io import BytesIO

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image

from api.arduino_bridge import analyze_image

router = APIRouter(tags=["camera"])

_lock = threading.Lock()
_latest_frame: bytes | None = None


@router.post("/frame")
async def post_frame(image: UploadFile = File(...)) -> dict:
    contents = await image.read()
    try:
        Image.open(BytesIO(contents)).verify()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    global _latest_frame
    with _lock:
        _latest_frame = contents
    return {"status": "received", "bytes": len(contents)}


@router.get("/frame")
def get_frame() -> Response:
    with _lock:
        frame = _latest_frame
    if frame is None:
        raise HTTPException(status_code=404, detail="No frame received yet")
    return Response(content=frame, media_type="image/jpeg")


@router.post("/analyze")
def analyze_frame() -> dict:
    with _lock:
        frame = _latest_frame
    if frame is None:
        raise HTTPException(status_code=404, detail="No frame received yet")

    try:
        pil_image = Image.open(BytesIO(frame)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid stored frame: {exc}") from exc

    result = analyze_image(pil_image)
    if result.get("error"):
        return JSONResponse(status_code=500, content=result)
    return result

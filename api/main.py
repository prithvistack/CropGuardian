"""FastAPI entrypoint for CropGuardian AI: the Arduino serial bridge
(sensors, spray/fan commands), the image-analysis pipeline, car control, the
live camera relay -- and the built React dashboard itself, served as static
files from the same process. Keeping frontend and backend on one origin
means the dashboard's API calls can be plain relative paths (see
cropguardian/src/api.js) instead of a hardcoded board IP that goes stale
every time the board joins a different network.

Run with: uvicorn api.main:app --reload --port 8000
(rebuild the frontend into cropguardian/dist/ first: `npm run build`)
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.arduino_bridge import bridge, router as arduino_router
from api.camera_router import router as camera_router
from api.car_router import router as car_router
from api.warehouse_router import router as warehouse_router

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "cropguardian" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    bridge.start()
    yield
    bridge.stop()


app = FastAPI(title="CropGuardian AI API", lifespan=lifespan)

# Any device on the same private network can call this API -- localhost (for
# same-machine dev), and the RFC1918 private ranges (so a phone or laptop on
# the same WiFi/hotspot as the board can reach it too, e.g. for car control).
# There's no auth anywhere in this API; this is a local-network-trust model,
# not a public-internet one.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"^https?://("
        r"localhost|127\.0\.0\.1"
        r"|10(?:\.\d{1,3}){3}"
        r"|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}"
        r"|192\.168(?:\.\d{1,3}){2}"
        r")(:\d+)?$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(arduino_router)
app.include_router(warehouse_router, prefix="/warehouse")
app.include_router(car_router, prefix="/car")
app.include_router(camera_router, prefix="/camera")

# Must come last -- a catch-all mount at "/" would otherwise shadow every
# API route registered above it. html=True serves index.html for any path
# that doesn't match a static file, which this single-page app needs since
# it does all view-switching client-side rather than via real routes.
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")

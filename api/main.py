"""FastAPI entrypoint for CropGuardian AI's device-facing API: the Arduino
serial bridge (sensors, spray/fan commands) and the image-analysis pipeline,
served for the dashboard (cropguardian/, a Vite dev server) to call over
localhost.

Run with: uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.arduino_bridge import bridge, router as arduino_router
from api.warehouse_router import router as warehouse_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    bridge.start()
    yield
    bridge.stop()


app = FastAPI(title="CropGuardian AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(arduino_router)
app.include_router(warehouse_router, prefix="/warehouse")

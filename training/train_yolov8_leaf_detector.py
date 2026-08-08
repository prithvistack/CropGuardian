#!/usr/bin/env python3
"""YOLOv8n tomato-leaf detector -- stage 1 of the two-stage detect-then-classify
pipeline (stage 2 is the existing EfficientNetV2 classifier in
training/train_efficientnetv2s.py).

Data (images, labels, and configs/yolo_leaf_detection.yaml) is built by
tools/build_leaf_detection_dataset.py from the PlantDoc Object Detection
Dataset -- run that first if configs/yolo_leaf_detection.yaml doesn't exist
yet. This script only owns training; it reads that config as-is rather than
regenerating it, since the data split is a fact about the built dataset, not
a training hyperparameter.

Single class ("tomato_leaf") -- this stage only locates and crops leaves;
disease classification happens downstream.

Usage:
    python3 training/train_yolov8_leaf_detector.py
"""

from __future__ import annotations

from pathlib import Path

import torch
from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_YAML_PATH = PROJECT_ROOT / "configs" / "yolo_leaf_detection.yaml"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts" / "yolo_leaf_detector"
RUN_NAME = "tomato_leaf_detector"

IMG_SIZE = 640
EPOCHS = 100
BATCH_SIZE = 16
PATIENCE = 20  # epochs with no val mAP improvement before early stopping
SEED = 42

AMP = True


def _check_dataset_ready() -> None:
    if not DATA_YAML_PATH.exists():
        raise FileNotFoundError(
            f"{DATA_YAML_PATH} not found. Run tools/build_leaf_detection_dataset.py "
            "first to build the dataset and write this config."
        )


def _select_device() -> str:
    if torch.cuda.is_available():
        return "0"
    # Deliberately not offering "mps" here even when available: two runs on
    # this repo's hardware (Apple M5, torch 2.8.0) crashed inside Ultralytics'
    # TaskAlignedAssigner with "RuntimeError: The size of tensor a (...) must
    # match the size of tensor b (...)" in a boolean-mask assignment
    # (overlaps[mask_gt] = ...) -- once at epoch 26 with amp=True, again
    # inside epoch 1 with amp=False. Same bug either way, non-deterministic
    # (tied to whatever box count a given mosaic-augmented batch produces),
    # and it reproduces with AMP on or off -- so it's a PyTorch MPS backend
    # indexing correctness bug, not an AMP setting this script controls.
    return "cpu"


def main() -> None:
    _check_dataset_ready()

    # Deliberately not using Ultralytics' resume=True here -- it reloads the
    # crashed run's saved args.yaml wholesale (including amp=True, the actual
    # cause of the crash), silently overriding anything passed alongside it.
    # Starting a fresh model.train() from last.pt's weights instead means
    # AMP/device below always win, at the cost of the optimizer momentum and
    # epoch counter resetting to 0 -- an acceptable tradeoff for training
    # that's still this early on.
    last_ckpt = ARTIFACTS_DIR / RUN_NAME / "weights" / "last.pt"
    if last_ckpt.exists():
        print(f"Continuing from {last_ckpt} (fresh optimizer state, amp={AMP})")
        model = YOLO(str(last_ckpt))
    else:
        model = YOLO("yolov8n.pt")  # COCO-pretrained; auto-downloads on first use

    model.train(
        data=str(DATA_YAML_PATH),
        imgsz=IMG_SIZE,
        epochs=EPOCHS,
        batch=BATCH_SIZE,
        patience=PATIENCE,
        seed=SEED,
        device=_select_device(),
        amp=AMP,
        project=str(ARTIFACTS_DIR),
        name=RUN_NAME,
        exist_ok=True,
    )
    # No explicit model.val() call here -- Ultralytics already validates
    # best.pt automatically at the end of model.train() (visible in its own
    # log output above); calling it again just reran the identical
    # validation a second time and wrote it to the wrong place (defaults to
    # runs/detect/val at the repo root instead of under ARTIFACTS_DIR, since
    # no project/name was passed to that second call).
    print(f"Best weights: {ARTIFACTS_DIR / RUN_NAME / 'weights' / 'best.pt'}")


if __name__ == "__main__":
    main()

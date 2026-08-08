"""Tomato-leaf detection (YOLOv8n) -- stage 1 of the two-stage pipeline.

Locates leaves in a full-plant image; disease classification happens
downstream in Predictor (predictor.py), one crop at a time.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image
from ultralytics import YOLO

from ..utils.paths import get_project_root

DEFAULT_WEIGHTS_PATH = (
    get_project_root() / "artifacts" / "yolo_leaf_detector" / "tomato_leaf_detector" / "weights" / "best.pt"
)
DEFAULT_CONFIDENCE_THRESHOLD = 0.25


@dataclass
class LeafDetection:
    box_xyxy: tuple[int, int, int, int]  # pixel coords in the original (uncropped) image
    confidence: float


class LeafDetector:
    """Loads the trained YOLOv8n tomato-leaf detector and locates leaves in a full image."""

    def __init__(
        self,
        weights_path: str | Path = DEFAULT_WEIGHTS_PATH,
        confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    ):
        self.weights_path = Path(weights_path)
        self.model = YOLO(str(self.weights_path))
        self.confidence_threshold = confidence_threshold

    def detect(self, image: Image.Image) -> list[LeafDetection]:
        results = self.model.predict(image, conf=self.confidence_threshold, verbose=False)
        width, height = image.size
        detections = []
        for box in results[0].boxes:
            xmin, ymin, xmax, ymax = box.xyxy[0].tolist()
            # Clip to image bounds -- YOLO boxes are normally already inside them,
            # but PIL.Image.crop silently pads out-of-bounds regions with black
            # instead of raising, which would corrupt the downstream classifier
            # input without any visible error.
            box_xyxy = (
                max(0, int(xmin)),
                max(0, int(ymin)),
                min(width, int(xmax)),
                min(height, int(ymax)),
            )
            detections.append(LeafDetection(box_xyxy=box_xyxy, confidence=float(box.conf[0])))
        return detections

    def crop(self, image: Image.Image, detection: LeafDetection) -> Image.Image:
        return image.crop(detection.box_xyxy)

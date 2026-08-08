"""Full detect-then-classify pipeline: image -> YOLO leaf detection -> crop
-> EfficientNetV2 classification -> Grad-CAM -> Sv severity score.

Each detected leaf is classified and explained independently, so a single
full-plant photo containing several leaves yields one LeafResult per leaf.
"""

from __future__ import annotations

from dataclasses import dataclass

from PIL import Image

from .detector import LeafDetector
from .gradcam import DEFAULT_LAST_CONV_LAYER, DEFAULT_SV_THRESHOLD, run_gradcam
from .predictor import IMG_SIZE, Predictor


@dataclass
class LeafResult:
    box_xyxy: tuple[int, int, int, int]  # leaf's location in the original image
    detection_confidence: float  # YOLO
    class_name: str  # EfficientNetV2
    class_confidence: float
    probabilities: dict[str, float]
    severity_score: float  # Sv, in [0, 1]
    heatmap: "object"  # np.ndarray, (IMG_SIZE, IMG_SIZE), for overlay/visualization by the caller


class DiseasePipeline:
    def __init__(
        self,
        detector: LeafDetector | None = None,
        predictor: Predictor | None = None,
        last_conv_layer_name: str = DEFAULT_LAST_CONV_LAYER,
        severity_threshold: float = DEFAULT_SV_THRESHOLD,
    ):
        self.detector = detector or LeafDetector()
        self.predictor = predictor or Predictor()
        self.last_conv_layer_name = last_conv_layer_name
        self.severity_threshold = severity_threshold

    def run(self, image: Image.Image) -> list[LeafResult]:
        results = []
        for detection in self.detector.detect(image):
            crop = self.detector.crop(image, detection)
            prediction = self.predictor.predict(crop)
            gradcam = run_gradcam(
                model=self.predictor.model,
                input_batch=prediction.input_batch,
                class_index=prediction.class_index,
                output_size=(IMG_SIZE, IMG_SIZE),
                last_conv_layer_name=self.last_conv_layer_name,
                threshold=self.severity_threshold,
            )
            results.append(
                LeafResult(
                    box_xyxy=detection.box_xyxy,
                    detection_confidence=detection.confidence,
                    class_name=prediction.class_name,
                    class_confidence=prediction.confidence,
                    probabilities=prediction.probabilities,
                    severity_score=gradcam.severity_score,
                    heatmap=gradcam.heatmap,
                )
            )
        return results

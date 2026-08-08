"""Inference utilities for CropGuardian AI."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image

from ..utils.paths import get_project_root

IMG_SIZE = 384

# Alphabetical directory order used by tf.keras.utils.image_dataset_from_directory
# during training (training/train_efficientnetv2s.py) -- label indices depend on
# this exact order.
CLASS_NAMES = [
    "Tomato_Bacterial_spot",
    "Tomato_Early_blight",
    "Tomato_Late_blight",
    "Tomato_Leaf_Mold",
    "Tomato_Septoria_leaf_spot",
    "Tomato_Spider_mites_Two_spotted_spider_mite",
    "Tomato__Target_Spot",
    "Tomato__Tomato_YellowLeaf__Curl_Virus",
    "Tomato__Tomato_mosaic_virus",
    "Tomato_healthy",
]

DEFAULT_MODEL_PATH = get_project_root() / "artifacts" / "cropguardian_v2s_best.keras"


@dataclass
class PredictionResult:
    class_name: str
    class_index: int
    confidence: float
    probabilities: dict[str, float]
    input_batch: tf.Tensor  # preprocessed (1, IMG_SIZE, IMG_SIZE, 3) batch, reusable for Grad-CAM


class Predictor:
    """Loads the trained EfficientNetV2S classifier and runs inference."""

    def __init__(self, model_path: str | Path = DEFAULT_MODEL_PATH):
        self.model_path = Path(model_path)
        self.model = tf.keras.models.load_model(self.model_path)

    def preprocess(self, image: Image.Image) -> tf.Tensor:
        image = image.convert("RGB").resize((IMG_SIZE, IMG_SIZE))
        array = tf.keras.utils.img_to_array(image)
        array = tf.keras.applications.efficientnet_v2.preprocess_input(array)
        return tf.expand_dims(array, axis=0)

    def predict(self, image: Image.Image) -> PredictionResult:
        batch = self.preprocess(image)
        probs = np.asarray(self.model(batch, training=False))[0]
        class_index = int(np.argmax(probs))
        return PredictionResult(
            class_name=CLASS_NAMES[class_index],
            class_index=class_index,
            confidence=float(probs[class_index]),
            probabilities=dict(zip(CLASS_NAMES, (float(p) for p in probs))),
            input_batch=batch,
        )

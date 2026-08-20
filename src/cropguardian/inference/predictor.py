"""Inference utilities for CropGuardian AI.

Runs on a TFLite backbone (the expensive EfficientNetV2S conv trunk, ~20M of
the model's 21.3M params) plus a plain-numpy classifier head, instead of the
full Keras model -- this avoids needing the ~1GB TensorFlow framework on
resource-constrained deployments (e.g. the Arduino UNO Q's Linux side), where
only a few-MB TFLite interpreter is required. The head (GAP -> BatchNorm ->
Dense(256, relu) -> Dense(10, softmax)) is small and shallow enough to run as
matrix multiplies; its exported weights are also what gradcam.py hand-derives
the classifier gradient through, since TFLite is inference-only and can't
backprop. See tools/export_tflite.py for how the .tflite/.npz artifacts here
are produced from the original cropguardian_v2s_best.keras.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from ..utils.paths import get_project_root

try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:
    try:
        from tflite_runtime.interpreter import Interpreter
    except ImportError:
        import tensorflow as tf  # dev-machine fallback (full TF installed)

        Interpreter = tf.lite.Interpreter

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

DEFAULT_BACKBONE_PATH = get_project_root() / "artifacts" / "cropguardian_v2s_backbone.tflite"
DEFAULT_HEAD_PATH = get_project_root() / "artifacts" / "cropguardian_v2s_head.npz"


@dataclass
class PredictionResult:
    class_name: str
    class_index: int
    confidence: float
    probabilities: dict[str, float]
    conv_output: np.ndarray  # (H, W, C) backbone feature map -- Grad-CAM's input


def _softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max()
    e = np.exp(z)
    return e / e.sum()


class HeadWeights:
    """The classifier head's weights, exported once from the original Keras
    model. Small enough (~1.3MB) to load as plain numpy arrays and run
    without any deep-learning framework -- both Predictor and gradcam.py use
    `forward()` (or its intermediates) directly."""

    def __init__(self, path: str | Path = DEFAULT_HEAD_PATH):
        w = np.load(path)
        self.bn_gamma: np.ndarray = w["bn_gamma"]
        self.bn_beta: np.ndarray = w["bn_beta"]
        self.bn_mean: np.ndarray = w["bn_mean"]
        self.bn_var: np.ndarray = w["bn_var"]
        self.bn_eps: float = float(w["bn_eps"])
        self.w1: np.ndarray = w["w1"]
        self.b1: np.ndarray = w["b1"]
        self.w2: np.ndarray = w["w2"]
        self.b2: np.ndarray = w["b2"]

    def forward(self, conv_output: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Runs GAP(conv_output) through the head. Returns (probs, z1,
        relu_mask) -- the latter two are exactly what Grad-CAM needs to
        hand-backprop through, so it doesn't have to recompute them."""
        gap = conv_output.mean(axis=(0, 1))
        bn_out = self.bn_gamma * (gap - self.bn_mean) / np.sqrt(self.bn_var + self.bn_eps) + self.bn_beta
        z1 = bn_out @ self.w1 + self.b1
        h1 = np.maximum(z1, 0)
        relu_mask = (z1 > 0).astype(np.float32)
        z2 = h1 @ self.w2 + self.b2
        probs = _softmax(z2)
        return probs, z1, relu_mask


class Predictor:
    """Loads the TFLite EfficientNetV2S backbone + numpy classifier head and runs inference."""

    def __init__(
        self,
        backbone_path: str | Path = DEFAULT_BACKBONE_PATH,
        head_path: str | Path = DEFAULT_HEAD_PATH,
    ):
        self.interpreter = Interpreter(model_path=str(backbone_path))
        self.interpreter.allocate_tensors()
        self._input_detail = self.interpreter.get_input_details()[0]
        self._output_detail = self.interpreter.get_output_details()[0]
        self.head = HeadWeights(head_path)

    def preprocess(self, image: Image.Image) -> np.ndarray:
        image = image.convert("RGB").resize((IMG_SIZE, IMG_SIZE))
        # tf.keras.applications.efficientnet_v2.preprocess_input is an identity
        # function -- verified empirically (input == output) -- since this
        # architecture normalizes internally as part of the model graph. So
        # there's nothing to replicate here beyond the plain float32 pixels.
        return np.asarray(image, dtype=np.float32)[None, ...]

    def predict(self, image: Image.Image) -> PredictionResult:
        batch = self.preprocess(image)
        self.interpreter.set_tensor(self._input_detail["index"], batch)
        self.interpreter.invoke()
        conv_output = self.interpreter.get_tensor(self._output_detail["index"])[0]

        probs, _, _ = self.head.forward(conv_output)
        class_index = int(np.argmax(probs))
        return PredictionResult(
            class_name=CLASS_NAMES[class_index],
            class_index=class_index,
            confidence=float(probs[class_index]),
            probabilities=dict(zip(CLASS_NAMES, (float(p) for p in probs))),
            conv_output=conv_output,
        )

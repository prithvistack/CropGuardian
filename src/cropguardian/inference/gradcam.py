"""Grad-CAM heatmaps and the Sv severity score, computed on Predictor's
EfficientNetV2 classifier.

Sv is defined here as (heatmap pixels above THRESHOLD) / (total pixels in
the classifier's 384x384 input) -- i.e. the fraction of the *crop* the
model's attention covers, not the fraction of actual leaf tissue. YOLO
gives a bounding box, not a leaf segmentation mask, so there is no ground
truth for "leaf pixels" vs. background pixels within the crop to divide by
instead; this is the closest well-defined quantity available without adding
a segmentation stage.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import tensorflow as tf

DEFAULT_LAST_CONV_LAYER = "top_activation"
DEFAULT_SV_THRESHOLD = 0.5


@dataclass
class GradCAMResult:
    heatmap: np.ndarray  # float32, normalized 0-1, resized to the classifier's input resolution
    severity_score: float  # Sv, in [0, 1]


def compute_gradcam(
    model: tf.keras.Model,
    input_batch: tf.Tensor,
    class_index: int,
    last_conv_layer_name: str = DEFAULT_LAST_CONV_LAYER,
) -> np.ndarray:
    """Standard Grad-CAM (Selvaraju et al., 2017): weight the last conv layer's
    feature maps by the gradient of the target class score w.r.t. each channel,
    then ReLU and normalize. Returns a heatmap at the conv layer's native
    (low) spatial resolution, values in [0, 1].
    """
    grad_model = tf.keras.models.Model(
        inputs=model.inputs,
        outputs=[model.get_layer(last_conv_layer_name).output, model.output],
    )
    with tf.GradientTape() as tape:
        conv_output, predictions = grad_model(input_batch, training=False)
        class_score = predictions[:, class_index]

    grads = tape.gradient(class_score, conv_output)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    conv_output = conv_output[0]
    heatmap = tf.reduce_sum(conv_output * pooled_grads, axis=-1)
    heatmap = tf.maximum(heatmap, 0)  # ReLU -- only positive influence on the target class
    max_value = tf.reduce_max(heatmap)
    if max_value > 0:
        heatmap = heatmap / max_value
    return heatmap.numpy()


def compute_severity_score(heatmap: np.ndarray, threshold: float = DEFAULT_SV_THRESHOLD) -> float:
    """Sv = fraction of heatmap pixels at or above `threshold`. See module
    docstring for what "pixels" means here in the absence of a leaf mask."""
    return float(np.count_nonzero(heatmap >= threshold)) / heatmap.size


def run_gradcam(
    model: tf.keras.Model,
    input_batch: tf.Tensor,
    class_index: int,
    output_size: tuple[int, int],
    last_conv_layer_name: str = DEFAULT_LAST_CONV_LAYER,
    threshold: float = DEFAULT_SV_THRESHOLD,
) -> GradCAMResult:
    """Computes the Grad-CAM heatmap, upsamples it to `output_size` (the
    classifier's input resolution, e.g. (384, 384)) so severity is measured
    in the same pixel grid the model actually classified, and derives Sv."""
    raw_heatmap = compute_gradcam(model, input_batch, class_index, last_conv_layer_name)
    resized = tf.image.resize(raw_heatmap[..., tf.newaxis], output_size, method="bilinear")
    heatmap = tf.squeeze(resized, axis=-1).numpy()
    severity_score = compute_severity_score(heatmap, threshold)
    return GradCAMResult(heatmap=heatmap, severity_score=severity_score)

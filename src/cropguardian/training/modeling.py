"""EfficientNetB0 transfer learning model definition for CropGuardian AI."""

from __future__ import annotations

from pathlib import Path

import tensorflow as tf
from tensorflow.keras import layers
from tensorflow.keras.applications import EfficientNetB0
from tensorflow.keras.models import Model


def enable_mixed_precision() -> None:
    """Enable mixed precision when a GPU is available."""
    try:
        if tf.config.list_physical_devices("GPU"):
            tf.keras.mixed_precision.set_global_policy("mixed_float16")
    except Exception:
        pass


def build_model(
    input_shape: tuple[int, int, int] = (224, 224, 3),
    num_classes: int = 10,
    dropout_rate: float = 0.3,
    trainable_backbone: bool = False,
    learning_rate: float = 1e-3,
    base_model: Model | None = None,
    loss: str | tf.keras.losses.Loss = "sparse_categorical_crossentropy",
) -> Model:
    """Build a transfer-learning EfficientNetB0 classification model.

    Args:
        base_model: Optional pretrained EfficientNetB0 backbone to reuse (e.g. one
            extracted from a previously trained checkpoint via
            `load_backbone_from_checkpoint`). When omitted, a fresh backbone is
            initialized from ImageNet weights.
        loss: Any Keras-compatible loss for sparse integer labels (name or
            `tf.keras.losses.Loss` instance), e.g. from
            `cropguardian.training.losses.build_loss`. This function has no
            opinion on loss selection -- that's config-driven, upstream.
    """
    if base_model is None:
        base_model = EfficientNetB0(
            include_top=False,
            weights="imagenet",
            input_shape=input_shape,
            pooling=None,
            name="efficientnetb0",
        )
    base_model.trainable = trainable_backbone

    inputs = layers.Input(shape=input_shape, name="image_input")
    x = base_model(inputs, training=False)
    x = layers.GlobalAveragePooling2D(name="gap")(x)
    x = layers.Dropout(dropout_rate, name="dropout")(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="classifier")(x)

    model = Model(inputs, outputs, name="cropguardian_efficientnetb0")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss=loss,
        metrics=["accuracy"],
    )
    return model


def build_fine_tune_model(
    model: Model,
    unfreeze_layers: int = 20,
    learning_rate: float = 1e-5,
    loss: str | tf.keras.losses.Loss = "sparse_categorical_crossentropy",
) -> Model:
    """Prepare the model for fine-tuning by unfreezing the upper EfficientNet layers."""
    base_model = model.get_layer("efficientnetb0")
    base_model.trainable = True

    for layer in base_model.layers[:-unfreeze_layers]:
        layer.trainable = False
    for layer in base_model.layers[-unfreeze_layers:]:
        layer.trainable = True

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss=loss,
        metrics=["accuracy"],
    )
    return model


def load_backbone_from_checkpoint(checkpoint_path: str | Path) -> Model:
    """Load a previously trained CropGuardian model and return its EfficientNetB0 backbone.

    This is the mechanism that lets a later training stage continue from a
    prior stage's learned weights instead of reinitializing from ImageNet.
    """
    checkpoint_path = Path(checkpoint_path)
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    source_model = tf.keras.models.load_model(checkpoint_path)
    return source_model.get_layer("efficientnetb0")

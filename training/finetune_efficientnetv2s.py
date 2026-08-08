#!/usr/bin/env python3
"""Stage-2 fine-tune of the EfficientNetV2-S / PlantVillage-tomato head model.

Starts from artifacts/cropguardian_v2s_best.keras (the frozen-backbone head
trained by train_efficientnetv2s.py, ~98% val_accuracy) and unfreezes only
the last few block6 repeat units plus the top conv, at a much lower learning
rate. Everything is written to separate cropguardian_v2s_finetune_* files so
the stage-1 checkpoint is never overwritten -- if fine-tuning fails to beat
it, the original 98% model is still intact.

Run training/train_efficientnetv2s.py to completion first.

Usage:
    python3 training/finetune_efficientnetv2s.py
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from sklearn.metrics import ConfusionMatrixDisplay, classification_report, confusion_matrix, f1_score

SEED = 42
tf.keras.utils.set_random_seed(SEED)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_ROOT / "datasets" / "plantvillage_tomato"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

IMG_SIZE = 384
BATCH_SIZE = 32
NUM_CLASSES = 10
EPOCHS = 20
FINETUNE_LR = 1e-5

# Only the deepest, most task-specific repeat units are unfrozen -- unfreezing
# the full 512-layer backbone on CPU would multiply epoch time and risks
# destroying the pretrained weights given only ~12.8k training images.
UNFREEZE_PREFIXES = ("block6l", "block6m", "block6n", "block6o", "top_conv", "top_bn", "top_activation")

# ---------------------------------------------------------------------------
# Dataset (identical pipeline to stage 1, for a fair comparison)
# ---------------------------------------------------------------------------

train_ds = tf.keras.utils.image_dataset_from_directory(
    DATA_ROOT / "train",
    image_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    label_mode="categorical",
    shuffle=True,
    seed=SEED,
)
val_ds = tf.keras.utils.image_dataset_from_directory(
    DATA_ROOT / "val",
    image_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    label_mode="categorical",
    shuffle=False,
    seed=SEED,
)
test_ds = tf.keras.utils.image_dataset_from_directory(
    DATA_ROOT / "test",
    image_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    label_mode="categorical",
    shuffle=False,
    seed=SEED,
)

CLASS_NAMES = train_ds.class_names
assert len(CLASS_NAMES) == NUM_CLASSES, f"Expected {NUM_CLASSES} classes, found {len(CLASS_NAMES)}: {CLASS_NAMES}"

preprocess = tf.keras.applications.efficientnet_v2.preprocess_input
train_ds = train_ds.map(lambda x, y: (preprocess(x), y))
val_ds = val_ds.map(lambda x, y: (preprocess(x), y))
test_ds = test_ds.map(lambda x, y: (preprocess(x), y))

data_augmentation = tf.keras.Sequential(
    [
        tf.keras.layers.RandomFlip("horizontal_and_vertical"),
        tf.keras.layers.RandomRotation(0.3),
        tf.keras.layers.RandomZoom(0.2),
        tf.keras.layers.RandomContrast(0.2),
    ]
)
train_ds = train_ds.map(lambda x, y: (data_augmentation(x, training=True), y))

AUTOTUNE = tf.data.AUTOTUNE
train_ds = train_ds.prefetch(AUTOTUNE)
val_ds = val_ds.prefetch(AUTOTUNE)
test_ds = test_ds.prefetch(AUTOTUNE)

# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

STAGE1_BEST_MODEL_PATH = ARTIFACTS_DIR / "cropguardian_v2s_best.keras"
BEST_MODEL_PATH = ARTIFACTS_DIR / "cropguardian_v2s_finetune_best.keras"
FINAL_MODEL_PATH = ARTIFACTS_DIR / "cropguardian_v2s_finetune_final.keras"
EPOCH_STATE_PATH = ARTIFACTS_DIR / "cropguardian_v2s_finetune_state.json"

initial_epoch = 0
if EPOCH_STATE_PATH.exists():
    initial_epoch = json.loads(EPOCH_STATE_PATH.read_text())["last_completed_epoch"]
    print(f"Resuming fine-tune from epoch {initial_epoch} (from {EPOCH_STATE_PATH})")

# A resumed fine-tune run continues from its own checkpoint (which already
# has the unfrozen layers and low-LR optimizer); a fresh run starts from the
# stage-1 head-only checkpoint and applies the unfreeze below.
if BEST_MODEL_PATH.exists():
    print(f"Resuming from existing fine-tune checkpoint: {BEST_MODEL_PATH}")
    model = tf.keras.models.load_model(BEST_MODEL_PATH)
else:
    if not STAGE1_BEST_MODEL_PATH.exists():
        raise FileNotFoundError(f"Stage-1 checkpoint not found at {STAGE1_BEST_MODEL_PATH}; run train_efficientnetv2s.py first.")
    print(f"Starting fine-tune from stage-1 checkpoint: {STAGE1_BEST_MODEL_PATH}")
    model = tf.keras.models.load_model(STAGE1_BEST_MODEL_PATH)

    for layer in model.layers:
        if layer.name.startswith(UNFREEZE_PREFIXES):
            # BatchNorm running stats are unreliable to re-estimate at batch
            # size 32 -- kept frozen even inside the unfrozen block range.
            layer.trainable = not isinstance(layer, tf.keras.layers.BatchNormalization)

unfrozen = [l.name for l in model.layers if l.trainable]
print(f"Trainable layers ({len(unfrozen)}): {unfrozen}")

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=FINETUNE_LR),
    loss="categorical_crossentropy",
    metrics=["accuracy"],
)

initial_value_threshold = model.evaluate(val_ds, verbose=0)[1]
print(f"Starting val_accuracy: {initial_value_threshold:.4f}")

# ---------------------------------------------------------------------------
# Callbacks
# ---------------------------------------------------------------------------

callbacks = [
    tf.keras.callbacks.ModelCheckpoint(
        str(BEST_MODEL_PATH),
        monitor="val_accuracy",
        save_best_only=True,
        mode="max",
        verbose=1,
        initial_value_threshold=initial_value_threshold,
    ),
    tf.keras.callbacks.EarlyStopping(
        monitor="val_accuracy",
        patience=8,
        restore_best_weights=True,
        verbose=1,
    ),
    tf.keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=4,
        min_lr=1e-7,
        verbose=1,
    ),
    tf.keras.callbacks.LambdaCallback(
        on_epoch_end=lambda epoch, logs: EPOCH_STATE_PATH.write_text(
            json.dumps({"last_completed_epoch": epoch + 1})
        )
    ),
]

# ---------------------------------------------------------------------------
# Train
# ---------------------------------------------------------------------------


def main() -> None:
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        initial_epoch=initial_epoch,
        epochs=EPOCHS,
        callbacks=callbacks,
    )

    model.save(FINAL_MODEL_PATH)
    print(f"Saved final model to {FINAL_MODEL_PATH}")
    print(f"Best checkpoint at {BEST_MODEL_PATH}")

    evaluate(history)


def evaluate(history) -> None:
    predictions = model.predict(test_ds)
    y_pred = predictions.argmax(axis=1)
    y_true = tf.concat([y for _, y in test_ds], axis=0).numpy().argmax(axis=1)

    report_text = classification_report(y_true, y_pred, target_names=CLASS_NAMES)
    print(report_text)
    (ARTIFACTS_DIR / "cropguardian_v2s_finetune_classification_report.txt").write_text(report_text)

    report_dict = classification_report(y_true, y_pred, target_names=CLASS_NAMES, output_dict=True)
    weighted_f1 = report_dict["weighted avg"]["f1-score"]
    macro_f1 = report_dict["macro avg"]["f1-score"]
    test_accuracy = report_dict["accuracy"]
    print(f"Test accuracy: {test_accuracy:.4f}")
    print(f"Weighted F1: {weighted_f1:.4f}")
    print(f"Macro F1: {macro_f1:.4f}")

    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(10, 9))
    ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=CLASS_NAMES).plot(
        ax=ax, xticks_rotation=45, cmap="Blues", colorbar=True
    )
    fig.tight_layout()
    fig.savefig(ARTIFACTS_DIR / "confusion_matrix_finetune.png", dpi=150)
    plt.close(fig)
    print(f"Saved confusion matrix to {ARTIFACTS_DIR / 'confusion_matrix_finetune.png'}")


if __name__ == "__main__":
    main()

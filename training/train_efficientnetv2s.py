#!/usr/bin/env python3
"""Standalone EfficientNetV2-S / PlantVillage-tomato experiment.

This is a deliberately isolated, one-off script -- it does not use or
modify src/cropguardian/training/ (EfficientNetB0), configs/, or any
existing checkpoint. It is a new, additional experiment, not a
replacement: every prior experiment (plantvillage, tomato_village,
cropguardian_v1, cropguardian_direct, cropguardian_headonly) remains
exactly as it was and stays runnable through the existing pipeline.

Run training/prepare_plantvillage_split.py first to create
datasets/plantvillage_tomato/{train,val,test}/.

Usage:
    python3 training/train_efficientnetv2s.py
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
EPOCHS = 50

# ---------------------------------------------------------------------------
# Dataset
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

# class_names is taken from the dataset object itself (correct,
# alphabetically-sorted order that label indices actually use) rather than a
# hand-maintained list, which would silently mislabel evaluation output if
# it ever drifted out of sync with the folder-name sort order.
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

BEST_MODEL_PATH = ARTIFACTS_DIR / "cropguardian_v2s_best.keras"
FINAL_MODEL_PATH = ARTIFACTS_DIR / "cropguardian_v2s_final.keras"
EPOCH_STATE_PATH = ARTIFACTS_DIR / "cropguardian_v2s_state.json"

# Resume support: if a best checkpoint from a previous (possibly interrupted)
# run exists, continue from it -- weights, optimizer state, and compile
# config are all preserved in the .keras format -- instead of rebuilding
# from ImageNet weights and losing prior progress.
#
# initial_epoch tracks how many epochs actually ran, so a resumed run keeps
# counting from there (correct progress display, correct EPOCHS budget)
# instead of restarting the epoch counter at 0. EPOCH_STATE_PATH is written
# by EpochStateCallback below after every epoch; the interrupted run that
# produced the current BEST_MODEL_PATH predates that callback, so its known
# stopping point (epoch 10) is used as a one-time fallback.
initial_value_threshold = None
initial_epoch = 0
if EPOCH_STATE_PATH.exists():
    initial_epoch = json.loads(EPOCH_STATE_PATH.read_text())["last_completed_epoch"]
    print(f"Resuming from epoch {initial_epoch} (from {EPOCH_STATE_PATH})")
elif BEST_MODEL_PATH.exists():
    initial_epoch = 10
    print(f"No epoch state file found; resuming from known interruption point: epoch {initial_epoch}")

if BEST_MODEL_PATH.exists():
    print(f"Resuming from existing checkpoint: {BEST_MODEL_PATH}")
    model = tf.keras.models.load_model(BEST_MODEL_PATH)
    initial_value_threshold = model.evaluate(val_ds, verbose=0)[1]
    print(f"Resumed model val_accuracy: {initial_value_threshold:.4f}")
else:
    base_model = tf.keras.applications.EfficientNetV2S(
        include_top=False,
        weights="imagenet",
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        pooling=None,
    )
    base_model.trainable = False  # frozen backbone -- the primary configuration for this experiment

    x = base_model.output
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    x = tf.keras.layers.Dense(256, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(NUM_CLASSES, activation="softmax")(x)

    model = tf.keras.Model(inputs=base_model.input, outputs=outputs)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

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
        # Seeded from the resumed model's own val_accuracy so the first
        # epoch of a resumed run can't overwrite a better prior checkpoint
        # just because ModelCheckpoint's in-memory "best" starts at -inf.
        initial_value_threshold=initial_value_threshold,
    ),
    tf.keras.callbacks.EarlyStopping(
        monitor="val_accuracy",
        patience=10,
        restore_best_weights=True,
        verbose=1,
    ),
    tf.keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=5,
        min_lr=1e-6,
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
    (ARTIFACTS_DIR / "cropguardian_v2s_classification_report.txt").write_text(report_text)

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
    fig.savefig(ARTIFACTS_DIR / "confusion_matrix.png", dpi=150)
    plt.close(fig)
    print(f"Saved confusion matrix to {ARTIFACTS_DIR / 'confusion_matrix.png'}")


if __name__ == "__main__":
    main()

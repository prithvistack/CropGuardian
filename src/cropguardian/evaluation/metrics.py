"""Evaluation metrics utilities for CropGuardian AI."""

from __future__ import annotations

from typing import Any

import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix, f1_score, precision_score, recall_score


def compute_metrics(y_true: Any, y_pred: Any) -> dict[str, Any]:
    """Compute classification metrics for the held-out test set."""
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)

    return {
        "accuracy": float(tf.keras.metrics.Accuracy()(y_true, y_pred).numpy()),
        "precision": float(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
        "f1_score": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
        "classification_report": classification_report(y_true, y_pred, output_dict=True),
    }

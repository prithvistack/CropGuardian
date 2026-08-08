"""Dataset splitting utilities for CropGuardian AI."""

from __future__ import annotations

import random
from typing import Any


def split_records(
    records: list[dict[str, Any]],
    train_ratio: float = 0.8,
    val_ratio: float = 0.1,
    test_ratio: float = 0.1,
    seed: int | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Split a list of records into train/validation/test sets.

    The split is deterministic when a seed is provided.
    """
    if not 0.0 < train_ratio < 1.0:
        raise ValueError("train_ratio must be between 0 and 1")
    if not 0.0 < val_ratio < 1.0:
        raise ValueError("val_ratio must be between 0 and 1")
    if not 0.0 < test_ratio < 1.0:
        raise ValueError("test_ratio must be between 0 and 1")

    if abs((train_ratio + val_ratio + test_ratio) - 1.0) > 1e-9:
        raise ValueError("train_ratio + val_ratio + test_ratio must equal 1")

    shuffled = list(records)
    if seed is not None:
        random.Random(seed).shuffle(shuffled)
    else:
        random.shuffle(shuffled)

    total = len(shuffled)
    train_end = int(total * train_ratio)
    val_end = train_end + int(total * val_ratio)

    return {
        "train": shuffled[:train_end],
        "val": shuffled[train_end:val_end],
        "test": shuffled[val_end:],
    }


def split_train_val(
    records: list[dict[str, Any]],
    val_ratio: float = 0.15,
    seed: int | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Carve a validation set out of a records list, leaving the remainder as train.

    Used for datasets that ship with a predefined train/test split but no
    separate validation set.
    """
    if not 0.0 < val_ratio < 1.0:
        raise ValueError("val_ratio must be between 0 and 1")

    shuffled = list(records)
    if seed is not None:
        random.Random(seed).shuffle(shuffled)
    else:
        random.shuffle(shuffled)

    val_end = int(len(shuffled) * val_ratio)

    return {
        "val": shuffled[:val_end],
        "train": shuffled[val_end:],
    }

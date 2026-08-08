"""Dataset loading utilities for CropGuardian AI."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .validation import discover_dataset_files


class DatasetLoader:
    """Simple dataset loader abstraction for future pipeline stages."""

    def __init__(self, dataset_root: str | Path):
        self.dataset_root = Path(dataset_root)

    def load(self) -> list[dict[str, Any]]:
        """Load dataset records from a flat `dataset_root/class_name/file.jpg` layout."""
        return discover_dataset_files(self.dataset_root)

    def load_predefined_splits(
        self, train_dir: str = "train", test_dir: str = "test", val_dir: str | None = None
    ) -> dict[str, list[dict[str, Any]]]:
        """Load records from a dataset that ships with predefined split directories.

        Expected structure: dataset_root/{train_dir,test_dir[,val_dir]}/class_name/file.jpg

        `val_dir` is optional. Pass it for datasets that ship a native
        train/val/test split; omit it for datasets that only ship train/test
        directories, in which case the caller is expected to carve a
        validation set out of the `train` records itself.
        """
        splits = {
            "train": discover_dataset_files(self.dataset_root / train_dir),
            "test": discover_dataset_files(self.dataset_root / test_dir),
        }
        if val_dir is not None:
            splits["val"] = discover_dataset_files(self.dataset_root / val_dir)
        return splits

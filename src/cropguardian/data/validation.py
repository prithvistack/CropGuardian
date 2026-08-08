"""Dataset validation utilities for CropGuardian AI."""

from __future__ import annotations

from pathlib import Path
from typing import Any

SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}


def discover_dataset_files(dataset_root: str | Path) -> list[dict[str, Any]]:
    """Discover labeled image files in a dataset directory.

    Expected structure: dataset_root/class_name/file.jpg
    """
    dataset_path = Path(dataset_root)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset root does not exist: {dataset_path}")

    records: list[dict[str, Any]] = []
    for class_dir in sorted(dataset_path.iterdir()):
        if not class_dir.is_dir():
            continue

        for image_path in sorted(class_dir.iterdir()):
            if image_path.is_file() and image_path.suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS:
                records.append(
                    {
                        "image_path": str(image_path),
                        "label": class_dir.name,
                        "class_dir": class_dir.name,
                    }
                )

    return records


def validate_dataset_structure(
    dataset_root: str | Path,
    expected_classes: list[str] | None = None,
) -> dict[str, Any]:
    """Validate that a dataset root contains expected class directories and files."""
    dataset_path = Path(dataset_root)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset root does not exist: {dataset_path}")

    class_dirs = sorted(path.name for path in dataset_path.iterdir() if path.is_dir())
    if not class_dirs:
        raise ValueError(f"No class directories were found under {dataset_path}")

    if expected_classes is not None:
        missing = [name for name in expected_classes if name not in class_dirs]
        if missing:
            raise ValueError(f"Missing expected classes: {missing}")

    records = discover_dataset_files(dataset_path)
    summary = {
        "dataset_root": str(dataset_path),
        "class_count": len(class_dirs),
        "image_count": len(records),
        "classes": class_dirs,
    }
    return summary

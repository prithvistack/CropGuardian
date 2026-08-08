from pathlib import Path

import pytest

from src.cropguardian.data.validation import (
    discover_dataset_files,
    validate_dataset_structure,
)


def _create_image_file(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"fake-image-content")


def test_validate_dataset_structure_accepts_expected_classes(tmp_path: Path) -> None:
    dataset_root = tmp_path / "dataset"
    _create_image_file(dataset_root / "healthy" / "img1.jpg")
    _create_image_file(dataset_root / "early_blight" / "img2.jpg")

    summary = validate_dataset_structure(
        dataset_root,
        expected_classes=["healthy", "early_blight"],
    )

    assert summary["dataset_root"] == str(dataset_root)
    assert summary["class_count"] == 2
    assert summary["image_count"] == 2
    assert summary["classes"] == ["early_blight", "healthy"]


def test_validate_dataset_structure_raises_for_missing_class(tmp_path: Path) -> None:
    dataset_root = tmp_path / "dataset"
    _create_image_file(dataset_root / "healthy" / "img1.jpg")

    with pytest.raises(ValueError):
        validate_dataset_structure(dataset_root, expected_classes=["healthy", "late_blight"])


def test_discover_dataset_files_returns_labelled_records(tmp_path: Path) -> None:
    dataset_root = tmp_path / "dataset"
    _create_image_file(dataset_root / "healthy" / "img1.jpg")
    _create_image_file(dataset_root / "healthy" / "img2.png")

    records = discover_dataset_files(dataset_root)

    assert len(records) == 2
    assert records[0]["label"] == "healthy"
    assert records[0]["image_path"].endswith((".jpg", ".png"))

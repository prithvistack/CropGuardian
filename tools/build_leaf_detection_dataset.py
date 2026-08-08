#!/usr/bin/env python3
"""Builds the tomato-leaf detection dataset for training/train_yolov8_leaf_detector.py
from the PlantDoc Object Detection Dataset
(github.com/pratikkayal/PlantDoc-Object-Detection-Dataset, cloned into
datasets/raw/PlantDoc-Object-Detection-Dataset/).

Filters to tomato classes only (all 9: healthy "Tomato leaf" plus 8
disease/pest variants), discards the disease label -- single class
"tomato_leaf", index 0, since disease classification happens downstream in
the EfficientNetV2 stage -- converts the pixel-coordinate boxes from
train_labels.csv/test_labels.csv to normalized YOLO format, and writes a
fresh 80:10:10 train/val/test split into datasets/tomato_leaf_detection/
(pooling PlantDoc's own train+test images before resplitting, since its
built-in split isn't sized for our purposes).

Every source filename is prefixed with its PlantDoc origin (pd_train_ /
pd_test_) because a handful of basenames are reused across PlantDoc's TRAIN
and TEST folders for unrelated images -- without the prefix, two different
photos could collide and overwrite each other once flattened into one of
our own train/val/test folders.

Two source images were found corrupted on disk by this repo's
case-insensitive filesystem colliding two differently-cased PlantDoc
filenames during checkout (early-blight-...-BY9J8R.jpg and
LateBlightLeaf.jpg both got the wrong potato photo instead of their real
tomato one) -- both were manually recovered from the git object store
before this script existed; nothing left to do about it here.

Usage:
    python3 tools/build_leaf_detection_dataset.py
"""

from __future__ import annotations

import csv
import random
import shutil
from collections import defaultdict
from pathlib import Path

import yaml
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PROJECT_ROOT / "datasets" / "raw" / "PlantDoc-Object-Detection-Dataset"
OUTPUT_ROOT = PROJECT_ROOT / "datasets" / "tomato_leaf_detection"
DATA_YAML_PATH = PROJECT_ROOT / "configs" / "yolo_leaf_detection.yaml"

SEED = 42
SPLIT_RATIOS = {"train": 0.8, "val": 0.1, "test": 0.1}
CLASS_NAMES = ["tomato_leaf"]

SOURCES = [
    ("pd_train_", SOURCE_ROOT / "train_labels.csv", SOURCE_ROOT / "TRAIN"),
    ("pd_test_", SOURCE_ROOT / "test_labels.csv", SOURCE_ROOT / "TEST"),
]


def load_tomato_boxes() -> dict[Path, list[tuple[float, float, float, float]]]:
    """Reads both CSVs, keeps only rows whose class starts with "Tomato", and
    returns {source image path: [(xmin, ymin, xmax, ymax), ...]} in pixel coords,
    with the origin-prefixed name baked into the dict via a renamed Path below."""
    boxes_by_image: dict[Path, list[tuple[float, float, float, float]]] = defaultdict(list)
    for prefix, csv_path, image_dir in SOURCES:
        with csv_path.open(newline="") as f:
            for row in csv.DictReader(f):
                if not row["class"].strip().lower().startswith("tomato"):
                    continue
                source_path = image_dir / row["filename"]
                renamed_path = source_path.with_name(prefix + source_path.name)
                boxes_by_image[renamed_path].append(
                    (float(row["xmin"]), float(row["ymin"]), float(row["xmax"]), float(row["ymax"]))
                )
    return boxes_by_image


def to_yolo_lines(source_path: Path, boxes: list[tuple[float, float, float, float]]) -> list[str] | None:
    try:
        with Image.open(source_path) as im:
            width, height = im.size
    except (FileNotFoundError, OSError) as e:
        print(f"  skipping {source_path.name}: {e}")
        return None

    lines = []
    for xmin, ymin, xmax, ymax in boxes:
        xmin, xmax = sorted((max(0.0, min(xmin, width)), max(0.0, min(xmax, width))))
        ymin, ymax = sorted((max(0.0, min(ymin, height)), max(0.0, min(ymax, height))))
        if xmax - xmin < 1 or ymax - ymin < 1:
            continue  # degenerate box after clipping to image bounds
        cx = ((xmin + xmax) / 2) / width
        cy = ((ymin + ymax) / 2) / height
        w = (xmax - xmin) / width
        h = (ymax - ymin) / height
        lines.append(f"0 {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
    return lines or None


def split_images(renamed_paths: list[Path]) -> dict[str, list[Path]]:
    shuffled = renamed_paths[:]
    random.Random(SEED).shuffle(shuffled)
    n = len(shuffled)
    n_train = round(n * SPLIT_RATIOS["train"])
    n_val = round(n * SPLIT_RATIOS["val"])
    return {
        "train": shuffled[:n_train],
        "val": shuffled[n_train : n_train + n_val],
        "test": shuffled[n_train + n_val :],
    }


def write_data_yaml() -> None:
    DATA_YAML_PATH.write_text(
        yaml.safe_dump(
            {
                "path": str(OUTPUT_ROOT),
                "train": "images/train",
                "val": "images/val",
                "test": "images/test",
                "nc": len(CLASS_NAMES),
                "names": CLASS_NAMES,
            },
            sort_keys=False,
        )
    )


def main() -> None:
    def source_path_for(renamed: Path) -> Path:
        for prefix, _, image_dir in SOURCES:
            if renamed.name.startswith(prefix):
                return image_dir / renamed.name[len(prefix) :]
        raise ValueError(f"Unrecognized prefix on {renamed}")

    boxes_by_image = load_tomato_boxes()
    total_boxes = sum(len(v) for v in boxes_by_image.values())
    print(f"Found {len(boxes_by_image)} tomato-labeled images across {total_boxes} boxes")

    valid_images: dict[Path, list[str]] = {}
    for renamed_path, boxes in boxes_by_image.items():
        lines = to_yolo_lines(source_path_for(renamed_path), boxes)
        if lines:
            valid_images[renamed_path] = lines
    skipped = len(boxes_by_image) - len(valid_images)
    print(f"{len(valid_images)} images usable ({skipped} skipped: missing file or all boxes degenerate)")

    for split in ("train", "val", "test"):
        images_dir = OUTPUT_ROOT / "images" / split
        labels_dir = OUTPUT_ROOT / "labels" / split
        images_dir.mkdir(parents=True, exist_ok=True)
        labels_dir.mkdir(parents=True, exist_ok=True)
        for old in list(images_dir.glob("*")) + list(labels_dir.glob("*")):
            old.unlink()

    splits = split_images(list(valid_images.keys()))
    for split, renamed_paths in splits.items():
        for renamed_path in renamed_paths:
            shutil.copy2(source_path_for(renamed_path), OUTPUT_ROOT / "images" / split / renamed_path.name)
            label_path = OUTPUT_ROOT / "labels" / split / (renamed_path.stem + ".txt")
            label_path.write_text("\n".join(valid_images[renamed_path]) + "\n")
        print(f"{split}: {len(renamed_paths)} images")

    write_data_yaml()
    print(f"Wrote {DATA_YAML_PATH}")


if __name__ == "__main__":
    main()

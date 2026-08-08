#!/usr/bin/env python3
"""One-off prep step for the EfficientNetV2-S / PlantVillage experiment
(see Master Migration Prompt, Section 3.1).

Copies the existing PlantVillage tomato classes from
datasets/raw/plant_village_zip/PlantVillage/ (source, never modified) into
an 80/10/10 train/val/test split under datasets/plantvillage_tomato/, with
a fixed seed for reproducibility. This is a standalone script for this one
experiment -- it does not touch configs/, does not use the generic
TrainingPipeline/dataset_builder tooling the rest of the project uses, and
does not modify or move anything under datasets/raw/.

The prompt's own spec says to download PlantVillage from Kaggle/GitHub;
that's skipped here since the exact same data already exists locally at
datasets/raw/plant_village_zip/PlantVillage/ -- re-downloading would just
duplicate it.

Usage:
    python3 training/prepare_plantvillage_split.py
"""

from __future__ import annotations

import random
import shutil
from pathlib import Path

SEED = 42
SPLIT_RATIOS = {"train": 0.8, "val": 0.1, "test": 0.1}

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PROJECT_ROOT / "datasets" / "raw" / "plant_village_zip" / "PlantVillage"
OUTPUT_ROOT = PROJECT_ROOT / "datasets" / "plantvillage_tomato"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def main() -> None:
    if not SOURCE_ROOT.exists():
        raise FileNotFoundError(f"Source PlantVillage folder not found: {SOURCE_ROOT}")

    class_dirs = sorted(p for p in SOURCE_ROOT.iterdir() if p.is_dir())
    print(f"Found {len(class_dirs)} classes under {SOURCE_ROOT}")

    rng = random.Random(SEED)
    total_counts = {"train": 0, "val": 0, "test": 0}

    for class_dir in class_dirs:
        images = sorted(p for p in class_dir.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS)
        shuffled = images[:]
        rng.shuffle(shuffled)

        n = len(shuffled)
        train_end = int(n * SPLIT_RATIOS["train"])
        val_end = train_end + int(n * SPLIT_RATIOS["val"])
        splits = {
            "train": shuffled[:train_end],
            "val": shuffled[train_end:val_end],
            "test": shuffled[val_end:],
        }

        for split_name, files in splits.items():
            dest_dir = OUTPUT_ROOT / split_name / class_dir.name
            dest_dir.mkdir(parents=True, exist_ok=True)
            for src_path in files:
                shutil.copy2(src_path, dest_dir / src_path.name)
            total_counts[split_name] += len(files)

        print(f"  {class_dir.name}: {n} -> train={len(splits['train'])} val={len(splits['val'])} test={len(splits['test'])}")

    print()
    print(f"Total: train={total_counts['train']} val={total_counts['val']} test={total_counts['test']}")
    print(f"Written to {OUTPUT_ROOT}")
    print(f"Source untouched: {SOURCE_ROOT}")


if __name__ == "__main__":
    main()

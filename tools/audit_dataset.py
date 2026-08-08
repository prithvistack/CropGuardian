#!/usr/bin/env python3
"""Read-only readiness audit for a built dataset (e.g. CropGuardian-Dataset-v1).

Performs no writes, moves, renames, or deletes anywhere. Validates
structure, per-image integrity (via PIL, and via TensorFlow's
tf.io.decode_image -- the exact decode path the training pipeline uses),
class distribution, cross-split duplication/leakage, label consistency,
metadata consistency, and image characteristics, then writes a single
JSON report for downstream analysis.

Usage:
    python3 tools/audit_dataset.py --dataset datasets/processed/CropGuardian-Dataset-v1
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from PIL import Image, UnidentifiedImageError  # noqa: E402

from src.cropguardian.data.validation import SUPPORTED_IMAGE_EXTENSIONS  # noqa: E402

EXPECTED_SPLITS = {"train", "val", "validation", "test"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", default="datasets/processed/CropGuardian-Dataset-v1")
    parser.add_argument("--report-out", default=None, help="Where to write the JSON audit report")
    args = parser.parse_args()

    dataset_root = Path(args.dataset)
    if not dataset_root.is_absolute():
        dataset_root = PROJECT_ROOT / dataset_root

    report: dict = {"dataset_root": str(dataset_root)}

    report["structure"] = audit_structure(dataset_root)
    split_dirs = report["structure"]["split_dirs_found"]

    all_files = discover_all_images(dataset_root, split_dirs)
    report["discovery"] = {
        "total_image_files_found": len(all_files),
        "non_image_files_found": report["structure"].pop("_non_image_files"),
    }

    integrity, hash_index, resolutions = audit_image_integrity(all_files)
    report["integrity"] = integrity

    report["distribution"] = audit_distribution(all_files, split_dirs)
    report["split_quality"] = audit_split_quality(hash_index, all_files)
    report["characteristics"] = audit_characteristics(resolutions)

    metadata_path = dataset_root / "metadata.csv"
    report["metadata"] = audit_metadata(metadata_path, all_files, dataset_root) if metadata_path.exists() else None

    out_path = Path(args.report_out) if args.report_out else dataset_root / "reports" / "readiness_audit.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, default=str)

    print(f"Audit report written to {out_path}")


# ---------------------------------------------------------------------------
# Structure
# ---------------------------------------------------------------------------

def audit_structure(dataset_root: Path) -> dict:
    result: dict = {"dataset_root_exists": dataset_root.exists()}
    if not dataset_root.exists():
        result["_non_image_files"] = []
        return result

    top_level = sorted(p.name for p in dataset_root.iterdir())
    result["top_level_entries"] = top_level

    split_dirs = [p for p in dataset_root.iterdir() if p.is_dir() and p.name != "reports"]
    result["split_dirs_found"] = sorted(p.name for p in split_dirs)
    result["unexpected_top_level_dirs"] = sorted(
        p.name for p in split_dirs if p.name not in EXPECTED_SPLITS
    )
    result["missing_expected_splits"] = sorted(
        name for name in ("train", "test") if name not in result["split_dirs_found"]
    ) + (["val or validation"] if not ({"val", "validation"} & set(result["split_dirs_found"])) else [])

    classes_per_split: dict[str, list[str]] = {}
    empty_class_dirs: list[str] = []
    non_image_files: list[str] = []
    hidden_files: list[str] = []

    for split_dir in split_dirs:
        class_names = []
        for class_dir in sorted(split_dir.iterdir()):
            if not class_dir.is_dir():
                non_image_files.append(str(class_dir.relative_to(dataset_root)))
                continue
            class_names.append(class_dir.name)
            files = list(class_dir.iterdir())
            if not files:
                empty_class_dirs.append(str(class_dir.relative_to(dataset_root)))
            for f in files:
                if f.is_file() and f.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
                    non_image_files.append(str(f.relative_to(dataset_root)))
                if f.name.startswith(".") or f.name in ("Thumbs.db", "desktop.ini"):
                    hidden_files.append(str(f.relative_to(dataset_root)))
        classes_per_split[split_dir.name] = sorted(class_names)

    result["classes_per_split"] = classes_per_split
    all_class_sets = [set(v) for v in classes_per_split.values()]
    if all_class_sets:
        common = set.intersection(*all_class_sets)
        union = set.union(*all_class_sets)
        result["classes_inconsistent_across_splits"] = sorted(union - common)
    else:
        result["classes_inconsistent_across_splits"] = []
    result["empty_class_dirs"] = empty_class_dirs
    result["hidden_or_system_files"] = hidden_files
    result["_non_image_files"] = non_image_files

    return result


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------

def discover_all_images(dataset_root: Path, split_dirs: list[str]) -> list[dict]:
    records = []
    for split_name in split_dirs:
        split_path = dataset_root / split_name
        if not split_path.is_dir():
            continue
        for class_dir in sorted(split_path.iterdir()):
            if not class_dir.is_dir():
                continue
            for f in sorted(class_dir.iterdir()):
                if f.is_file() and f.suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS:
                    records.append({"split": split_name, "class": class_dir.name, "path": f})
    return records


# ---------------------------------------------------------------------------
# Integrity: PIL full-decode + TensorFlow decode (matches training's actual path)
# ---------------------------------------------------------------------------

def audit_image_integrity(all_files: list[dict]):
    failures: dict[str, list[dict]] = defaultdict(list)
    hash_index: dict[str, list[dict]] = defaultdict(list)
    resolutions: list[dict] = []

    tf_available = True
    try:
        import tensorflow as tf
    except Exception:
        tf_available = False

    tf_decode_failures = []

    for record in all_files:
        path = record["path"]
        try:
            size_bytes = path.stat().st_size
        except OSError as exc:
            failures["unreadable"].append({**_loc(record), "detail": str(exc)})
            continue

        if size_bytes == 0:
            failures["zero_byte"].append(_loc(record))
            continue

        raw_bytes = path.read_bytes()
        file_hash = hashlib.md5(raw_bytes).hexdigest()
        hash_index[file_hash].append(record)

        try:
            with Image.open(path) as img:
                img.load()
                width, height = img.size
                mode = img.mode
                fmt = img.format
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            failures["corrupted_or_unreadable_pil"].append({**_loc(record), "detail": f"{type(exc).__name__}: {exc}"})
            continue

        resolutions.append({**_loc(record), "width": width, "height": height, "mode": mode, "format": fmt})

        if tf_available:
            try:
                image_bytes = tf.io.read_file(str(path))
                decoded = tf.io.decode_image(image_bytes, channels=3, expand_animations=False)
                _ = decoded.shape
            except Exception as exc:  # noqa: BLE001 - auditing arbitrary decode failures
                tf_decode_failures.append({**_loc(record), "detail": f"{type(exc).__name__}: {exc}"})

    failures["tf_decode_incompatible"] = tf_decode_failures

    integrity = {
        "tensorflow_available": tf_available,
        "total_checked": len(all_files),
        "total_passed_pil": len(resolutions),
        "failure_counts": {reason: len(items) for reason, items in failures.items()},
        "failures": {reason: items for reason, items in failures.items()},
    }
    return integrity, hash_index, resolutions


def _loc(record: dict) -> dict:
    return {"split": record["split"], "class": record["class"], "path": str(record["path"])}


# ---------------------------------------------------------------------------
# Distribution
# ---------------------------------------------------------------------------

def audit_distribution(all_files: list[dict], split_dirs: list[str]) -> dict:
    per_split = Counter(r["split"] for r in all_files)
    per_class = Counter(r["class"] for r in all_files)
    per_class_split = Counter((r["class"], r["split"]) for r in all_files)

    result = {
        "total_images": len(all_files),
        "images_per_split": dict(per_split),
        "images_per_class": dict(sorted(per_class.items(), key=lambda kv: -kv[1])),
        "images_per_class_per_split": {
            f"{cls}/{split}": count for (cls, split), count in per_class_split.items()
        },
    }
    if per_class:
        largest_class, largest_count = per_class.most_common(1)[0]
        smallest_class, smallest_count = min(per_class.items(), key=lambda kv: kv[1])
        result["largest_class"] = {"class": largest_class, "count": largest_count}
        result["smallest_class"] = {"class": smallest_class, "count": smallest_count}
        result["imbalance_ratio"] = round(largest_count / smallest_count, 2) if smallest_count else None
        result["classes_under_50_images"] = sorted(cls for cls, count in per_class.items() if count < 50)
        result["classes_under_100_images"] = sorted(cls for cls, count in per_class.items() if count < 100)
    return result


# ---------------------------------------------------------------------------
# Split quality: cross-split exact duplicates == leakage
# ---------------------------------------------------------------------------

def audit_split_quality(hash_index: dict[str, list[dict]], all_files: list[dict]) -> dict:
    cross_split_leaks = []
    within_split_dupes = []
    for file_hash, records in hash_index.items():
        if len(records) < 2:
            continue
        splits_involved = {r["split"] for r in records}
        entry = {
            "hash": file_hash,
            "count": len(records),
            "classes": sorted({r["class"] for r in records}),
            "paths": [str(r["path"]) for r in records],
        }
        if len(splits_involved) > 1:
            entry["splits"] = sorted(splits_involved)
            cross_split_leaks.append(entry)
        else:
            within_split_dupes.append(entry)

    filenames = Counter(r["path"].name for r in all_files)
    ambiguous_filenames = {name: count for name, count in filenames.items() if count > 1}

    return {
        "cross_split_exact_duplicate_groups": len(cross_split_leaks),
        "cross_split_duplicate_details": cross_split_leaks,
        "within_split_exact_duplicate_groups": len(within_split_dupes),
        "duplicate_filenames_across_dataset": len(ambiguous_filenames),
        "duplicate_filename_examples": dict(list(ambiguous_filenames.items())[:20]),
    }


# ---------------------------------------------------------------------------
# Image characteristics
# ---------------------------------------------------------------------------

def audit_characteristics(resolutions: list[dict]) -> dict:
    if not resolutions:
        return {}

    widths = [r["width"] for r in resolutions]
    heights = [r["height"] for r in resolutions]
    aspect_ratios = [r["width"] / r["height"] for r in resolutions]

    portrait = sum(1 for r in resolutions if r["height"] > r["width"])
    landscape = sum(1 for r in resolutions if r["width"] > r["height"])
    square = sum(1 for r in resolutions if r["width"] == r["height"])

    min_res_record = min(resolutions, key=lambda r: r["width"] * r["height"])
    max_res_record = max(resolutions, key=lambda r: r["width"] * r["height"])

    modes = Counter(r["mode"] for r in resolutions)
    formats = Counter(r["format"] for r in resolutions)

    small_but_present = sorted(
        (r for r in resolutions if min(r["width"], r["height"]) < 224),
        key=lambda r: min(r["width"], r["height"]),
    )[:20]

    return {
        "width_min": min(widths),
        "width_max": max(widths),
        "width_avg": round(sum(widths) / len(widths), 1),
        "height_min": min(heights),
        "height_max": max(heights),
        "height_avg": round(sum(heights) / len(heights), 1),
        "aspect_ratio_min": round(min(aspect_ratios), 3),
        "aspect_ratio_max": round(max(aspect_ratios), 3),
        "portrait_count": portrait,
        "landscape_count": landscape,
        "square_count": square,
        "min_resolution_image": {**_loc(min_res_record), "width": min_res_record["width"], "height": min_res_record["height"]},
        "max_resolution_image": {**_loc(max_res_record), "width": max_res_record["width"], "height": max_res_record["height"]},
        "color_modes": dict(modes),
        "file_formats": dict(formats),
        "images_with_a_dimension_under_224px": len(
            [r for r in resolutions if min(r["width"], r["height"]) < 224]
        ),
        "smallest_examples_under_224px": small_but_present,
    }


# ---------------------------------------------------------------------------
# Metadata cross-check
# ---------------------------------------------------------------------------

def audit_metadata(metadata_path: Path, all_files: list[dict], dataset_root: Path) -> dict:
    with metadata_path.open("r", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    metadata_relpaths = {row["new_relative_path"] for row in rows}
    disk_relpaths = {str(r["path"].relative_to(dataset_root)) for r in all_files}

    metadata_missing_on_disk = sorted(metadata_relpaths - disk_relpaths)
    disk_missing_in_metadata = sorted(disk_relpaths - metadata_relpaths)

    filename_mismatches = [
        row["new_relative_path"]
        for row in rows
        if Path(row["new_relative_path"]).name != row["new_filename"]
    ]

    return {
        "metadata_rows": len(rows),
        "images_on_disk": len(all_files),
        "metadata_entries_missing_file_on_disk": metadata_missing_on_disk,
        "disk_files_missing_from_metadata": disk_missing_in_metadata,
        "filename_field_mismatches": filename_mismatches,
    }


if __name__ == "__main__":
    main()

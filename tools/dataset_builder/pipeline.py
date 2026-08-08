"""Orchestrates the full build: scan -> taxonomy -> quality -> dedup -> split -> materialize.

This module contains no dataset-specific logic and no hardcoded paths --
everything it needs comes from a `BuildConfig`. Splitting reuses the
training pipeline's own `split_records` (called once per unified class,
same seed, for stratification) rather than reimplementing split logic.
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass, field
from pathlib import Path

from src.cropguardian.data.splitting import split_records

from .config import BuildConfig
from .quality import (
    DuplicateRemoval,
    QualityFailure,
    QualityPassRecord,
    check_image,
    resolve_exact_duplicates,
    resolve_near_duplicates,
)
from .records import ExclusionEntry, MappedRecord, apply_taxonomy, scan_source


@dataclass
class MaterializedRecord:
    source: str
    source_class: str
    unified_class: str
    original_path: Path
    original_filename: str
    new_filename: str
    new_relative_path: str
    split: str
    width: int
    height: int
    file_hash: str


@dataclass
class BuildReport:
    per_source_raw_counts: dict[str, dict[str, int]] = field(default_factory=dict)
    exclusions: list[ExclusionEntry] = field(default_factory=list)
    quality_failures: list[QualityFailure] = field(default_factory=list)
    duplicate_removals: list[DuplicateRemoval] = field(default_factory=list)
    materialized: list[MaterializedRecord] = field(default_factory=list)


def run_build(config: BuildConfig) -> BuildReport:
    report = BuildReport()

    # ---- Scan + taxonomy mapping ------------------------------------------------
    all_mapped: list[MappedRecord] = []
    for source in config.sources:
        raw_records = scan_source(source)

        raw_counts: dict[str, int] = {}
        for record in raw_records:
            raw_counts[record.source_class] = raw_counts.get(record.source_class, 0) + 1
        report.per_source_raw_counts[source.name] = raw_counts

        mapped, excluded = apply_taxonomy(raw_records, source)
        all_mapped.extend(mapped)
        report.exclusions.extend(excluded)

    # ---- Quality control (corruption, zero-byte, resolution) --------------------
    passed: list[QualityPassRecord] = []
    for record in all_mapped:
        result = check_image(record, config.resolution_min_px)
        if isinstance(result, QualityFailure):
            report.quality_failures.append(result)
        else:
            passed.append(result)

    # ---- Duplicate resolution -----------------------------------------------------
    passed, exact_dup_removals = resolve_exact_duplicates(passed)
    report.duplicate_removals.extend(exact_dup_removals)

    passed, near_dup_removals = resolve_near_duplicates(passed, config.near_duplicate_hamming_threshold)
    report.duplicate_removals.extend(near_dup_removals)

    # ---- Group by unified class for deterministic naming + stratified split -----
    by_class: dict[str, list[QualityPassRecord]] = {}
    for item in passed:
        by_class.setdefault(item.record.unified_class, []).append(item)

    filenames: dict[str, str] = {}  # keyed by original absolute path string
    split_assignment: dict[str, str] = {}

    for unified_class, items in by_class.items():
        items_sorted = sorted(items, key=lambda item: (item.record.source, str(item.record.path)))

        for index, item in enumerate(items_sorted, start=1):
            suffix = item.record.path.suffix.lower()
            filenames[str(item.record.path)] = f"{unified_class}_{index:06d}{suffix}"

        splits = split_records(
            items_sorted,
            train_ratio=config.split_ratios["train"],
            val_ratio=config.split_ratios["val"],
            test_ratio=config.split_ratios["test"],
            seed=config.seed,
        )
        for split_name, split_items in splits.items():
            for item in split_items:
                split_assignment[str(item.record.path)] = split_name

    # ---- Materialize: copy into output_dir/<split>/<class>/<new_name>, never touching sources ----
    for unified_class, items in by_class.items():
        for item in items:
            path_key = str(item.record.path)
            split_name = split_assignment[path_key]
            new_filename = filenames[path_key]

            dest_dir = config.output_dir / split_name / unified_class
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest_path = dest_dir / new_filename
            shutil.copy2(item.record.path, dest_path)

            report.materialized.append(
                MaterializedRecord(
                    source=item.record.source,
                    source_class=item.record.source_class,
                    unified_class=unified_class,
                    original_path=item.record.path,
                    original_filename=item.record.path.name,
                    new_filename=new_filename,
                    new_relative_path=f"{split_name}/{unified_class}/{new_filename}",
                    split=split_name,
                    width=item.width,
                    height=item.height,
                    file_hash=item.file_hash,
                )
            )

    return report

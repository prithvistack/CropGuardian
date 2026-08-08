"""Generate every deliverable report from a completed BuildReport."""

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

from .config import BuildConfig
from .pipeline import BuildReport


def write_all_reports(config: BuildConfig, report: BuildReport) -> None:
    reports_dir = config.output_dir / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    _write_metadata_csv(report, config.output_dir)
    _write_json(report.exclusions, reports_dir / "excluded_files.json", _exclusion_dict)
    _write_json(report.quality_failures, reports_dir / "quality_failures.json", _quality_failure_dict)
    _write_json(report.duplicate_removals, reports_dir / "duplicate_removals.json", _duplicate_removal_dict)

    (reports_dir / "merge_report.md").write_text(_merge_report(config, report), encoding="utf-8")
    (reports_dir / "cleaning_report.md").write_text(_cleaning_report(report), encoding="utf-8")
    (reports_dir / "dataset_statistics.md").write_text(_dataset_statistics(config, report), encoding="utf-8")


# ---------------------------------------------------------------------------
# metadata.csv -- full per-image provenance (requirement 8)
# ---------------------------------------------------------------------------

def _write_metadata_csv(report: BuildReport, output_dir: Path) -> None:
    fieldnames = [
        "source",
        "source_class",
        "unified_class",
        "split",
        "original_path",
        "original_filename",
        "new_filename",
        "new_relative_path",
        "width",
        "height",
        "file_hash",
    ]
    with (output_dir / "metadata.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for record in sorted(report.materialized, key=lambda r: r.new_relative_path):
            writer.writerow(
                {
                    "source": record.source,
                    "source_class": record.source_class,
                    "unified_class": record.unified_class,
                    "split": record.split,
                    "original_path": str(record.original_path),
                    "original_filename": record.original_filename,
                    "new_filename": record.new_filename,
                    "new_relative_path": record.new_relative_path,
                    "width": record.width,
                    "height": record.height,
                    "file_hash": record.file_hash,
                }
            )


def _exclusion_dict(entry) -> dict:
    return {
        "source": entry.source,
        "source_class": entry.source_class,
        "path": str(entry.path),
        "reason": entry.reason,
    }


def _quality_failure_dict(entry) -> dict:
    return {
        "source": entry.record.source,
        "source_class": entry.record.source_class,
        "unified_class": entry.record.unified_class,
        "path": str(entry.record.path),
        "failure_reason": entry.reason,
        "detail": entry.detail,
    }


def _duplicate_removal_dict(entry) -> dict:
    return {
        "source": entry.record.source,
        "source_class": entry.record.source_class,
        "unified_class": entry.record.unified_class,
        "path": str(entry.record.path),
        "removal_reason": entry.reason,
        "detail": entry.detail,
        "group_id": entry.group_id,
    }


def _write_json(items: list, path: Path, to_dict) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump([to_dict(item) for item in items], handle, indent=2)


# ---------------------------------------------------------------------------
# merge_report.md -- taxonomy mapping + exclusions (requirements 2, 3)
# ---------------------------------------------------------------------------

def _merge_report(config: BuildConfig, report: BuildReport) -> str:
    lines = ["# CropGuardian-Dataset-v1 -- Merge Report", ""]

    for source in config.sources:
        raw_counts = report.per_source_raw_counts.get(source.name, {})
        lines.append(f"## Source: `{source.name}`")
        lines.append(f"Root: `{source.root}`")
        lines.append("")
        lines.append("### Included classes (mapped to unified taxonomy)")
        lines.append("")
        lines.append("| Source class | Raw image count | Unified class |")
        lines.append("|---|---:|---|")
        for source_class, unified_class in sorted(source.class_map.items()):
            lines.append(f"| {source_class} | {raw_counts.get(source_class, 0)} | {unified_class} |")
        lines.append("")

        if source.excluded_classes:
            lines.append("### Excluded classes (with reason)")
            lines.append("")
            lines.append("| Source class | Raw image count | Reason |")
            lines.append("|---|---:|---|")
            for source_class, reason in sorted(source.excluded_classes.items()):
                lines.append(f"| {source_class} | {raw_counts.get(source_class, 0)} | {reason} |")
            lines.append("")

    lines.append("## Unified class -> contributing sources")
    lines.append("")
    contributions: dict[str, dict[str, str]] = defaultdict(dict)
    for source in config.sources:
        for source_class, unified_class in source.class_map.items():
            contributions[unified_class][source.name] = source_class
    lines.append("| Unified class | " + " | ".join(source.name for source in config.sources) + " |")
    lines.append("|---|" + "---|" * len(config.sources))
    for unified_class in sorted(contributions):
        row = [contributions[unified_class].get(source.name, "--") for source in config.sources]
        lines.append(f"| {unified_class} | " + " | ".join(row) + " |")
    lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# cleaning_report.md -- everything removed and why (requirements 4, 5, 6)
# ---------------------------------------------------------------------------

def _cleaning_report(report: BuildReport) -> str:
    lines = ["# CropGuardian-Dataset-v1 -- Cleaning Report", ""]

    lines.append("## Quality-control removals (corrupted / unreadable / zero-byte / low-resolution)")
    lines.append("")
    by_reason: dict[str, list] = defaultdict(list)
    for failure in report.quality_failures:
        by_reason[failure.reason].append(failure)
    lines.append("| Reason | Count |")
    lines.append("|---|---:|")
    for reason, items in sorted(by_reason.items()):
        lines.append(f"| {reason} | {len(items)} |")
    lines.append(f"| **Total** | **{len(report.quality_failures)}** |")
    lines.append("")

    lines.append("### By unified class")
    lines.append("")
    by_class = Counter((f.record.unified_class, f.reason) for f in report.quality_failures)
    lines.append("| Unified class | Reason | Count |")
    lines.append("|---|---|---:|")
    for (unified_class, reason), count in sorted(by_class.items()):
        lines.append(f"| {unified_class} | {reason} | {count} |")
    lines.append("")

    lines.append("## Duplicate / conflict removals")
    lines.append("")
    dup_by_reason: dict[str, list] = defaultdict(list)
    for removal in report.duplicate_removals:
        dup_by_reason[removal.reason].append(removal)
    lines.append("| Reason | Count |")
    lines.append("|---|---:|")
    for reason, items in sorted(dup_by_reason.items()):
        lines.append(f"| {reason} | {len(items)} |")
    lines.append(f"| **Total** | **{len(report.duplicate_removals)}** |")
    lines.append("")

    conflicts = dup_by_reason.get("label_conflict", [])
    if conflicts:
        lines.append("### Label-conflict groups (identical image, different labels -- all copies removed)")
        lines.append("")
        by_group: dict[int, list] = defaultdict(list)
        for item in conflicts:
            by_group[item.group_id].append(item)
        lines.append("| Group | Paths | Conflicting classes |")
        lines.append("|---|---|---|")
        for group_id, items in sorted(by_group.items()):
            paths = "<br>".join(str(item.record.path) for item in items)
            classes = sorted({item.record.unified_class for item in items})
            lines.append(f"| {group_id} | {paths} | {', '.join(classes)} |")
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# dataset_statistics.md -- final composition (requirement 11)
# ---------------------------------------------------------------------------

def _dataset_statistics(config: BuildConfig, report: BuildReport) -> str:
    lines = ["# CropGuardian-Dataset-v1 -- Dataset Statistics", ""]

    per_class_total = Counter(r.unified_class for r in report.materialized)
    per_class_split = Counter((r.unified_class, r.split) for r in report.materialized)
    per_class_source = defaultdict(Counter)
    for r in report.materialized:
        per_class_source[r.unified_class][r.source] += 1

    lines.append("## Final images per class (train / val / test / total)")
    lines.append("")
    source_names = [s.name for s in config.sources]
    lines.append("| Class | Train | Val | Test | Total | " + " | ".join(source_names) + " |")
    lines.append("|---|---:|---:|---:|---:|" + "---:|" * len(source_names))
    for unified_class in sorted(per_class_total):
        train = per_class_split.get((unified_class, "train"), 0)
        val = per_class_split.get((unified_class, "val"), 0)
        test = per_class_split.get((unified_class, "test"), 0)
        total = per_class_total[unified_class]
        source_counts = [str(per_class_source[unified_class].get(name, 0)) for name in source_names]
        lines.append(
            f"| {unified_class} | {train} | {val} | {test} | {total} | " + " | ".join(source_counts) + " |"
        )
    total_all = sum(per_class_total.values())
    lines.append(f"| **Total** | {sum(v for (c, s), v in per_class_split.items() if s == 'train')} "
                  f"| {sum(v for (c, s), v in per_class_split.items() if s == 'val')} "
                  f"| {sum(v for (c, s), v in per_class_split.items() if s == 'test')} "
                  f"| **{total_all}** | " + " | ".join("" for _ in source_names) + " |")
    lines.append("")

    if per_class_total:
        largest = max(per_class_total.values())
        smallest = min(per_class_total.values())
        lines.append("## Class balance")
        lines.append("")
        lines.append(f"- Largest class: {largest} images")
        lines.append(f"- Smallest class: {smallest} images")
        lines.append(f"- Imbalance ratio (largest/smallest): {largest / smallest:.2f}x")
        lines.append("")

    lines.append("## Source contribution to final dataset")
    lines.append("")
    source_totals = Counter(r.source for r in report.materialized)
    lines.append("| Source | Images contributed to final dataset |")
    lines.append("|---|---:|")
    for name in source_names:
        lines.append(f"| {name} | {source_totals.get(name, 0)} |")
    lines.append("")

    return "\n".join(lines)

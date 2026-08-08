"""Generic source scanning and taxonomy mapping.

Scanning makes exactly one assumption about every source dataset: an
image's immediate parent directory name is its class label. That holds for
every layout seen so far -- split-then-class (`train/<class>/img.jpg`),
grouped-then-class (`tomato_diseases/<class>/img.jpg`), or plain
class-only (`<class>/img.jpg`) -- without the scanner needing to know which
shape a given source uses. A future dataset with the same convention needs
no code changes, only a new config entry.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from src.cropguardian.data.validation import SUPPORTED_IMAGE_EXTENSIONS

from .config import BuildConfigError, SourceConfig


@dataclass(frozen=True)
class RawRecord:
    """One discovered image, before taxonomy mapping."""

    source: str
    source_class: str
    path: Path


@dataclass(frozen=True)
class MappedRecord:
    """One image after taxonomy mapping, ready for quality control."""

    source: str
    source_class: str
    unified_class: str
    path: Path


@dataclass(frozen=True)
class ExclusionEntry:
    source: str
    source_class: str
    path: Path
    reason: str


def scan_source(source: SourceConfig) -> list[RawRecord]:
    """Recursively discover every image file under a source's root."""
    if not source.root.exists():
        raise BuildConfigError(f"Source '{source.name}' root does not exist: {source.root}")

    records: list[RawRecord] = []
    for path in sorted(source.root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
            continue
        records.append(RawRecord(source=source.name, source_class=path.parent.name, path=path))
    return records


def apply_taxonomy(
    records: list[RawRecord], source: SourceConfig
) -> tuple[list[MappedRecord], list[ExclusionEntry]]:
    """Map raw records to unified classes, or log why they were excluded.

    Every `source_class` encountered on disk must appear in exactly one of
    `class_map` (included) or `excluded_classes` (excluded, with a reason).
    A class present in neither is a configuration gap, not a silent drop --
    it raises immediately so every class is always accounted for.
    """
    mapped: list[MappedRecord] = []
    excluded: list[ExclusionEntry] = []
    unaccounted: set[str] = set()

    for record in records:
        if record.source_class in source.class_map:
            mapped.append(
                MappedRecord(
                    source=record.source,
                    source_class=record.source_class,
                    unified_class=source.class_map[record.source_class],
                    path=record.path,
                )
            )
        elif record.source_class in source.excluded_classes:
            excluded.append(
                ExclusionEntry(
                    source=record.source,
                    source_class=record.source_class,
                    path=record.path,
                    reason=source.excluded_classes[record.source_class],
                )
            )
        else:
            unaccounted.add(record.source_class)

    if unaccounted:
        raise BuildConfigError(
            f"Source '{source.name}' has classes not covered by class_map or excluded_classes: "
            f"{sorted(unaccounted)}. Every class must be explicitly mapped or excluded."
        )

    return mapped, excluded

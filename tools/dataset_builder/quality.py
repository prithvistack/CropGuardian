"""Image quality control: corruption/resolution checks and duplicate detection.

Nothing here is dataset-specific -- it operates purely on file bytes and
pixel content, so it applies identically regardless of which source or
class a record came from.
"""

from __future__ import annotations

import hashlib
from collections import defaultdict
from dataclasses import dataclass

import numpy as np
from PIL import Image, UnidentifiedImageError

from .records import MappedRecord


@dataclass(frozen=True)
class QualityFailure:
    record: MappedRecord
    reason: str  # "zero_byte" | "corrupted" | "low_resolution"
    detail: str


@dataclass(frozen=True)
class QualityPassRecord:
    record: MappedRecord
    width: int
    height: int
    file_hash: str  # md5 of raw file bytes
    perceptual_hash: int  # 64-bit perceptual hash, for near-duplicate detection


@dataclass(frozen=True)
class DuplicateRemoval:
    record: MappedRecord
    reason: str  # "exact_duplicate" | "label_conflict" | "near_duplicate"
    detail: str
    group_id: int


def check_image(record: MappedRecord, resolution_min_px: int) -> QualityPassRecord | QualityFailure:
    """Validate a single image: readable, decodable, and above the resolution floor.

    Uses `Image.load()` rather than `Image.verify()` -- `load()` forces a
    full pixel decode, which is what actually catches files that are
    truncated or, as found during Phase 1 inspection, HTML error pages
    saved with an image extension (they open superficially but fail to
    decode as image data).
    """
    path = record.path
    try:
        size_bytes = path.stat().st_size
    except OSError as exc:
        return QualityFailure(record, "unreadable", f"stat() failed: {exc}")

    if size_bytes == 0:
        return QualityFailure(record, "zero_byte", "file is 0 bytes")

    raw_bytes = path.read_bytes()
    file_hash = hashlib.md5(raw_bytes).hexdigest()

    try:
        with Image.open(path) as img:
            img.load()
            width, height = img.size
            gray_gradient = img.convert("L").resize((9, 8))
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        return QualityFailure(record, "corrupted", f"{type(exc).__name__}: {exc}")

    if width < resolution_min_px or height < resolution_min_px:
        return QualityFailure(record, "low_resolution", f"{width}x{height} is below {resolution_min_px}px minimum")

    return QualityPassRecord(
        record=record,
        width=width,
        height=height,
        file_hash=file_hash,
        perceptual_hash=_difference_hash(gray_gradient),
    )


def _difference_hash(gray_gradient: Image.Image) -> int:
    """9x8 difference hash (dHash): each bit is whether a pixel is brighter than
    its right neighbor. Empirically calibrated against this dataset in favor of
    a simpler average-hash (aHash): aHash's absolute-brightness bits collide
    constantly between *unrelated* same-class leaf photos (they share similar
    overall coloring/lighting), producing false-positive near-duplicate
    matches even at a tight threshold. dHash encodes local gradients instead
    of absolute brightness, which cleanly separates genuinely near-identical
    images (distance 0 for a resized/recompressed copy, in testing) from
    merely visually-similar-but-distinct photos (distance 12+ among random
    same-class pairs, in testing) -- a much safer margin for automatic removal.
    """
    pixels = np.asarray(gray_gradient, dtype=np.float64)
    value = 0
    for bit in (pixels[:, 1:] > pixels[:, :-1]).flatten():
        value = (value << 1) | int(bit)
    return value


def resolve_exact_duplicates(
    passed: list[QualityPassRecord],
) -> tuple[list[QualityPassRecord], list[DuplicateRemoval]]:
    """Group by raw-byte MD5. Same-class groups keep one copy; cross-class
    groups (identical image, conflicting labels) are removed entirely --
    never silently keep one of two conflicting labels for the same image.
    """
    groups: dict[str, list[QualityPassRecord]] = defaultdict(list)
    for item in passed:
        groups[item.file_hash].append(item)

    kept: list[QualityPassRecord] = []
    removed: list[DuplicateRemoval] = []
    group_id = 0

    for file_hash, items in groups.items():
        if len(items) == 1:
            kept.append(items[0])
            continue

        group_id += 1
        items_sorted = sorted(items, key=lambda item: (item.record.source, str(item.record.path)))
        classes = {item.record.unified_class for item in items_sorted}

        if len(classes) > 1:
            for item in items_sorted:
                removed.append(
                    DuplicateRemoval(
                        record=item.record,
                        reason="label_conflict",
                        detail=f"identical image (md5={file_hash}) labeled as multiple classes: {sorted(classes)}",
                        group_id=group_id,
                    )
                )
        else:
            kept.append(items_sorted[0])
            for item in items_sorted[1:]:
                removed.append(
                    DuplicateRemoval(
                        record=item.record,
                        reason="exact_duplicate",
                        detail=f"byte-identical to {items_sorted[0].record.path}",
                        group_id=group_id,
                    )
                )

    return kept, removed


def resolve_near_duplicates(
    passed: list[QualityPassRecord], hamming_threshold: int
) -> tuple[list[QualityPassRecord], list[DuplicateRemoval]]:
    """Perceptual near-duplicate detection, scoped to within each unified class.

    Cross-class near-duplicates are intentionally not auto-resolved here --
    perceptual similarity across classes is too weak a signal to safely
    treat as a label conflict (visually similar leaves are not necessarily
    the same condition). Only exact-byte cross-class duplicates
    (`resolve_exact_duplicates`) are treated as conflicts.
    """
    by_class: dict[str, list[QualityPassRecord]] = defaultdict(list)
    for item in passed:
        by_class[item.record.unified_class].append(item)

    kept: list[QualityPassRecord] = []
    removed: list[DuplicateRemoval] = []
    group_id = 0

    for unified_class, items in by_class.items():
        items_sorted = sorted(items, key=lambda item: (item.record.source, str(item.record.path)))
        n = len(items_sorted)
        if n <= 1:
            kept.extend(items_sorted)
            continue

        bits = np.stack([_bits_array(item.perceptual_hash) for item in items_sorted])
        distance = bits @ (1 - bits).T + (1 - bits) @ bits.T
        np.fill_diagonal(distance, 999)
        candidate_pairs = np.argwhere(np.triu(distance <= hamming_threshold, k=1))

        removed_indices: set[int] = set()
        for i, j in candidate_pairs:
            i, j = int(i), int(j)
            if i in removed_indices or j in removed_indices:
                continue
            group_id += 1
            removed_indices.add(j)
            removed.append(
                DuplicateRemoval(
                    record=items_sorted[j].record,
                    reason="near_duplicate",
                    detail=(
                        f"near-duplicate (hamming={int(distance[i, j])}) of "
                        f"{items_sorted[i].record.path} within class '{unified_class}'"
                    ),
                    group_id=group_id,
                )
            )

        for idx, item in enumerate(items_sorted):
            if idx not in removed_indices:
                kept.append(item)

    return kept, removed


def _bits_array(value: int) -> np.ndarray:
    return np.array([(value >> i) & 1 for i in range(64)], dtype=np.int16)

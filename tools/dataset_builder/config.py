"""Load and validate a dataset-build YAML config."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


class BuildConfigError(Exception):
    """Raised when a build config is missing required fields or is inconsistent."""


@dataclass(frozen=True)
class SourceConfig:
    name: str
    root: Path
    class_map: dict[str, str]
    excluded_classes: dict[str, str]


@dataclass(frozen=True)
class BuildConfig:
    seed: int
    resolution_min_px: int
    output_dir: Path
    split_ratios: dict[str, float]
    near_duplicate_hamming_threshold: int
    sources: list[SourceConfig] = field(default_factory=list)


def load_build_config(config_path: str | Path, project_root: str | Path) -> BuildConfig:
    """Load a dataset-build YAML config, resolving relative paths against `project_root`."""
    project_root = Path(project_root)
    config_path = Path(config_path)
    if not config_path.is_absolute():
        config_path = project_root / config_path

    with config_path.open("r", encoding="utf-8") as handle:
        raw: dict[str, Any] = yaml.safe_load(handle) or {}

    required_top_level = ["seed", "resolution_min_px", "output_dir", "split_ratios", "sources"]
    missing = [key for key in required_top_level if key not in raw]
    if missing:
        raise BuildConfigError(f"Build config {config_path} is missing required keys: {missing}")

    split_ratios = raw["split_ratios"]
    ratio_sum = sum(split_ratios.values())
    if abs(ratio_sum - 1.0) > 1e-6:
        raise BuildConfigError(f"split_ratios must sum to 1.0, got {ratio_sum} ({split_ratios})")

    sources: list[SourceConfig] = []
    for source_name, source_raw in raw["sources"].items():
        if "root" not in source_raw or "class_map" not in source_raw:
            raise BuildConfigError(f"Source '{source_name}' must define 'root' and 'class_map'")
        root = Path(source_raw["root"])
        if not root.is_absolute():
            root = project_root / root
        sources.append(
            SourceConfig(
                name=source_name,
                root=root,
                class_map=dict(source_raw["class_map"]),
                excluded_classes=dict(source_raw.get("excluded_classes") or {}),
            )
        )

    output_dir = Path(raw["output_dir"])
    if not output_dir.is_absolute():
        output_dir = project_root / output_dir

    return BuildConfig(
        seed=int(raw["seed"]),
        resolution_min_px=int(raw["resolution_min_px"]),
        output_dir=output_dir,
        split_ratios={key: float(value) for key, value in split_ratios.items()},
        near_duplicate_hamming_threshold=int(raw.get("near_duplicate_hamming_threshold", 5)),
        sources=sources,
    )

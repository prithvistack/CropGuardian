"""Configuration utilities for CropGuardian AI."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

import yaml


class ConfigurationError(Exception):
    """Raised when configuration cannot be loaded correctly."""


def _merge_configs(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Recursively merge two configuration dictionaries."""
    merged = deepcopy(base)
    for key, value in override.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = _merge_configs(merged[key], value)
        else:
            merged[key] = deepcopy(value)
    return merged


def load_config(config_path: str | Path | list[str | Path] | None = None) -> dict[str, Any]:
    """Load one or more YAML configuration files from disk.

    Args:
        config_path: Optional path or list of paths to YAML configuration files.

    Returns:
        A dictionary containing the loaded configuration.
    """
    if config_path is None:
        config_paths = [Path(__file__).resolve().parents[2] / "configs" / "base.yaml"]
    elif isinstance(config_path, (str, Path)):
        config_paths = [Path(config_path)]
    else:
        config_paths = [Path(path) for path in config_path]

    merged_config: dict[str, Any] = {}
    for config_file in config_paths:
        config_file = Path(config_file)
        if not config_file.exists():
            raise ConfigurationError(f"Configuration file not found: {config_file}")

        with config_file.open("r", encoding="utf-8") as handle:
            loaded = yaml.safe_load(handle) or {}
            merged_config = _merge_configs(merged_config, loaded)

    return merged_config

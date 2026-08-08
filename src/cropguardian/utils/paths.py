"""Path helpers for CropGuardian AI."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .config import load_config


def get_project_root() -> Path:
    """Return the repository root directory."""
    return Path(__file__).resolve().parents[3]


def get_config_value(key_path: str, config: dict[str, Any] | None = None) -> Any:
    """Retrieve a nested configuration value from a dictionary."""
    if config is None:
        config = load_config()

    value: Any = config
    for part in key_path.split("."):
        if isinstance(value, dict) and part in value:
            value = value[part]
        else:
            raise KeyError(f"Configuration key not found: {key_path}")
    return value

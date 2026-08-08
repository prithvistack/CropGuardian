"""Tests for configuration utilities."""

from pathlib import Path

from src.cropguardian.utils.config import load_config


def test_load_config_returns_mapping() -> None:
    config = load_config(Path("configs/base.yaml"))
    assert isinstance(config, dict)
    assert config["project_name"] == "CropGuardianAI"

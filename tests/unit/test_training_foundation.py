from pathlib import Path

import yaml

from src.cropguardian.data.splitting import split_records
from src.cropguardian.utils.config import load_config


def test_load_config_can_merge_multiple_files(tmp_path: Path) -> None:
    base_config = tmp_path / "base.yaml"
    override_config = tmp_path / "training.yaml"

    base_config.write_text(yaml.safe_dump({"project_name": "demo", "paths": {"models_dir": "models"}}), encoding="utf-8")
    override_config.write_text(yaml.safe_dump({"paths": {"logs_dir": "logs"}, "training": {"epochs": 3}}), encoding="utf-8")

    config = load_config([base_config, override_config])

    assert config["project_name"] == "demo"
    assert config["paths"]["models_dir"] == "models"
    assert config["paths"]["logs_dir"] == "logs"
    assert config["training"]["epochs"] == 3


def test_split_records_returns_expected_partition_sizes() -> None:
    records = [{"image_path": f"img_{index}.jpg", "label": "healthy"} for index in range(10)]

    splits = split_records(records, train_ratio=0.7, val_ratio=0.2, test_ratio=0.1, seed=42)

    assert len(splits["train"]) == 7
    assert len(splits["val"]) == 2
    assert len(splits["test"]) == 1

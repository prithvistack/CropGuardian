#!/usr/bin/env python3
"""CLI entrypoint for building a merged, cleaned, split dataset from a YAML
build config -- e.g. CropGuardian-Dataset-v1.

The config (see configs/dataset_build/) fully describes the source
datasets, taxonomy mapping, exclusions, and thresholds. This script has no
dataset-specific knowledge; pointing --config at a different build config
builds a different dataset with the same pipeline.

Usage:
    python3 tools/build_dataset.py --config configs/dataset_build/cropguardian_v1.yaml
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from tools.dataset_builder.config import load_build_config  # noqa: E402
from tools.dataset_builder.pipeline import run_build  # noqa: E402
from tools.dataset_builder.reporting import write_all_reports  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        default="configs/dataset_build/cropguardian_v1.yaml",
        help="Path to a dataset-build YAML config (relative to the project root, or absolute).",
    )
    args = parser.parse_args()

    config = load_build_config(args.config, PROJECT_ROOT)

    print(f"Building dataset -> {config.output_dir}")
    report = run_build(config)
    write_all_reports(config, report)

    print()
    print(f"Source classes excluded (by taxonomy):  {len(report.exclusions)} files")
    print(f"Removed by quality control:              {len(report.quality_failures)} files")
    print(f"Removed as duplicates/label conflicts:    {len(report.duplicate_removals)} files")
    print(f"Final images written:                     {len(report.materialized)}")
    print(f"Reports written to: {config.output_dir / 'reports'}")
    print(f"Metadata CSV: {config.output_dir / 'metadata.csv'}")


if __name__ == "__main__":
    main()

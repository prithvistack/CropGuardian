# CropGuardian AI

CropGuardian AI is a production-oriented machine learning repository for tomato disease detection.

## Training Stages

Training is config-driven and selected via `dataset.name` in
`configs/training.yaml`. Currently supported:

1. `plantvillage` — transfer learning from ImageNet on the lab-photographed
   PlantVillage dataset. Produces `models/plantvillage_best.keras` and
   `models/plantvillage_final.keras`.
2. `tomato_village` — continues training from the PlantVillage checkpoint
   (never restarts from ImageNet) on the real-world Tomato-Village
   Variant-a dataset, which ships its own train/val/test split. Produces
   `models/tomato_village_best.keras` and `models/tomato_village_final.keras`.

Additional stages can be added by defining a new block under `stages` in
`configs/training.yaml` and a matching entry under `datasets` in
`configs/datasets.yaml`, without any source code changes. A later stage can
continue training from an earlier stage's checkpoint by setting
`source_model` to that stage's name.

Run training with:

```
python3 train.py
```

## Phase 1 Scope

This phase establishes the foundational repository structure for future machine learning work, including:

- modular source organization
- configuration-driven design
- logging infrastructure
- experiment and model storage conventions
- documentation and testing structure

## Repository Structure

- configs/: configuration files for datasets, training, evaluation, and inference
- datasets/: raw, processed, split, and manifest data assets
- src/: core source modules for data, preprocessing, training, evaluation, inference, and utilities
- models/: model architectures, checkpoints, and exports
- experiments/: experiment-level metadata and run organization
- artifacts/: generated outputs and reports
- logs/: runtime and training logs
- docs/: architecture and usage documentation
- tests/: unit and integration tests
- notebooks/: exploratory analysis and experimentation

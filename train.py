"""Training entrypoint for CropGuardian AI."""

from __future__ import annotations

from src.cropguardian.training.pipeline import TrainingPipeline


def main() -> None:
    """Run the EfficientNetB0 training pipeline for the configured stage.

    The active stage is selected via `dataset.name` in configs/training.yaml
    — no code changes required.
    """
    pipeline = TrainingPipeline()
    result = pipeline.run()
    print("Stage:", result["stage"])
    print("Best model:", result["best_model_path"])
    print("Final model:", result["final_model_path"])
    print("Metrics:", result["metrics"])


if __name__ == "__main__":
    main()

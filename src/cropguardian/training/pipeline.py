"""Training pipeline for CropGuardian AI CNN stages (PlantVillage)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau, TensorBoard

from ..data.loader import DatasetLoader
from ..data.splitting import split_records, split_train_val
from ..data.validation import validate_dataset_structure
from ..preprocessing.image_ops import build_preprocessing_pipeline
from ..training.losses import build_loss
from ..training.modeling import (
    build_fine_tune_model,
    build_model,
    enable_mixed_precision,
    load_backbone_from_checkpoint,
)
from ..utils.config import load_config
from ..utils.logging import get_logger

# Legacy checkpoint locations produced by the original single-stage PlantVillage
# pipeline, kept as a fallback so previously trained models remain usable as
# the source for later stages without needing to be retrained or moved.
_LEGACY_CHECKPOINTS = {
    "plantvillage": {
        "best": "models/checkpoints/best_model.keras",
        "final": "models/final_model.keras",
    }
}


class TrainingPipeline:
    """Config-driven transfer-learning pipeline supporting multiple training stages.

    The active stage is selected entirely through configuration
    (`dataset.name` in configs/training.yaml) — no source code changes are
    required to add or switch between stages defined in `stages` and
    `datasets` config blocks.
    """

    def __init__(self, config_path: str | Path | list[str | Path] | None = None):
        project_root = Path(__file__).resolve().parents[3]
        default_config_paths = [
            project_root / "configs" / "base.yaml",
            project_root / "configs" / "datasets.yaml",
            project_root / "configs" / "training.yaml",
        ]

        if config_path is None:
            config_paths = default_config_paths
        elif isinstance(config_path, (str, Path)):
            path = Path(config_path)
            if not path.is_absolute():
                path = project_root / path
            config_paths = default_config_paths + [path]
        else:
            config_paths = default_config_paths + [Path(path) if not Path(path).is_absolute() else Path(path) for path in config_path]

        self.config = load_config(config_paths)
        self.logger = get_logger("cropguardian.training")
        self.project_root = project_root

    def run(self) -> dict[str, Any]:
        """Run the complete transfer-learning workflow for the configured stage."""
        enable_mixed_precision()

        dataset_selector = self.config.get("dataset") or {}
        stage_name = dataset_selector.get("name")
        if not stage_name:
            raise ValueError(
                "No dataset stage configured. Set `dataset.name` in configs/training.yaml "
                f"(configured stages: {list(self.config.get('stages', {}))})."
            )
        stage_config = self.config.get("stages", {}).get(stage_name)
        if stage_config is None:
            raise ValueError(
                f"Unknown dataset/stage '{stage_name}'. Configured stages: "
                f"{list(self.config.get('stages', {}))}"
            )

        dataset_config = self.config.get("datasets", {}).get(stage_name)
        if dataset_config is None:
            raise ValueError(f"No dataset configuration found for '{stage_name}' in configs/datasets.yaml")

        train_config = self.config.get("training", {})
        model_config = self.config.get("model", {})

        self.logger.info("Starting training stage '%s'", stage_name)

        splits = self._load_splits(dataset_config, train_config)
        expected_classes = self._resolve_expected_classes(dataset_config, splits)
        num_classes = len(expected_classes)
        self.logger.info(
            "Stage '%s': %d train / %d val / %d test records across %d classes",
            stage_name,
            len(splits["train"]),
            len(splits["val"]),
            len(splits["test"]),
            num_classes,
        )

        class_weight = self._compute_class_weights(splits["train"], expected_classes)

        loss, apply_class_weight_in_fit = build_loss(train_config.get("loss"), num_classes, class_weight)
        fit_class_weight = class_weight if apply_class_weight_in_fit else None
        if not apply_class_weight_in_fit:
            self.logger.info(
                "Loss config encodes per-class weighting via alpha; class_weight will not "
                "also be passed to fit() (avoids double-weighting)."
            )

        batch_size = int(train_config.get("batch_size", 32))
        image_size = tuple(int(value) for value in model_config.get("input_shape", [224, 224, 3])[:2])
        buffer_size = int(train_config.get("buffer_size", 1000))
        augmentation_strength = dataset_config.get("augmentation_strength", "light")

        train_ds = self._build_dataset(
            splits["train"],
            expected_classes,
            training=True,
            batch_size=batch_size,
            image_size=image_size,
            buffer_size=buffer_size,
            augmentation_strength=augmentation_strength,
        )
        val_ds = self._build_dataset(
            splits["val"],
            expected_classes,
            training=False,
            batch_size=batch_size,
            image_size=image_size,
            buffer_size=buffer_size,
            augmentation_strength=augmentation_strength,
        )
        test_ds = self._build_dataset(
            splits["test"],
            expected_classes,
            training=False,
            batch_size=batch_size,
            image_size=image_size,
            buffer_size=buffer_size,
            augmentation_strength=augmentation_strength,
        )

        input_shape = (image_size[0], image_size[1], 3)
        base_model = self._resolve_base_model(stage_config)

        self.logger.info("Building classification head for stage '%s' (%d classes)", stage_name, num_classes)
        model = build_model(
            input_shape=input_shape,
            num_classes=num_classes,
            dropout_rate=float(model_config.get("dropout_rate", 0.3)),
            trainable_backbone=False,
            learning_rate=float(stage_config.get("head_learning_rate", 1e-3)),
            base_model=base_model,
            loss=loss,
        )

        checkpoint_prefix = stage_config.get("checkpoint_prefix", stage_name)
        best_model_path = self.project_root / "models" / f"{checkpoint_prefix}_best.keras"
        final_model_path = self.project_root / "models" / f"{checkpoint_prefix}_final.keras"
        best_model_path.parent.mkdir(parents=True, exist_ok=True)

        # One shared ModelCheckpoint instance, reused across both the head and
        # fine-tune fit() calls. Keras tracks "best value seen so far" as
        # state on the callback object itself -- reusing the same instance
        # (rather than constructing a fresh one per phase) is what makes
        # best_model_path reflect the true best epoch across the whole run,
        # not just whichever phase happens to run last. A phase that performs
        # worse than the other (as fine-tuning did here) will not overwrite a
        # better checkpoint the other phase already produced.
        checkpoint_callback = ModelCheckpoint(
            filepath=str(best_model_path),
            save_best_only=True,
            monitor="val_loss",
            mode="min",
            save_weights_only=False,
        )

        head_callbacks = [
            checkpoint_callback,
            EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True),
            ReduceLROnPlateau(monitor="val_loss", factor=0.2, patience=2, min_lr=1e-6),
            TensorBoard(log_dir=str(self.project_root / "logs" / "tensorboard" / stage_name / "head")),
        ]

        head_epochs = int(stage_config.get("epochs", 5))
        self.logger.info("Training classification head for %d epochs", head_epochs)
        history = model.fit(
            train_ds,
            validation_data=val_ds,
            epochs=head_epochs,
            callbacks=head_callbacks,
            class_weight=fit_class_weight,
            verbose=1,
        )

        fine_tune_epochs = int(stage_config.get("fine_tune_epochs", 3))
        if fine_tune_epochs > 0:
            self.logger.info("Starting fine-tuning phase for stage '%s'", stage_name)
            fine_tuned_model = build_fine_tune_model(
                model,
                unfreeze_layers=int(stage_config.get("unfreeze_layers", 20)),
                learning_rate=float(stage_config.get("fine_tune_learning_rate", 1e-5)),
                loss=loss,
            )

            fine_tune_callbacks = [
                checkpoint_callback,
                EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True),
                ReduceLROnPlateau(monitor="val_loss", factor=0.2, patience=2, min_lr=1e-6),
                TensorBoard(log_dir=str(self.project_root / "logs" / "tensorboard" / stage_name / "finetune")),
            ]

            self.logger.info("Fine-tuning for %d epochs", fine_tune_epochs)
            fine_tune_history = fine_tuned_model.fit(
                train_ds,
                validation_data=val_ds,
                epochs=fine_tune_epochs,
                callbacks=fine_tune_callbacks,
                class_weight=fit_class_weight,
                verbose=1,
            )
        else:
            # fine_tune_epochs: 0 -- backbone stays frozen for the entire run,
            # no second training phase, no unfreezing. `model` (head-trained,
            # backbone still fully frozen) is the final model as-is.
            self.logger.info(
                "fine_tune_epochs=0 for stage '%s' -- skipping backbone fine-tuning, backbone remains frozen",
                stage_name,
            )
            fine_tuned_model = model
            fine_tune_history = None

        fine_tuned_model.save(final_model_path)
        self.logger.info("Saved final '%s' model to %s", stage_name, final_model_path)

        metrics = self._evaluate_model(fine_tuned_model, test_ds)
        self.logger.info(
            "Stage '%s' test evaluation: accuracy=%.4f f1=%.4f",
            stage_name,
            metrics["accuracy"],
            metrics["f1_score"],
        )
        fine_tune_history_dict = fine_tune_history.history if fine_tune_history is not None else {}
        self._save_artifacts(stage_name, history.history, fine_tune_history_dict, metrics, expected_classes)

        return {
            "stage": stage_name,
            "history": history.history,
            "fine_tune_history": fine_tune_history_dict,
            "best_model_path": str(best_model_path),
            "final_model_path": str(final_model_path),
            "metrics": metrics,
        }

    # ------------------------------------------------------------------
    # Dataset loading
    # ------------------------------------------------------------------

    def _resolve_dataset_root(self, dataset_config: dict[str, Any]) -> Path:
        root_value = dataset_config.get("root")
        if not root_value:
            raise ValueError("Dataset 'root' must be configured")
        root = Path(root_value)
        if not root.is_absolute():
            root = self.project_root / root
        return root

    def _load_splits(
        self, dataset_config: dict[str, Any], train_config: dict[str, Any]
    ) -> dict[str, list[dict[str, Any]]]:
        layout = dataset_config.get("layout", "flat")
        root = self._resolve_dataset_root(dataset_config)

        if layout == "predefined_split":
            return self._load_predefined_splits(dataset_config, root, train_config)
        return self._load_flat_splits(dataset_config, root, train_config)

    def _load_flat_splits(
        self, dataset_config: dict[str, Any], root: Path, train_config: dict[str, Any]
    ) -> dict[str, list[dict[str, Any]]]:
        expected_classes = dataset_config.get("expected_classes") or None
        self.logger.info("Validating dataset structure at %s", root)
        validate_dataset_structure(root, expected_classes=expected_classes)

        loader = DatasetLoader(root)
        records = loader.load()
        if not records:
            raise ValueError(f"No dataset records were found under {root}")

        return split_records(
            records,
            train_ratio=train_config.get("train_ratio", 0.8),
            val_ratio=train_config.get("val_ratio", 0.1),
            test_ratio=train_config.get("test_ratio", 0.1),
            seed=train_config.get("seed", 42),
        )

    def _load_predefined_splits(
        self, dataset_config: dict[str, Any], root: Path, train_config: dict[str, Any]
    ) -> dict[str, list[dict[str, Any]]]:
        """Load a dataset that ships its own split directories.

        `val_dir` is optional in config. When present, that directory is used
        as-is for validation (a native train/val/test dataset). When absent,
        a validation set is carved out of `train_dir` via `val_ratio`, as for
        a dataset that only ships train/test directories.
        """
        train_dir = dataset_config.get("train_dir", "train")
        test_dir = dataset_config.get("test_dir", "test")
        val_dir = dataset_config.get("val_dir")
        expected_classes = dataset_config.get("expected_classes") or None

        split_dirs = [d for d in (train_dir, val_dir, test_dir) if d is not None]
        self.logger.info("Validating dataset structure at %s/{%s}", root, ",".join(split_dirs))
        validate_dataset_structure(root / train_dir, expected_classes=expected_classes)
        validate_dataset_structure(root / test_dir, expected_classes=expected_classes)
        if val_dir is not None:
            validate_dataset_structure(root / val_dir, expected_classes=expected_classes)

        loader = DatasetLoader(root)
        predefined = loader.load_predefined_splits(train_dir=train_dir, test_dir=test_dir, val_dir=val_dir)
        if not predefined["train"]:
            raise ValueError(f"No training records were found under {root / train_dir}")
        if not predefined["test"]:
            raise ValueError(f"No test records were found under {root / test_dir}")

        if "val" in predefined:
            if not predefined["val"]:
                raise ValueError(f"No validation records were found under {root / val_dir}")
            return {"train": predefined["train"], "val": predefined["val"], "test": predefined["test"]}

        val_ratio = float(dataset_config.get("val_ratio", 0.15))
        train_val = split_train_val(
            predefined["train"],
            val_ratio=val_ratio,
            seed=train_config.get("seed", 42),
        )

        return {
            "train": train_val["train"],
            "val": train_val["val"],
            "test": predefined["test"],
        }

    def _resolve_expected_classes(
        self, dataset_config: dict[str, Any], splits: dict[str, list[dict[str, Any]]]
    ) -> list[str]:
        expected_classes = dataset_config.get("expected_classes") or []
        if expected_classes:
            return list(expected_classes)

        discovered = sorted({record["label"] for records in splits.values() for record in records})
        if not discovered:
            raise ValueError("Unable to determine dataset classes: no records discovered")
        self.logger.info("No expected_classes configured; auto-discovered %d classes from dataset", len(discovered))
        return discovered

    def _compute_class_weights(
        self, train_records: list[dict[str, Any]], expected_classes: list[str]
    ) -> dict[int, float]:
        """Compute balanced class weights from the training split only.

        Weights are indexed identically to `expected_classes` (the same
        indexing `_label_to_index`/`_build_dataset` use), so class 0's weight
        always corresponds to `expected_classes[0]` regardless of dataset.
        """
        train_labels = np.array(
            [self._label_to_index(record["label"], expected_classes) for record in train_records]
        )
        weights = compute_class_weight(
            class_weight="balanced",
            classes=np.arange(len(expected_classes)),
            y=train_labels,
        )
        class_weight = {index: float(weight) for index, weight in enumerate(weights)}

        print("Class Weights")
        for index, class_name in enumerate(expected_classes):
            print(f"{class_name:<24}{class_weight[index]:.2f}")

        return class_weight

    # ------------------------------------------------------------------
    # Model construction
    # ------------------------------------------------------------------

    def _resolve_base_model(self, stage_config: dict[str, Any]) -> Any:
        source = stage_config.get("source_model", "imagenet")
        if source == "imagenet":
            self.logger.info("Initializing backbone from ImageNet weights")
            return None

        checkpoint_path = self._resolve_checkpoint_path(source, "final")
        self.logger.info("Continuing training from '%s' checkpoint: %s", source, checkpoint_path)
        return load_backbone_from_checkpoint(checkpoint_path)

    def _resolve_checkpoint_path(self, stage_name: str, kind: str) -> Path:
        candidates = [self.project_root / "models" / f"{stage_name}_{kind}.keras"]

        legacy = _LEGACY_CHECKPOINTS.get(stage_name, {}).get(kind)
        if legacy:
            candidates.append(self.project_root / legacy)

        for candidate in candidates:
            if candidate.exists():
                return candidate

        raise FileNotFoundError(
            f"Could not find a trained '{stage_name}' checkpoint. Looked in: "
            f"{[str(candidate) for candidate in candidates]}. Train the '{stage_name}' stage first."
        )

    # ------------------------------------------------------------------
    # tf.data construction
    # ------------------------------------------------------------------

    def _build_dataset(
        self,
        records: list[dict[str, Any]],
        expected_classes: list[str],
        training: bool,
        batch_size: int,
        image_size: tuple[int, int],
        buffer_size: int,
        augmentation_strength: str,
    ) -> Any:
        image_paths = [record["image_path"] for record in records]
        labels = [self._label_to_index(record["label"], expected_classes) for record in records]

        dataset = tf.data.Dataset.from_tensor_slices(
            (tf.constant(image_paths, dtype=tf.string), tf.constant(labels, dtype=tf.int32))
        )
        dataset = dataset.map(self._load_image_and_label, num_parallel_calls=tf.data.AUTOTUNE)
        dataset = dataset.cache()
        if training:
            dataset = dataset.shuffle(buffer_size=max(buffer_size, 1000), reshuffle_each_iteration=True)
        pipeline = build_preprocessing_pipeline(
            image_size=image_size,
            batch_size=batch_size,
            augmentation=training,
            augmentation_strength=augmentation_strength,
            shuffle=training,
            buffer_size=max(buffer_size, 1000),
            cache=False,
        )
        return pipeline(dataset)

    def _load_image_and_label(self, image_path: tf.Tensor, label: tf.Tensor) -> tuple[tf.Tensor, tf.Tensor]:
        image = tf.io.read_file(image_path)
        label = tf.cast(label, tf.int32)
        return image, label

    def _label_to_index(self, label: str, expected_classes: list[str]) -> int:
        if label in expected_classes:
            return expected_classes.index(label)

        normalized_label = Path(label).name
        if normalized_label in expected_classes:
            return expected_classes.index(normalized_label)

        raise ValueError(f"Label {label} not found in expected classes")

    # ------------------------------------------------------------------
    # Evaluation and artifacts
    # ------------------------------------------------------------------

    def _evaluate_model(self, model: tf.keras.Model, test_ds: Any) -> dict[str, Any]:
        y_true_list: list[np.ndarray] = []
        y_pred_list: list[np.ndarray] = []

        for images, labels in test_ds:
            predictions = model.predict(images, verbose=0)
            y_true_list.append(labels.numpy())
            y_pred_list.append(np.argmax(predictions, axis=1))

        y_true = np.concatenate(y_true_list)
        y_pred = np.concatenate(y_pred_list)

        metrics = {
            "accuracy": float(np.mean(y_pred == y_true)),
            "precision": float(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
            "recall": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
            "f1_score": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
            "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
            "classification_report": classification_report(y_true, y_pred, output_dict=True),
        }
        return metrics

    def _save_artifacts(
        self,
        stage_name: str,
        history: dict[str, Any],
        fine_tune_history: dict[str, Any],
        metrics: dict[str, Any],
        expected_classes: list[str],
    ) -> None:
        artifacts_dir = self.project_root / "artifacts" / "experiments"
        artifacts_dir.mkdir(parents=True, exist_ok=True)

        with (artifacts_dir / f"{stage_name}_training_history.json").open("w", encoding="utf-8") as handle:
            json.dump({"base_history": history, "fine_tune_history": fine_tune_history}, handle, indent=2)

        with (artifacts_dir / f"{stage_name}_evaluation_metrics.json").open("w", encoding="utf-8") as handle:
            json.dump(metrics, handle, indent=2)

        with (artifacts_dir / f"{stage_name}_confusion_matrix.json").open("w", encoding="utf-8") as handle:
            json.dump(metrics["confusion_matrix"], handle, indent=2)

        with (artifacts_dir / f"{stage_name}_classification_report.json").open("w", encoding="utf-8") as handle:
            json.dump(metrics["classification_report"], handle, indent=2)

        with (artifacts_dir / f"{stage_name}_classes.json").open("w", encoding="utf-8") as handle:
            json.dump(expected_classes, handle, indent=2)

        self.logger.info("Saved artifacts for stage '%s' to %s", stage_name, artifacts_dir)

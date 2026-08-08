"""Configurable classification loss functions for CropGuardian AI.

Loss selection is driven entirely by `training.loss` in configs/training.yaml
and is dataset- and backbone-agnostic: `build_loss` only ever depends on the
active stage's class count and the pipeline's already-computed per-class
weights, never on a specific dataset or model architecture.
"""

from __future__ import annotations

from typing import Any

import tensorflow as tf

_DEFAULT_GAMMA = 2.0


class SparseCategoricalFocalLoss(tf.keras.losses.Loss):
    """Multiclass focal loss (Lin et al., 2017) for sparse integer labels.

    Down-weights well-classified ("easy") examples via `(1 - p_t) ** gamma`,
    so gradient contributions concentrate on hard/misclassified examples
    regardless of class. An optional `alpha` term additionally reweights
    classes directly -- see `build_loss` for why combining a per-class alpha
    with the pipeline's automatic `class_weight` would double-count.
    """

    def __init__(
        self,
        gamma: float = _DEFAULT_GAMMA,
        alpha: float | list[float] | None = None,
        name: str = "sparse_categorical_focal_loss",
    ) -> None:
        super().__init__(name=name)
        self.gamma = gamma
        self.alpha = alpha
        self._alpha_tensor = tf.constant(alpha, dtype=tf.float32) if isinstance(alpha, (list, tuple)) else None

    def call(self, y_true: tf.Tensor, y_pred: tf.Tensor) -> tf.Tensor:
        y_true = tf.cast(tf.reshape(y_true, [-1]), tf.int32)
        # Loss math is done in float32 regardless of the model's compute
        # dtype (e.g. under mixed_float16 policy), since log()/pow() on
        # float16 probabilities are numerically unstable.
        y_pred = tf.cast(y_pred, tf.float32)
        y_pred = tf.clip_by_value(y_pred, tf.keras.backend.epsilon(), 1.0 - tf.keras.backend.epsilon())

        probs = tf.gather(y_pred, y_true, batch_dims=1)
        cross_entropy = -tf.math.log(probs)
        modulating_factor = tf.pow(1.0 - probs, self.gamma)
        loss = modulating_factor * cross_entropy

        if self._alpha_tensor is not None:
            loss *= tf.gather(self._alpha_tensor, y_true)
        elif isinstance(self.alpha, (int, float)):
            loss *= self.alpha

        return loss

    def get_config(self) -> dict[str, Any]:
        config = super().get_config()
        config.update({"gamma": self.gamma, "alpha": self.alpha})
        return config


def build_loss(
    loss_config: dict[str, Any] | None,
    num_classes: int,
    class_weight: dict[int, float] | None,
) -> tuple[str | SparseCategoricalFocalLoss, bool]:
    """Build the configured loss for `model.compile()`.

    Returns `(loss, apply_class_weight_in_fit)`. The second value tells the
    caller whether the pipeline's automatically computed `class_weight`
    should still be passed to `model.fit()` -- see `_resolve_focal_alpha`
    for the reasoning. Unset or `type: crossentropy` reproduces the
    pipeline's original behavior exactly: plain sparse categorical
    cross-entropy, with `class_weight` applied in `fit()`.
    """
    loss_config = loss_config or {}
    loss_type = str(loss_config.get("type", "crossentropy")).lower()

    if loss_type == "crossentropy":
        return "sparse_categorical_crossentropy", True

    if loss_type != "focal":
        raise ValueError(f"Unknown training.loss.type '{loss_type}'. Supported: 'crossentropy', 'focal'.")

    gamma = float(loss_config.get("gamma", _DEFAULT_GAMMA))
    alpha_spec = loss_config.get("alpha", "auto")
    alpha, apply_class_weight_in_fit = _resolve_focal_alpha(alpha_spec, num_classes, class_weight)

    return SparseCategoricalFocalLoss(gamma=gamma, alpha=alpha), apply_class_weight_in_fit


def _resolve_focal_alpha(
    alpha_spec: Any,
    num_classes: int,
    class_weight: dict[int, float] | None,
) -> tuple[float | list[float] | None, bool]:
    """Resolve `training.loss.alpha` and decide whether `class_weight`
    should *also* be applied in `model.fit()`.

    Per-class alpha and Keras `class_weight` are mathematically the same
    mechanism: both multiply a sample's loss by a factor that depends only
    on its class, before averaging. Applying both at once for the same
    class multiplies its correction by itself (alpha_i * class_weight_i),
    over-suppressing majority classes and exploding minority-class
    gradients -- that destabilizes optimization rather than helping it.

    So whenever `alpha` carries genuine per-class information ("auto", or
    an explicit per-class list), `class_weight` is *not* also passed to
    `fit()` -- the loss already encodes it, reusing the exact values the
    pipeline's automatic class-weight computation produced. A scalar alpha
    (or no alpha at all) carries no per-class information -- it's the
    original focal-loss foreground/background constant, not an imbalance
    correction -- so it composes safely with `class_weight`, which keeps
    handling the imbalance correction exactly as it did before focal loss
    was introduced.
    """
    if alpha_spec is None or (isinstance(alpha_spec, str) and alpha_spec.lower() == "none"):
        return None, True

    if isinstance(alpha_spec, str) and alpha_spec.lower() == "auto":
        if not class_weight:
            raise ValueError("training.loss.alpha: 'auto' requires computed class weights, but none were provided.")
        alpha = [float(class_weight[index]) for index in range(num_classes)]
        return alpha, False

    if isinstance(alpha_spec, (list, tuple)):
        if len(alpha_spec) != num_classes:
            raise ValueError(
                f"training.loss.alpha has {len(alpha_spec)} entries but the dataset has {num_classes} classes."
            )
        return [float(value) for value in alpha_spec], False

    if isinstance(alpha_spec, (int, float)):
        return float(alpha_spec), True

    raise ValueError(f"Unsupported training.loss.alpha value: {alpha_spec!r}")

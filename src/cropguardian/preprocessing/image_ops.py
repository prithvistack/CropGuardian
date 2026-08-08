"""Image preprocessing utilities for EfficientNetB0 training."""

from __future__ import annotations

from typing import Any

import tensorflow as tf
from tensorflow.keras.applications import efficientnet


def _random_zoom(image: tf.Tensor, image_size: tuple[int, int], min_scale: float = 0.8) -> tf.Tensor:
    """Randomly crop-and-resize an image to simulate camera distance/framing variation."""
    scale = tf.random.uniform([], min_scale, 1.0)
    new_height = tf.cast(tf.cast(image_size[0], tf.float32) * scale, tf.int32)
    new_width = tf.cast(tf.cast(image_size[1], tf.float32) * scale, tf.int32)
    image = tf.image.random_crop(image, size=[new_height, new_width, 3])
    image = tf.image.resize(image, image_size)
    return image


def build_preprocessing_pipeline(
    image_size: tuple[int, int] = (224, 224),
    batch_size: int = 32,
    autotune: Any = tf.data.AUTOTUNE,
    augmentation: bool = False,
    augmentation_strength: str = "light",
    shuffle: bool = False,
    buffer_size: int = 1000,
    cache: bool = False,
) -> Any:
    """Create an EfficientNet-compatible preprocessing pipeline.

    Args:
        augmentation_strength: "light" mirrors the controlled, lab-photographed
            PlantVillage images (flip/brightness/contrast only). "strong" adds
            rotation, zoom, saturation/hue jitter, and wider brightness/contrast
            ranges, appropriate for real-world photos with variable
            backgrounds, lighting, and framing.
    """

    def preprocess_image(image_bytes: tf.Tensor, label: tf.Tensor) -> tuple[tf.Tensor, tf.Tensor]:
        image = tf.io.decode_image(image_bytes, channels=3, expand_animations=False)
        image = tf.ensure_shape(image, [None, None, 3])
        image = tf.image.resize(image, image_size)
        image = tf.cast(image, tf.float32)
        image = efficientnet.preprocess_input(image)
        return image, label

    def augment_image_light(image: tf.Tensor, label: tf.Tensor) -> tuple[tf.Tensor, tf.Tensor]:
        image = tf.image.random_flip_left_right(image)
        image = tf.image.random_brightness(image, max_delta=0.1)
        image = tf.image.random_contrast(image, lower=0.9, upper=1.1)
        return image, label

    def augment_image_strong(image: tf.Tensor, label: tf.Tensor) -> tuple[tf.Tensor, tf.Tensor]:
        image = tf.image.random_flip_left_right(image)
        image = tf.image.random_flip_up_down(image)
        rotations = tf.random.uniform([], 0, 4, dtype=tf.int32)
        image = tf.image.rot90(image, k=rotations)
        image = _random_zoom(image, image_size)
        image = tf.image.random_brightness(image, max_delta=0.2)
        image = tf.image.random_contrast(image, lower=0.7, upper=1.3)
        image = tf.image.random_saturation(image, lower=0.7, upper=1.3)
        image = tf.image.random_hue(image, max_delta=0.05)
        return image, label

    augment_image = augment_image_strong if augmentation_strength == "strong" else augment_image_light

    def pipeline(ds: Any) -> Any:
        ds = ds.map(preprocess_image, num_parallel_calls=autotune)
        if cache:
            ds = ds.cache()
        if shuffle:
            ds = ds.shuffle(buffer_size=buffer_size)
        if augmentation:
            ds = ds.map(augment_image, num_parallel_calls=autotune)
        ds = ds.batch(batch_size)
        ds = ds.prefetch(autotune)
        return ds

    return pipeline

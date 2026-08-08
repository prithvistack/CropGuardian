"""Logging utilities for CropGuardian AI."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional


def get_logger(name: str, log_file: Optional[str | Path] = None) -> logging.Logger:
    """Create and configure a module logger.

    Args:
        name: Logger name.
        log_file: Optional file path for file-based logging.

    Returns:
        Configured logger instance.
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.propagate = False

    if not logger.handlers:
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )

        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)

        if log_file is not None:
            log_path = Path(log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            file_handler = logging.FileHandler(log_path)
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)

    return logger

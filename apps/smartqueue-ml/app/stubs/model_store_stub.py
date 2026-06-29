# Phase 2 stub — replaced by app/ml/model_store.py
# Locked interface: do not change these signatures.
from typing import Any, Optional


def load_model() -> None:
    pass


def get_model() -> Optional[Any]:
    return None


def get_encoders() -> Optional[dict]:
    return None


def is_model_loaded() -> bool:
    return False

# -*- coding: utf-8 -*-
"""T-005 — Random Forest Regressor for wait time prediction.

Reads:  data/synthetic_tickets.csv
Writes: models/wait_time_rf.joblib
        models/encoders.joblib
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Dict

import joblib
import numpy as np
import pandas as pd
import structlog
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from structlog.types import FilteringBoundLogger

# Logger --------------------------------------------------------------------
logger: FilteringBoundLogger = structlog.get_logger().bind(
    service="smartqueue-ml",
    module=__name__,
)

# Paths ---------------------------------------------------------------------
CSV_PATH = os.path.join("data", "synthetic_tickets.csv")
MODEL_DIR = os.path.join("models")
MODEL_PATH = os.path.join(MODEL_DIR, "wait_time_rf.joblib")
ENCODER_PATH = os.path.join(MODEL_DIR, "encoders.joblib")

# Feature order --------------------------------------------------------------
FEATURE_COLUMNS = [
    "hour",
    "day_of_week",
    "is_weekend",
    "is_lunch_hour",
    "queue_length_at_arrival",
    "active_agents",
    "service_type",
    "priority",
]


def _load_data() -> pd.DataFrame:
    return pd.read_csv(CSV_PATH, parse_dates=["timestamp"])


def _encode_categoricals(df: pd.DataFrame) -> Dict[str, LabelEncoder]:
    encoders: Dict[str, LabelEncoder] = {}
    for col in ["service_type", "priority"]:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col])
        encoders[col] = le
    return encoders


def _build_pipeline() -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        (
            "model",
            RandomForestRegressor(
                n_estimators=100,
                max_depth=15,
                min_samples_split=5,
                random_state=42,
                n_jobs=-1,
            ),
        ),
    ])


def train_and_evaluate() -> None:
    df = _load_data()
    encoders = _encode_categoricals(df)

    X = df[FEATURE_COLUMNS]
    y = df["wait_time_seconds"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    pipeline = _build_pipeline()
    pipeline.fit(X_train, y_train)
    preds = pipeline.predict(X_test)

    mae = mean_absolute_error(y_test, preds)
    rmse = root_mean_squared_error(y_test, preds)
    r2 = r2_score(y_test, preds)

    importances = pipeline.named_steps["model"].feature_importances_
    top_idx = np.argsort(importances)[::-1][:5]
    top_features = [
        {"feature": FEATURE_COLUMNS[i], "importance": float(importances[i])}
        for i in top_idx
    ]

    logger.info(
        "train_complete",
        timestamp=datetime.now(tz=UTC).isoformat(),
        level="info",
        mae_seconds=round(mae, 2),
        rmse_seconds=round(rmse, 2),
        r2_score=round(r2, 4),
        top_5_feature_importances=top_features,
    )

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)
    joblib.dump(encoders, ENCODER_PATH)

    logger.info(
        "artifacts_saved",
        timestamp=datetime.now(tz=UTC).isoformat(),
        level="info",
        model_path=MODEL_PATH,
        encoder_path=ENCODER_PATH,
    )


if __name__ == "__main__":
    train_and_evaluate()

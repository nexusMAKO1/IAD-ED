# -*- coding: utf-8 -*-
"""T-004 — Synthetic ticket dataset.

Period: 01 Mar 2026 → 31 May 2026. Target: ~15 000 rows.
Simulates a Tunisian bank branch.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

import numpy as np
import pandas as pd
import structlog
from structlog.types import FilteringBoundLogger

# Bind logger with required fields
logger: FilteringBoundLogger = structlog.get_logger().bind(
    service="smartqueue-ml",
    module=__name__,
)

# ---------------------------------------------------------------------------
# Constants & helper functions
# ---------------------------------------------------------------------------
START_DATE = datetime(2026, 3, 1)
END_DATE = datetime(2026, 5, 31, 23, 59, 59)

SERVICE_TYPES = [
    "consultation",
    "virement",
    "retrait",
    "depot",
    "reclamation",
    "info",
]

PRIORITY_CHOICES = ["standard", "priority", "vip"]
PRIORITY_PROBS = [0.70, 0.20, 0.10]

SERVICE_MULTIPLIERS = {
    "reclamation": 1.6,
    "consultation": 1.4,
    "virement": 1.1,
    "retrait": 0.9,
    "depot": 0.9,
    "info": 0.7,
}

PRIORITY_MULTIPLIERS = {"vip": 0.60, "priority": 0.80, "standard": 1.00}


def _rand_timestamps(n: int) -> pd.Series:
    """Return ``n`` random timestamps between START_DATE and END_DATE."""
    total_seconds = int((END_DATE - START_DATE).total_seconds())
    offs = np.random.randint(0, total_seconds + 1, size=n)
    return pd.to_datetime(START_DATE + pd.to_timedelta(offs, unit="s"))


def _clip(arr: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return np.clip(arr, lo, hi)


def generate_dataset(row_target: int = 15_000) -> pd.DataFrame:
    """Generate the synthetic ticket dataframe.

    Returns:
        pd.DataFrame with the exact column order required by the training
        pipeline.
    """
    # ------------------------------------------------------------------- time
    ts = _rand_timestamps(row_target)
    hour = ts.hour.values
    dow = ts.weekday.values  # 0 = Mon, 6 = Sun
    is_weekend = (dow >= 5).astype(bool)
    is_lunch = np.isin(hour, [12, 13])

    # ---------------------------------------------------------------- service
    service_type = np.random.choice(SERVICE_TYPES, size=row_target)
    priority = np.random.choice(
        PRIORITY_CHOICES, size=row_target, p=PRIORITY_PROBS
    )

    # ----------------------------------------------------------- queue & agents
    peak = ((hour >= 9) & (hour <= 11)) | ((hour >= 14) & (hour <= 16))
    q_len = np.where(
        peak,
        _clip(np.random.normal(18, 5, size=row_target), 5, 30),
        _clip(np.random.normal(6, 3, size=row_target), 0, 15),
    ).astype(int)

    agents = np.where(
        peak, np.random.randint(3, 6, size=row_target), np.random.randint(1, 4, size=row_target)
    )
    agents = np.where(is_lunch, np.minimum(agents, 2), agents)

    # -------------------------------------------------------------- base wait
    base = q_len * 45 + np.random.normal(0, 30, size=row_target)

    # ------------------------------------------------------------ multipliers
    svc_mul = np.vectorize(SERVICE_MULTIPLIERS.get)(service_type)
    prio_mul = np.vectorize(PRIORITY_MULTIPLIERS.get)(priority)
    wait = base * svc_mul * prio_mul + np.random.normal(0, 60, size=row_target)
    wait_seconds = _clip(wait, 60, 2700).astype(int)

    df = pd.DataFrame(
        {
            "ticket_id": [
                f"{i}-{os.urandom(4).hex()}" for i in range(row_target)
            ],
            "timestamp": ts,
            "hour": hour,
            "day_of_week": dow,
            "is_weekend": is_weekend,
            "is_lunch_hour": is_lunch,
            "service_type": service_type,
            "priority": priority,
            "queue_length_at_arrival": q_len,
            "active_agents": agents,
            "wait_time_seconds": wait_seconds,
        }
    )
    return df


def main() -> None:
    """CLI entry-point - generate CSV and log a short summary."""
    df = generate_dataset()
    out_dir = os.path.join("data")
    os.makedirs(out_dir, exist_ok=True)
    csv_path = os.path.join(out_dir, "synthetic_tickets.csv")
    df.to_csv(csv_path, index=False)

    logger.info(
        "dataset_generated",
        timestamp=datetime.now(tz=UTC).isoformat(),
        level="info",
        rows=len(df),
        path=csv_path,
    )
    logger.info(
        "dataset_head",
        timestamp=datetime.now(tz=UTC).isoformat(),
        level="info",
        head=df.head().to_dict(orient="records"),
    )


if __name__ == "__main__":
    main()


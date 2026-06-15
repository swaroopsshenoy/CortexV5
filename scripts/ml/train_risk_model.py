#!/usr/bin/env python3
"""Train RandomForest performance-risk model and save joblib artifact."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET = ROOT / "resources" / "ml_performance_dataset" / "dataset.csv"
DEFAULT_MODEL = ROOT / "resources" / "ml_models" / "performance_risk.joblib"
FEATURE_COLUMNS_PATH = ROOT / "resources" / "ml_performance_dataset" / "feature_columns.json"


def load_feature_columns() -> list[str]:
    columns = json.loads(FEATURE_COLUMNS_PATH.read_text(encoding="utf-8"))
    if not isinstance(columns, list):
        raise ValueError("feature_columns.json must be a list")
    return columns


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--model-output", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--target-column", default="performance_risk")
    parser.add_argument("--n-estimators", type=int, default=300)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()

    if not args.dataset.exists():
        raise FileNotFoundError(f"Dataset not found: {args.dataset}")

    feature_order = load_feature_columns()
    df = pd.read_csv(args.dataset)
    if args.target_column not in df.columns:
        raise ValueError(f"Target column missing: {args.target_column}")

    missing = [name for name in feature_order if name not in df.columns]
    if missing:
        raise ValueError(f"Dataset missing feature columns: {missing}")

    X = df[feature_order]
    y = df[args.target_column]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=args.random_state, stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=args.n_estimators,
        random_state=args.random_state,
        class_weight="balanced",
    )
    model.fit(X_train, y_train)
    accuracy = float(model.score(X_test, y_test))

    feature_means = {name: float(X[name].mean()) for name in feature_order}
    args.model_output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "feature_order": feature_order,
            "feature_means": feature_means,
            "target_column": args.target_column,
            "classes": list(model.classes_),
        },
        args.model_output,
    )

    print(
        json.dumps(
            {
                "model_path": str(args.model_output),
                "rows": int(df.shape[0]),
                "features": feature_order,
                "accuracy": accuracy,
                "classes": list(model.classes_),
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

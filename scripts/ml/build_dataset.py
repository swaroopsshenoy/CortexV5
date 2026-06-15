#!/usr/bin/env python3
"""Build performance-risk training CSV from synthetic samples and optional program heuristics."""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
FEATURE_COLUMNS_PATH = ROOT / "resources" / "ml_performance_dataset" / "feature_columns.json"
DEFAULT_OUTPUT = ROOT / "resources" / "ml_performance_dataset" / "dataset.csv"


def load_columns() -> list[str]:
    columns = json.loads(FEATURE_COLUMNS_PATH.read_text(encoding="utf-8"))
    if not isinstance(columns, list):
        raise ValueError("feature_columns.json must be a list")
    return columns


def risk_score(row: dict[str, float]) -> float:
    return (
        row["loops_total"] * 1.4
        + row["nesting_max_depth"] * 2.2
        + row["recursion_count"] * 3.0
        + row["alloc_total"] * 1.8
        + row["complexity_time_rank"] * 2.5
        + row["semantic_high_severity_count"] * 2.0
        + row["code_smell_high_severity_count"] * 1.5
    )


def label_row(row: dict[str, float]) -> str:
    score = risk_score(row)
    if score >= 28:
        return "risk_high"
    if score >= 16:
        return "risk_medium"
    return "risk_low"


def tier_ranges(rng: random.Random) -> tuple[str, dict[str, tuple[int, int]]]:
    tier = rng.choices(["risk_low", "risk_medium", "risk_high"], weights=[40, 35, 25], k=1)[0]
    if tier == "risk_low":
        return tier, {
            "loops": (0, 2),
            "nesting": (0, 2),
            "recursion": (0, 0),
            "complexity_time": (1, 2),
            "semantic_high": (0, 0),
            "smell_high": (0, 1),
            "alloc": (0, 3),
        }
    if tier == "risk_medium":
        return tier, {
            "loops": (2, 5),
            "nesting": (2, 4),
            "recursion": (0, 1),
            "complexity_time": (3, 4),
            "semantic_high": (0, 2),
            "smell_high": (1, 2),
            "alloc": (3, 10),
        }
    return tier, {
        "loops": (4, 8),
        "nesting": (4, 7),
        "recursion": (1, 3),
        "complexity_time": (5, 7),
        "semantic_high": (1, 3),
        "smell_high": (2, 4),
        "alloc": (8, 20),
    }


def random_row(rng: random.Random, columns: list[str]) -> dict[str, float]:
    tier, ranges = tier_ranges(rng)
    row = {
        "loops_total": float(rng.randint(*ranges["loops"])),
        "loops_for": 0.0,
        "loops_while": 0.0,
        "loops_do_while": 0.0,
        "loops_range_for": 0.0,
        "nesting_max_depth": float(rng.randint(*ranges["nesting"])),
        "recursion_count": float(rng.randint(*ranges["recursion"])),
        "function_count": float(rng.randint(1, 20)),
        "pointers_declarations": float(rng.randint(0, 15)),
        "pointers_dereferences": float(rng.randint(0, 25)),
        "pointers_address_of": float(rng.randint(0, 10)),
        "pointers_total": 0.0,
        "stl_container_refs": float(rng.randint(0, 12)),
        "stl_algorithm_calls": float(rng.randint(0, 8)),
        "stl_iterator_usage": float(rng.randint(0, 10)),
        "stl_total": 0.0,
        "alloc_heap_new": float(rng.randint(0, max(1, ranges["alloc"][1] // 3))),
        "alloc_heap_delete": float(rng.randint(0, max(1, ranges["alloc"][1] // 3))),
        "alloc_malloc_family": float(rng.randint(0, max(1, ranges["alloc"][1] // 4))),
        "alloc_free_calls": float(rng.randint(0, max(1, ranges["alloc"][1] // 4))),
        "alloc_stack_arrays": float(rng.randint(0, max(1, ranges["alloc"][1] // 4))),
        "alloc_total": 0.0,
        "semantic_issue_count": float(rng.randint(0, 6)),
        "semantic_high_severity_count": float(rng.randint(*ranges["semantic_high"])),
        "code_smell_count": float(rng.randint(ranges["smell_high"][0], ranges["smell_high"][1] + 3)),
        "code_smell_high_severity_count": float(rng.randint(*ranges["smell_high"])),
        "complexity_time_rank": float(rng.randint(*ranges["complexity_time"])),
        "complexity_space_rank": float(rng.randint(1, ranges["complexity_time"][1])),
    }
    row["loops_for"] = min(row["loops_total"], float(rng.randint(0, int(row["loops_total"]))))
    row["loops_while"] = max(0.0, row["loops_total"] - row["loops_for"] - row["loops_range_for"])
    row["pointers_total"] = row["pointers_declarations"] + row["pointers_dereferences"] + row["pointers_address_of"]
    row["stl_total"] = row["stl_container_refs"] + row["stl_algorithm_calls"] + row["stl_iterator_usage"]
    row["alloc_total"] = (
        row["alloc_heap_new"]
        + row["alloc_heap_delete"]
        + row["alloc_malloc_family"]
        + row["alloc_free_calls"]
        + row["alloc_stack_arrays"]
    )
    vector = {column: float(row.get(column, 0.0)) for column in columns}
    vector["_tier"] = tier
    return vector


def build_dataset(rows: int, seed: int) -> pd.DataFrame:
    columns = load_columns()
    rng = random.Random(seed)
    records: list[dict[str, float | str]] = []
    for _ in range(rows):
        features = random_row(rng, columns)
        tier = features.pop("_tier", None)
        label = tier if tier in {"risk_low", "risk_medium", "risk_high"} else label_row(features)
        records.append({**features, "performance_risk": label})
    return pd.DataFrame.from_records(records)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=480)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    df = build_dataset(rows=max(50, args.rows), seed=args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.output, index=False)
    print(json.dumps({"rows": int(df.shape[0]), "columns": list(df.columns), "output": str(args.output)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

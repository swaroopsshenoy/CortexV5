#!/usr/bin/env python3
"""Build performance-risk training CSV from synthetic samples and optional program heuristics."""

from __future__ import annotations

import argparse
import json
import re
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


# ---------------------------------------------------------------------------
# Real C++ program feature extraction
# ---------------------------------------------------------------------------

_FOR_RE = re.compile(r'\bfor\s*\(')
_RANGE_FOR_RE = re.compile(r'\bfor\s*\(.*?:')
_WHILE_RE = re.compile(r'\bwhile\s*\(')
_DO_RE = re.compile(r'\bdo\s*\{')
_NEW_RE = re.compile(r'\bnew\b')
_DELETE_RE = re.compile(r'\bdelete\b')
_MALLOC_RE = re.compile(r'\b(malloc|calloc|realloc)\b')
_FREE_RE = re.compile(r'\bfree\s*\(')
_PTR_DECL_RE = re.compile(r'\b\w+\s*\*\s*\w+')
_DEREF_RE = re.compile(r'\*\s*\w+|\w+\s*->')
_ADDR_RE = re.compile(r'&\s*\w+')
_STL_CONT_RE = re.compile(r'\b(vector|list|deque|map|set|unordered_map|unordered_set|multimap|multiset|queue|stack|priority_queue)\b')
_STL_ALGO_RE = re.compile(r'\b(sort|find|count|accumulate|transform|copy|remove|replace|reverse|for_each|lower_bound|upper_bound|binary_search|merge|unique)\s*\(')
_STL_ITER_RE = re.compile(r'\b(begin|end|rbegin|rend|cbegin|cend|iterator|const_iterator)\b')
_SEMANTIC_RE = re.compile(r'\bnull\b|->next->next|delete\s+\w+;\s*\*\w+')
_SMELL_THRESHOLD = 40


def _nesting_depth(code: str) -> int:
    depth = peak = 0
    for ch in code:
        if ch == '{': depth += 1; peak = max(peak, depth)
        elif ch == '}': depth = max(0, depth - 1)
    return peak


def _func_names(code: str) -> list[str]:
    names = []
    skip = {'if', 'while', 'for', 'switch', 'catch', 'else'}
    for m in re.finditer(r'\b([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{', code):
        if m.group(1) not in skip:
            names.append(m.group(1))
    return list(set(names))


def _recursion_count(code: str, names: list[str]) -> int:
    return sum(1 for n in names if len(re.findall(rf'\b{re.escape(n)}\s*\(', code)) >= 2)


def _long_func_smells(code: str) -> int:
    smells = 0
    lines = code.split('\n')
    start, depth = None, 0
    for i, line in enumerate(lines):
        if re.search(r'\b\w+\s*\([^)]*\)\s*\{', line):
            start = i; depth = line.count('{') - line.count('}')
        elif start is not None:
            depth += line.count('{') - line.count('}')
            if depth <= 0:
                if i - start > _SMELL_THRESHOLD: smells += 1
                start = None; depth = 0
    return smells


def extract_features_from_cpp(path: Path, columns: list[str]) -> dict[str, float]:
    code = path.read_text(encoding='utf-8', errors='ignore')
    for_loops = len(_FOR_RE.findall(code))
    range_for = len(_RANGE_FOR_RE.findall(code))
    while_loops = len(_WHILE_RE.findall(code))
    do_loops = len(_DO_RE.findall(code))
    loops_total = for_loops + while_loops + do_loops
    names = _func_names(code)
    recursion = _recursion_count(code, names)
    nesting = _nesting_depth(code)
    ptr_d = len(_PTR_DECL_RE.findall(code))
    ptr_r = len(_DEREF_RE.findall(code))
    ptr_a = len(_ADDR_RE.findall(code))
    stl_c = len(_STL_CONT_RE.findall(code))
    stl_a = len(_STL_ALGO_RE.findall(code))
    stl_i = len(_STL_ITER_RE.findall(code))
    a_new = len(_NEW_RE.findall(code))
    a_del = len(_DELETE_RE.findall(code))
    a_mal = len(_MALLOC_RE.findall(code))
    a_fre = len(_FREE_RE.findall(code))
    a_stk = len(re.findall(r'\b\w+\s+\w+\s*\[', code))
    alloc_total = a_new + a_del + a_mal + a_fre + a_stk
    sem_high = len(_SEMANTIC_RE.findall(code))
    sem_total = sem_high + len(re.findall(r'\bvoid\s*\*', code))
    smell_high = _long_func_smells(code)
    smell_total = smell_high + max(0, len(names) - 5)
    if nesting >= 5 or loops_total >= 6: ct_rank = 6
    elif nesting >= 3 or loops_total >= 3: ct_rank = 4
    elif loops_total >= 1: ct_rank = 2
    else: ct_rank = 1
    cs_rank = min(6, max(1, nesting // 2 + recursion))
    row = {
        'loops_total': float(loops_total), 'loops_for': float(max(0, for_loops - range_for)),
        'loops_while': float(while_loops), 'loops_do_while': float(do_loops),
        'loops_range_for': float(range_for), 'nesting_max_depth': float(nesting),
        'recursion_count': float(recursion), 'function_count': float(len(names)),
        'pointers_declarations': float(ptr_d), 'pointers_dereferences': float(ptr_r),
        'pointers_address_of': float(ptr_a), 'pointers_total': float(ptr_d + ptr_r + ptr_a),
        'stl_container_refs': float(stl_c), 'stl_algorithm_calls': float(stl_a),
        'stl_iterator_usage': float(stl_i), 'stl_total': float(stl_c + stl_a + stl_i),
        'alloc_heap_new': float(a_new), 'alloc_heap_delete': float(a_del),
        'alloc_malloc_family': float(a_mal), 'alloc_free_calls': float(a_fre),
        'alloc_stack_arrays': float(a_stk), 'alloc_total': float(alloc_total),
        'semantic_issue_count': float(sem_total), 'semantic_high_severity_count': float(sem_high),
        'code_smell_count': float(smell_total), 'code_smell_high_severity_count': float(smell_high),
        'complexity_time_rank': float(ct_rank), 'complexity_space_rank': float(cs_rank),
    }
    return {col: float(row.get(col, 0.0)) for col in columns}


def build_real_program_rows(programs_dir: Path, columns: list[str]) -> list[dict]:
    records = []
    for cpp in sorted(programs_dir.rglob('*.cpp')):
        try:
            features = extract_features_from_cpp(cpp, columns)
            records.append({**features, 'performance_risk': label_row(features)})
        except Exception as exc:
            print(f'[WARN] skipping {cpp.name}: {exc}')
    return records


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--rows', type=int, default=480)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--programs-dir', type=Path, default=None,
                        help='Directory of .cpp files to extract features from')
    args = parser.parse_args()

    columns = load_columns()
    synthetic_df = build_dataset(rows=max(50, args.rows), seed=args.seed)

    if args.programs_dir and args.programs_dir.exists():
        real_rows = build_real_program_rows(args.programs_dir, columns)
        real_df = pd.DataFrame.from_records(real_rows) if real_rows else pd.DataFrame()
        df = pd.concat([synthetic_df, real_df], ignore_index=True) if not real_df.empty else synthetic_df
        print(f'[dataset] synthetic={len(synthetic_df)} real={len(real_rows)} total={len(df)}')
    else:
        df = synthetic_df

    args.output.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.output, index=False)
    print(json.dumps({'rows': int(df.shape[0]), 'columns': list(df.columns), 'output': str(args.output)}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

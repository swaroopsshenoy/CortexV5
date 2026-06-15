import json
from pathlib import Path

BIG_O_RANK = {
    "O(1)": 1,
    "O(log n)": 2,
    "O(n)": 3,
    "O(n log n)": 4,
    "O(n^2)": 5,
    "O(n^3)": 6,
    "O(2^n)": 7,
    "O(n!)": 8,
}


def project_root() -> Path:
    return Path(__file__).resolve().parents[4]


def load_feature_columns() -> list[str]:
    path = project_root() / "resources" / "ml_performance_dataset" / "feature_columns.json"
    columns = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(columns, list) or not all(isinstance(item, str) for item in columns):
        raise ValueError("feature_columns.json must be a string array")
    return columns


def rank_big_o(value: object) -> int:
    if not isinstance(value, str):
        return 0
    return int(BIG_O_RANK.get(value.strip(), 0))


def count_severity(issues: list[dict], severity: str) -> int:
    return sum(1 for item in issues if item.get("severity") == severity)


def build_feature_vector_from_analyze_payload(analyze_payload: dict) -> dict[str, float]:
    features = analyze_payload.get("features") or {}
    loops = features.get("loops") or {}
    nesting = features.get("nesting") or {}
    recursion = features.get("recursion") or {}
    pointers = features.get("pointers") or {}
    stl = features.get("stl") or {}
    allocations = features.get("allocations") or {}
    semantic_issues = (analyze_payload.get("semanticChecks") or {}).get("issues") or []
    smell_issues = (analyze_payload.get("codeSmells") or {}).get("issues") or []
    complexity = analyze_payload.get("complexityEstimate") or analyze_payload.get("complexity") or {}

    values = {
        "loops_total": loops.get("total", 0),
        "loops_for": loops.get("for", 0),
        "loops_while": loops.get("while", 0),
        "loops_do_while": loops.get("doWhile", 0),
        "loops_range_for": loops.get("rangeFor", 0),
        "nesting_max_depth": nesting.get("maxDepth", 0),
        "recursion_count": recursion.get("recursiveFunctionCount", 0),
        "function_count": recursion.get("functionCount", 0),
        "pointers_declarations": pointers.get("declarations", 0),
        "pointers_dereferences": pointers.get("dereferences", 0),
        "pointers_address_of": pointers.get("addressOf", 0),
        "pointers_total": pointers.get("total", 0),
        "stl_container_refs": stl.get("containerReferences", 0),
        "stl_algorithm_calls": stl.get("algorithmCalls", 0),
        "stl_iterator_usage": stl.get("iteratorUsage", 0),
        "stl_total": stl.get("total", 0),
        "alloc_heap_new": allocations.get("heapNew", 0),
        "alloc_heap_delete": allocations.get("heapDelete", 0),
        "alloc_malloc_family": allocations.get("mallocFamily", 0),
        "alloc_free_calls": allocations.get("freeCalls", 0),
        "alloc_stack_arrays": allocations.get("stackArrayDeclarations", 0),
        "alloc_total": allocations.get("total", 0),
        "semantic_issue_count": len(semantic_issues),
        "semantic_high_severity_count": count_severity(semantic_issues, "high"),
        "code_smell_count": len(smell_issues),
        "code_smell_high_severity_count": count_severity(smell_issues, "high"),
        "complexity_time_rank": rank_big_o((complexity.get("time") or {}).get("bigO")),
        "complexity_space_rank": rank_big_o((complexity.get("space") or {}).get("bigO")),
    }
    return {key: float(values.get(key, 0)) for key in load_feature_columns()}

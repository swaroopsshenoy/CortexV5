const fs = require("node:fs");
const path = require("node:path");

const FEATURE_LABELS = Object.freeze({
  loops_total: "Total loops",
  loops_for: "For loops",
  loops_while: "While loops",
  loops_do_while: "Do-while loops",
  loops_range_for: "Range-for loops",
  nesting_max_depth: "Maximum nesting depth",
  recursion_count: "Recursive functions",
  function_count: "Function count",
  pointers_declarations: "Pointer declarations",
  pointers_dereferences: "Pointer dereferences",
  pointers_address_of: "Address-of operations",
  pointers_total: "Pointer operations (total)",
  stl_container_refs: "STL container usage",
  stl_algorithm_calls: "STL algorithm calls",
  stl_iterator_usage: "Iterator usage",
  stl_total: "STL usage (total)",
  alloc_heap_new: "Heap new allocations",
  alloc_heap_delete: "Heap delete calls",
  alloc_malloc_family: "malloc/calloc/realloc",
  alloc_free_calls: "free calls",
  alloc_stack_arrays: "Stack array declarations",
  alloc_total: "Allocation signals (total)",
  semantic_issue_count: "Semantic issues",
  semantic_high_severity_count: "High-severity semantic issues",
  code_smell_count: "Code smells",
  code_smell_high_severity_count: "High-severity code smells",
  complexity_time_rank: "Estimated time complexity rank",
  complexity_space_rank: "Estimated space complexity rank"
});

const BIG_O_RANK = Object.freeze({
  "O(1)": 1,
  "O(log n)": 2,
  "O(n)": 3,
  "O(n log n)": 4,
  "O(n^2)": 5,
  "O(n^3)": 6,
  "O(2^n)": 7,
  "O(n!)": 8
});

let cachedFeatureColumns = null;

function loadFeatureColumns(projectRoot) {
  if (cachedFeatureColumns) {
    return cachedFeatureColumns;
  }
  const filePath = path.join(
    projectRoot,
    "resources",
    "ml_performance_dataset",
    "feature_columns.json"
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("feature_columns.json must be string array");
  }
  cachedFeatureColumns = parsed;
  return cachedFeatureColumns;
}

function rankBigO(value) {
  if (typeof value !== "string") {
    return 0;
  }
  return BIG_O_RANK[value.trim()] ?? 0;
}

function countSeverity(issues, severity) {
  return (issues ?? []).filter((item) => item?.severity === severity).length;
}

function buildFeatureVectorFromAnalyzePayload(analyzePayload) {
  const features = analyzePayload?.features ?? {};
  const loops = features.loops ?? {};
  const nesting = features.nesting ?? {};
  const recursion = features.recursion ?? {};
  const pointers = features.pointers ?? {};
  const stl = features.stl ?? {};
  const allocations = features.allocations ?? {};
  const semanticIssues = analyzePayload?.semanticChecks?.issues ?? [];
  const smellIssues = analyzePayload?.codeSmells?.issues ?? [];
  const complexity = analyzePayload?.complexityEstimate ?? analyzePayload?.complexity ?? {};

  const values = {
    loops_total: loops.total ?? 0,
    loops_for: loops.for ?? 0,
    loops_while: loops.while ?? 0,
    loops_do_while: loops.doWhile ?? 0,
    loops_range_for: loops.rangeFor ?? 0,
    nesting_max_depth: nesting.maxDepth ?? 0,
    recursion_count: recursion.recursiveFunctionCount ?? 0,
    function_count: recursion.functionCount ?? 0,
    pointers_declarations: pointers.declarations ?? 0,
    pointers_dereferences: pointers.dereferences ?? 0,
    pointers_address_of: pointers.addressOf ?? 0,
    pointers_total: pointers.total ?? 0,
    stl_container_refs: stl.containerReferences ?? 0,
    stl_algorithm_calls: stl.algorithmCalls ?? 0,
    stl_iterator_usage: stl.iteratorUsage ?? 0,
    stl_total: stl.total ?? 0,
    alloc_heap_new: allocations.heapNew ?? 0,
    alloc_heap_delete: allocations.heapDelete ?? 0,
    alloc_malloc_family: allocations.mallocFamily ?? 0,
    alloc_free_calls: allocations.freeCalls ?? 0,
    alloc_stack_arrays: allocations.stackArrayDeclarations ?? 0,
    alloc_total: allocations.total ?? 0,
    semantic_issue_count: semanticIssues.length,
    semantic_high_severity_count: countSeverity(semanticIssues, "high"),
    code_smell_count: smellIssues.length,
    code_smell_high_severity_count: countSeverity(smellIssues, "high"),
    complexity_time_rank: rankBigO(complexity?.time?.bigO),
    complexity_space_rank: rankBigO(complexity?.space?.bigO)
  };

  return values;
}

function buildFeatureVector(analyzePayload, projectRoot) {
  const columns = loadFeatureColumns(projectRoot);
  const values = buildFeatureVectorFromAnalyzePayload(analyzePayload);
  const vector = {};
  for (const column of columns) {
    vector[column] = Number(values[column] ?? 0);
  }
  return vector;
}

function parseAnalyzeStdout(stdout) {
  if (typeof stdout !== "string" || stdout.trim().length === 0) {
    return null;
  }
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function humanizeFeatureName(featureKey) {
  return FEATURE_LABELS[featureKey] ?? featureKey;
}

module.exports = {
  FEATURE_LABELS,
  BIG_O_RANK,
  loadFeatureColumns,
  buildFeatureVectorFromAnalyzePayload,
  buildFeatureVector,
  parseAnalyzeStdout,
  humanizeFeatureName
};

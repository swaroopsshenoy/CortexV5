const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  buildFeatureVector,
  buildFeatureVectorFromAnalyzePayload,
  humanizeFeatureName
} = require("./performanceRiskFeatures");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

test("buildFeatureVectorFromAnalyzePayload maps analyze JSON fields", () => {
  const vector = buildFeatureVectorFromAnalyzePayload({
    features: {
      loops: { total: 3, for: 2, while: 1, doWhile: 0, rangeFor: 0 },
      nesting: { maxDepth: 4 },
      recursion: { recursiveFunctionCount: 1, functionCount: 5 },
      pointers: { declarations: 2, dereferences: 3, addressOf: 1, total: 6 },
      stl: { containerReferences: 2, algorithmCalls: 1, iteratorUsage: 1, total: 4 },
      allocations: {
        heapNew: 1,
        heapDelete: 0,
        mallocFamily: 0,
        freeCalls: 0,
        stackArrayDeclarations: 2,
        total: 3
      }
    },
    semanticChecks: { issues: [{ severity: "high" }, { severity: "low" }] },
    codeSmells: { issues: [{ severity: "high" }] },
    complexityEstimate: {
      time: { bigO: "O(n^2)" },
      space: { bigO: "O(n)" }
    }
  });

  assert.equal(vector.loops_total, 3);
  assert.equal(vector.nesting_max_depth, 4);
  assert.equal(vector.semantic_issue_count, 2);
  assert.equal(vector.semantic_high_severity_count, 1);
  assert.equal(vector.complexity_time_rank, 5);
  assert.equal(vector.complexity_space_rank, 3);
});

test("buildFeatureVector enforces feature column order and keys", () => {
  const vector = buildFeatureVector(
    {
      features: {
        loops: { total: 1, for: 1, while: 0, doWhile: 0, rangeFor: 0 },
        nesting: { maxDepth: 1 },
        recursion: { recursiveFunctionCount: 0, functionCount: 1 },
        pointers: { declarations: 0, dereferences: 0, addressOf: 0, total: 0 },
        stl: { containerReferences: 0, algorithmCalls: 0, iteratorUsage: 0, total: 0 },
        allocations: {
          heapNew: 0,
          heapDelete: 0,
          mallocFamily: 0,
          freeCalls: 0,
          stackArrayDeclarations: 0,
          total: 0
        }
      },
      semanticChecks: { issues: [] },
      codeSmells: { issues: [] },
      complexityEstimate: { time: { bigO: "O(1)" }, space: { bigO: "O(1)" } }
    },
    PROJECT_ROOT
  );

  assert.equal(typeof vector.loops_total, "number");
  assert.ok("performance_risk" in vector === false);
  assert.equal(humanizeFeatureName("nesting_max_depth"), "Maximum nesting depth");
});

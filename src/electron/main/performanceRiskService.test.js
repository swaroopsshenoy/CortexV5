const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createPerformanceRiskService } = require("./performanceRiskService");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

test("predictFromAnalyzeResult returns unavailable when analyze failed", async () => {
  const service = createPerformanceRiskService({
    projectRoot: PROJECT_ROOT,
    toProjectPath: (input) => path.join(PROJECT_ROOT, input),
    runProcess: async () => ({ code: 0, stdout: "{}", stderr: "" })
  });

  const result = await service.predictFromAnalyzeResult({ code: 1, stdout: "", stderr: "failed" });
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "analyze_failed");
});

test("predictFromAnalyzeResult returns prediction payload from python driver", async () => {
  const service = createPerformanceRiskService({
    projectRoot: PROJECT_ROOT,
    toProjectPath: (input) => path.join(PROJECT_ROOT, input.replace(/\\/g, path.sep)),
    runProcess: async () => ({
      code: 0,
      stdout: JSON.stringify({
        status: "ok",
        riskClass: "risk_medium",
        probability: 0.82,
        confidenceBand: "high",
        probabilities: { risk_medium: 0.82, risk_low: 0.18 },
        topCauses: [{ feature: "loops_total", value: 4, contribution: 0.31 }]
      }),
      stderr: ""
    })
  });

  const analyzeStdout = JSON.stringify({
    features: {
      loops: { total: 4, for: 4, while: 0, doWhile: 0, rangeFor: 0 },
      nesting: { maxDepth: 2 },
      recursion: { recursiveFunctionCount: 0, functionCount: 2 },
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
    complexityEstimate: { time: { bigO: "O(n)" }, space: { bigO: "O(1)" } }
  });

  const result = await service.predictFromAnalyzeResult({ code: 0, stdout: analyzeStdout, stderr: "" });
  assert.equal(result.status, "ok");
  assert.equal(result.riskClass, "risk_medium");
  assert.equal(result.topCauses[0].label, "Total loops");
});

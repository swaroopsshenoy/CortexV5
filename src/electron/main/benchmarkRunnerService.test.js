const test = require("node:test");
const assert = require("node:assert/strict");
const { createBenchmarkRunnerService } = require("./benchmarkRunnerService");

test("benchmark returns compile-error without running executable", async () => {
  let compileCalls = 0;
  let runCalls = 0;
  const service = createBenchmarkRunnerService({
    projectRoot: "C:\\project",
    toProjectPath: (input) => input,
    compile: async () => {
      compileCalls += 1;
      return {
        code: 1,
        stdout: "",
        stderr: "compile failed",
        diagnostics: [],
        explanations: []
      };
    },
    runExecutable: async () => {
      runCalls += 1;
      return { code: 0, stdout: "", stderr: "" };
    }
  });

  const result = await service.benchmark({ runs: 2, warmupRuns: 1 });

  assert.equal(compileCalls, 1);
  assert.equal(runCalls, 0);
  assert.equal(result.status, "compile-error");
  assert.equal(result.runs.length, 0);
  assert.equal(result.summary.runCount, 0);
});

test("benchmark computes summary for successful runs", async () => {
  const service = createBenchmarkRunnerService({
    projectRoot: "C:\\project",
    toProjectPath: (input) => input,
    compile: async () => ({
      code: 0,
      stdout: "",
      stderr: "",
      diagnostics: [],
      explanations: []
    }),
    runExecutable: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { code: 0, stdout: "ok", stderr: "" };
    }
  });

  const result = await service.benchmark({ runs: 3, warmupRuns: 1 });

  assert.equal(result.status, "ok");
  assert.equal(result.runs.length, 3);
  assert.equal(result.summary.runCount, 3);
  assert.equal(result.summary.warmupRuns, 1);
  assert.ok(Number.isFinite(result.summary.meanMs));
  assert.ok(result.summary.minMs !== null);
  assert.ok(result.summary.maxMs !== null);
});

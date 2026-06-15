const { spawn } = require("node:child_process");

const DEFAULT_RUNS = 5;
const DEFAULT_WARMUP_RUNS = 1;
const MAX_RUNS = 50;
const MAX_WARMUP_RUNS = 10;
const OUTPUT_LIMIT = 4000;

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be non-empty string`);
  }
}

function assertStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} must be string array`);
  }
}

function normalizeRunCount(value, label, defaultValue, minValue, maxValue) {
  if (value === undefined) {
    return defaultValue;
  }
  if (!Number.isInteger(value) || value < minValue || value > maxValue) {
    throw new Error(`${label} must be integer between ${minValue} and ${maxValue}`);
  }
  return value;
}

function roundMs(value) {
  return Math.round(value * 1000) / 1000;
}

function summarizeTimings(timings, warmupRuns) {
  if (timings.length === 0) {
    return {
      runCount: 0,
      warmupRuns,
      minMs: null,
      maxMs: null,
      meanMs: null,
      medianMs: null,
      p95Ms: null
    };
  }
  const sorted = [...timings].sort((left, right) => left - right);
  const runCount = sorted.length;
  const sum = sorted.reduce((total, value) => total + value, 0);
  const mean = sum / runCount;
  const mid = Math.floor(runCount / 2);
  const median =
    runCount % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const p95Index = Math.max(0, Math.ceil(runCount * 0.95) - 1);
  return {
    runCount,
    warmupRuns,
    minMs: roundMs(sorted[0]),
    maxMs: roundMs(sorted[runCount - 1]),
    meanMs: roundMs(mean),
    medianMs: roundMs(median),
    p95Ms: roundMs(sorted[p95Index])
  };
}

function truncateOutput(value, limit = OUTPUT_LIMIT) {
  const text = String(value ?? "");
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}\n...output truncated...`;
}

function spawnExecutable(executablePath, args, options = {}) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new Error("Arguments must be string array");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, args, { shell: false, ...options });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function createBenchmarkRunnerService(options = {}) {
  assertNonEmptyString(options.projectRoot, "projectRoot");
  if (typeof options.toProjectPath !== "function") {
    throw new Error("toProjectPath must be function");
  }
  if (typeof options.compile !== "function") {
    throw new Error("compile must be function");
  }

  const runExecutable = options.runExecutable ?? spawnExecutable;

  return Object.freeze({
    async benchmark(payload = {}) {
      const compiler = payload.compiler;
      const sourcePath = options.toProjectPath(payload.sourcePath ?? "workspace\\main.cpp");
      const outputPath = options.toProjectPath(payload.outputPath ?? "build\\benchmark.exe");
      const extraArgs = payload.extraArgs ?? [];
      const args = payload.args ?? [];
      const runCount = normalizeRunCount(payload.runs, "runs", DEFAULT_RUNS, 1, MAX_RUNS);
      const warmupRuns = normalizeRunCount(
        payload.warmupRuns,
        "warmupRuns",
        DEFAULT_WARMUP_RUNS,
        0,
        MAX_WARMUP_RUNS
      );

      assertStringArray(extraArgs, "extraArgs");
      assertStringArray(args, "args");

      const compileResult = await options.compile({
        compiler,
        sourcePath,
        outputPath,
        extraArgs,
        code: payload.code
      });

      if (compileResult.code !== 0) {
        return {
          status: "compile-error",
          compile: compileResult,
          runs: [],
          summary: summarizeTimings([], warmupRuns),
          failedRun: null
        };
      }

      for (let index = 0; index < warmupRuns; index += 1) {
        await runExecutable(outputPath, args, { cwd: options.projectRoot });
      }

      const runs = [];
      for (let index = 0; index < runCount; index += 1) {
        const start = process.hrtime.bigint();
        const result = await runExecutable(outputPath, args, { cwd: options.projectRoot });
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        const runEntry = {
          runIndex: index + 1,
          durationMs: roundMs(durationMs),
          code: result.code,
          stdout: truncateOutput(result.stdout),
          stderr: truncateOutput(result.stderr)
        };
        runs.push(runEntry);

        if (result.code !== 0) {
          return {
            status: "run-error",
            compile: compileResult,
            runs,
            summary: summarizeTimings(runs.map((item) => item.durationMs), warmupRuns),
            failedRun: {
              runIndex: runEntry.runIndex,
              code: runEntry.code
            }
          };
        }
      }

      return {
        status: "ok",
        compile: compileResult,
        runs,
        summary: summarizeTimings(runs.map((item) => item.durationMs), warmupRuns),
        failedRun: null
      };
    }
  });
}

module.exports = {
  createBenchmarkRunnerService
};

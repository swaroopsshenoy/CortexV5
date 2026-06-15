const path = require("node:path");

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be non-empty string`);
  }
}

function createComparativeProfilingService() {
  let baseline = null;

  return Object.freeze({
    setBaseline(benchmarkResult) {
      if (!benchmarkResult || typeof benchmarkResult !== "object") {
        throw new Error("Baseline must be valid benchmark result");
      }
      if (!benchmarkResult.summary) {
        throw new Error("Baseline must have summary");
      }
      baseline = {
        timestamp: new Date().toISOString(),
        meanMs: benchmarkResult.summary.meanMs,
        minMs: benchmarkResult.summary.minMs,
        maxMs: benchmarkResult.summary.maxMs,
        medianMs: benchmarkResult.summary.medianMs,
        p95Ms: benchmarkResult.summary.p95Ms,
        runCount: benchmarkResult.summary.runCount,
        warmupRuns: benchmarkResult.summary.warmupRuns
      };
      return { ok: true, stored: true };
    },

    clearBaseline() {
      baseline = null;
      return { ok: true, cleared: true };
    },

    hasBaseline() {
      return baseline !== null;
    },

    compare(benchmarkResult) {
      if (!baseline) {
        throw new Error("No baseline profile stored");
      }
      if (!benchmarkResult || !benchmarkResult.summary) {
        throw new Error("Current result missing summary");
      }

      const current = benchmarkResult.summary;
      const deltas = {
        meanDeltaMs: current.meanMs - baseline.meanMs,
        meanDeltaPercent:
          baseline.meanMs !== 0
            ? ((current.meanMs - baseline.meanMs) / baseline.meanMs) * 100
            : 0,
        minDeltaMs: current.minMs - baseline.minMs,
        maxDeltaMs: current.maxMs - baseline.maxMs,
        medianDeltaMs: current.medianMs - baseline.medianMs,
        p95DeltaMs: current.p95Ms - baseline.p95Ms
      };

      const improvement =
        deltas.meanDeltaMs < 0
          ? Math.abs(deltas.meanDeltaPercent).toFixed(1)
          : deltas.meanDeltaPercent.toFixed(1);

      const direction = deltas.meanDeltaMs < 0 ? "faster" : "slower";

      return {
        status: "ok",
        baseline: {
          timestamp: baseline.timestamp,
          meanMs: baseline.meanMs
        },
        current: {
          meanMs: current.meanMs,
          minMs: current.minMs,
          maxMs: current.maxMs,
          medianMs: current.medianMs,
          p95Ms: current.p95Ms
        },
        deltas,
        summary: {
          improvement,
          direction,
          gainPercent: deltas.meanDeltaPercent < 0 ? Math.abs(deltas.meanDeltaPercent) : 0,
          regressionPercent: deltas.meanDeltaPercent > 0 ? deltas.meanDeltaPercent : 0
        }
      };
    }
  });
}

module.exports = { createComparativeProfilingService };

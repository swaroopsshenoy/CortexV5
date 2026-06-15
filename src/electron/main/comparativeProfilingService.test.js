const assert = require("node:assert");
const test = require("node:test");
const { createComparativeProfilingService } = require("./comparativeProfilingService");

test("sets baseline from benchmark result", () => {
  const service = createComparativeProfilingService();
  const baseline = {
    summary: {
      meanMs: 100,
      minMs: 95,
      maxMs: 110,
      medianMs: 99,
      p95Ms: 108,
      runCount: 5,
      warmupRuns: 1
    }
  };

  const result = service.setBaseline(baseline);

  assert.equal(result.ok, true);
  assert.equal(result.stored, true);
  assert.equal(service.hasBaseline(), true);
});

test("compare detects improvement", () => {
  const service = createComparativeProfilingService();
  service.setBaseline({
    summary: {
      meanMs: 100,
      minMs: 95,
      maxMs: 110,
      medianMs: 99,
      p95Ms: 108,
      runCount: 5,
      warmupRuns: 1
    }
  });

  const current = {
    summary: {
      meanMs: 80,
      minMs: 75,
      maxMs: 90,
      medianMs: 79,
      p95Ms: 88,
      runCount: 5,
      warmupRuns: 1
    }
  };

  const comparison = service.compare(current);

  assert.equal(comparison.status, "ok");
  assert.equal(comparison.deltas.meanDeltaMs, -20);
  assert.equal(comparison.summary.direction, "faster");
  assert.ok(comparison.summary.gainPercent > 0);
});

test("compare detects regression", () => {
  const service = createComparativeProfilingService();
  service.setBaseline({
    summary: {
      meanMs: 100,
      minMs: 95,
      maxMs: 110,
      medianMs: 99,
      p95Ms: 108,
      runCount: 5,
      warmupRuns: 1
    }
  });

  const current = {
    summary: {
      meanMs: 120,
      minMs: 115,
      maxMs: 130,
      medianMs: 119,
      p95Ms: 128,
      runCount: 5,
      warmupRuns: 1
    }
  };

  const comparison = service.compare(current);

  assert.equal(comparison.deltas.meanDeltaMs, 20);
  assert.equal(comparison.summary.direction, "slower");
  assert.ok(comparison.summary.regressionPercent > 0);
});

test("compare throws without baseline", () => {
  const service = createComparativeProfilingService();
  const current = {
    summary: { meanMs: 100, minMs: 95, maxMs: 110, medianMs: 99, p95Ms: 108 }
  };

  assert.throws(() => service.compare(current), /No baseline/);
});

test("clears baseline", () => {
  const service = createComparativeProfilingService();
  service.setBaseline({
    summary: { meanMs: 100, minMs: 95, maxMs: 110, medianMs: 99, p95Ms: 108 }
  });
  assert.equal(service.hasBaseline(), true);

  service.clearBaseline();
  assert.equal(service.hasBaseline(), false);
});

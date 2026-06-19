"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { createReportService } = require("./reportService");

// Use a real temp dir so generateReport can write files
async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "cortex-report-test-"));
}

function fakeToProjectPath(projectRoot) {
  return (inputPath) => {
    const resolved = path.resolve(projectRoot, inputPath);
    return resolved;
  };
}

test("generateReport produces a valid HTML file", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createReportService({
    projectRoot: tmpDir,
    toProjectPath: fakeToProjectPath(tmpDir)
  });

  const result = await service.generateReport({
    sourcePath: "workspace\\main.cpp",
    compiler: "g++",
    outputPath: "workspace\\main_report.html"
  });

  assert.equal(result.ok, true);
  assert.ok(typeof result.outputPath === "string");
  assert.ok(result.sizeBytes > 0);

  const html = await fs.readFile(result.outputPath, "utf8");
  assert.ok(html.startsWith("<!DOCTYPE html>"), "should start with DOCTYPE");
  assert.ok(html.includes("<html"), "should contain <html");
  assert.ok(html.includes("Cortex++ Analysis Report"), "should contain report title");
});

test("generateReport includes dark-mode CSS variables", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createReportService({
    projectRoot: tmpDir,
    toProjectPath: fakeToProjectPath(tmpDir)
  });

  const result = await service.generateReport({
    sourcePath: "workspace\\main.cpp",
    outputPath: "workspace\\main_report.html"
  });

  const html = await fs.readFile(result.outputPath, "utf8");
  assert.ok(html.includes("--bg:"), "should have --bg CSS variable");
  assert.ok(html.includes("--surface:"), "should have --surface CSS variable");
});

test("generateReport includes performance risk section", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createReportService({
    projectRoot: tmpDir,
    toProjectPath: fakeToProjectPath(tmpDir)
  });

  const analyzeResult = {
    code: 0,
    stdout: "{}",
    stderr: "",
    performanceRisk: {
      status: "ok",
      riskClass: "high",
      probability: 0.85,
      confidenceBand: "high",
      topCauses: [
        { feature: "loop_count", label: "Loop Count", value: 5, contribution: 0.42 }
      ]
    },
    nlpExplanations: []
  };

  const result = await service.generateReport({
    sourcePath: "workspace\\main.cpp",
    outputPath: "workspace\\main_report.html",
    analyzeResult
  });

  const html = await fs.readFile(result.outputPath, "utf8");
  assert.ok(html.includes("Performance Risk"), "should have risk section");
  assert.ok(html.includes("high"), "should show risk class");
  assert.ok(html.includes("Loop Count"), "should list top cause");
});

test("generateReport handles undefined analyzeResult gracefully", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createReportService({
    projectRoot: tmpDir,
    toProjectPath: fakeToProjectPath(tmpDir)
  });

  // Should not throw when no analyzeResult given
  const result = await service.generateReport({
    sourcePath: "workspace\\main.cpp",
    outputPath: "workspace\\main_report.html"
  });

  assert.equal(result.ok, true);
  const html = await fs.readFile(result.outputPath, "utf8");
  assert.ok(html.includes("No performance risk data"), "should show fallback text");
  assert.ok(html.includes("No benchmark data"), "should show benchmark fallback");
});

test("generateReport auto-generates output path from sourcePath", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createReportService({
    projectRoot: tmpDir,
    toProjectPath: fakeToProjectPath(tmpDir)
  });

  const result = await service.generateReport({
    sourcePath: "workspace\\hello.cpp"
    // no outputPath
  });

  assert.equal(result.ok, true);
  assert.ok(result.outputPath.includes("hello_report.html"), "output path should derive from sourcePath");
});

test("generateReport renders code smells section when provided", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createReportService({
    projectRoot: tmpDir,
    toProjectPath: fakeToProjectPath(tmpDir)
  });

  const analyzeResult = {
    code: 0,
    stdout: JSON.stringify({
      codeSmells: [
        { kind: "long-function", severity: "HIGH", message: "Function exceeds 100 lines" }
      ]
    }),
    stderr: ""
  };

  const result = await service.generateReport({
    sourcePath: "workspace\\main.cpp",
    outputPath: "workspace\\main_report.html",
    analyzeResult
  });

  const html = await fs.readFile(result.outputPath, "utf8");
  assert.ok(html.includes("long-function"), "should list code smell kind");
  assert.ok(html.includes("Function exceeds 100 lines"), "should show smell message");
});

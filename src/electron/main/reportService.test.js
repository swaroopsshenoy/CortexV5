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

test("generateReport omits performance risk prediction section", async (t) => {
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
  assert.equal(html.includes("Performance Risk Prediction"), false, "should not contain performance risk section");
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

test("generateReport omits code smells, optimization suggestions, and semantic issues", async (t) => {
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
      ],
      semanticIssues: [
        { kind: "dangling-pointer", severity: "HIGH", message: "Dangling pointer" }
      ],
      optimizationSuggestions: [
        { title: "Use vector reserve", rationale: "Avoid reallocation" }
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
  assert.equal(html.includes("Code Smells"), false, "should not contain Code Smells section");
  assert.equal(html.includes("Semantic Issues"), false, "should not contain Semantic Issues section");
  assert.equal(html.includes("Optimization Suggestions"), false, "should not contain Optimization Suggestions section");
});

test("generateReport omits complexity analysis section", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createReportService({
    projectRoot: tmpDir,
    toProjectPath: fakeToProjectPath(tmpDir)
  });

  const analyzeResult = {
    code: 0,
    stdout: JSON.stringify({
      complexityEstimate: {
        time: { bigO: "O(n^2)" }
      }
    }),
    stderr: ""
  };

  const result = await service.generateReport({
    sourcePath: "workspace\\main.cpp",
    outputPath: "workspace\\main_report.html",
    analyzeResult
  });

  const html = await fs.readFile(result.outputPath, "utf8");
  assert.equal(html.includes("Complexity Analysis"), false, "should not contain complexity analysis section");
});

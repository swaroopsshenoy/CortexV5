"use strict";

/**
 * Stability / stress tests.
 * Validates that all services handle edge-case inputs without throwing unexpected errors.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");

const { createClangService } = require("../clangService");
const { createAutoSaveService } = require("../autoSaveService");
const { createReportService } = require("../reportService");

// Real project root so errorExplanationService can find compiler_error_database/
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "cortex-stability-"));
}

// toProjectPath resolves relative to tmpDir for output files,
// but services are constructed with real PROJECT_ROOT so internal
// resource lookups (error DB) succeed.
function fakeProjectPath(base) {
  return (inputPath) => path.resolve(base, inputPath);
}

// ---------------------------------------------------------------------------
// Invalid / edge inputs: clangService
// ---------------------------------------------------------------------------

test("compile with invalid syntax returns diagnostics, does not throw", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createClangService({
    projectRoot: PROJECT_ROOT,
    toProjectPath: fakeProjectPath(tmpDir),
    commandExists: async () => true,
    spawnCompileProcess: async () => ({
      code: 1,
      stdout: "",
      stderr: "main.cpp:1:1: error: expected ';' after return statement"
    })
  });

  const result = await service.compile({
    compiler: "g++",
    sourcePath: "workspace\\main.cpp",
    outputPath: "build\\app.exe",
    code: "int main() { return 0 }" // missing semicolon
  });

  assert.equal(result.code, 1, "should return non-zero exit");
  assert.ok(result.diagnostics.length > 0, "should parse diagnostics");
  assert.equal(result.diagnostics[0].type, "error");
});

test("compile with unknown compiler throws cleanly", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createClangService({
    projectRoot: PROJECT_ROOT,
    toProjectPath: fakeProjectPath(tmpDir),
    commandExists: async () => false // no compiler found
  });

  await assert.rejects(
    () => service.compile({ compiler: "clang++", sourcePath: "workspace\\main.cpp", outputPath: "build\\app.exe" }),
    /Compiler not detected/
  );
});

test("compileMultiFile with 1 source file still works (single element)", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const invocations = [];
  const service = createClangService({
    projectRoot: tmpDir,
    toProjectPath: fakeProjectPath(tmpDir),
    commandExists: async () => true,
    spawnCompileProcess: async (_c, args) => {
      invocations.push(args);
      return { code: 0, stdout: "", stderr: "" };
    }
  });

  const result = await service.compileMultiFile({
    compiler: "g++",
    sourceFiles: ["workspace\\main.cpp"],
    outputPath: "build\\app.exe"
  });

  assert.equal(result.code, 0);
  // 1 compile-to-object + 1 link
  assert.equal(invocations.length, 2);
});

test("compileCmake with missing buildPath throws cleanly", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createClangService({
    projectRoot: tmpDir,
    toProjectPath: fakeProjectPath(tmpDir),
    commandExists: async () => true,
    spawnCompileProcess: async () => ({ code: 0, stdout: "", stderr: "" })
  });

  await assert.rejects(
    () => service.compileCmake({ projectRootPath: "workspace\\proj", buildPath: "" }),
    /buildPath must be non-empty string/
  );
});

// ---------------------------------------------------------------------------
// Stress: large stderr / diagnostic output doesn't OOM or crash
// ---------------------------------------------------------------------------

test("compile parses large stderr without crashing", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  // Generate 500 fake diagnostics in stderr
  const bigStderr = Array.from({ length: 500 }, (_, i) =>
    `main.cpp:${i + 1}:1: error: error number ${i + 1}`
  ).join("\n");

  const service = createClangService({
    projectRoot: PROJECT_ROOT,
    toProjectPath: fakeProjectPath(tmpDir),
    commandExists: async () => true,
    spawnCompileProcess: async () => ({ code: 1, stdout: "", stderr: bigStderr })
  });

  const result = await service.compile({
    sourcePath: "workspace\\main.cpp",
    outputPath: "build\\app.exe"
  });

  assert.equal(result.code, 1);
  assert.ok(result.diagnostics.length === 500, `expected 500 diagnostics, got ${result.diagnostics.length}`);
});

// ---------------------------------------------------------------------------
// Stability: autoSaveService
// ---------------------------------------------------------------------------

test("autosave handles many concurrent stages without data loss", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createAutoSaveService({ workspaceRoot: tmpDir });

  const files = Array.from({ length: 20 }, (_, i) => `file${i}.cpp`);
  for (const file of files) {
    service.stage(file, `// content of ${file}`);
  }
  await service.flush();

  const recoverable = await service.listRecoverable();
  assert.equal(recoverable.length, 20, "all 20 files should be recoverable");
});

test("autosave recover after repeated stage overwrites returns latest content", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createAutoSaveService({ workspaceRoot: tmpDir });

  service.stage("main.cpp", "version 1");
  service.stage("main.cpp", "version 2");
  service.stage("main.cpp", "version 3");
  await service.flush();

  const content = await service.recover("main.cpp");
  assert.equal(content, "version 3", "should recover latest staged version");
});

// ---------------------------------------------------------------------------
// Stability: reportService with pathological/missing data
// ---------------------------------------------------------------------------

test("report with completely empty payload does not throw", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createReportService({
    projectRoot: tmpDir,
    toProjectPath: fakeProjectPath(tmpDir)
  });

  // No sourcePath, no analyzeResult, no benchmarkResult
  const result = await service.generateReport({
    outputPath: "workspace\\empty_report.html"
  });

  assert.equal(result.ok, true, "should produce report even with empty payload");
  const html = await fs.readFile(result.outputPath, "utf8");
  assert.ok(html.includes("<!DOCTYPE html>"), "output should be valid HTML");
});

test("report with malformed JSON in analyzeResult.stdout does not throw", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createReportService({
    projectRoot: tmpDir,
    toProjectPath: fakeProjectPath(tmpDir)
  });

  const result = await service.generateReport({
    sourcePath: "workspace\\main.cpp",
    outputPath: "workspace\\main_report.html",
    analyzeResult: { code: 0, stdout: "NOT_VALID_JSON", stderr: "" }
  });

  assert.equal(result.ok, true, "should not crash on malformed JSON");
});

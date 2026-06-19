"use strict";

/**
 * Integration smoke test: compile -> analyze -> report pipeline.
 * Uses mocked spawn to avoid real compiler/Python invocations.
 * Validates that each stage receives expected inputs and produces schema-valid outputs.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");

const { createClangService } = require("../clangService");
const { createReportService } = require("../reportService");
const { createAutoSaveService } = require("../autoSaveService");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "cortex-integration-"));
}

function fakeProjectPath(base) {
  return (inputPath) => path.resolve(base, inputPath);
}

// ---------------------------------------------------------------------------
// Compile -> Report pipeline
// ---------------------------------------------------------------------------

test("compile succeeds and report is generated with compile data", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const compileStderr = [];
  const clangService = createClangService({
    projectRoot: tmpDir,
    toProjectPath: fakeProjectPath(tmpDir),
    commandExists: async () => true,
    spawnCompileProcess: async (_compiler, args) => {
      if (args.includes("-c")) {
        return { code: 0, stdout: "", stderr: "" };
      }
      return { code: 0, stdout: "build ok", stderr: "" };
    },
    emitCompileStderr: (chunk) => compileStderr.push(chunk)
  });

  const reportService = createReportService({
    projectRoot: tmpDir,
    toProjectPath: fakeProjectPath(tmpDir)
  });

  // Stage 1: compile (single file)
  const compileResult = await clangService.compile({
    compiler: "g++",
    sourcePath: "workspace\\main.cpp",
    outputPath: "build\\app.exe",
    code: "int main() { return 0; }"
  });

  assert.equal(compileResult.code, 0, "compile should succeed");
  assert.ok(Array.isArray(compileResult.diagnostics), "diagnostics should be array");

  // Stage 2: report using compile result
  const reportResult = await reportService.generateReport({
    sourcePath: "workspace\\main.cpp",
    compiler: "g++",
    compileResult,
    outputPath: "workspace\\main_report.html"
  });

  assert.equal(reportResult.ok, true, "report should be generated");
  assert.ok(reportResult.sizeBytes > 0, "report should have content");

  const html = await fs.readFile(reportResult.outputPath, "utf8");
  assert.ok(html.includes("<!DOCTYPE html>"), "report should be valid HTML");
  assert.ok(html.includes("Cortex++ Analysis Report"), "report should have title");
});

// ---------------------------------------------------------------------------
// Multi-file compile pipeline
// ---------------------------------------------------------------------------

test("multi-file compile: 3 sources -> 3 object files -> link", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const spawnLog = [];

  const clangService = createClangService({
    projectRoot: tmpDir,
    toProjectPath: fakeProjectPath(tmpDir),
    commandExists: async () => true,
    spawnCompileProcess: async (_compiler, args) => {
      spawnLog.push([...args]);
      return { code: 0, stdout: "", stderr: "" };
    }
  });

  const result = await clangService.compileMultiFile({
    compiler: "g++",
    sourceFiles: [
      "workspace\\main.cpp",
      "workspace\\utils.cpp",
      "workspace\\math.cpp"
    ],
    outputPath: "build\\app.exe"
  });

  assert.equal(result.code, 0, "multi-file compile should succeed");
  // 3 compile-to-object calls + 1 link = 4 total
  assert.equal(spawnLog.length, 4, "should have 4 spawn calls");

  const objectCalls = spawnLog.filter((args) => args.includes("-c"));
  assert.equal(objectCalls.length, 3, "3 object compile calls");

  const linkCall = spawnLog.find((args) => !args.includes("-c"));
  assert.ok(linkCall, "should have a link call");
  assert.ok(linkCall.some((a) => a.includes("app.exe")), "link target should be app.exe");
});

// ---------------------------------------------------------------------------
// Autosave -> Recover pipeline
// ---------------------------------------------------------------------------

test("autosave stages code; recover returns exact content", async (t) => {
  const tmpDir = await makeTempDir();
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const service = createAutoSaveService({ workspaceRoot: tmpDir });

  const code = `#include <iostream>\nint main() { std::cout << "Hello"; }`;
  service.stage("main.cpp", code);
  await service.flush();

  const recovered = await service.recover("main.cpp");
  assert.equal(recovered, code, "recovered content should match staged content");

  // After discard, recover returns null
  await service.discard("main.cpp");
  const afterDiscard = await service.recover("main.cpp");
  assert.equal(afterDiscard, null, "should be null after discard");
});

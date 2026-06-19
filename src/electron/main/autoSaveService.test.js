"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { createAutoSaveService } = require("./autoSaveService");

async function makeTempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "cortex-autosave-test-"));
}

test("stage + flush writes file to .autosave dir", async (t) => {
  const workspaceRoot = await makeTempWorkspace();
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));

  const service = createAutoSaveService({ workspaceRoot });
  service.stage("main.cpp", "int main() {}");
  await service.flush();

  const autosaveDir = path.join(workspaceRoot, ".autosave");
  const entries = await fs.readdir(autosaveDir);
  assert.ok(entries.some((e) => e.endsWith(".autosave")), "autosave file should exist");
});

test("recover returns staged content after flush", async (t) => {
  const workspaceRoot = await makeTempWorkspace();
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));

  const service = createAutoSaveService({ workspaceRoot });
  service.stage("src\\utils.cpp", "// utils");
  await service.flush();

  const content = await service.recover("src\\utils.cpp");
  assert.equal(content, "// utils");
});

test("recover returns null for unknown path", async (t) => {
  const workspaceRoot = await makeTempWorkspace();
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));

  const service = createAutoSaveService({ workspaceRoot });
  const content = await service.recover("nonexistent.cpp");
  assert.equal(content, null);
});

test("listRecoverable returns staged file paths after flush", async (t) => {
  const workspaceRoot = await makeTempWorkspace();
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));

  const service = createAutoSaveService({ workspaceRoot });
  service.stage("main.cpp", "int main() {}");
  service.stage("utils.cpp", "void helper() {}");
  await service.flush();

  const paths = await service.listRecoverable();
  assert.ok(Array.isArray(paths), "should return array");
  assert.equal(paths.length, 2, "should list 2 recoverable files");
});

test("discard removes staged file", async (t) => {
  const workspaceRoot = await makeTempWorkspace();
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));

  const service = createAutoSaveService({ workspaceRoot });
  service.stage("main.cpp", "int main() {}");
  await service.flush();

  await service.discard("main.cpp");
  const content = await service.recover("main.cpp");
  assert.equal(content, null, "content should be null after discard");
});

test("flush with no pending entries is a no-op", async (t) => {
  const workspaceRoot = await makeTempWorkspace();
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));

  const service = createAutoSaveService({ workspaceRoot });
  // Should not throw
  await assert.doesNotReject(() => service.flush());
});

test("stage ignores empty relativePath", async (t) => {
  const workspaceRoot = await makeTempWorkspace();
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));

  const service = createAutoSaveService({ workspaceRoot });
  service.stage("", "content");
  service.stage("   ", "content");
  await service.flush();

  const paths = await service.listRecoverable();
  assert.equal(paths.length, 0, "empty paths should not be staged");
});

test("stage ignores non-string content", async (t) => {
  const workspaceRoot = await makeTempWorkspace();
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));

  const service = createAutoSaveService({ workspaceRoot });
  service.stage("main.cpp", null);
  await service.flush();

  const paths = await service.listRecoverable();
  assert.equal(paths.length, 0, "non-string content should not be staged");
});

test("start and stop manage interval lifecycle", async (t) => {
  const workspaceRoot = await makeTempWorkspace();
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));

  const service = createAutoSaveService({ workspaceRoot });
  // Should not throw
  service.start();
  service.start(); // double start should be idempotent
  service.stop();
  service.stop(); // double stop should be idempotent
});

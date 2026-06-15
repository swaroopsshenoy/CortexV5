const test = require("node:test");
const assert = require("node:assert/strict");
const { createClangService, mergeWindowsClangCompatArgs } = require("./clangService");

test("mergeWindowsClangCompatArgs adds MSVC STL workarounds for clang++ on Windows", () => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });

  try {
    assert.deepEqual(mergeWindowsClangCompatArgs("clang++", ["-O2"]), [
      "-D_ALLOW_COMPILER_AND_STL_VERSION_MISMATCH",
      "-D_MSVC_STL_USE_ABORT_AS_DOOM_FUNCTION",
      "-O2"
    ]);
    assert.deepEqual(mergeWindowsClangCompatArgs("g++", ["-O2"]), ["-O2"]);
  } finally {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  }
});

test("compile retries with g++ when clang++ hits the missing CRT header error", async () => {
  const commands = [];
  const stderrChunks = [];
  const service = createClangService({
    projectRoot: "C:\\project",
    toProjectPath: (input) => input,
    commandExists: async (command) => command === "clang++" || command === "g++",
    spawnCompileProcess: async (compiler) => {
      commands.push(compiler);
      if (compiler === "clang++") {
        return {
          code: 1,
          stdout: "",
          stderr: "fatal error: 'crtdbg.h' file not found"
        };
      }
      return {
        code: 0,
        stdout: "compiled",
        stderr: ""
      };
    },
    emitCompileStderr: (chunk) => {
      stderrChunks.push(chunk);
    }
  });

  const result = await service.compile({
    compiler: "clang++",
    sourcePath: "workspace\\main.cpp",
    outputPath: "build\\app.exe"
  });

  assert.deepEqual(commands, ["clang++", "g++"]);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, "compiled");
  assert.equal(result.stderr, "");
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.explanations, []);
  assert.ok(stderrChunks.some((chunk) => chunk.includes("compiler fallback")));
});

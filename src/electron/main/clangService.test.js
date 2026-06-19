const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createClangService, mergeWindowsClangCompatArgs, buildCompileToObjectArgs, buildLinkArgs } = require("./clangService");

// Real project root so errorExplanationService can resolve compiler_error_database/
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

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
    projectRoot: PROJECT_ROOT,
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

// ---------------------------------------------------------------------------
// buildCompileToObjectArgs
// ---------------------------------------------------------------------------

test("buildCompileToObjectArgs produces -c flag and -o objectPath", () => {
  const args = buildCompileToObjectArgs("src/main.cpp", "build/main.o", ["-O2"]);
  assert.deepEqual(args, ["-c", "src/main.cpp", "-o", "build/main.o", "-O2"]);
});

test("buildCompileToObjectArgs rejects non-string extraArgs", () => {
  assert.throws(() => buildCompileToObjectArgs("a.cpp", "a.o", [42]), /extraArgs must be string array/);
});

// ---------------------------------------------------------------------------
// buildLinkArgs
// ---------------------------------------------------------------------------

test("buildLinkArgs assembles object files and output path", () => {
  const args = buildLinkArgs(["build/a.o", "build/b.o"], "build/app.exe", []);
  assert.deepEqual(args, ["build/a.o", "build/b.o", "-o", "build/app.exe"]);
});

// ---------------------------------------------------------------------------
// compileMultiFile
// ---------------------------------------------------------------------------

test("compileMultiFile compiles each .cpp to .o then links", async () => {
  const invocations = [];

  const service = createClangService({
    projectRoot: PROJECT_ROOT,
    toProjectPath: (input) => input,
    commandExists: async () => true,
    spawnCompileProcess: async (compiler, args) => {
      invocations.push({ compiler, args });
      return { code: 0, stdout: "", stderr: "" };
    }
  });

  const result = await service.compileMultiFile({
    compiler: "g++",
    sourceFiles: ["workspace\\a.cpp", "workspace\\b.cpp"],
    outputPath: "build\\app.exe"
  });

  assert.equal(result.code, 0);
  // 2 compile-to-object + 1 link
  assert.equal(invocations.length, 3);
  // First two should use -c flag
  assert.ok(invocations[0].args.includes("-c"));
  assert.ok(invocations[1].args.includes("-c"));
  // Third is the link step (no -c)
  assert.ok(!invocations[2].args.includes("-c"));
  assert.ok(invocations[2].args.includes("build\\app.exe"));
});

test("compileMultiFile stops on first failing .o compile", async () => {
  let callCount = 0;

  const service = createClangService({
    projectRoot: PROJECT_ROOT,
    toProjectPath: (input) => input,
    commandExists: async () => true,
    spawnCompileProcess: async (_compiler, args) => {
      callCount += 1;
      if (args.includes("-c")) {
        return { code: 1, stdout: "", stderr: "workspace\\a.cpp:1:1: error: bad code" };
      }
      return { code: 0, stdout: "", stderr: "" };
    }
  });

  const result = await service.compileMultiFile({
    compiler: "g++",
    sourceFiles: ["workspace\\a.cpp", "workspace\\b.cpp"],
    outputPath: "build\\app.exe"
  });

  assert.equal(result.code, 1);
  assert.equal(callCount, 1);
  assert.ok(result.diagnostics.length > 0);
});

test("compileMultiFile throws when sourceFiles is empty", async () => {
  const service = createClangService({
    projectRoot: PROJECT_ROOT,
    toProjectPath: (input) => input,
    commandExists: async () => true,
    spawnCompileProcess: async () => ({ code: 0, stdout: "", stderr: "" })
  });

  await assert.rejects(
    () => service.compileMultiFile({ sourceFiles: [] }),
    /sourceFiles must be non-empty array/
  );
});

// ---------------------------------------------------------------------------
// compileCmake
// ---------------------------------------------------------------------------

test("compileCmake runs configure then build step", async () => {
  const invocations = [];

  const service = createClangService({
    projectRoot: PROJECT_ROOT,
    toProjectPath: (input) => input,
    commandExists: async () => true,
    spawnCompileProcess: async (compiler, args) => {
      invocations.push({ compiler, args });
      return { code: 0, stdout: "ok", stderr: "" };
    }
  });

  const result = await service.compileCmake({
    projectRootPath: "workspace\\myproject",
    buildPath: "workspace\\myproject\\build"
  });

  assert.equal(result.code, 0);
  assert.equal(invocations.length, 2);
  assert.ok(invocations[0].args.includes("-S"));
  assert.ok(invocations[0].args.includes("-B"));
  assert.ok(invocations[1].args.includes("--build"));
});

test("compileCmake stops after failing configure step", async () => {
  let buildCalled = false;

  const service = createClangService({
    projectRoot: PROJECT_ROOT,
    toProjectPath: (input) => input,
    commandExists: async () => true,
    spawnCompileProcess: async (_compiler, args) => {
      if (args.includes("-S")) {
        return { code: 1, stdout: "", stderr: "CMake Error: no CMakeLists.txt" };
      }
      buildCalled = true;
      return { code: 0, stdout: "", stderr: "" };
    }
  });

  const result = await service.compileCmake({
    projectRootPath: "workspace\\myproject",
    buildPath: "workspace\\myproject\\build"
  });

  assert.equal(result.code, 1);
  assert.equal(buildCalled, false);
});

test("compileCmake throws when projectRootPath is empty", async () => {
  const service = createClangService({
    projectRoot: PROJECT_ROOT,
    toProjectPath: (input) => input,
    commandExists: async () => true,
    spawnCompileProcess: async () => ({ code: 0, stdout: "", stderr: "" })
  });

  await assert.rejects(
    () => service.compileCmake({ projectRootPath: "", buildPath: "build" }),
    /projectRootPath must be non-empty string/
  );
});

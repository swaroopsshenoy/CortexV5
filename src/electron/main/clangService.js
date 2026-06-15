const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createErrorExplanationService } = require("./errorExplanationService");
const COMPILER_DIAGNOSTIC_PATTERN = /^(.+?):(\d+):(\d+):\s*(warning|error):\s*(.+)$/i;
const FALLBACK_COMPILER_PATTERNS = [
  /crtdbg\.h/i,
  /vs\.h/i,
  /yvals_core\.h/i,
  /cannot open source file/i,
  /__builtin_verbose_trap/i,
  /STL1000.*Clang/i
];

const WINDOWS_CLANG_MSVC_COMPAT_ARGS = [
  "-D_ALLOW_COMPILER_AND_STL_VERSION_MISMATCH",
  "-D_MSVC_STL_USE_ABORT_AS_DOOM_FUNCTION"
];

function mergeWindowsClangCompatArgs(compiler, extraArgs) {
  if (process.platform !== "win32" || compiler !== "clang++") {
    return extraArgs;
  }

  const merged = [...WINDOWS_CLANG_MSVC_COMPAT_ARGS];
  for (const arg of extraArgs) {
    if (!merged.includes(arg)) {
      merged.push(arg);
    }
  }
  return merged;
}

function commandExists(command) {
  const detectorCommand = process.platform === "win32" ? "where.exe" : "which";
  return new Promise((resolve) => {
    const child = spawn(detectorCommand, [command], {
      shell: false,
      windowsHide: true
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function detectCompiler(requestedCompiler, commandExistsImpl = commandExists) {
  if (requestedCompiler) {
    const isRequestedAvailable = await commandExistsImpl(requestedCompiler);
    if (!isRequestedAvailable) {
      throw new Error(`Compiler not detected: ${requestedCompiler}`);
    }
    return requestedCompiler;
  }

  const [hasClang, hasGcc] = await Promise.all([
    commandExistsImpl("clang++"),
    commandExistsImpl("g++")
  ]);
  if (process.platform === "win32") {
    if (hasGcc) {
      return "g++";
    }
    if (hasClang) {
      return "clang++";
    }
  } else {
    if (hasClang) {
      return "clang++";
    }
    if (hasGcc) {
      return "g++";
    }
  }
  throw new Error("No supported compiler detected. Install clang++ or g++.");
}

function buildCompileArgs(sourcePath, outputPath, extraArgs = []) {
  if (!Array.isArray(extraArgs) || extraArgs.some((item) => typeof item !== "string")) {
    throw new Error("extraArgs must be string array");
  }
  return [sourcePath, "-o", outputPath, ...extraArgs];
}

function spawnCompileProcess(compiler, args, options = {}) {
  const { cwd, onStdout, onStderr } = options;
  if (typeof cwd !== "string" || cwd.trim().length === 0) {
    throw new Error("cwd must be non-empty string");
  }
  if (onStdout !== undefined && typeof onStdout !== "function") {
    throw new Error("onStdout must be function");
  }
  if (onStderr !== undefined && typeof onStderr !== "function") {
    throw new Error("onStderr must be function");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(compiler, args, {
      cwd,
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      onStdout?.(chunk);
    });
    child.stderr?.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      onStderr?.(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function parseCompilerDiagnostics(stderr) {
  const diagnostics = [];
  for (const line of String(stderr ?? "").split(/\r?\n/)) {
    const match = line.match(COMPILER_DIAGNOSTIC_PATTERN);
    if (!match) {
      continue;
    }
    diagnostics.push({
      file: match[1],
      line: Number(match[2]),
      column: Number(match[3]),
      type: match[4].toLowerCase(),
      message: match[5]
    });
  }
  return diagnostics;
}

function shouldRetryWithFallback(compiler, stderr) {
  if (compiler !== "clang++") {
    return false;
  }

  const text = String(stderr ?? "");
  return FALLBACK_COMPILER_PATTERNS.some((pattern) => pattern.test(text));
}

function createClangService(options) {
  const { projectRoot, toProjectPath, emitCompileCommand, emitCompileStdout, emitCompileStderr } =
    options ?? {};
  const commandExistsImpl = options?.commandExists ?? commandExists;
  const spawnCompileProcessImpl = options?.spawnCompileProcess ?? spawnCompileProcess;
  if (typeof projectRoot !== "string" || projectRoot.trim().length === 0) {
    throw new Error("projectRoot must be non-empty string");
  }
  if (typeof toProjectPath !== "function") {
    throw new Error("toProjectPath must be function");
  }
  if (emitCompileCommand !== undefined && typeof emitCompileCommand !== "function") {
    throw new Error("emitCompileCommand must be function");
  }
  if (emitCompileStdout !== undefined && typeof emitCompileStdout !== "function") {
    throw new Error("emitCompileStdout must be function");
  }
  if (emitCompileStderr !== undefined && typeof emitCompileStderr !== "function") {
    throw new Error("emitCompileStderr must be function");
  }
  const errorExplanationService = createErrorExplanationService({
    databaseRoot: path.join(projectRoot, "resources", "compiler_error_database"),
    rewriteAdapter: options.rewriteAdapter,
    onUnmappedDiagnostic: (event) => {
      console.warn("[error-explanation][unmapped]", JSON.stringify(event));
    }
  });

  return Object.freeze({
    async compile(payload = {}) {
      const compiler = await detectCompiler(payload.compiler, commandExistsImpl);
      const sourcePath = toProjectPath(payload.sourcePath ?? "workspace\\main.cpp");
      const outputPath = toProjectPath(payload.outputPath ?? "build\\app.exe");
      const extraArgs = mergeWindowsClangCompatArgs(compiler, payload.extraArgs ?? []);

      if (typeof payload.code === "string") {
        await fs.mkdir(path.dirname(sourcePath), { recursive: true });
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(sourcePath, payload.code, "utf8");
      }

      const compileArgs = buildCompileArgs(sourcePath, outputPath, extraArgs);
      emitCompileCommand?.(compiler, compileArgs);

      const result = await spawnCompileProcessImpl(compiler, compileArgs, {
        cwd: projectRoot,
        onStdout: emitCompileStdout,
        onStderr: emitCompileStderr
      });
      if (result.code !== 0 && shouldRetryWithFallback(compiler, result.stderr)) {
        const fallbackCompiler = await detectCompiler("g++", commandExistsImpl);
        const fallbackMessage =
          "[compiler fallback] clang++ failed while using the MSVC standard library. Retrying with g++.\n";
        emitCompileStderr?.(fallbackMessage);
        const fallbackResult = await spawnCompileProcessImpl(fallbackCompiler, compileArgs, {
          cwd: projectRoot,
          onStdout: emitCompileStdout,
          onStderr: emitCompileStderr
        });
        const fallbackDiagnostics = parseCompilerDiagnostics(fallbackResult.stderr);
        const fallbackExplanations = await errorExplanationService.mapDiagnostics({
          compiler: fallbackCompiler,
          diagnostics: fallbackDiagnostics
        });
        return {
          ...fallbackResult,
          diagnostics: fallbackDiagnostics,
          explanations: fallbackExplanations
        };
      }
      const diagnostics = parseCompilerDiagnostics(result.stderr);
      const explanations = await errorExplanationService.mapDiagnostics({
        compiler,
        diagnostics
      });
      return {
        ...result,
        diagnostics,
        explanations
      };
    }
  });
}

module.exports = {
  createClangService,
  mergeWindowsClangCompatArgs
};

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const pty = require("node-pty");
const { createClangService } = require("./clangService");
const { createAstAnalysisService } = require("./astAnalysisService");
const { createExecutionSimulatorService } = require("./executionSimulatorService");
const { createBenchmarkRunnerService } = require("./benchmarkRunnerService");
const { createComparativeProfilingService } = require("./comparativeProfilingService");
const { createProfileHistoryService } = require("./profileHistoryService");
const { createPerformanceRiskService } = require("./performanceRiskService");
const { createNlpExplanationService } = require("./nlpExplanationService");
const { createReportService } = require("./reportService");
const { createAutoSaveService } = require("./autoSaveService");
const {
  IPC_CHANNELS,
  IPC_CHANNEL_SET,
  IPC_EVENTS
} = require("../../shared/ipc/channels");
const { requestSchemas, responseSchemas } = require("../../shared/ipc/schemas");

require("dotenv").config({
  path: path.resolve(__dirname, "..", "..", "..", ".env"),
  quiet: true
});

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const RENDERER_ENTRY = path.join(PROJECT_ROOT, "dist", "renderer", "index.html");
let currentWorkspaceRoot = path.join(PROJECT_ROOT, "workspace");
const ALLOWED_COMMANDS = new Set(["clang++", "g++", "python", "python3", "cmake"]);
const SOURCE_FILE_EXTENSIONS = new Set([".c", ".cc", ".cpp", ".cxx", ".c++"]);
const IGNORED_WORKSPACE_DIRS = new Set([".git", "node_modules", "build", "dist", ".vscode"]);

try {
  const historyPath = path.join(app.getPath("userData"), "workspace-history.json");
  const raw = require("node:fs").readFileSync(historyPath, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed.lastWorkspace) {
    currentWorkspaceRoot = parsed.lastWorkspace;
  }
} catch (e) {
  // Ignore missing or malformed history file
}

// When running as a packaged build, use frozen Python drivers
if (app.isPackaged) {
  process.env.CORTEX_PYTHON_FROZEN = "true";
}

let mainWindow;
let terminalSession = null;
let clangService = null;
let astAnalysisService = null;
let executionSimulatorService = null;
let benchmarkRunnerService = null;
let comparativeProfilingService = null;
let profileHistoryService = null;
let performanceRiskService = null;
let nlpExplanationService = null;
let reportService = null;
let autoSaveService = null;
const MAX_TERMINAL_HISTORY_ENTRIES = 500;
const MAX_PROFILE_HISTORY_ENTRIES = 200;

function getTerminalHistoryFilePath() {
  return path.join(app.getPath("userData"), "terminal-history.json");
}

function getProfileHistoryFilePath() {
  return path.join(app.getPath("userData"), "profile-history.json");
}

function sendTerminalEvent(eventName, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send(eventName, payload);
}

function getClangService() {
  if (!clangService) {
    clangService = createClangService({
      projectRoot: PROJECT_ROOT,
      toProjectPath,
      emitCompileCommand: (compiler, compileArgs) => {
        sendTerminalEvent(IPC_EVENTS.terminalData, {
          data: `\n[compile] ${compiler} ${compileArgs.join(" ")}\n`,
          stream: "stdout"
        });
      },
      emitCompileStdout: (chunk) => {
        sendTerminalEvent(IPC_EVENTS.terminalData, {
          data: chunk,
          stream: "stdout"
        });
      },
      emitCompileStderr: (chunk) => {
        sendTerminalEvent(IPC_EVENTS.terminalData, {
          data: chunk,
          stream: "stderr"
        });
      },
      rewriteAdapter: async (payload) => getNlpExplanationService().refineCompilerExplanation(payload)
    });
  }
  return clangService;
}

function getAstAnalysisService() {
  if (!astAnalysisService) {
    astAnalysisService = createAstAnalysisService({
      projectRoot: PROJECT_ROOT,
      toProjectPath,
      runProcess: spawnProcess
    });
  }
  return astAnalysisService;
}

function getPerformanceRiskService() {
  if (!performanceRiskService) {
    performanceRiskService = createPerformanceRiskService({
      projectRoot: PROJECT_ROOT,
      toProjectPath,
      runProcess: spawnProcess
    });
  }
  return performanceRiskService;
}

function getNlpExplanationService() {
  if (!nlpExplanationService) {
    nlpExplanationService = createNlpExplanationService({
      projectRoot: PROJECT_ROOT,
      runProcess: spawnProcess
    });
  }
  return nlpExplanationService;
}

function getReportService() {
  if (!reportService) {
    reportService = createReportService({
      projectRoot: PROJECT_ROOT,
      toProjectPath: toWorkspacePath
    });
  }
  return reportService;
}

function getAutoSaveService() {
  if (!autoSaveService) {
    autoSaveService = createAutoSaveService({
      workspaceRoot: currentWorkspaceRoot
    });
  }
  return autoSaveService;
}

async function analyzeWithPerformanceRisk(payload) {
  if (typeof payload?.code === "string" && typeof payload?.sourcePath === "string") {
    const sourcePath = toProjectPath(payload.sourcePath);
    await fs.mkdir(path.dirname(sourcePath), { recursive: true });
    await fs.writeFile(sourcePath, payload.code, "utf8");
  }
  const analyzeResult = await getAstAnalysisService().analyze(payload);
  const performanceRisk = await getPerformanceRiskService().predictFromAnalyzeResult(analyzeResult);
  const nlpExplanations = await getNlpExplanationService().generateFromAnalyzeResult(
    analyzeResult,
    performanceRisk
  );
  return {
    ...analyzeResult,
    performanceRisk,
    nlpExplanations
  };
}

function getExecutionSimulatorService() {
  if (!executionSimulatorService) {
    executionSimulatorService = createExecutionSimulatorService({
      projectRoot: PROJECT_ROOT,
      toProjectPath
    });
  }
  return executionSimulatorService;
}

function getBenchmarkRunnerService() {
  if (!benchmarkRunnerService) {
    benchmarkRunnerService = createBenchmarkRunnerService({
      projectRoot: PROJECT_ROOT,
      toProjectPath,
      compile: (payload) => getClangService().compile(payload),
      runExecutable: (executablePath, args, options) =>
        spawnExecutable(executablePath, args, options)
    });
  }
  return benchmarkRunnerService;
}

function getComparativeProfilingService() {
  if (!comparativeProfilingService) {
    comparativeProfilingService = createComparativeProfilingService();
  }
  return comparativeProfilingService;
}

function getProfileHistoryService() {
  if (!profileHistoryService) {
    profileHistoryService = createProfileHistoryService({
      storagePath: getProfileHistoryFilePath(),
      maxEntries: MAX_PROFILE_HISTORY_ENTRIES
    });
  }
  return profileHistoryService;
}

function toProjectPath(inputPath) {
  if (typeof inputPath !== "string" || inputPath.trim().length === 0) {
    throw new Error("Invalid path input");
  }

  const resolved = path.resolve(PROJECT_ROOT, inputPath);
  const relative = path.relative(PROJECT_ROOT, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path outside workspace not allowed");
  }

  return resolved;
}

function validateCommand(command) {
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`Command not allowed: ${command}`);
  }
}

function toWorkspacePath(inputPath = "") {
  if (typeof inputPath !== "string") {
    throw new Error("Invalid workspace path input");
  }

  const resolved = path.resolve(currentWorkspaceRoot, inputPath);
  const relative = path.relative(currentWorkspaceRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path outside workspace not allowed");
  }
  return resolved;
}

function toWorkspaceRelative(inputPath) {
  return path.relative(currentWorkspaceRoot, inputPath).split(path.sep).join("\\");
}

async function readWorkspaceEntries(parentAbsolutePath) {
  let dirents = [];
  try {
    dirents = await fs.readdir(parentAbsolutePath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      return [];
    }
    throw error;
  }

  const filteredDirents = dirents.filter((entry) => {
    if (entry.isDirectory() && IGNORED_WORKSPACE_DIRS.has(entry.name)) {
      return false;
    }
    return true;
  });

  filteredDirents.sort((left, right) => {
    if (left.isDirectory() !== right.isDirectory()) {
      return left.isDirectory() ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });

  return Promise.all(
    filteredDirents.map(async (entry) => {
      const absoluteEntryPath = path.join(parentAbsolutePath, entry.name);
      const relativePath = toWorkspaceRelative(absoluteEntryPath);
      if (entry.isDirectory()) {
        return {
          name: entry.name,
          relativePath,
          kind: "directory",
          children: await readWorkspaceEntries(absoluteEntryPath)
        };
      }
      return {
        name: entry.name,
        relativePath,
        kind: "file"
      };
    })
  );
}

function isSourceFileName(fileName) {
  return SOURCE_FILE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

async function isRegularFile(absolutePath) {
  try {
    const stats = await fs.stat(absolutePath);
    return stats.isFile();
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function readWorkspaceSourceFiles(parentAbsolutePath) {
  const dirents = await fs.readdir(parentAbsolutePath, { withFileTypes: true });
  const nested = await Promise.all(
    dirents.map(async (entry) => {
      const absoluteEntryPath = path.join(parentAbsolutePath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.toLowerCase() === "build") {
          return [];
        }
        return readWorkspaceSourceFiles(absoluteEntryPath);
      }
      if (!entry.isFile() || !isSourceFileName(entry.name)) {
        return [];
      }
      return [toWorkspaceRelative(absoluteEntryPath)];
    })
  );
  return nested.flat().sort((left, right) => left.localeCompare(right));
}

function pickEntryFile(sourceFiles) {
  if (!Array.isArray(sourceFiles) || sourceFiles.length === 0) {
    return null;
  }
  const mainCandidate =
    sourceFiles.find((item) => /(^|\\)main\.(c|cc|cpp|cxx|c\+\+)$/i.test(item)) ?? null;
  return mainCandidate ?? sourceFiles[0];
}

async function detectWorkspaceProject(targetPathInput) {
  const absoluteTargetPath = toWorkspacePath(targetPathInput);
  const stats = await fs.stat(absoluteTargetPath);

  if (stats.isFile()) {
    if (!isSourceFileName(path.basename(absoluteTargetPath))) {
      throw new Error("Single-file project must target C/C++ source file");
    }
    const projectRootPath = path.dirname(absoluteTargetPath);
    const buildAbsolutePath = path.join(projectRootPath, "build");
    await fs.mkdir(buildAbsolutePath, { recursive: true });
    const sourceFile = toWorkspaceRelative(absoluteTargetPath);
    return {
      type: "single-file",
      rootPath: toWorkspaceRelative(projectRootPath),
      buildPath: toWorkspaceRelative(buildAbsolutePath),
      sourceFiles: [sourceFile],
      entryFile: sourceFile
    };
  }

  if (!stats.isDirectory()) {
    throw new Error("targetPath must point to file or directory");
  }

  const cmakeFilePath = path.join(absoluteTargetPath, "CMakeLists.txt");
  const hasCmakeLists = await isRegularFile(cmakeFilePath);
  const sourceFiles = await readWorkspaceSourceFiles(absoluteTargetPath);

  if (!hasCmakeLists && sourceFiles.length === 0) {
    throw new Error("No C/C++ source files found in target directory");
  }

  const projectType = hasCmakeLists
    ? "cmake"
    : sourceFiles.length > 1
      ? "multi-file"
      : "single-file";
  const buildAbsolutePath = path.join(absoluteTargetPath, "build");
  await fs.mkdir(buildAbsolutePath, { recursive: true });

  return {
    type: projectType,
    rootPath: toWorkspaceRelative(absoluteTargetPath),
    buildPath: toWorkspaceRelative(buildAbsolutePath),
    sourceFiles,
    entryFile: pickEntryFile(sourceFiles)
  };
}

function spawnProcess(command, args, options = {}) {
  validateCommand(command);
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new Error("Arguments must be string array");
  }
  const { onStdout, onStderr, ...spawnOptions } = options;
  if (onStdout !== undefined && typeof onStdout !== "function") {
    throw new Error("onStdout must be function");
  }
  if (onStderr !== undefined && typeof onStderr !== "function") {
    throw new Error("onStderr must be function");
  }

  const { input, ...spawnOptionsWithoutInput } = spawnOptions;
  if (input !== undefined && typeof input !== "string") {
    throw new Error("input must be string");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, ...spawnOptionsWithoutInput });
    let stdout = "";
    let stderr = "";

    if (typeof input === "string") {
      child.stdin?.write(input);
      child.stdin?.end();
    }

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

function spawnExecutable(executablePath, args, options = {}) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new Error("Arguments must be string array");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, args, { shell: false, ...options });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function createTerminalSession(cwd) {
  const resolvedCwd = cwd ? toWorkspacePath(cwd) : currentWorkspaceRoot;
  const shell = process.platform === "win32" ? "powershell.exe" : process.env.SHELL ?? "bash";
  const shellArgs = process.platform === "win32" ? ["-NoLogo", "-NoProfile"] : [];
  const ptyProcess = pty.spawn(shell, shellArgs, {
    name: "xterm-256color",
    cwd: resolvedCwd,
    env: process.env,
    cols: 80,
    rows: 24,
    useConpty: process.platform === "win32",
    useConptyDll: process.platform === "win32"
  });

  ptyProcess.onData((chunk) => {
    sendTerminalEvent(IPC_EVENTS.terminalData, {
      data: chunk,
      stream: "stdout"
    });
  });
  ptyProcess.onExit(({ exitCode }) => {
    sendTerminalEvent(IPC_EVENTS.terminalExit, { code: exitCode });
    terminalSession = null;
  });

  return {
    pty: ptyProcess,
    pid: ptyProcess.pid,
    cwd: resolvedCwd,
    cols: 80,
    rows: 24
  };
}

async function readTerminalHistory() {
  const historyPath = getTerminalHistoryFilePath();
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry) => typeof entry === "string");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeTerminalHistory(entries) {
  const historyPath = getTerminalHistoryFilePath();
  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  await fs.writeFile(historyPath, JSON.stringify(entries, null, 2), "utf8");
}

async function appendTerminalHistory(command) {
  const currentHistory = await readTerminalHistory();
  const nextHistory = [...currentHistory, command].slice(-MAX_TERMINAL_HISTORY_ENTRIES);
  await writeTerminalHistory(nextHistory);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true
    }
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  const useDevServer = process.env.ELECTRON_USE_DEV_SERVER === "true";
  if (useDevServer && rendererUrl) {
    mainWindow.loadURL(rendererUrl);
    return;
  }

  mainWindow.loadFile(RENDERER_ENTRY);
}

function registerIpcHandler(channel, handler) {
  if (!IPC_CHANNEL_SET.has(channel)) {
    throw new Error(`IPC channel not allowed: ${channel}`);
  }

  const requestSchema = requestSchemas[channel];
  const responseSchema = responseSchemas[channel];
  if (!requestSchema || !responseSchema) {
    throw new Error(`Missing IPC schemas for channel: ${channel}`);
  }

  ipcMain.handle(channel, async (_event, payload) => {
    const parsedPayload = requestSchema.parse(payload ?? {});
    const response = await handler(parsedPayload);
    return responseSchema.parse(response);
  });
}

registerIpcHandler(IPC_CHANNELS.compile, async (payload) => {
  if (payload.projectType === "cmake") {
    return getClangService().compileCmake({
      projectRootPath: payload.projectRootPath,
      buildPath: payload.buildPath
    });
  }
  if (payload.projectType === "multi-file" && Array.isArray(payload.sourceFiles)) {
    return getClangService().compileMultiFile({
      compiler: payload.compiler,
      sourceFiles: payload.sourceFiles,
      outputPath: payload.outputPath,
      extraArgs: payload.extraArgs
    });
  }
  return getClangService().compile(payload);
});

registerIpcHandler(IPC_CHANNELS.run, async (payload) => {
  const binaryPath = toProjectPath(payload.binaryPath ?? "build\\app.exe");
  const args = payload.args ?? [];

  if (binaryPath.endsWith(".py")) {
    return spawnProcess("python", [binaryPath, ...args], { cwd: PROJECT_ROOT });
  }

  return spawnExecutable(binaryPath, args, { cwd: PROJECT_ROOT });
});

registerIpcHandler(IPC_CHANNELS.analyze, async (payload) => {
  return analyzeWithPerformanceRisk(payload);
});

registerIpcHandler(IPC_CHANNELS.optimize, async (payload) => {
  const scriptPath = toProjectPath(payload.scriptPath ?? "scripts\\optimize.py");
  const sourcePath = toProjectPath(payload.sourcePath ?? "workspace\\main.cpp");
  const args = payload.args ?? [];

  return spawnProcess("python", [scriptPath, sourcePath, ...args], {
    cwd: PROJECT_ROOT
  });
});

registerIpcHandler(IPC_CHANNELS.simulate, async (payload) => {
  return getExecutionSimulatorService().simulate(payload);
});

registerIpcHandler(IPC_CHANNELS.benchmark, async (payload) => {
  const result = await getBenchmarkRunnerService().benchmark(payload);
  if (result.status === "ok" && typeof result.summary.meanMs === "number") {
    await getProfileHistoryService().append({
      timestamp: new Date().toISOString(),
      meanMs: result.summary.meanMs,
      file: payload.sourcePath
    });
  }
  return result;
});

registerIpcHandler(IPC_CHANNELS.analyzeComplexity, async (payload) => {
  return analyzeWithPerformanceRisk(payload);
});

registerIpcHandler(IPC_CHANNELS.storeProfileBaseline, async (payload) => {
  return getComparativeProfilingService().setBaseline(payload.benchmarkResult);
});

registerIpcHandler(IPC_CHANNELS.compareProfile, async (payload) => {
  return getComparativeProfilingService().compare(payload.benchmarkResult);
});

registerIpcHandler(IPC_CHANNELS.profileHistory, async (payload) => {
  const limit = payload.limit ?? 10;
  return {
    entries: await getProfileHistoryService().list(limit)
  };
});

registerIpcHandler(IPC_CHANNELS.workspaceList, async (payload) => {
  await fs.mkdir(currentWorkspaceRoot, { recursive: true });
  const targetPath = toWorkspacePath(payload.targetPath ?? "");
  const stats = await fs.stat(targetPath);
  if (!stats.isDirectory()) {
    throw new Error("targetPath must point to directory");
  }
  return {
    entries: await readWorkspaceEntries(targetPath),
    path: targetPath
  };
});

registerIpcHandler(IPC_CHANNELS.workspaceCreate, async (payload) => {
  const targetPath = toWorkspacePath(payload.targetPath);
  if (payload.kind === "directory") {
    await fs.mkdir(targetPath, { recursive: true });
    return { ok: true };
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const fileHandle = await fs.open(targetPath, "wx");
  await fileHandle.close();
  return { ok: true };
});

registerIpcHandler(IPC_CHANNELS.workspaceRename, async (payload) => {
  const targetPath = toWorkspacePath(payload.targetPath);
  const nextPath = toWorkspacePath(payload.nextPath);
  await fs.mkdir(path.dirname(nextPath), { recursive: true });
  await fs.rename(targetPath, nextPath);
  return { ok: true };
});

registerIpcHandler(IPC_CHANNELS.workspaceDelete, async (payload) => {
  const targetPath = toWorkspacePath(payload.targetPath);
  if (targetPath === currentWorkspaceRoot) {
    throw new Error("Deleting workspace root is not allowed");
  }
  await fs.rm(targetPath, { recursive: true, force: false });
  return { ok: true };
});

registerIpcHandler(IPC_CHANNELS.workspaceRead, async (payload) => {
  const targetPath = toWorkspacePath(payload.targetPath);
  const stats = await fs.stat(targetPath);
  if (!stats.isFile()) {
    throw new Error("targetPath must point to file");
  }
  return {
    content: await fs.readFile(targetPath, "utf8")
  };
});

registerIpcHandler(IPC_CHANNELS.workspaceWrite, async (payload) => {
  const targetPath = toWorkspacePath(payload.targetPath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, payload.content, "utf8");
  return { ok: true };
});

registerIpcHandler(IPC_CHANNELS.workspaceLoadProject, async (payload) => {
  return {
    ok: true,
    project: await detectWorkspaceProject(payload.targetPath)
  };
});

registerIpcHandler(IPC_CHANNELS.workspaceSelectFolder, async (payload) => {
  const result = await dialog.showOpenDialog({
    title: 'Select Workspace Folder',
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    currentWorkspaceRoot = result.filePaths[0];
    try {
      const historyPath = path.join(app.getPath("userData"), "workspace-history.json");
      await fs.mkdir(path.dirname(historyPath), { recursive: true });
      await fs.writeFile(historyPath, JSON.stringify({ lastWorkspace: currentWorkspaceRoot }), "utf8");
    } catch (e) {
      console.error("Failed to write workspace history", e);
    }
    return { path: currentWorkspaceRoot };
  }
  return { path: null };
});

registerIpcHandler(IPC_CHANNELS.terminalStart, async (payload) => {
  if (!terminalSession) {
    terminalSession = createTerminalSession(payload.cwd);
  }
  return {
    ok: true,
    pid: terminalSession.pid
  };
});

registerIpcHandler(IPC_CHANNELS.terminalWrite, async (payload) => {
  if (!terminalSession) {
    terminalSession = createTerminalSession();
  }
  terminalSession.pty.write(payload.data);
  return { ok: true };
});

registerIpcHandler(IPC_CHANNELS.terminalResize, async (payload) => {
  if (!terminalSession) {
    terminalSession = createTerminalSession();
  }
  terminalSession.cols = payload.cols;
  terminalSession.rows = payload.rows;
  terminalSession.pty.resize(payload.cols, payload.rows);
  return { ok: true };
});

registerIpcHandler(IPC_CHANNELS.terminalInterrupt, async () => {
  if (terminalSession) {
    terminalSession.pty.write("\x03");
  }
  return { ok: true };
});

registerIpcHandler(IPC_CHANNELS.terminalRecordHistory, async (payload) => {
  await appendTerminalHistory(payload.command);
  return { ok: true };
});

registerIpcHandler(IPC_CHANNELS.terminalHistoryList, async () => {
  return {
    entries: await readTerminalHistory()
  };
});

registerIpcHandler(IPC_CHANNELS.reportGenerate, async (payload) => {
  return getReportService().generateReport(payload);
});

registerIpcHandler(IPC_CHANNELS.autoSaveStage, async (payload) => {
  getAutoSaveService().stage(payload.relativePath, payload.content);
  return { ok: true };
});

registerIpcHandler(IPC_CHANNELS.autoSaveRecover, async (payload) => {
  const content = await getAutoSaveService().recover(payload.relativePath);
  return { content };
});

registerIpcHandler(IPC_CHANNELS.autoSaveList, async () => {
  const paths = await getAutoSaveService().listRecoverable();
  return { paths };
});

registerIpcHandler(IPC_CHANNELS.autoSaveDiscard, async (payload) => {
  await getAutoSaveService().discard(payload.relativePath);
  return { ok: true };
});

registerIpcHandler(IPC_CHANNELS.workspaceOpenExternal, async (payload) => {
  const targetPath = toWorkspacePath(payload.targetPath);
  const errorMsg = await shell.openPath(targetPath);
  if (errorMsg) {
    throw new Error(errorMsg);
  }
  return { ok: true };
});

app.whenReady().then(async () => {
  getAutoSaveService().start();
  createWindow();

  // Compiler startup check — notify user if no C++ compiler is on PATH
  const { exec } = require("node:child_process");
  const checkCompiler = (cmd) =>
    new Promise((resolve) => {
      exec(`${cmd} --version`, (err) => resolve(!err));
    });
  const [hasClang, hasGpp] = await Promise.all([
    checkCompiler("clang++"),
    checkCompiler("g++")
  ]);
  if (!hasClang && !hasGpp) {
    const warn = [
      "",
      "⚠️  No C++ compiler detected on PATH.",
      "   Cortex++ V5 requires clang++ or g++ to compile code.",
      "",
      "   Install one of:",
      "     • LLVM/Clang  → https://releases.llvm.org",
      "     • MSYS2+MinGW → https://www.msys2.org  (provides g++)",
      "",
      "   Then restart Cortex++ V5.",
      ""
    ].join("\n");
    mainWindow?.webContents.send(IPC_EVENTS.terminalData, warn);
  }
});

app.on("window-all-closed", () => {
  if (terminalSession) {
    terminalSession.pty.kill();
    terminalSession = null;
  }
  getAutoSaveService().stop();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

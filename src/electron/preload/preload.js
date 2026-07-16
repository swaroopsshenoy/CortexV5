const { contextBridge, ipcRenderer } = require("electron");
const IPC_CHANNELS = Object.freeze({
  compile: "compile",
  run: "run",
  analyze: "analyze",
  optimize: "optimize",
  simulate: "simulate",
  benchmark: "benchmark",
  analyzeComplexity: "analyze-complexity",
  storeProfileBaseline: "profile:store-baseline",
  compareProfile: "profile:compare",
  profileHistory: "profile:history",
  workspaceList: "workspace:list",
  workspaceCreate: "workspace:create",
  workspaceRename: "workspace:rename",
  workspaceDelete: "workspace:delete",
  workspaceRead: "workspace:read",
  workspaceWrite: "workspace:write",
  workspaceLoadProject: "workspace:loadProject",
  workspaceSelectFolder: "workspace:selectFolder",
  terminalStart: "terminal:start",
  terminalWrite: "terminal:write",
  terminalResize: "terminal:resize",
  terminalInterrupt: "terminal:interrupt",
  terminalRecordHistory: "terminal:recordHistory",
  terminalHistoryList: "terminal:historyList",
  reportGenerate: "report:generate",
  autoSaveStage: "autosave:stage",
  autoSaveRecover: "autosave:recover",
  autoSaveList: "autosave:list",
  autoSaveDiscard: "autosave:discard",
  workspaceOpenExternal: "workspace:openExternal"
});
const IPC_CHANNEL_SET = new Set(Object.values(IPC_CHANNELS));
const IPC_EVENTS = Object.freeze({
  terminalData: "terminal:data",
  terminalExit: "terminal:exit"
});
const IPC_EVENT_SET = new Set(Object.values(IPC_EVENTS));

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be non-empty string`);
  }
}

function validateStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} must be string[]`);
  }
}

function validatePositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} must be positive integer`);
  }
}

function validateCompilePayload(payload) {
  if (!isObject(payload)) {
    throw new Error("compile payload must be object");
  }
  if (payload.compiler !== undefined && payload.compiler !== "clang++" && payload.compiler !== "g++") {
    throw new Error("compiler must be clang++ or g++");
  }
  if (payload.sourcePath !== undefined) {
    validateString(payload.sourcePath, "sourcePath");
  }
  if (payload.outputPath !== undefined) {
    validateString(payload.outputPath, "outputPath");
  }
  if (payload.extraArgs !== undefined) {
    validateStringArray(payload.extraArgs, "extraArgs");
  }
  if (payload.code !== undefined && typeof payload.code !== "string") {
    throw new Error("code must be string");
  }
  return payload;
}

function validateRunPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("run payload must be object");
  }
  if (payload.binaryPath !== undefined) {
    validateString(payload.binaryPath, "binaryPath");
  }
  if (payload.args !== undefined) {
    validateStringArray(payload.args, "args");
  }
  return payload;
}

function validateAnalyzeOrOptimizePayload(payload, methodName) {
  if (!isObject(payload)) {
    throw new Error(`${methodName} payload must be object`);
  }
  if (payload.scriptPath !== undefined) {
    validateString(payload.scriptPath, "scriptPath");
  }
  if (payload.sourcePath !== undefined) {
    validateString(payload.sourcePath, "sourcePath");
  }
  if (payload.args !== undefined) {
    validateStringArray(payload.args, "args");
  }
  return payload;
}

function validateSimulatePayload(payload) {
  if (!isObject(payload)) {
    throw new Error("simulate payload must be object");
  }
  if (payload.language !== undefined && payload.language !== "cpp") {
    throw new Error("language must be cpp");
  }
  if (payload.sourcePath !== undefined) {
    validateString(payload.sourcePath, "sourcePath");
  }
  if (payload.code !== undefined && typeof payload.code !== "string") {
    throw new Error("code must be string");
  }
  if (payload.maxLoopIterations !== undefined) {
    if (
      !Number.isInteger(payload.maxLoopIterations) ||
      payload.maxLoopIterations < 1 ||
      payload.maxLoopIterations > 200
    ) {
      throw new Error("maxLoopIterations must be integer between 1 and 200");
    }
  }
  return payload;
}

function validateBenchmarkPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("benchmark payload must be object");
  }
  if (payload.compiler !== undefined && payload.compiler !== "clang++" && payload.compiler !== "g++") {
    throw new Error("compiler must be clang++ or g++");
  }
  if (payload.sourcePath !== undefined) {
    validateString(payload.sourcePath, "sourcePath");
  }
  if (payload.outputPath !== undefined) {
    validateString(payload.outputPath, "outputPath");
  }
  if (payload.extraArgs !== undefined) {
    validateStringArray(payload.extraArgs, "extraArgs");
  }
  if (payload.code !== undefined && typeof payload.code !== "string") {
    throw new Error("code must be string");
  }
  if (payload.args !== undefined) {
    validateStringArray(payload.args, "args");
  }
  if (payload.runs !== undefined) {
    if (!Number.isInteger(payload.runs) || payload.runs < 1 || payload.runs > 50) {
      throw new Error("runs must be integer between 1 and 50");
    }
  }
  if (payload.warmupRuns !== undefined) {
    if (!Number.isInteger(payload.warmupRuns) || payload.warmupRuns < 0 || payload.warmupRuns > 10) {
      throw new Error("warmupRuns must be integer between 0 and 10");
    }
  }
  return payload;
}

function validateAnalyzeComplexityPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("analyzeComplexity payload must be object");
  }
  validateString(payload.sourcePath, "sourcePath");
  validateString(payload.code, "code");
  return payload;
}

function validateStoreProfileBaselinePayload(payload) {
  if (!isObject(payload)) {
    throw new Error("storeProfileBaseline payload must be object");
  }
  if (!isObject(payload.benchmarkResult)) {
    throw new Error("benchmarkResult must be object");
  }
  return payload;
}

function validateCompareProfilePayload(payload) {
  if (!isObject(payload)) {
    throw new Error("compareProfile payload must be object");
  }
  if (!isObject(payload.benchmarkResult)) {
    throw new Error("benchmarkResult must be object");
  }
  return payload;
}

function validateProfileHistoryPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("profileHistory payload must be object");
  }
  if (payload.limit !== undefined) {
    if (!Number.isInteger(payload.limit) || payload.limit < 1 || payload.limit > 50) {
      throw new Error("limit must be integer between 1 and 50");
    }
  }
  return payload;
}

function validateWorkspaceListPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("workspaceList payload must be object");
  }
  if (payload.targetPath !== undefined) {
    validateString(payload.targetPath, "targetPath");
  }
  return payload;
}

function validateWorkspaceCreatePayload(payload) {
  if (!isObject(payload)) {
    throw new Error("workspaceCreate payload must be object");
  }
  validateString(payload.targetPath, "targetPath");
  if (payload.kind !== "file" && payload.kind !== "directory") {
    throw new Error("kind must be file or directory");
  }
  return payload;
}

function validateWorkspaceRenamePayload(payload) {
  if (!isObject(payload)) {
    throw new Error("workspaceRename payload must be object");
  }
  validateString(payload.targetPath, "targetPath");
  validateString(payload.nextPath, "nextPath");
  return payload;
}

function validateWorkspaceDeletePayload(payload) {
  if (!isObject(payload)) {
    throw new Error("workspaceDelete payload must be object");
  }
  validateString(payload.targetPath, "targetPath");
  return payload;
}

function validateWorkspaceReadPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("workspaceRead payload must be object");
  }
  validateString(payload.targetPath, "targetPath");
  return payload;
}

function validateWorkspaceWritePayload(payload) {
  if (!isObject(payload)) {
    throw new Error("workspaceWrite payload must be object");
  }
  validateString(payload.targetPath, "targetPath");
  if (typeof payload.content !== "string") {
    throw new Error("content must be string");
  }
  return payload;
}

function validateWorkspaceOpenExternalPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("workspaceOpenExternal payload must be object");
  }
  validateString(payload.targetPath, "targetPath");
  return payload;
}

function validateWorkspaceLoadProjectPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("workspaceLoadProject payload must be object");
  }
  validateString(payload.targetPath, "targetPath");
  return payload;
}

function validateTerminalStartPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("terminalStart payload must be object");
  }
  if (payload.cwd !== undefined) {
    validateString(payload.cwd, "cwd");
  }
  return payload;
}

function validateTerminalWritePayload(payload) {
  if (!isObject(payload)) {
    throw new Error("terminalWrite payload must be object");
  }
  if (typeof payload.data !== "string") {
    throw new Error("data must be string");
  }
  return payload;
}

function validateTerminalResizePayload(payload) {
  if (!isObject(payload)) {
    throw new Error("terminalResize payload must be object");
  }
  validatePositiveInteger(payload.cols, "cols");
  validatePositiveInteger(payload.rows, "rows");
  return payload;
}

function validateAutoSaveStagePayload(payload) {
  if (!isObject(payload)) throw new Error("autoSaveStage payload must be object");
  validateString(payload.relativePath, "relativePath");
  if (typeof payload.content !== "string") throw new Error("content must be string");
  return payload;
}

function validateAutoSaveRecoverPayload(payload) {
  if (!isObject(payload)) throw new Error("autoSaveRecover payload must be object");
  validateString(payload.relativePath, "relativePath");
  return payload;
}

function validateAutoSaveDiscardPayload(payload) {
  if (!isObject(payload)) throw new Error("autoSaveDiscard payload must be object");
  validateString(payload.relativePath, "relativePath");
  return payload;
}

function validateReportGeneratePayload(payload) {
  if (!isObject(payload)) {
    throw new Error("reportGenerate payload must be object");
  }
  if (payload.sourcePath !== undefined) {
    validateString(payload.sourcePath, "sourcePath");
  }
  if (payload.outputPath !== undefined) {
    validateString(payload.outputPath, "outputPath");
  }
  // analyzeResult, benchmarkResult, compileResult are plain objects — pass through
  return payload;
}

function validateTerminalRecordHistoryPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("terminalRecordHistory payload must be object");
  }
  validateString(payload.command, "command");
  return payload;
}

function validateEmptyObjectPayload(payload, methodName) {
  if (!isObject(payload)) {
    throw new Error(`${methodName} payload must be object`);
  }
  if (Object.keys(payload).length > 0) {
    throw new Error(`${methodName} payload must be empty object`);
  }
  return payload;
}

function invokeSafe(channel, payload, validator) {
  if (!IPC_CHANNEL_SET.has(channel)) {
    throw new Error(`IPC channel not allowed: ${channel}`);
  }
  const parsedPayload = validator(payload ?? {});
  return ipcRenderer.invoke(channel, parsedPayload);
}

function onEventSafe(eventName, listener) {
  if (!IPC_EVENT_SET.has(eventName)) {
    throw new Error(`IPC event not allowed: ${eventName}`);
  }
  if (typeof listener !== "function") {
    throw new Error("listener must be function");
  }
  const handler = (_event, payload) => listener(payload);
  ipcRenderer.on(eventName, handler);
  return () => {
    ipcRenderer.removeListener(eventName, handler);
  };
}

const api = Object.freeze({
  compile: (payload) => invokeSafe(IPC_CHANNELS.compile, payload, validateCompilePayload),
  run: (payload) => invokeSafe(IPC_CHANNELS.run, payload, validateRunPayload),
  analyze: (payload) =>
    invokeSafe(
      IPC_CHANNELS.analyze,
      payload,
      (input) => validateAnalyzeOrOptimizePayload(input, "analyze")
    ),
  optimize: (payload) =>
    invokeSafe(
      IPC_CHANNELS.optimize,
      payload,
      (input) => validateAnalyzeOrOptimizePayload(input, "optimize")
    ),
  simulate: (payload) => invokeSafe(IPC_CHANNELS.simulate, payload, validateSimulatePayload),
  benchmark: (payload) => invokeSafe(IPC_CHANNELS.benchmark, payload, validateBenchmarkPayload),
  analyzeComplexity: (payload) => invokeSafe(IPC_CHANNELS.analyzeComplexity, payload, validateAnalyzeComplexityPayload),
  storeProfileBaseline: (payload) => invokeSafe(IPC_CHANNELS.storeProfileBaseline, payload, validateStoreProfileBaselinePayload),
  compareProfile: (payload) => invokeSafe(IPC_CHANNELS.compareProfile, payload, validateCompareProfilePayload),
  profileHistory: (payload) => invokeSafe(IPC_CHANNELS.profileHistory, payload, validateProfileHistoryPayload),
  workspaceList: (payload) =>
    invokeSafe(IPC_CHANNELS.workspaceList, payload, validateWorkspaceListPayload),
  workspaceRead: (payload) =>
    invokeSafe(IPC_CHANNELS.workspaceRead, payload, validateWorkspaceReadPayload),
  workspaceWrite: (payload) =>
    invokeSafe(IPC_CHANNELS.workspaceWrite, payload, validateWorkspaceWritePayload),
  workspaceOpenExternal: (payload) =>
    invokeSafe(IPC_CHANNELS.workspaceOpenExternal, payload, validateWorkspaceOpenExternalPayload),
  workspaceCreate: (payload) =>
    invokeSafe(IPC_CHANNELS.workspaceCreate, payload, validateWorkspaceCreatePayload),
  workspaceRename: (payload) =>
    invokeSafe(IPC_CHANNELS.workspaceRename, payload, validateWorkspaceRenamePayload),
  workspaceDelete: (payload) =>
    invokeSafe(IPC_CHANNELS.workspaceDelete, payload, validateWorkspaceDeletePayload),
  workspaceLoadProject: (payload) =>
    invokeSafe(
      IPC_CHANNELS.workspaceLoadProject,
      payload,
      validateWorkspaceLoadProjectPayload
    ),
  workspaceSelectFolder: (payload) =>
    invokeSafe(
      IPC_CHANNELS.workspaceSelectFolder,
      payload,
      (input) => validateEmptyObjectPayload(input, "workspaceSelectFolder")
    ),
  terminalStart: (payload) =>
    invokeSafe(IPC_CHANNELS.terminalStart, payload, validateTerminalStartPayload),
  terminalWrite: (payload) =>
    invokeSafe(IPC_CHANNELS.terminalWrite, payload, validateTerminalWritePayload),
  terminalResize: (payload) =>
    invokeSafe(IPC_CHANNELS.terminalResize, payload, validateTerminalResizePayload),
  terminalInterrupt: (payload) =>
    invokeSafe(IPC_CHANNELS.terminalInterrupt, payload, (input) =>
      validateEmptyObjectPayload(input, "terminalInterrupt")
    ),
  terminalRecordHistory: (payload) =>
    invokeSafe(
      IPC_CHANNELS.terminalRecordHistory,
      payload,
      validateTerminalRecordHistoryPayload
    ),
  terminalHistoryList: (payload) =>
    invokeSafe(IPC_CHANNELS.terminalHistoryList, payload, (input) =>
      validateEmptyObjectPayload(input, "terminalHistoryList")
    ),
  reportGenerate: (payload) =>
    invokeSafe(IPC_CHANNELS.reportGenerate, payload, validateReportGeneratePayload),
  autoSaveStage: (payload) =>
    invokeSafe(IPC_CHANNELS.autoSaveStage, payload, validateAutoSaveStagePayload),
  autoSaveRecover: (payload) =>
    invokeSafe(IPC_CHANNELS.autoSaveRecover, payload, validateAutoSaveRecoverPayload),
  autoSaveList: (payload) =>
    invokeSafe(IPC_CHANNELS.autoSaveList, payload, (input) =>
      validateEmptyObjectPayload(input, "autoSaveList")
    ),
  autoSaveDiscard: (payload) =>
    invokeSafe(IPC_CHANNELS.autoSaveDiscard, payload, validateAutoSaveDiscardPayload),
  onTerminalData: (listener) => onEventSafe(IPC_EVENTS.terminalData, listener),
  onTerminalExit: (listener) => onEventSafe(IPC_EVENTS.terminalExit, listener)
});

contextBridge.exposeInMainWorld("api", api);

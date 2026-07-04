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
  autoSaveDiscard: "autosave:discard"
});

const IPC_CHANNEL_SET = new Set(Object.values(IPC_CHANNELS));
const IPC_EVENTS = Object.freeze({
  terminalData: "terminal:data",
  terminalExit: "terminal:exit"
});
const IPC_EVENT_SET = new Set(Object.values(IPC_EVENTS));

module.exports = {
  IPC_CHANNELS,
  IPC_CHANNEL_SET,
  IPC_EVENTS,
  IPC_EVENT_SET
};

function getApi() {
  if (!window.api) {
    throw new Error("Preload API unavailable");
  }
  return window.api;
}

export const ipcClient = Object.freeze({
  compile(payload) {
    return getApi().compile(payload);
  },
  run(payload) {
    return getApi().run(payload);
  },
  analyze(payload) {
    return getApi().analyze(payload);
  },
  optimize(payload) {
    return getApi().optimize(payload);
  },
  simulate(payload) {
    return getApi().simulate(payload);
  },
  benchmark(payload) {
    return getApi().benchmark(payload);
  },
  analyzeComplexity(payload) {
    return getApi().analyzeComplexity(payload);
  },
  storeProfileBaseline(payload) {
    return getApi().storeProfileBaseline(payload);
  },
  compareProfile(payload) {
    return getApi().compareProfile(payload);
  },
  profileHistory(payload) {
    return getApi().profileHistory(payload);
  },
  workspaceList(payload) {
    return getApi().workspaceList(payload);
  },
  workspaceRead(payload) {
    return getApi().workspaceRead(payload);
  },
  workspaceWrite(payload) {
    return getApi().workspaceWrite(payload);
  },
  workspaceCreate(payload) {
    return getApi().workspaceCreate(payload);
  },
  workspaceRename(payload) {
    return getApi().workspaceRename(payload);
  },
  workspaceDelete(payload) {
    return getApi().workspaceDelete(payload);
  },
  workspaceLoadProject(payload) {
    return getApi().workspaceLoadProject(payload);
  },
  terminalStart(payload) {
    return getApi().terminalStart(payload);
  },
  terminalWrite(payload) {
    return getApi().terminalWrite(payload);
  },
  terminalResize(payload) {
    return getApi().terminalResize(payload);
  },
  terminalInterrupt(payload) {
    return getApi().terminalInterrupt(payload);
  },
  terminalRecordHistory(payload) {
    return getApi().terminalRecordHistory(payload);
  },
  terminalHistoryList(payload) {
    return getApi().terminalHistoryList(payload);
  },
  reportGenerate(payload) {
    return getApi().reportGenerate(payload);
  },
  autoSaveStage(payload) {
    return getApi().autoSaveStage(payload);
  },
  autoSaveRecover(payload) {
    return getApi().autoSaveRecover(payload);
  },
  autoSaveList(payload) {
    return getApi().autoSaveList(payload);
  },
  autoSaveDiscard(payload) {
    return getApi().autoSaveDiscard(payload);
  },
  onTerminalData(listener) {
    return getApi().onTerminalData(listener);
  },
  onTerminalExit(listener) {
    return getApi().onTerminalExit(listener);
  }
});

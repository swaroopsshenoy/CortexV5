export type CompilerName = "clang++" | "g++";

export type ProcessResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

export type PerformanceRiskCause = {
  feature: string;
  label?: string;
  value: number;
  contribution: number;
};

export type PerformanceRisk = {
  status: "ok" | "unavailable" | "error";
  reason?: string;
  riskClass: string | null;
  probability: number | null;
  confidenceBand: "high" | "medium" | "low" | null;
  probabilities?: Record<string, number> | null;
  topCauses: PerformanceRiskCause[];
};

export type NlpExplanation = {
  collapsed: {
    title: string;
    summary: string;
  };
  expanded: {
    whatHappened: string;
    actions: string[];
  };
  metadata: {
    id: string;
    domain: string;
    confidenceBand: "high" | "medium" | "low";
    pipelineStages: string[];
    refinementEngine?: string;
  };
};

export type AnalyzeResult = ProcessResult & {
  performanceRisk?: PerformanceRisk;
  nlpExplanations?: NlpExplanation[];
};

export type CompilerDiagnostic = {
  file: string;
  line: number;
  column: number;
  type: "warning" | "error";
  message: string;
};

export type CompileResult = ProcessResult & {
  diagnostics: CompilerDiagnostic[];
  explanations: CompilerExplanation[];
};

export type CompilerExplanation = {
  key: string;
  issue_id: string;
  title: string;
  category: "Syntax" | "Type" | "Template" | "Linker" | "General";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  compiler: CompilerName;
  matcherType: "regex" | "fuzzy" | "fallback";
  summary: string;
  explanation: string;
  quickFixes: string[];
  quickFixCards: Array<{
    id: string;
    text: string;
    actionType: "edit" | "check" | "read";
    expectedImpact: "LOW" | "MEDIUM" | "HIGH";
    relevanceScore: number;
    reason: string;
    priority: number;
  }>;
  confidence: number;
  confidenceBand: "high" | "medium" | "low";
  sections: {
    collapsed: {
      title: string;
      summary: string;
    };
    expanded: {
      whatHappened: string;
      quickFixes: string[];
      quickFixCards: Array<{
        id: string;
        text: string;
        actionType: "edit" | "check" | "read";
        expectedImpact: "LOW" | "MEDIUM" | "HIGH";
        relevanceScore: number;
        reason: string;
        priority: number;
      }>;
    };
    deepDive: {
      whyThisMatched: string;
      originalDiagnostic: string;
    };
    metadata: {
      issue_id: string;
      compiler: CompilerName;
      category: "Syntax" | "Type" | "Template" | "Linker" | "General";
      severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      matcherType: "regex" | "fuzzy" | "fallback";
      confidence: number;
      confidenceBand: "high" | "medium" | "low";
    };
  };
  diagnostic: CompilerDiagnostic;
};

export type CompileRequest = {
  compiler?: CompilerName;
  sourcePath?: string;
  outputPath?: string;
  extraArgs?: string[];
  code?: string;
};

export type RunRequest = {
  binaryPath?: string;
  args?: string[];
};

export type AnalyzeRequest = {
  scriptPath?: string;
  sourcePath?: string;
  args?: string[];
};

export type OptimizeRequest = {
  scriptPath?: string;
  sourcePath?: string;
  args?: string[];
};

export type SimulationRequest = {
  language?: "cpp";
  sourcePath?: string;
  code?: string;
  maxLoopIterations?: number;
};

export type ExecutionVariable = {
  name: string;
  value: string;
  kind: "param" | "local";
  declaredLine: number | null;
};

export type ExecutionScope = {
  scopeId: number;
  kind: "function" | "block" | "loop";
  locals: ExecutionVariable[];
};

export type ExecutionVariableSnapshot = {
  scopes: ExecutionScope[];
};

export type ExecutionStackFrame = {
  frameId: number;
  functionName: string;
  scopeId: number;
  line: number | null;
  params: ExecutionVariable[];
  locals: ExecutionVariable[];
};

export type ExecutionStackSummary = {
  frames: number;
  locals: number;
  params: number;
};

export type ExecutionHeapSummary = {
  allocations: number;
  frees: number;
  live: number;
  bytesAllocated: number;
  bytesFreed: number;
  bytesLive: number;
  unknownAllocs: number;
  unknownFrees: number;
};

export type ExecutionMemorySnapshot = {
  stack: ExecutionStackSummary;
  heap: ExecutionHeapSummary;
};

export type SimulationTraceStep = {
  stepIndex: number;
  eventType:
    | "line-enter"
    | "evaluate"
    | "branch"
    | "assign"
    | "loop-iteration"
    | "statement"
    | "return"
    | "unsupported"
    | "end";
  phase: "execution" | "completed";
  line: number | null;
  column: number | null;
  currentLine: number | null;
  detail: string;
  variableSnapshot: ExecutionVariableSnapshot;
  callStack: ExecutionStackFrame[];
  memorySnapshot: ExecutionMemorySnapshot;
  variable?: string;
  value?: string;
  decision?: "true" | "false" | "indeterminate";
  iteration?: number;
  loopKind?: "for" | "while";
};

export type SimulationWarning = {
  code:
    | "unsupported_construct"
    | "indeterminate_condition"
    | "loop_iteration_cap_reached";
  message: string;
  line: number | null;
};

export type SimulationResult = {
  status: "ok" | "partial";
  engine: "execution-simulator-v1";
  language: "cpp";
  sourcePath: string;
  maxLoopIterations: number;
  executionTrace: SimulationTraceStep[];
  warnings: SimulationWarning[];
  summary: {
    totalSteps: number;
    simulatedLines: number;
    unsupportedCount: number;
    warningCount: number;
    loopCapHits: number;
  };
  currentLine: number | null;
  phase: "completed";
};

export type BenchmarkRequest = {
  compiler?: CompilerName;
  sourcePath?: string;
  outputPath?: string;
  extraArgs?: string[];
  code?: string;
  args?: string[];
  runs?: number;
  warmupRuns?: number;
};

export type BenchmarkRun = {
  runIndex: number;
  durationMs: number;
  code: number | null;
  stdout: string;
  stderr: string;
};

export type BenchmarkSummary = {
  runCount: number;
  warmupRuns: number;
  minMs: number | null;
  maxMs: number | null;
  meanMs: number | null;
  medianMs: number | null;
  p95Ms: number | null;
};

export type BenchmarkResult = {
  status: "ok" | "compile-error" | "run-error";
  compile: CompileResult;
  runs: BenchmarkRun[];
  summary: BenchmarkSummary;
  failedRun: { runIndex: number; code: number | null } | null;
};

export type ProfileBaselineRequest = {
  benchmarkResult: BenchmarkResult;
};

export type ProfileBaselineResponse = {
  ok: true;
  stored: true;
};

export type ProfileComparisonRequest = {
  benchmarkResult: BenchmarkResult;
};

export type ProfileComparisonResult = {
  status: "ok";
  baseline: {
    timestamp: string;
    meanMs: number;
  };
  current: {
    meanMs: number;
    minMs: number;
    maxMs: number;
    medianMs: number;
    p95Ms: number;
  };
  deltas: {
    meanDeltaMs: number;
    meanDeltaPercent: number;
    minDeltaMs: number;
    maxDeltaMs: number;
    medianDeltaMs: number;
    p95DeltaMs: number;
  };
  summary: {
    improvement: string;
    direction: "faster" | "slower";
    gainPercent: number;
    regressionPercent: number;
  };
};

export type ProfileHistoryEntry = {
  timestamp: string;
  meanMs: number;
};

export type ProfileHistoryRequest = {
  limit?: number;
};

export type ProfileHistoryResponse = {
  entries: ProfileHistoryEntry[];
};

export type WorkspaceEntry = {
  name: string;
  relativePath: string;
  kind: "file" | "directory";
  children?: WorkspaceEntry[];
};

export type WorkspaceListRequest = {
  targetPath?: string;
};

export type WorkspaceReadRequest = {
  targetPath: string;
};

export type WorkspaceCreateRequest = {
  targetPath: string;
  kind: "file" | "directory";
};

export type WorkspaceRenameRequest = {
  targetPath: string;
  nextPath: string;
};

export type WorkspaceDeleteRequest = {
  targetPath: string;
};

export type WorkspaceLoadProjectRequest = {
  targetPath: string;
};

export type WorkspaceListResponse = {
  entries: WorkspaceEntry[];
};

export type WorkspaceMutationResponse = {
  ok: true;
};

export type WorkspaceReadResponse = {
  content: string;
};

export type WorkspaceProjectType = "cmake" | "single-file" | "multi-file";

export type WorkspaceProject = {
  type: WorkspaceProjectType;
  rootPath: string;
  buildPath: string;
  sourceFiles: string[];
  entryFile: string | null;
};

export type WorkspaceLoadProjectResponse = {
  ok: true;
  project: WorkspaceProject;
};

export type TerminalStartRequest = {
  cwd?: string;
};

export type TerminalWriteRequest = {
  data: string;
};

export type TerminalResizeRequest = {
  cols: number;
  rows: number;
};

export type TerminalRecordHistoryRequest = {
  command: string;
};

export type TerminalEventData = {
  data: string;
  stream: "stdout" | "stderr";
};

export type TerminalEventExit = {
  code: number | null;
};

export type TerminalStartResponse = {
  ok: true;
  pid: number;
};

export type TerminalMutationResponse = {
  ok: true;
};

export type TerminalHistoryListResponse = {
  entries: string[];
};

export interface WindowApi {
  compile(payload: CompileRequest): Promise<CompileResult>;
  run(payload: RunRequest): Promise<ProcessResult>;
  analyze(payload: AnalyzeRequest): Promise<AnalyzeResult>;
  optimize(payload: OptimizeRequest): Promise<ProcessResult>;
  simulate(payload: SimulationRequest): Promise<SimulationResult>;
  benchmark(payload: BenchmarkRequest): Promise<BenchmarkResult>;
  storeProfileBaseline(payload: ProfileBaselineRequest): Promise<ProfileBaselineResponse>;
  compareProfile(payload: ProfileComparisonRequest): Promise<ProfileComparisonResult>;
  profileHistory(payload?: ProfileHistoryRequest): Promise<ProfileHistoryResponse>;
  workspaceList(payload?: WorkspaceListRequest): Promise<WorkspaceListResponse>;
  workspaceRead(payload: WorkspaceReadRequest): Promise<WorkspaceReadResponse>;
  workspaceWrite(payload: WorkspaceWriteRequest): Promise<WorkspaceMutationResponse>;
  workspaceCreate(payload: WorkspaceCreateRequest): Promise<WorkspaceMutationResponse>;
  workspaceRename(payload: WorkspaceRenameRequest): Promise<WorkspaceMutationResponse>;
  workspaceDelete(payload: WorkspaceDeleteRequest): Promise<WorkspaceMutationResponse>;
  workspaceLoadProject(payload: WorkspaceLoadProjectRequest): Promise<WorkspaceLoadProjectResponse>;
  terminalStart(payload?: TerminalStartRequest): Promise<TerminalStartResponse>;
  terminalWrite(payload: TerminalWriteRequest): Promise<TerminalMutationResponse>;
  terminalResize(payload: TerminalResizeRequest): Promise<TerminalMutationResponse>;
  terminalInterrupt(payload?: Record<string, never>): Promise<TerminalMutationResponse>;
  terminalRecordHistory(payload: TerminalRecordHistoryRequest): Promise<TerminalMutationResponse>;
  terminalHistoryList(payload?: Record<string, never>): Promise<TerminalHistoryListResponse>;
  onTerminalData(listener: (payload: TerminalEventData) => void): () => void;
  onTerminalExit(listener: (payload: TerminalEventExit) => void): () => void;
}

export type WorkspaceWriteRequest = {
  targetPath: string;
  content: string;
};

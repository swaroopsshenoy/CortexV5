const { z } = require("zod");
const { IPC_CHANNELS } = require("./channels");

const compileRequestSchema = z
  .object({
    compiler: z.enum(["clang++", "g++"]).optional(),
    sourcePath: z.string().min(1).optional(),
    outputPath: z.string().min(1).optional(),
    extraArgs: z.array(z.string()).optional(),
    code: z.string().optional()
  })
  .strict();

const runRequestSchema = z
  .object({
    binaryPath: z.string().min(1).optional(),
    args: z.array(z.string()).optional()
  })
  .strict();

const analyzeRequestSchema = z
  .object({
    scriptPath: z.string().min(1).optional(),
    sourcePath: z.string().min(1).optional(),
    args: z.array(z.string()).optional()
  })
  .strict();

const analyzeComplexityRequestSchema = z
  .object({
    sourcePath: z.string().min(1).optional(),
    code: z.string().optional(),
    args: z.array(z.string()).optional()
  })
  .strict();

const optimizeRequestSchema = z
  .object({
    scriptPath: z.string().min(1).optional(),
    sourcePath: z.string().min(1).optional(),
    args: z.array(z.string()).optional()
  })
  .strict();

const simulateRequestSchema = z
  .object({
    language: z.enum(["cpp"]).optional(),
    sourcePath: z.string().min(1).optional(),
    code: z.string().optional(),
    maxLoopIterations: z.number().int().min(1).max(200).optional()
  })
  .strict();

const benchmarkRequestSchema = z
  .object({
    compiler: z.enum(["clang++", "g++"]).optional(),
    sourcePath: z.string().min(1).optional(),
    outputPath: z.string().min(1).optional(),
    extraArgs: z.array(z.string()).optional(),
    code: z.string().optional(),
    args: z.array(z.string()).optional(),
    runs: z.number().int().min(1).max(50).optional(),
    warmupRuns: z.number().int().min(0).max(10).optional()
  })
  .strict();

const profileBaselineRequestSchema = z
  .object({
    benchmarkResult: z.record(z.unknown())
  })
  .strict();

const compareProfileRequestSchema = z
  .object({
    benchmarkResult: z.record(z.unknown())
  })
  .strict();

const profileHistoryRequestSchema = z
  .object({
    limit: z.number().int().min(1).max(50).optional()
  })
  .strict();

const workspaceListRequestSchema = z
  .object({
    targetPath: z.string().optional()
  })
  .strict();

const workspaceCreateRequestSchema = z
  .object({
    targetPath: z.string().min(1),
    kind: z.enum(["file", "directory"])
  })
  .strict();

const workspaceRenameRequestSchema = z
  .object({
    targetPath: z.string().min(1),
    nextPath: z.string().min(1)
  })
  .strict();

const workspaceDeleteRequestSchema = z
  .object({
    targetPath: z.string().min(1)
  })
  .strict();

const workspaceReadRequestSchema = z
  .object({
    targetPath: z.string().min(1)
  })
  .strict();

const workspaceWriteRequestSchema = z
  .object({
    targetPath: z.string().min(1),
    content: z.string()
  })
  .strict();

const workspaceLoadProjectRequestSchema = z
  .object({
    targetPath: z.string().min(1)
  })
  .strict();

const terminalStartRequestSchema = z
  .object({
    cwd: z.string().min(1).optional()
  })
  .strict();

const terminalWriteRequestSchema = z
  .object({
    data: z.string()
  })
  .strict();

const terminalResizeRequestSchema = z
  .object({
    cols: z.number().int().min(1),
    rows: z.number().int().min(1)
  })
  .strict();

const terminalInterruptRequestSchema = z.object({}).strict();

const terminalRecordHistoryRequestSchema = z
  .object({
    command: z.string().min(1)
  })
  .strict();

const terminalHistoryListRequestSchema = z.object({}).strict();

const reportGenerateRequestSchema = z
  .object({
    sourcePath: z.string().min(1).optional(),
    compiler: z.enum(["clang++", "g++"]).optional(),
    outputPath: z.string().min(1).optional(),
    analyzeResult: z.record(z.unknown()).optional(),
    benchmarkResult: z.record(z.unknown()).optional(),
    compileResult: z.record(z.unknown()).optional()
  })
  .strict();

const autoSaveStageRequestSchema = z
  .object({
    relativePath: z.string().min(1),
    content: z.string()
  })
  .strict();

const autoSaveRecoverRequestSchema = z
  .object({
    relativePath: z.string().min(1)
  })
  .strict();

const autoSaveListRequestSchema = z.object({}).strict();

const autoSaveDiscardRequestSchema = z
  .object({
    relativePath: z.string().min(1)
  })
  .strict();

const autoSaveStageResponseSchema = z
  .object({ ok: z.literal(true) })
  .strict();

const autoSaveRecoverResponseSchema = z
  .object({
    content: z.string().nullable()
  })
  .strict();

const autoSaveListResponseSchema = z
  .object({
    paths: z.array(z.string())
  })
  .strict();

const autoSaveDiscardResponseSchema = z
  .object({ ok: z.literal(true) })
  .strict();

const processResultSchema = z
  .object({
    code: z.number().int().nullable(),
    stdout: z.string(),
    stderr: z.string()
  })
  .strict();

const performanceRiskCauseSchema = z
  .object({
    feature: z.string().min(1),
    label: z.string().min(1).optional(),
    value: z.number(),
    contribution: z.number()
  })
  .strict();

const performanceRiskSchema = z
  .object({
    status: z.enum(["ok", "unavailable", "error"]),
    reason: z.string().optional(),
    riskClass: z.string().nullable(),
    probability: z.number().nullable(),
    confidenceBand: z.enum(["high", "medium", "low"]).nullable(),
    probabilities: z.record(z.number()).nullable().optional(),
    topCauses: z.array(performanceRiskCauseSchema)
  })
  .strict();

const nlpExplanationSchema = z
  .object({
    collapsed: z
      .object({
        title: z.string().min(1),
        summary: z.string().min(1)
      })
      .strict(),
    expanded: z
      .object({
        whatHappened: z.string().min(1),
        actions: z.array(z.string())
      })
      .strict(),
    metadata: z
      .object({
        id: z.string().min(1),
        domain: z.string().min(1),
        confidenceBand: z.enum(["high", "medium", "low"]),
        pipelineStages: z.array(z.string()),
        refinementEngine: z.string().optional()
      })
      .strict()
  })
  .strict();

const analyzeResultSchema = processResultSchema
  .extend({
    performanceRisk: performanceRiskSchema.optional(),
    nlpExplanations: z.array(nlpExplanationSchema).optional()
  })
  .strict();

const compilerDiagnosticSchema = z
  .object({
    file: z.string(),
    line: z.number().int().min(1),
    column: z.number().int().min(1),
    type: z.enum(["warning", "error"]),
    message: z.string()
  })
  .strict();

const compilerExplanationSectionsSchema = z
  .object({
    collapsed: z
      .object({
        title: z.string().min(1),
        summary: z.string().min(1)
      })
      .strict(),
    expanded: z
      .object({
        whatHappened: z.string().min(1),
        quickFixes: z.array(z.string()),
        quickFixCards: z.array(
          z
            .object({
              id: z.string().min(1),
              text: z.string().min(1),
              actionType: z.enum(["edit", "check", "read"]),
              expectedImpact: z.enum(["LOW", "MEDIUM", "HIGH"]),
              relevanceScore: z.number(),
              reason: z.string().min(1),
              priority: z.number().int().min(1)
            })
            .strict()
        )
      })
      .strict(),
    deepDive: z
      .object({
        whyThisMatched: z.string().min(1),
        originalDiagnostic: z.string().min(1)
      })
      .strict(),
    metadata: z
      .object({
        issue_id: z.string().min(1),
        compiler: z.enum(["clang++", "g++"]),
        category: z.enum(["Syntax", "Type", "Template", "Linker", "General"]),
        severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
        matcherType: z.enum(["regex", "fuzzy", "fallback"]),
        confidence: z.number(),
        confidenceBand: z.enum(["high", "medium", "low"])
      })
      .strict()
  })
  .strict();

const compileResultSchema = processResultSchema
  .extend({
    diagnostics: z.array(compilerDiagnosticSchema),
    explanations: z.array(
      z
        .object({
          key: z.string().min(1),
          issue_id: z.string().min(1),
          title: z.string().min(1),
          category: z.enum(["Syntax", "Type", "Template", "Linker", "General"]),
          severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
          compiler: z.enum(["clang++", "g++"]),
          matcherType: z.enum(["regex", "fuzzy", "fallback"]),
          summary: z.string().min(1),
          explanation: z.string().min(1),
          quickFixes: z.array(z.string()),
          quickFixCards: z.array(
            z
              .object({
                id: z.string().min(1),
                text: z.string().min(1),
                actionType: z.enum(["edit", "check", "read"]),
                expectedImpact: z.enum(["LOW", "MEDIUM", "HIGH"]),
                relevanceScore: z.number(),
                reason: z.string().min(1),
                priority: z.number().int().min(1)
              })
              .strict()
          ),
          confidence: z.number(),
          confidenceBand: z.enum(["high", "medium", "low"]),
          sections: compilerExplanationSectionsSchema,
          diagnostic: compilerDiagnosticSchema
        })
        .strict()
    )
  })
  .strict();

const executionVariableSchema = z
  .object({
    name: z.string().min(1),
    value: z.string().min(1),
    kind: z.enum(["param", "local"]),
    declaredLine: z.number().int().min(1).nullable()
  })
  .strict();

const executionScopeSchema = z
  .object({
    scopeId: z.number().int().min(1),
    kind: z.enum(["function", "block", "loop"]),
    locals: z.array(executionVariableSchema)
  })
  .strict();

const executionVariableSnapshotSchema = z
  .object({
    scopes: z.array(executionScopeSchema)
  })
  .strict();

const executionStackFrameSchema = z
  .object({
    frameId: z.number().int().min(1),
    functionName: z.string().min(1),
    scopeId: z.number().int().min(1),
    line: z.number().int().min(1).nullable(),
    params: z.array(executionVariableSchema),
    locals: z.array(executionVariableSchema)
  })
  .strict();

const executionStackSummarySchema = z
  .object({
    frames: z.number().int().min(0),
    locals: z.number().int().min(0),
    params: z.number().int().min(0)
  })
  .strict();

const executionHeapSummarySchema = z
  .object({
    allocations: z.number().int().min(0),
    frees: z.number().int().min(0),
    live: z.number().int().min(0),
    bytesAllocated: z.number().int().min(0),
    bytesFreed: z.number().int().min(0),
    bytesLive: z.number().int().min(0),
    unknownAllocs: z.number().int().min(0),
    unknownFrees: z.number().int().min(0)
  })
  .strict();

const executionMemorySnapshotSchema = z
  .object({
    stack: executionStackSummarySchema,
    heap: executionHeapSummarySchema
  })
  .strict();

const executionTraceStepSchema = z
  .object({
    stepIndex: z.number().int().min(1),
    eventType: z.enum([
      "line-enter",
      "evaluate",
      "branch",
      "assign",
      "loop-iteration",
      "statement",
      "return",
      "unsupported",
      "end"
    ]),
    phase: z.enum(["execution", "completed"]),
    line: z.number().int().min(1).nullable(),
    column: z.number().int().min(1).nullable(),
    currentLine: z.number().int().min(1).nullable(),
    detail: z.string(),
    variableSnapshot: executionVariableSnapshotSchema,
    callStack: z.array(executionStackFrameSchema),
    memorySnapshot: executionMemorySnapshotSchema,
    variable: z.string().optional(),
    value: z.string().optional(),
    decision: z.enum(["true", "false", "indeterminate"]).optional(),
    iteration: z.number().int().min(1).optional(),
    loopKind: z.enum(["for", "while"]).optional()
  })
  .strict();

const simulationWarningSchema = z
  .object({
    code: z.enum([
      "unsupported_construct",
      "indeterminate_condition",
      "loop_iteration_cap_reached"
    ]),
    message: z.string().min(1),
    line: z.number().int().min(1).nullable()
  })
  .strict();

const simulationSummarySchema = z
  .object({
    totalSteps: z.number().int().min(1),
    simulatedLines: z.number().int().min(0),
    unsupportedCount: z.number().int().min(0),
    warningCount: z.number().int().min(0),
    loopCapHits: z.number().int().min(0)
  })
  .strict();

const simulationResultSchema = z
  .object({
    status: z.enum(["ok", "partial"]),
    engine: z.literal("execution-simulator-v1"),
    language: z.literal("cpp"),
    sourcePath: z.string().min(1),
    maxLoopIterations: z.number().int().min(1).max(200),
    executionTrace: z.array(executionTraceStepSchema),
    warnings: z.array(simulationWarningSchema),
    summary: simulationSummarySchema,
    currentLine: z.number().int().min(1).nullable(),
    phase: z.literal("completed")
  })
  .strict();

const benchmarkRunSchema = z
  .object({
    runIndex: z.number().int().min(1),
    durationMs: z.number().min(0),
    code: z.number().int().nullable(),
    stdout: z.string(),
    stderr: z.string()
  })
  .strict();

const benchmarkSummarySchema = z
  .object({
    runCount: z.number().int().min(0),
    warmupRuns: z.number().int().min(0),
    minMs: z.number().min(0).nullable(),
    maxMs: z.number().min(0).nullable(),
    meanMs: z.number().min(0).nullable(),
    medianMs: z.number().min(0).nullable(),
    p95Ms: z.number().min(0).nullable()
  })
  .strict();

const benchmarkFailedRunSchema = z
  .object({
    runIndex: z.number().int().min(1),
    code: z.number().int().nullable()
  })
  .strict();

const benchmarkResultSchema = z
  .object({
    status: z.enum(["ok", "compile-error", "run-error"]),
    compile: compileResultSchema,
    runs: z.array(benchmarkRunSchema),
    summary: benchmarkSummarySchema,
    failedRun: benchmarkFailedRunSchema.nullable()
  })
  .strict();

const profileComparisonSchema = z
  .object({
    status: z.enum(["ok"]),
    baseline: z.object({
      timestamp: z.string(),
      meanMs: z.number().min(0)
    }),
    current: z.object({
      meanMs: z.number().min(0),
      minMs: z.number().min(0),
      maxMs: z.number().min(0),
      medianMs: z.number().min(0),
      p95Ms: z.number().min(0)
    }),
    deltas: z.object({
      meanDeltaMs: z.number(),
      meanDeltaPercent: z.number(),
      minDeltaMs: z.number(),
      maxDeltaMs: z.number(),
      medianDeltaMs: z.number(),
      p95DeltaMs: z.number()
    }),
    summary: z.object({
      improvement: z.string(),
      direction: z.enum(["faster", "slower"]),
      gainPercent: z.number().min(0),
      regressionPercent: z.number().min(0)
    })
  })
  .strict();

const profileBaselineResponseSchema = z
  .object({
    ok: z.literal(true),
    stored: z.literal(true)
  })
  .strict();

const profileHistoryEntrySchema = z
  .object({
    timestamp: z.string().min(1),
    meanMs: z.number().min(0)
  })
  .strict();

const profileHistoryResponseSchema = z
  .object({
    entries: z.array(profileHistoryEntrySchema)
  })
  .strict();

const workspaceEntrySchema = z.lazy(() =>
  z
    .object({
      name: z.string(),
      relativePath: z.string(),
      kind: z.enum(["file", "directory"]),
      children: z.array(workspaceEntrySchema).optional()
    })
    .strict()
);

const workspaceListResponseSchema = z
  .object({
    entries: z.array(workspaceEntrySchema)
  })
  .strict();

const workspaceMutationResponseSchema = z
  .object({
    ok: z.literal(true)
  })
  .strict();

const workspaceReadResponseSchema = z
  .object({
    content: z.string()
  })
  .strict();

const workspaceProjectSchema = z
  .object({
    type: z.enum(["cmake", "single-file", "multi-file"]),
    rootPath: z.string(),
    buildPath: z.string(),
    sourceFiles: z.array(z.string()),
    entryFile: z.string().nullable()
  })
  .strict();

const workspaceLoadProjectResponseSchema = z
  .object({
    ok: z.literal(true),
    project: workspaceProjectSchema
  })
  .strict();

const terminalStartResponseSchema = z
  .object({
    ok: z.literal(true),
    pid: z.number().int()
  })
  .strict();

const terminalMutationResponseSchema = z
  .object({
    ok: z.literal(true)
  })
  .strict();

const terminalHistoryListResponseSchema = z
  .object({
    entries: z.array(z.string())
  })
  .strict();

const reportGenerateResponseSchema = z
  .object({
    ok: z.literal(true),
    outputPath: z.string().min(1),
    sizeBytes: z.number().int().min(0)
  })
  .strict();

const requestSchemas = Object.freeze({
  [IPC_CHANNELS.compile]: compileRequestSchema,
  [IPC_CHANNELS.run]: runRequestSchema,
  [IPC_CHANNELS.analyze]: analyzeRequestSchema,
  [IPC_CHANNELS.optimize]: optimizeRequestSchema,
  [IPC_CHANNELS.simulate]: simulateRequestSchema,
  [IPC_CHANNELS.benchmark]: benchmarkRequestSchema,
  [IPC_CHANNELS.analyzeComplexity]: analyzeComplexityRequestSchema,
  [IPC_CHANNELS.storeProfileBaseline]: profileBaselineRequestSchema,
  [IPC_CHANNELS.compareProfile]: compareProfileRequestSchema,
  [IPC_CHANNELS.profileHistory]: profileHistoryRequestSchema,
  [IPC_CHANNELS.workspaceList]: workspaceListRequestSchema,
  [IPC_CHANNELS.workspaceCreate]: workspaceCreateRequestSchema,
  [IPC_CHANNELS.workspaceRename]: workspaceRenameRequestSchema,
  [IPC_CHANNELS.workspaceDelete]: workspaceDeleteRequestSchema,
  [IPC_CHANNELS.workspaceRead]: workspaceReadRequestSchema,
  [IPC_CHANNELS.workspaceWrite]: workspaceWriteRequestSchema,
  [IPC_CHANNELS.workspaceLoadProject]: workspaceLoadProjectRequestSchema,
  [IPC_CHANNELS.terminalStart]: terminalStartRequestSchema,
  [IPC_CHANNELS.terminalWrite]: terminalWriteRequestSchema,
  [IPC_CHANNELS.terminalResize]: terminalResizeRequestSchema,
  [IPC_CHANNELS.terminalInterrupt]: terminalInterruptRequestSchema,
  [IPC_CHANNELS.terminalRecordHistory]: terminalRecordHistoryRequestSchema,
  [IPC_CHANNELS.terminalHistoryList]: terminalHistoryListRequestSchema,
  [IPC_CHANNELS.reportGenerate]: reportGenerateRequestSchema,
  [IPC_CHANNELS.autoSaveStage]: autoSaveStageRequestSchema,
  [IPC_CHANNELS.autoSaveRecover]: autoSaveRecoverRequestSchema,
  [IPC_CHANNELS.autoSaveList]: autoSaveListRequestSchema,
  [IPC_CHANNELS.autoSaveDiscard]: autoSaveDiscardRequestSchema
});

const responseSchemas = Object.freeze({
  [IPC_CHANNELS.compile]: compileResultSchema,
  [IPC_CHANNELS.run]: processResultSchema,
  [IPC_CHANNELS.analyze]: analyzeResultSchema,
  [IPC_CHANNELS.optimize]: processResultSchema,
  [IPC_CHANNELS.simulate]: simulationResultSchema,
  [IPC_CHANNELS.benchmark]: benchmarkResultSchema,
  [IPC_CHANNELS.analyzeComplexity]: analyzeResultSchema,
  [IPC_CHANNELS.storeProfileBaseline]: profileBaselineResponseSchema,
  [IPC_CHANNELS.compareProfile]: profileComparisonSchema,
  [IPC_CHANNELS.profileHistory]: profileHistoryResponseSchema,
  [IPC_CHANNELS.workspaceList]: workspaceListResponseSchema,
  [IPC_CHANNELS.workspaceCreate]: workspaceMutationResponseSchema,
  [IPC_CHANNELS.workspaceRename]: workspaceMutationResponseSchema,
  [IPC_CHANNELS.workspaceDelete]: workspaceMutationResponseSchema,
  [IPC_CHANNELS.workspaceRead]: workspaceReadResponseSchema,
  [IPC_CHANNELS.workspaceWrite]: workspaceMutationResponseSchema,
  [IPC_CHANNELS.workspaceLoadProject]: workspaceLoadProjectResponseSchema,
  [IPC_CHANNELS.terminalStart]: terminalStartResponseSchema,
  [IPC_CHANNELS.terminalWrite]: terminalMutationResponseSchema,
  [IPC_CHANNELS.terminalResize]: terminalMutationResponseSchema,
  [IPC_CHANNELS.terminalInterrupt]: terminalMutationResponseSchema,
  [IPC_CHANNELS.terminalRecordHistory]: terminalMutationResponseSchema,
  [IPC_CHANNELS.terminalHistoryList]: terminalHistoryListResponseSchema,
  [IPC_CHANNELS.reportGenerate]: reportGenerateResponseSchema,
  [IPC_CHANNELS.autoSaveStage]: autoSaveStageResponseSchema,
  [IPC_CHANNELS.autoSaveRecover]: autoSaveRecoverResponseSchema,
  [IPC_CHANNELS.autoSaveList]: autoSaveListResponseSchema,
  [IPC_CHANNELS.autoSaveDiscard]: autoSaveDiscardResponseSchema
});

module.exports = {
  requestSchemas,
  responseSchemas
};

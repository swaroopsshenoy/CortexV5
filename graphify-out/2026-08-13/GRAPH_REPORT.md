# Graph Report - CortexV5  (2026-07-21)

## Corpus Check
- 95 files · ~55,567 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 990 nodes · 1395 edges · 70 communities (63 shown, 7 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `21028acc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Isolated Component 0
- Isolated Component 1
- Isolated Component 2
- Isolated Component 3
- Isolated Component 4
- Isolated Component 5
- Isolated Component 6
- Isolated Component 7
- Isolated Component 8
- Isolated Component 9
- Isolated Component 10
- Isolated Component 11
- Isolated Component 12
- Isolated Component 13
- Isolated Component 14
- Isolated Component 15
- Isolated Component 16
- Isolated Component 17
- Isolated Component 18
- Isolated Component 19
- Isolated Component 20
- Isolated Component 21
- pipeline.test.js
- Isolated Component 23
- Isolated Component 24
- Isolated Component 25
- Isolated Component 26
- Isolated Component 27
- Isolated Component 28
- stability.test.js
- Isolated Component 30
- Isolated Component 31
- Isolated Component 32
- Isolated Component 33
- Isolated Component 34
- Isolated Component 35
- Isolated Component 36
- Isolated Component 37
- Isolated Component 38
- Isolated Component 39
- clangService.test.js
- errorExplanationService.test.js
- Isolated Component 42
- Isolated Component 43
- Isolated Component 44
- Isolated Component 45
- Isolated Component 46
- Isolated Component 47
- Isolated Component 48
- Isolated Component 49
- Isolated Component 50
- Isolated Component 51
- Isolated Component 52
- Isolated Component 53
- Isolated Component 54
- Isolated Component 55
- Isolated Component 56
- Isolated Component 57
- Isolated Component 58
- Isolated Component 59
- Isolated Component 60
- Isolated Component 61
- Isolated Component 65
- channels.js
- createClangService

## God Nodes (most connected - your core abstractions)
1. `isObject()` - 27 edges
2. `WindowApi` - 25 edges
3. `validateString()` - 21 edges
4. `Cortex++V5 Master Roadmap (Primary Reference)` - 16 edges
5. `esc()` - 13 edges
6. `buildHtml()` - 13 edges
7. `buildExplanationRecord()` - 11 edges
8. `scripts` - 9 edges
9. `build` - 9 edges
10. `extractAstFeatures()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `createAstAnalysisService()` --calls--> `createOptimizationSuggestionService()`  [EXTRACTED]
  src/electron/main/astAnalysisService.js → src/electron/main/optimizationSuggestionService.js
- `getAstAnalysisService()` --calls--> `createAstAnalysisService()`  [EXTRACTED]
  src/electron/main/main.js → src/electron/main/astAnalysisService.js
- `getAutoSaveService()` --calls--> `createAutoSaveService()`  [EXTRACTED]
  src/electron/main/main.js → src/electron/main/autoSaveService.js
- `getBenchmarkRunnerService()` --calls--> `createBenchmarkRunnerService()`  [EXTRACTED]
  src/electron/main/main.js → src/electron/main/benchmarkRunnerService.js
- `getClangService()` --calls--> `createClangService()`  [EXTRACTED]
  src/electron/main/main.js → src/electron/main/clangService.js

## Import Cycles
- None detected.

## Communities (70 total, 7 thin omitted)

### Community 0 - "Isolated Component 0"
Cohesion: 0.03
Nodes (76): analyzeComplexityRequestSchema, analyzeRequestSchema, analyzeResultSchema, autoSaveDiscardRequestSchema, autoSaveDiscardResponseSchema, autoSaveListRequestSchema, autoSaveListResponseSchema, autoSaveRecoverRequestSchema (+68 more)

### Community 1 - "Isolated Component 1"
Cohesion: 0.06
Nodes (44): assertNonEmptyString(), buildComplexityEstimate(), CINDEX_UNAVAILABLE_MARKERS, collectCopyHotspotIssues(), collectDeadCodeIssues(), collectDeepNestingSmells(), collectDuplicateBlockSmells(), collectLargeClassSmells() (+36 more)

### Community 2 - "Isolated Component 2"
Cohesion: 0.07
Nodes (23): App(), formatComplexityFactors(), isDiagnosticForTab(), normalizeWorkspacePath(), parseAnalyzeStdoutPayload(), selectTopQuickFixCards(), toComplexityMessage(), toWorkspaceSourcePath() (+15 more)

### Community 3 - "Isolated Component 3"
Cohesion: 0.03
Nodes (58): AnalyzeRequest, AnalyzeResult, BenchmarkRequest, BenchmarkResult, BenchmarkRun, BenchmarkSummary, CompilerDiagnostic, CompileRequest (+50 more)

### Community 4 - "Isolated Component 4"
Cohesion: 0.12
Nodes (37): assertNonEmptyString(), assertStringArray(), buildExplanationRecord(), buildProgressiveSections(), buildQuickFixCards(), buildSummary(), CATEGORY_RELEVANCE_TOKENS, compilePattern() (+29 more)

### Community 5 - "Isolated Component 5"
Cohesion: 0.06
Nodes (41): applyMlEnhancement(), assertNonEmptyString(), buildAnalyzeContext(), buildTopCauseSummary(), createNlpExplanationService(), fs, getByPath(), matchesWhenClause() (+33 more)

### Community 6 - "Isolated Component 6"
Cohesion: 0.08
Nodes (24): build, appId, directories, extraResources, files, npmRebuild, nsis, productName (+16 more)

### Community 7 - "Isolated Component 7"
Cohesion: 0.09
Nodes (36): getOptimizationSuggestionService(), applyConstReferenceRefactor(), applyLoopModernizationRefactor(), assertNonEmptyString(), assertStringArray(), buildUnifiedDiff(), calculateSemanticSeverityPressure(), calculateSmellDensity() (+28 more)

### Community 8 - "Isolated Component 8"
Cohesion: 0.12
Nodes (36): api, { contextBridge, ipcRenderer }, IPC_CHANNEL_SET, IPC_CHANNELS, IPC_EVENT_SET, IPC_EVENTS, isObject(), validateAnalyzeComplexityPayload() (+28 more)

### Community 9 - "Isolated Component 9"
Cohesion: 0.08
Nodes (26): assertNonEmptyString(), buildBraceMap(), createExecutionSimulatorService(), createExecutionTrace(), detectFunctionHeader(), detectUnsupportedConstruct(), evaluateCondition(), extractFirstParenContent() (+18 more)

### Community 10 - "Isolated Component 10"
Cohesion: 0.15
Nodes (26): badge(), buildBenchmarkSection(), buildCodeSmellsSection(), buildComplexitySection(), buildDiagnosticsSection(), buildExplanationsSection(), buildHtml(), buildMetaSection() (+18 more)

### Community 11 - "Isolated Component 11"
Cohesion: 0.07
Nodes (25): { app, BrowserWindow, ipcMain, dialog, shell }, { createAstAnalysisService }, { createAutoSaveService }, { createBenchmarkRunnerService }, { createClangService }, { createComparativeProfilingService }, { createExecutionSimulatorService }, { createNlpExplanationService } (+17 more)

### Community 12 - "Isolated Component 12"
Cohesion: 0.08
Nodes (25): autoprefixer, concurrently, cross-env, electron, electron-builder, devDependencies, autoprefixer, concurrently (+17 more)

### Community 14 - "Isolated Component 14"
Cohesion: 0.05
Nodes (37): dotenv, monaco-editor, @monaco-editor/react, node-pty, author, dependencies, dotenv, monaco-editor (+29 more)

### Community 15 - "Isolated Component 15"
Cohesion: 0.26
Nodes (16): DataFrame, Random, build_dataset(), build_real_program_rows(), extract_features_from_cpp(), _func_names(), label_row(), load_columns() (+8 more)

### Community 16 - "Isolated Component 16"
Cohesion: 0.12
Nodes (16): Cortex++V5 Master Roadmap (Primary Reference), Deployment Baseline, Engineering Rule, Phase 10 - Final Production Features, Phase 1 - IDE Foundation, Phase 2 - Compiler System, Phase 3 - Error Intelligence, Phase 4 - Static Analysis (+8 more)

### Community 17 - "Isolated Component 17"
Cohesion: 0.20
Nodes (13): build_feature_vector_from_analyze_payload(), count_severity(), load_feature_columns(), project_root(), Path, rank_big_o(), confidence_band(), main() (+5 more)

### Community 18 - "Isolated Component 18"
Cohesion: 0.18
Nodes (8): assertNonEmptyString(), createBenchmarkRunnerService(), roundMs(), { spawn }, summarizeTimings(), assert, { createBenchmarkRunnerService }, test

### Community 19 - "Isolated Component 19"
Cohesion: 0.17
Nodes (10): createAutoSaveService(), fs, path, assert, { createAutoSaveService }, fs, os, path (+2 more)

### Community 20 - "Isolated Component 20"
Cohesion: 0.17
Nodes (7): { createErrorExplanationService }, FALLBACK_COMPILER_PATTERNS, fs, path, shouldRetryWithFallback(), { spawn }, WINDOWS_CLANG_MSVC_COMPAT_ARGS

### Community 21 - "Isolated Component 21"
Cohesion: 0.14
Nodes (19): buildCompletionItems(), escapeRegex(), extractUserSymbols(), filterByScope(), getIncludedHeaders(), getMemberAccessContext(), HEADER_SYMBOLS, resolveVariableType() (+11 more)

### Community 22 - "pipeline.test.js"
Cohesion: 0.17
Nodes (9): assert, { createAutoSaveService }, { createClangService }, { createReportService }, fs, os, path, PROJECT_ROOT (+1 more)

### Community 23 - "Isolated Component 23"
Cohesion: 0.22
Nodes (8): getProfileHistoryFilePath(), getProfileHistoryService(), assertNonEmptyString(), createProfileHistoryService(), fs, path, sortEntries(), toTimestampMs()

### Community 24 - "Isolated Component 24"
Cohesion: 0.27
Nodes (9): PPLX_API_KEY, npx, python, @microsoft/mcp-server-playwright, cortex-cmake, cortex-perplexity-search, cortex-python-ml, cortex-shell (+1 more)

### Community 25 - "Isolated Component 25"
Cohesion: 0.27
Nodes (9): PPLX_API_KEY, npx, python, @microsoft/mcp-server-playwright, cortex-cmake, cortex-perplexity-search, cortex-python-ml, cortex-shell (+1 more)

### Community 26 - "Isolated Component 26"
Cohesion: 0.27
Nodes (9): PPLX_API_KEY, npx, python, @microsoft/mcp-server-playwright, cortex-cmake, cortex-perplexity-search, cortex-python-ml, cortex-shell (+1 more)

### Community 27 - "Isolated Component 27"
Cohesion: 0.29
Nodes (11): ALLOWED_COMMANDS, analyzeWithPerformanceRisk(), getAstAnalysisService(), getBenchmarkRunnerService(), getClangService(), getNlpExplanationService(), getPerformanceRiskService(), spawnExecutable() (+3 more)

### Community 28 - "Isolated Component 28"
Cohesion: 0.39
Nodes (8): build(), configure(), Any, Run CMake configure step., Run CMake build step., Run CTest in the given build directory., _run(), test()

### Community 29 - "stability.test.js"
Cohesion: 0.17
Nodes (9): assert, { createAutoSaveService }, { createClangService }, { createReportService }, fs, os, path, PROJECT_ROOT (+1 more)

### Community 30 - "Isolated Component 30"
Cohesion: 0.25
Nodes (6): createComparativeProfilingService(), path, assert, { createComparativeProfilingService }, test, getComparativeProfilingService()

### Community 31 - "Isolated Component 31"
Cohesion: 0.20
Nodes (12): createTerminalSession(), detectWorkspaceProject(), getReportService(), isRegularFile(), isSourceFileName(), pickEntryFile(), readWorkspaceSourceFiles(), sendTerminalEvent() (+4 more)

### Community 32 - "Isolated Component 32"
Cohesion: 0.29
Nodes (7): explain_diagnostic(), predict_random_forest(), Any, Train a RandomForest model from CSV data and save it., Predict using a saved RandomForest model.     features_json example:     {"fea, Provide structured NLP-style explanation for compiler or runtime diagnostics., train_random_forest()

### Community 33 - "Isolated Component 33"
Cohesion: 0.46
Nodes (5): main(), polish_sentence(), refine_item(), refine_with_transformers(), NlpRefineDriverTest

### Community 34 - "Isolated Component 34"
Cohesion: 0.67
Nodes (6): algorithmic_programs(), compile_time_optimizations(), elimination_optimizations(), function_and_loop_optimizations(), main(), prog()

### Community 35 - "Isolated Component 35"
Cohesion: 0.47
Nodes (5): _parse_first_token(), Any, Run an allowlisted command for builds/tests/tooling., run_command(), _validate_command()

### Community 36 - "Isolated Component 36"
Cohesion: 0.33
Nodes (5): Implemented in this repository, MCP Servers for Cortex++V5, Quick setup, Recommended Servers, Suggested Startup Order

### Community 37 - "Isolated Component 37"
Cohesion: 0.67
Nodes (5): create_parser(), cursor_to_json(), diagnostics_to_json(), location_to_json(), main()

### Community 38 - "Isolated Component 38"
Cohesion: 0.40
Nodes (4): Build, test, and lint commands, Copilot Instructions for This Repository, High-level architecture, Key conventions

### Community 39 - "Isolated Component 39"
Cohesion: 0.40
Nodes (4): Core Skills, Extra Skills Added from Referenced Resources, Skill Catalog for Cortex++V5, Source Inspirations Used

### Community 40 - "clangService.test.js"
Cohesion: 0.22
Nodes (8): buildCompileToObjectArgs(), buildLinkArgs(), mergeWindowsClangCompatArgs(), assert, { createClangService, mergeWindowsClangCompatArgs, buildCompileToObjectArgs, buildLinkArgs }, path, PROJECT_ROOT, test

### Community 41 - "errorExplanationService.test.js"
Cohesion: 0.25
Nodes (6): assert, { createErrorExplanationService }, databaseRoot, fs, path, test

### Community 42 - "Isolated Component 42"
Cohesion: 0.50
Nodes (3): Any, Query Perplexity's API for real-time research.     Requires env var: PPLX_API_K, search()

### Community 43 - "Isolated Component 43"
Cohesion: 0.50
Nodes (3): Clang/GCC Compilation Pipeline Skill, Focus, Use when

### Community 44 - "Isolated Component 44"
Cohesion: 0.50
Nodes (3): Context7 + Research Skill, Focus, Use when

### Community 45 - "Isolated Component 45"
Cohesion: 0.50
Nodes (3): C++ Static Analysis & AST Skill, Focus, Use when

### Community 46 - "Isolated Component 46"
Cohesion: 0.50
Nodes (3): Electron Desktop Framework Skill, Focus, Use when

### Community 47 - "Isolated Component 47"
Cohesion: 0.50
Nodes (3): Electron Security Scaffold Skill, Focus, Use when

### Community 48 - "Isolated Component 48"
Cohesion: 0.50
Nodes (3): Focus, Full Pipeline Integration Skill (Master Skill), Use when

### Community 49 - "Isolated Component 49"
Cohesion: 0.50
Nodes (3): Focus, Monaco Editor + C++ IDE Skill, Use when

### Community 50 - "Isolated Component 50"
Cohesion: 0.50
Nodes (3): Focus, NLP Explanation & Error Intelligence Skill, Use when

### Community 51 - "Isolated Component 51"
Cohesion: 0.50
Nodes (3): Focus, Optimization Engine Skill, Use when

### Community 52 - "Isolated Component 52"
Cohesion: 0.50
Nodes (3): Focus, Performance Profiling & ML Predictor Skill, Use when

### Community 53 - "Isolated Component 53"
Cohesion: 0.50
Nodes (3): Focus, Playwright Webapp Testing Skill, Use when

### Community 54 - "Isolated Component 54"
Cohesion: 0.50
Nodes (3): Focus, React + Zustand + Tailwind UI Skill, Use when

### Community 55 - "Isolated Component 55"
Cohesion: 0.50
Nodes (3): Focus, Report Generation & PDF Export Skill, Use when

### Community 56 - "Isolated Component 56"
Cohesion: 0.67
Nodes (4): appendTerminalHistory(), getTerminalHistoryFilePath(), readTerminalHistory(), writeTerminalHistory()

### Community 69 - "channels.js"
Cohesion: 0.40
Nodes (4): IPC_CHANNEL_SET, IPC_CHANNELS, IPC_EVENT_SET, IPC_EVENTS

### Community 70 - "createClangService"
Cohesion: 0.50
Nodes (4): createClangService(), createErrorExplanationService(), createRewriteAdapter(), normalizeRewriteOutput()

## Knowledge Gaps
- **407 isolated node(s):** `npx`, `@microsoft/mcp-server-playwright`, `PPLX_API_KEY`, `npx`, `@microsoft/mcp-server-playwright` (+402 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClangService()` connect `createClangService` to `clangService.test.js`, `Isolated Component 11`, `Isolated Component 20`, `pipeline.test.js`, `Isolated Component 27`, `stability.test.js`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `createReportService()` connect `Isolated Component 31` to `Isolated Component 10`, `Isolated Component 11`, `stability.test.js`, `pipeline.test.js`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `createAutoSaveService()` connect `Isolated Component 19` to `Isolated Component 11`, `stability.test.js`, `pipeline.test.js`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `Run CMake configure step.`, `Run CMake build step.`, `Run CTest in the given build directory.` to the rest of the system?**
  _415 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Isolated Component 0` be split into smaller, more focused modules?**
  _Cohesion score 0.025974025974025976 - nodes in this community are weakly interconnected._
- **Should `Isolated Component 1` be split into smaller, more focused modules?**
  _Cohesion score 0.061016949152542375 - nodes in this community are weakly interconnected._
- **Should `Isolated Component 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
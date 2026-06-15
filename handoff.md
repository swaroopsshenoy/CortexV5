# Cortex++V5 Master Roadmap (Primary Reference)

This file is the canonical checklist I will read first before planning or implementing work.

## Product Direction
Build an integrated **Intelligent C++ Research & Optimization Platform** as a real software product (not disconnected modules), with a unified flow:

Editor -> Compiler -> Diagnostics -> Analysis -> Optimization -> Explanation -> Visualization

## Phase-by-Phase Systems Checklist

## Progress Snapshot
- ✅ **Phase 1 / System 1 / Step 1 complete**: Electron main process shell implemented in `src/electron/main/main.js` (window lifecycle, controlled process spawn, filesystem handlers, renderer load flow).
- ✅ **Phase 1 / System 1 / Step 2 complete**: Secure preload bridge implemented in `src/electron/preload/preload.js` with fixed API surface (`compile`, `run`, `analyze`, `optimize`) and payload validation.
- ✅ **Phase 1 / System 1 / Step 3 complete**: Monaco editor baseline implemented (`src/renderer/components/Editor/`) with syntax highlighting, completion snippets, diagnostics markers, tabs, minimap, and shortcuts.
- ✅ **Strict IPC channel validation complete**: centralized channel registry + guarded handler registration.
- ✅ **Typed IPC contracts definition complete**: shared IPC contracts/types and renderer IPC client wrapper added.
- ✅ **Phase 1 / System 2 / Step 1 complete**: Workspace explorer CRUD is now end-to-end, including tree rendering, create/rename/delete, file open/read, and file save/write via hardened IPC (`workspace:list/create/rename/delete/read/write`).
- ✅ **Phase 2 / System 4 / Step 2 complete**: Compile flow is fully wired via `child_process.spawn()` in `src/electron/main/clangService.js`, exposed through compile IPC, and triggered from renderer compile actions.
- ✅ **Phase 2 / System 4 / Step 3 complete**: `clangService.js` now parses stderr into structured diagnostics (`file/line/column/type/message`) and renderer consumes them for Monaco markers.
- ✅ **Phase 3 / System 5 / Step 1 complete**: Compiler error database scaffold added under `resources/compiler_error_database/` with compiler-specific JSON entries and mapper service (`src/electron/main/errorExplanationService.js`) returning explanation + quick-fix suggestions.
- ✅ **Phase 3 / System 5 / Target 1 expansion complete**: Added 20 beginner-friendly frequent-error mappings (clang++ + g++, syntax/type/template/linker) with explanation + quick-fix coverage and automated mapping tests in `src/electron/main/errorExplanationService.test.js`.
- ✅ **Phase 3 / System 5 / Step 2 complete**: `errorExplanationService.js` upgraded with regex scoring + fuzzy fallback (token overlap + Levenshtein-lite), strict type matching, confidence bands (`high/medium/low`), and structured unmapped-diagnostic telemetry.
- ✅ **Phase 3 / System 5 / Step 3 complete**: Added config-driven deterministic NLP formatter with progressive disclosure sections + metadata, plus pluggable rewrite adapter interface (no-op fallback) and unit tests.
- ✅ **Phase 3 / System 5 / Step 4 (Backend quality rules) complete**: Quick-fix pipeline now normalizes phrasing, deduplicates near-duplicate fixes, ranks by contextual relevance, tags action type (`edit/check/read`), and emits quick-fix cards with impact/reason/priority metadata.
- ✅ **Phase 3 / System 5 / Step 4 (UI integration) complete**: Terminal pane now renders top quick-fix cards with collapsed progressive disclosure, action/impact badges, copy-to-clipboard interaction, diagnostic focus, and editor auto-scroll to selected diagnostic line.
- ✅ **Phase 4 / System 6 / Step 1 complete**: Added backend AST generation service (`src/electron/main/astAnalysisService.js`) using `clang.cindex` JSON via Python driver with automatic fallback to `clang++ -Xclang -ast-dump -fsyntax-only`, wired through analyze IPC, with parser/fallback unit tests.
- ✅ **Phase 4 / System 6 / Step 2 complete**: Added single-file AST feature extraction in `astAnalysisService.js` for loops, nesting depth, recursion, pointer usage, STL usage, and allocation patterns with baseline thresholds, included in analyze JSON output, with unit tests per extractor.
- ✅ **Phase 4 / System 6 / Step 3 complete**: Added semantic checks in `astAnalysisService.js` returning structured issue lists for dead code, unused variables, memory risks, and copy hotspots, with fixed severities and remediation suggestions, included in analyze JSON output with unit tests per check.
- ✅ **Phase 4 / System 6 / Step 4 complete**: Added code smell detection in `astAnalysisService.js` for long functions, deep nesting, large classes, magic numbers, and duplicate blocks with severity + confidence + suggestions, included as `codeSmells` in analyze JSON output with unit tests per smell detector.
- ✅ **Phase 5 / System 7 / Step 1 complete**: Added optimization rule database (`resources/optimization_rule_database/core_rules.json`) and matcher/ranker service (`src/electron/main/optimizationSuggestionService.js`) with structured ranked suggestions (`id/title/rationale/actions/confidence/references`) integrated into analyze output as `optimizationSuggestions`, plus unit tests for rule loading, matching, and ranking.
- ✅ **Phase 5 / System 7 / Step 2 complete**: Added STL-focused optimization rule set (`resources/optimization_rule_database/stl_rules.json`) for loop modernization, const/reference passing, reserve guidance, algorithm substitution, and iterator-safe traversal; reused `optimizationSuggestions` output; added STL signal confidence weighting in `optimizationSuggestionService.js`; added unit tests per STL hint rule and STL boost behavior.
- ✅ **Phase 5 / System 7 / Step 3 complete**: Added optional high-confidence refactor preview generation (preview-only, no apply) in `optimizationSuggestionService.js` for loop modernization and const-reference suggestions, producing unified diff text and exposing `refactorPreviews` in `optimizationSuggestions`, with unit tests for diff generation and confidence gating.
- ✅ **Phase 5 / System 7 / Step 4 complete**: Added weighted confidence calibration in `optimizationSuggestionService.js` across all optimization suggestions (rule match strength, STL boost, semantic severity pressure, smell density, preview availability), with `confidenceBand` (`high/medium/low`) and `calibrationBreakdown` output, plus unit tests for calibration math and threshold band mapping.
- ✅ **Phase 6 / System 8 / Step 1 complete**: Added `executionSimulatorService.js` baseline with deterministic trace events (`line-enter`, `evaluate`, `branch`, `assign`, `loop-iteration`, `statement`, `return`, `end`) for sequential statements, assignments, `if/else`, `for`, and `while`; includes loop safety caps, indeterminate-condition deterministic pathing, unsupported-construct partial warnings, strict IPC wiring (`simulate`) across main/preload/renderer/shared contracts/schemas, and baseline unit tests.
- ✅ **Phase 6 / System 8 / Step 2 complete**: Added per-step variable snapshots (locals + params only) with function/block/loop scoping, assignment + declaration tracking, `for` init/iteration updates, and IPC schema validation; included unit tests for scoping behavior.
- ✅ **Phase 6 / System 8 / Step 3 complete**: Added call-stack frames in simulator output, IPC schema updates, and sidebar Call Stack UI with params/locals per frame.
- ✅ **Phase 6 / System 8 / Step 4 complete**: Added basic memory visualization with per-step stack/heap summaries, allocation/free detection, IPC schema updates, and sidebar Memory panel.
- ✅ **Phase 7 / System 9 / Step 1 complete**: Added benchmark runner service with runtime-only timing summary, IPC wiring (`benchmark`) across main/preload/renderer/shared contracts, and UI trigger with terminal summary output.
- ✅ **Phase 7 / System 9 / Step 2 complete**: Added static Big O complexity estimation with time/space heuristics (loops, nesting, recursion, STL, allocations), integration into AST analysis, unit tests for estimation logic, IPC wiring (`analyze-complexity`), and UI display in terminal with formatter.
- ✅ **Phase 7 / System 9 / Step 3 complete**: Added comparative profiling service with before/after benchmark comparison, delta calculations, improvement/regression detection, IPC wiring (`profile:store-baseline` / `profile:compare`) across main/preload/renderer/shared contracts, UI buttons (Store Baseline / Compare Profile), and terminal delta formatter.
- ✅ **Phase 7 / System 9 / Step 3 validation fix complete**: Added dedicated profile baseline response schema for IPC validation in `src/shared/ipc/schemas.js`.
- ✅ **Phase 7 / System 9 / Step 4 complete**: Added benchmark trend history storage in app data, profile history IPC, and trend chart UI (mean ms, improvement/regression badge, time axis labels).
- ✅ **Phase 8 / System 10 / Step 1 complete**: Added ML feature vector spec (`resources/ml_performance_dataset/feature_columns.json`, `src/electron/main/performanceRiskFeatures.js`, `src/electron/main/py/feature_spec.py`) mapped from analyze JSON (`features`, semantic checks, smells, complexity).
- ✅ **Phase 8 / System 10 / Step 2 complete**: Added dataset + training pipeline (`scripts/ml/build_dataset.py`, `scripts/ml/train_risk_model.py`) producing `resources/ml_performance_dataset/dataset.csv` and `resources/ml_models/performance_risk.joblib` (RandomForest + joblib, MCP-compatible payload shape).
- ✅ **Phase 8 / System 10 / Step 3 complete**: Added inference driver + service (`src/electron/main/py/performance_risk_driver.py`, `src/electron/main/performanceRiskService.js`) with top-cause ranking and unavailable/error handling.
- ✅ **Phase 8 / System 10 / Step 4 complete**: Wired performance risk into analyze IPC responses (`analyze`, `analyze-complexity`) and renderer terminal output (risk class, confidence, causes) with schema/contracts updates and unit tests.
- ✅ **Phase 8 / System 10 complete**: End-to-end **C++ Performance Risk Predictor** shipped (feature spec → dataset/train → `performance_risk.joblib` → Python driver → `performanceRiskService` → analyze IPC + **Analyze Complexity** terminal UI). Tests: `performanceRiskFeatures.test.js`, `performanceRiskService.test.js`, `src/electron/main/py/test_performance_risk_driver.py`. Retrain: `python scripts/ml/build_dataset.py --rows 480` then `python scripts/ml/train_risk_model.py`.
- 🔜 **Phase 8 follow-up (optional)**: Grow `resources/ml_performance_dataset/programs/` with real C++ samples and feed `build_dataset.py` from analyze/benchmark labels (current CSV is 480-row synthetic tier-balanced seed data).
- ✅ **Phase 9 / System 11 / Step 1 complete**: Added parameterized NLP template database (`resources/nlp_explanation_templates/templates.json`) for performance risk, complexity, semantic, and optimization domains.
- ✅ **Phase 9 / System 11 / Step 2 complete**: Added `nlpExplanationService.js` rule/template generation with context builders and ML enhancement from performance-risk causes.
- ✅ **Phase 9 / System 11 / Step 3 complete**: Added optional refinement driver (`src/electron/main/py/nlp_refine_driver.py`) with rule-based fallback and optional FLAN-T5 path via `CORTEX_NLP_MODEL_PATH`.
- ✅ **Phase 9 / System 11 / Step 4 complete**: Integrated pipeline into analyze IPC (`nlpExplanations`), compile rewrite adapter (compiler explanations), renderer terminal output, schemas/contracts, and tests (`nlpExplanationService.test.js`, `test_nlp_refine_driver.py`).
- ✅ **Phase 9 / System 11 complete**: Unified NLP explanation pipeline (rule templates → ML cause enrichment → Python refinement). Optional transformer rewrite: set `CORTEX_NLP_MODEL_PATH` to a local FLAN-T5-small (or compatible) model directory.
- ✅ **Phase 10 / System 12 / Step 1 complete**: Added `reportService.js` — builds a full styled HTML report from analyze/benchmark/compile/risk/NLP/optimization/smells/semantic data. Dark-mode glassmorphism design with print support.
- ✅ **Phase 10 / System 12 / Step 2 complete**: Wired `report:generate` IPC channel end-to-end (channels → schemas → main.js → preload.js → ipcClient → App.jsx). UI button **Generate Report** in topbar; stores HTML to `workspace/<basename>_report.html`.
- ✅ **Phase 10 / System 13 complete**: Added `autoSaveService.js` — stages unsaved code edits to `workspace/.autosave/` every 30 s via `setInterval`; four IPC channels (`autosave:stage/recover/list/discard`) wired end-to-end. `handleCodeChange` in App.jsx silently stages on every keystroke.
- ▶️ **Next active scope**: **Phase 10 / System 14 - Multi-File Support** + **System 15 - Testing System**.

## Phase 1 - IDE Foundation
1. **System 1 - Electron Desktop Framework**
   - `electron/main/main.js`: window lifecycle, IPC, compiler spawn, Python backend spawn, filesystem access
   - `electron/preload/preload.js`: expose only safe APIs (`compile`, `run`, `analyze`, `optimize`)
   - `renderer/components/Editor/`: Monaco integration (highlighting, autocomplete, markers, tabs, minimap, shortcuts)
2. **System 2 - Workspace System**
   - File explorer tree, create/delete/rename
   - Project loader: CMake + single-file + multi-file projects
   - Auto build directory creation (`/build`)
3. **System 3 - Terminal System**
   - Integrated terminal with `xterm.js`
   - Run binaries, execute commands, show compiler logs

## Phase 2 - Compiler System
4. **System 4 - Compilation Pipeline**
   - Compiler detection (GCC/Clang)
   - Compile flow via `child_process.spawn()`
   - `clangService.js`
   - Parse errors into file/line/column/type/message
   - Feed Monaco decorations

## Phase 3 - Error Intelligence
5. **System 5 - Error Explanation Engine**
   - Error DB: `resources/compiler_error_database/`
   - Pattern matching: `compiler_error_mapper.py` (regex/difflib/fuzzy matching)
   - NLP formatter for humanized explanations
   - Quick-fix suggestion cards

## Phase 4 - Static Analysis
6. **System 6 - Clang AST Analysis**
   - AST generation (`clang -Xclang -ast-dump -fsyntax-only` or `clang.cindex`)
   - Feature extraction (loops, nesting, recursion, pointers, STL, allocations)
   - Semantic checks (dead code, unused vars, memory risks, copy hotspots)
   - Code smell detection + suggestions

## Phase 5 - Optimization Engine
7. **System 7 - Optimization Suggestion Engine**
   - Rule database for optimization patterns
   - STL optimization hints (loop modernizations, references, etc.)
   - Optional auto-refactoring + diff view
   - Confidence scoring per suggestion

## Phase 6 - Debug Visualization
8. **System 8 - Execution Simulator**
   - Step-wise execution state engine
   - Variable tracker
   - Call-stack visualization
   - Basic memory visualization

## Phase 7 - Performance Profiling
9. **System 9 - Profiler Engine**
   - Benchmark runner (runtime/CPU/memory)
   - Complexity estimation heuristics
   - Comparative profiling (before/after optimization)
   - Trend charts

## Phase 8 - ML Performance Model
10. **System 10 - C++ Performance Risk Predictor** (implemented)
   - ✅ Dataset collection (480-row seed CSV; expandable to 400-500 real programs)
   - ✅ Feature extraction + risk labeling (`performanceRiskFeatures.js` / `feature_spec.py`)
   - ✅ Train `RandomForestClassifier` (scikit-learn) via `scripts/ml/train_risk_model.py`
   - ✅ Save model via `joblib` → `resources/ml_models/performance_risk.joblib`
   - ✅ Inference pipeline + UI risk display with causes (`performance_risk_driver.py`, analyze IPC, `App.jsx`)

## Phase 9 - NLP Response System
11. **System 11 - NLP Explanation Engine** (implemented)
   - ✅ Rule/template base generation (`nlpExplanationService.js`, `templates.json`)
   - ✅ Parameterized explanations (`{{parameter}}` rendering)
   - ✅ Optional T5/FLAN-T5-small rewrite refinement (`nlp_refine_driver.py`, `CORTEX_NLP_MODEL_PATH`)
   - ✅ Local inference pipeline (rule engine -> ML enhancement -> NLP refinement) on analyze + compile paths

## Phase 10 - Final Production Features
12. **System 12 - Report Generation**
   - Optimization/profiling/complexity reports
   - Export PDF + HTML
13. **System 13 - Crash Recovery**
   - Auto-save into `workspace/.autosave`
14. **System 14 - Multi-File Support**
   - Headers, multiple `.cpp`, CMake projects
15. **System 15 - Testing System**
   - Unit, integration, stress, invalid-syntax stability tests

## Deployment Baseline
- Electron frontend + Python engine packaging via `electron-builder`

## Engineering Rule
Treat integration as mandatory: every implemented system must connect to the upstream/downstream pipeline.

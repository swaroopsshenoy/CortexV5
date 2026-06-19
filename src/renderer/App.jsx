import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CppEditor from "./components/Editor/CppEditor";
import TerminalPane from "./components/Terminal/TerminalPane";
import { useEditorStore } from "./components/Editor/useEditorStore";
import { ipcClient } from "./ipc/client";

const PROFILE_HISTORY_WINDOW = 10;

function normalizeWorkspacePath(inputPath) {
  const normalized = String(inputPath ?? "")
    .trim()
    .replace(/\//g, "\\")
    .replace(/^\\+/, "")
    .replace(/\\+/g, "\\");
  if (normalized.toLowerCase() === "workspace") {
    return "";
  }
  return normalized.replace(/^workspace\\/i, "");
}

function mapSeverity(type) {
  return type === "warning" ? 4 : 8;
}

function isDiagnosticForTab(diagnosticFile, tabPath, tabLabel) {
  const normalizedDiagnosticFile = normalizeWorkspacePath(diagnosticFile).toLowerCase();
  const normalizedTabPath = normalizeWorkspacePath(tabPath).toLowerCase();
  const normalizedTabLabel = String(tabLabel ?? "").toLowerCase();
  return (
    normalizedDiagnosticFile === normalizedTabPath ||
    normalizedDiagnosticFile.endsWith(`\\${normalizedTabPath}`) ||
    normalizedDiagnosticFile.endsWith(`\\${normalizedTabLabel}`)
  );
}

function toWorkspaceSourcePath(relativeWorkspacePath) {
  const normalized = normalizeWorkspacePath(relativeWorkspacePath);
  return normalized ? `workspace\\${normalized}` : "workspace";
}

function toExplanationMessage(explanations) {
  if (!Array.isArray(explanations) || explanations.length === 0) {
    return "";
  }

  const top = explanations.slice(0, 3);
  const lines = top.flatMap((item, index) => [
    `${index + 1}. ${item.title} [${item.severity}] (${Math.round(item.confidence * 100)}%, ${item.confidenceBand})`,
    `   ${item.summary}`,
    ...item.quickFixes.slice(0, 2).map((fix) => `   - ${fix}`)
  ]);
  return ["Error explanations:", ...lines].join("\n");
}

function toSimulationMessage(result) {
  const preview = (result.executionTrace ?? [])
    .slice(0, 8)
    .map((step) => `#${step.stepIndex} ${step.eventType} L${step.currentLine ?? "-"} ${step.detail}`);
  return [
    `Simulation ${result.status}.`,
    `Steps: ${result.summary.totalSteps}`,
    `Warnings: ${result.summary.warningCount}`,
    ...preview
  ].join("\n");
}

function toBenchmarkMessage(result) {
  if (!result) {
    return "";
  }
  const summary = result.summary ?? {};
  const lines = [
    `Benchmark ${result.status}.`,
    `Runs: ${summary.runCount ?? 0}, Warmup: ${summary.warmupRuns ?? 0}`,
    summary.meanMs !== null && summary.meanMs !== undefined ? `Mean: ${summary.meanMs} ms` : "",
    summary.minMs !== null && summary.maxMs !== null
      ? `Min/Max: ${summary.minMs} / ${summary.maxMs} ms`
      : "",
    summary.medianMs !== null && summary.p95Ms !== null
      ? `Median: ${summary.medianMs} ms, P95: ${summary.p95Ms} ms`
      : ""
  ].filter(Boolean);
  if (result.failedRun) {
    lines.push(
      `Failed run #${result.failedRun.runIndex} (code ${result.failedRun.code ?? "null"})`
    );
  }
  const lastRun = result.runs?.at(-1);
  if (lastRun?.stdout) {
    lines.push(`stdout:\n${lastRun.stdout}`);
  }
  if (lastRun?.stderr) {
    lines.push(`stderr:\n${lastRun.stderr}`);
  }
  return lines.join("\n");
}

function parseAnalyzeStdoutPayload(result) {
  if (!result || result.code !== 0 || typeof result.stdout !== "string") {
    return null;
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function toNlpExplanationsMessage(nlpExplanations) {
  if (!Array.isArray(nlpExplanations) || nlpExplanations.length === 0) {
    return "";
  }
  const lines = ["NLP Explanations:"];
  for (const item of nlpExplanations.slice(0, 4)) {
    lines.push(`- ${item.collapsed?.title ?? "Insight"}: ${item.collapsed?.summary ?? ""}`);
    if (item.expanded?.whatHappened) {
      lines.push(`  ${item.expanded.whatHappened}`);
    }
    const actions = item.expanded?.actions ?? [];
    if (actions.length > 0) {
      lines.push(`  Actions: ${actions.slice(0, 2).join(" | ")}`);
    }
  }
  return lines.join("\n");
}

function toPerformanceRiskMessage(performanceRisk) {
  if (!performanceRisk || performanceRisk.status !== "ok") {
    if (performanceRisk?.status === "unavailable") {
      return `Performance risk: unavailable (${performanceRisk.reason ?? "unknown"}).`;
    }
    return "";
  }
  const probabilityPercent =
    typeof performanceRisk.probability === "number"
      ? `${Math.round(performanceRisk.probability * 100)}%`
      : "N/A";
  const causeLines = (performanceRisk.topCauses ?? [])
    .slice(0, 5)
    .map(
      (cause) =>
        `  - ${cause.label ?? cause.feature}: ${cause.value} (impact ${cause.contribution.toFixed(3)})`
    );
  return [
    "Performance Risk:",
    `Class: ${performanceRisk.riskClass ?? "N/A"}`,
    `Confidence: ${probabilityPercent} (${performanceRisk.confidenceBand ?? "unknown"})`,
    causeLines.length > 0 ? "Top causes:" : "",
    ...causeLines
  ]
    .filter(Boolean)
    .join("\n");
}

function toComplexityMessage(result) {
  if (!result) {
    return "";
  }
  const payload = parseAnalyzeStdoutPayload(result);
  const complexity = payload?.complexityEstimate ?? result.complexity ?? {};
  const time = complexity.time ?? {};
  const space = complexity.space ?? {};
  const lines = [
    "Complexity Analysis:",
    `Time: ${time.bigO ?? "N/A"} (${time.confidence ?? "unknown"})`,
    time.factors ? `  Factors: ${time.factors.join(", ")}` : "",
    time.notes && Array.isArray(time.notes) && time.notes.length > 0 ? `  Notes: ${time.notes.join("; ")}` : "",
    `Space: ${space.bigO ?? "N/A"} (${space.confidence ?? "unknown"})`,
    space.factors ? `  Factors: ${space.factors.join(", ")}` : "",
    space.notes && Array.isArray(space.notes) && space.notes.length > 0 ? `  Notes: ${space.notes.join("; ")}` : ""
  ].filter(Boolean);
  return lines.join("\n");
}

function toComparisonMessage(result) {
  if (!result || result.status !== "ok") {
    return "";
  }
  const { baseline, current, summary, deltas } = result;
  const lines = [
    "Comparative Profiling:",
    `Baseline: ${baseline.meanMs} ms (${baseline.timestamp})`,
    `Current: ${current.meanMs} ms`,
    `Delta: ${deltas.meanDeltaMs > 0 ? "+" : ""}${deltas.meanDeltaMs.toFixed(2)} ms (${deltas.meanDeltaPercent > 0 ? "+" : ""}${deltas.meanDeltaPercent.toFixed(1)}%)`,
    `Result: ${summary.improvement}% ${summary.direction}`
  ].filter(Boolean);
  return lines.join("\n");
}

function formatStackVariables(variables) {
  return (variables ?? [])
    .map((item) => `${item.name}=${item.value}`)
    .filter(Boolean)
    .join(", ");
}

function selectTopQuickFixCards(explanations) {
  const allCards = (explanations ?? []).flatMap((explanation) =>
    (explanation.quickFixCards ?? []).map((card) => ({
      ...card,
      explanationTitle: explanation.title,
      diagnostic: explanation.diagnostic
    }))
  );

  return allCards
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, 3);
}

function renderTree(entries, selectedPath, onSelect) {
  return (
    <ul className="workspace-tree">
      {entries.map((entry) => (
        <li key={entry.relativePath}>
          <button
            type="button"
            className={`tree-item ${selectedPath === entry.relativePath ? "selected" : ""}`}
            onClick={() => onSelect(entry)}
          >
            <span className="tree-kind">{entry.kind === "directory" ? "D" : "F"}</span>
            <span>{entry.name}</span>
          </button>
          {entry.kind === "directory" && entry.children && entry.children.length > 0
            ? renderTree(entry.children, selectedPath, onSelect)
            : null}
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  const tabs = useEditorStore((state) => state.tabs);
  const activeTabId = useEditorStore((state) => state.activeTabId);
  const init = useEditorStore((state) => state.init);
  const addTab = useEditorStore((state) => state.addTab);
  const closeTab = useEditorStore((state) => state.closeTab);
  const setActiveTab = useEditorStore((state) => state.setActiveTab);
  const updateActiveCode = useEditorStore((state) => state.updateActiveCode);
  const openWorkspaceTab = useEditorStore((state) => state.openWorkspaceTab);
  const renameWorkspacePath = useEditorStore((state) => state.renameWorkspacePath);
  const removeWorkspacePath = useEditorStore((state) => state.removeWorkspacePath);

  const [status, setStatus] = useState("Ready.");
  const [diagnostics, setDiagnostics] = useState([]);
  const [workspaceEntries, setWorkspaceEntries] = useState([]);
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState("");
  const [createPathInput, setCreatePathInput] = useState("");
  const [renamePathInput, setRenamePathInput] = useState("");
  const [projectPathInput, setProjectPathInput] = useState("");
  const [activeProject, setActiveProject] = useState(null);
  const [compileExplanations, setCompileExplanations] = useState([]);
  const [focusedDiagnostic, setFocusedDiagnostic] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [profileHistory, setProfileHistory] = useState([]);
  const [lastAnalyzeResult, setLastAnalyzeResult] = useState(null);
  const [lastCompileResult, setLastCompileResult] = useState(null);
  const terminalRef = useRef(null);

  const refreshWorkspace = useCallback(async () => {
    const result = await ipcClient.workspaceList();
    setWorkspaceEntries(result.entries);
  }, []);

  const loadProfileHistory = useCallback(async () => {
    const result = await ipcClient.profileHistory({ limit: PROFILE_HISTORY_WINDOW });
    setProfileHistory(result.entries);
  }, []);

  useEffect(() => {
    init();
    refreshWorkspace().catch((error) => {
      setStatus(`Workspace load error.\n${error.message}`);
    });
    loadProfileHistory().catch((error) => {
      setStatus(`Profile history error.\n${error.message}`);
    });
  }, [init, refreshWorkspace, loadProfileHistory]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs]
  );

  const callStackSnapshot = useMemo(() => {
    const trace = simulationResult?.executionTrace ?? [];
    for (let index = trace.length - 1; index >= 0; index -= 1) {
      const step = trace[index];
      if (Array.isArray(step.callStack) && step.callStack.length > 0) {
        return {
          frames: step.callStack,
          stepIndex: step.stepIndex,
          line: step.currentLine
        };
      }
    }
    const lastStep = trace.at(-1) ?? null;
    return {
      frames: [],
      stepIndex: lastStep?.stepIndex ?? null,
      line: lastStep?.currentLine ?? null
    };
  }, [simulationResult]);

  const memorySnapshot = useMemo(() => {
    const trace = simulationResult?.executionTrace ?? [];
    for (let index = trace.length - 1; index >= 0; index -= 1) {
      const step = trace[index];
      if (step?.memorySnapshot) {
        return {
          snapshot: step.memorySnapshot,
          stepIndex: step.stepIndex,
          line: step.currentLine
        };
      }
    }
    return {
      snapshot: null,
      stepIndex: null,
      line: null
    };
  }, [simulationResult]);

  const handleSelectWorkspaceEntry = useCallback(
    async (entry) => {
      setSelectedWorkspacePath(entry.relativePath);
      setRenamePathInput(entry.relativePath);
      if (entry.kind !== "file") {
        return;
      }

      try {
        const result = await ipcClient.workspaceRead({
          targetPath: entry.relativePath
        });
        openWorkspaceTab({
          path: entry.relativePath,
          code: result.content
        });
        setStatus(`Opened: ${entry.relativePath}`);
      } catch (error) {
        setStatus(`Open error.\n${error.message}`);
      }
    },
    [openWorkspaceTab]
  );

  async function handleCompile() {
    if (!activeTab) {
      return;
    }

    setStatus("Compiling...");
    try {
      let compilePayload;

      if (activeProject?.type === "cmake") {
        compilePayload = {
          projectType: "cmake",
          projectRootPath: `workspace\\${activeProject.rootPath}`.replace(/\\+/g, "\\"),
          buildPath: `workspace\\${activeProject.buildPath}`.replace(/\\+/g, "\\")
        };
        terminalRef.current?.writeSystem(
          `[cmake] Building project at ${activeProject.rootPath}...`
        );
      } else if (activeProject?.type === "multi-file" && activeProject.sourceFiles?.length > 1) {
        compilePayload = {
          projectType: "multi-file",
          compiler: "clang++",
          sourceFiles: activeProject.sourceFiles.map((f) => `workspace\\${f}`.replace(/\\+/g, "\\")),
          outputPath: `workspace\\${activeProject.buildPath}\\app.exe`.replace(/\\+/g, "\\")
        };
        terminalRef.current?.writeSystem(
          `[multi-file] Compiling ${activeProject.sourceFiles.length} files...`
        );
      } else {
        compilePayload = {
          compiler: "clang++",
          sourcePath: toWorkspaceSourcePath(activeTab.path),
          outputPath: `${toWorkspaceSourcePath(activeProject?.buildPath ?? "build")}\\app.exe`,
          code: activeTab.code
        };
      }

      const result = await ipcClient.compile(compilePayload);
      terminalRef.current?.writeSystem(
        [
          "Compile completed.",
          result.stdout ? `stdout:\n${result.stdout}` : "",
          result.stderr ? `stderr:\n${result.stderr}` : "",
          toExplanationMessage(result.explanations)
        ]
          .filter(Boolean)
          .join("\n")
      );
      setCompileExplanations(result.explanations ?? []);
      setLastCompileResult(result);
      setDiagnostics(
        (result.diagnostics ?? []).map((item) => ({
          ...item,
          severity: mapSeverity(item.type)
        }))
      );
      setStatus(
        result.code === 0
          ? "Compile succeeded."
          : `Compile failed.\n${result.stderr || result.stdout}`
      );
      refreshWorkspace().catch(() => {});
    } catch (error) {
      setCompileExplanations([]);
      setDiagnostics([]);
      setStatus(`Compile error.\n${error.message}`);
    }
  }

  async function handleQuickFixSelect(card) {
    if (!card || typeof card.text !== "string") {
      return;
    }

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(card.text);

      const matchingTab = tabs.find((tab) =>
        isDiagnosticForTab(card?.diagnostic?.file, tab.path, tab.label)
      );
      if (matchingTab) {
        setActiveTab(matchingTab.id);
      }

      if (card?.diagnostic?.line) {
        setFocusedDiagnostic({
          file: card.diagnostic.file,
          line: card.diagnostic.line,
          column: card.diagnostic.column
        });
      }

      setStatus(
        [
          `Quick fix copied: ${card.text}`,
          card.explanationTitle ? `Related issue: ${card.explanationTitle}` : "",
          card?.diagnostic?.line
            ? `Focused line: ${card.diagnostic.line}:${card.diagnostic.column ?? 1}`
            : ""
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch (error) {
      setStatus(`Quick-fix copy error.\n${error.message}`);
    }
  }

  async function handleRun() {
    setStatus("Running...");
    try {
      const result = await ipcClient.run({
        binaryPath: `${toWorkspaceSourcePath(activeProject?.buildPath ?? "build")}\\app.exe`
      });
      terminalRef.current?.writeSystem(
        [
          "Run completed.",
          result.stdout ? `stdout:\n${result.stdout}` : "",
          result.stderr ? `stderr:\n${result.stderr}` : ""
        ]
          .filter(Boolean)
          .join("\n")
      );
      setStatus(
        result.code === 0
          ? `Run succeeded.\n${result.stdout}`
          : `Run failed.\n${result.stderr || result.stdout}`
      );
    } catch (error) {
      setStatus(`Run error.\n${error.message}`);
    }
  }

  async function handleSimulate() {
    if (!activeTab) {
      return;
    }
    setStatus("Simulating...");
    setSimulationResult(null);
    try {
      const result = await ipcClient.simulate({
        language: "cpp",
        sourcePath: toWorkspaceSourcePath(activeTab.path),
        code: activeTab.code,
        maxLoopIterations: 20
      });
      setSimulationResult(result);
      terminalRef.current?.writeSystem(toSimulationMessage(result));
      setStatus(
        result.status === "ok"
          ? `Simulation completed.\nSteps: ${result.summary.totalSteps}`
          : `Simulation partial.\nWarnings: ${result.summary.warningCount}`
      );
    } catch (error) {
      setSimulationResult(null);
      setStatus(`Simulation error.\n${error.message}`);
    }
  }

  async function handleBenchmark() {
    if (!activeTab) {
      return;
    }
    if (activeProject && activeProject.type !== "single-file") {
      setStatus("Benchmark supports single-file projects only.");
      return;
    }

    setStatus("Benchmarking...");
    try {
      const result = await ipcClient.benchmark({
        compiler: "clang++",
        sourcePath: toWorkspaceSourcePath(activeTab.path),
        outputPath: `${toWorkspaceSourcePath(activeProject?.buildPath ?? "build")}\\benchmark.exe`,
        code: activeTab.code,
        runs: 5,
        warmupRuns: 1
      });
      terminalRef.current?.writeSystem(toBenchmarkMessage(result));
      if (result.status === "ok") {
        setBenchmarkResult(result);
        setStatus(`Benchmark completed.\nMean: ${result.summary.meanMs} ms`);
        try {
          await loadProfileHistory();
        } catch (error) {
          setStatus(`Profile history error.\n${error.message}`);
        }
        return;
      }
      if (result.status === "compile-error") {
        setStatus(`Benchmark compile failed.\n${result.compile.stderr || result.compile.stdout}`);
        return;
      }
      const lastRun = result.runs.at(-1);
      setStatus(`Benchmark run failed.\n${lastRun?.stderr || lastRun?.stdout || ""}`);
    } catch (error) {
      setStatus(`Benchmark error.\n${error.message}`);
    }
  }

  async function handleAnalyzeComplexity() {
    if (!activeTab) {
      return;
    }

    setStatus("Analyzing complexity...");
    try {
      const result = await ipcClient.analyzeComplexity({
        sourcePath: toWorkspaceSourcePath(activeTab.path),
        code: activeTab.code
      });
      terminalRef.current?.writeSystem(
        [
          toComplexityMessage(result),
          toPerformanceRiskMessage(result.performanceRisk),
          toNlpExplanationsMessage(result.nlpExplanations)
        ]
          .filter(Boolean)
          .join("\n\n")
      );
      setStatus("Complexity, risk, and NLP analysis completed.");
      setLastAnalyzeResult(result);
    } catch (error) {
      setStatus(`Complexity analysis error.\n${error.message}`);
    }
  }


  async function handleStoreBaseline() {
    if (!benchmarkResult) {
      setStatus("Run benchmark first.");
      return;
    }

    try {
      await ipcClient.storeProfileBaseline({ benchmarkResult });
      setStatus("Baseline profile stored.");
    } catch (error) {
      setStatus(`Store baseline error.\n${error.message}`);
    }
  }

  async function handleCompareProfile() {
    if (!benchmarkResult) {
      setStatus("Run benchmark first.");
      return;
    }

    setStatus("Comparing profiles...");
    try {
      const result = await ipcClient.compareProfile({ benchmarkResult });
      terminalRef.current?.writeSystem(toComparisonMessage(result));
      setStatus("Profiling comparison completed.");
    } catch (error) {
      setStatus(`Compare profile error.\n${error.message}`);
    }
  }

  async function handleGenerateReport() {
    if (!activeTab) {
      return;
    }
    setStatus("Generating report...");
    try {
      const result = await ipcClient.reportGenerate({
        sourcePath: toWorkspaceSourcePath(activeTab.path),
        compiler: "clang++",
        analyzeResult: lastAnalyzeResult ?? undefined,
        benchmarkResult: benchmarkResult ?? undefined,
        compileResult: lastCompileResult ?? undefined
      });
      terminalRef.current?.writeSystem(
        `Report generated: ${result.outputPath} (${result.sizeBytes} bytes)`
      );
      setStatus(`Report saved: ${result.outputPath}`);
      refreshWorkspace().catch(() => {});
    } catch (error) {
      setStatus(`Report error.\n${error.message}`);
    }
  }

  async function handleSave() {
    if (!activeTab) {
      return;
    }
    try {
      await ipcClient.workspaceWrite({
        targetPath: activeTab.path,
        content: activeTab.code
      });
      await refreshWorkspace();
      setStatus(`Saved: ${activeTab.path}`);
    } catch (error) {
      setStatus(`Save error.\n${error.message}`);
    }
  }

  async function handleAutoSaveStage(path, content) {
    try {
      await ipcClient.autoSaveStage({ relativePath: path, content });
    } catch {
      // silent — auto-save must never block user
    }
  }

  function handleCodeChange(code) {
    updateActiveCode(code);
    if (activeTab?.path) {
      handleAutoSaveStage(activeTab.path, code);
    }
  }


  async function handleCreate(kind) {
    const normalizedInputPath = normalizeWorkspacePath(createPathInput);
    if (!normalizedInputPath) {
      setStatus("Enter path first.");
      return;
    }
    try {
      await ipcClient.workspaceCreate({
        targetPath: normalizedInputPath,
        kind
      });
      await refreshWorkspace();
      if (kind === "file") {
        openWorkspaceTab({
          path: normalizedInputPath,
          code: ""
        });
        setSelectedWorkspacePath(normalizedInputPath);
        setRenamePathInput(normalizedInputPath);
      }
      setCreatePathInput("");
      setStatus(`${kind} created: ${normalizedInputPath}`);
    } catch (error) {
      setStatus(`Create error.\n${error.message}`);
    }
  }

  async function handleRename() {
    if (!selectedWorkspacePath) {
      setStatus("Select item first.");
      return;
    }
    const normalizedNextPath = normalizeWorkspacePath(renamePathInput);
    if (!normalizedNextPath) {
      setStatus("Enter rename path.");
      return;
    }
    try {
      await ipcClient.workspaceRename({
        targetPath: selectedWorkspacePath,
        nextPath: normalizedNextPath
      });
      renameWorkspacePath(selectedWorkspacePath, normalizedNextPath);
      setSelectedWorkspacePath(normalizedNextPath);
      setRenamePathInput(normalizedNextPath);
      await refreshWorkspace();
      setStatus(`Renamed: ${selectedWorkspacePath} -> ${normalizedNextPath}`);
    } catch (error) {
      setStatus(`Rename error.\n${error.message}`);
    }
  }

  async function handleDelete() {
    if (!selectedWorkspacePath) {
      setStatus("Select item first.");
      return;
    }
    const confirmed = window.confirm(`Delete ${selectedWorkspacePath}?`);
    if (!confirmed) {
      return;
    }
    try {
      await ipcClient.workspaceDelete({
        targetPath: selectedWorkspacePath
      });
      removeWorkspacePath(selectedWorkspacePath);
      setSelectedWorkspacePath("");
      await refreshWorkspace();
      setStatus(`Deleted: ${selectedWorkspacePath}`);
    } catch (error) {
      setStatus(`Delete error.\n${error.message}`);
    }
  }

  async function handleLoadProject() {
    const normalizedInputPath = normalizeWorkspacePath(projectPathInput);
    if (!normalizedInputPath) {
      setStatus("Enter project path first.");
      return;
    }

    try {
      const result = await ipcClient.workspaceLoadProject({
        targetPath: normalizedInputPath
      });
      setActiveProject(result.project);
      await refreshWorkspace();

      if (result.project.entryFile) {
        const fileResult = await ipcClient.workspaceRead({
          targetPath: result.project.entryFile
        });
        openWorkspaceTab({
          path: result.project.entryFile,
          code: fileResult.content
        });
        setSelectedWorkspacePath(result.project.entryFile);
        setRenamePathInput(result.project.entryFile);
      }

      setStatus(
        [
          `Project loaded: ${result.project.type}`,
          `Root: ${result.project.rootPath || "."}`,
          `Build: ${result.project.buildPath}`,
          `Sources: ${result.project.sourceFiles.length}`
        ].join("\n")
      );
    } catch (error) {
      setStatus(`Project load error.\n${error.message}`);
    }
  }

  if (!activeTab) {
    return null;
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <strong>CortexV5 - Monaco C++ IDE</strong>
        <div className="actions">
          <button type="button" onClick={addTab}>
            New Tab
          </button>
          <button type="button" onClick={handleCompile}>
            Compile
          </button>
          <button type="button" onClick={handleRun}>
            Run
          </button>
          <button type="button" onClick={handleBenchmark}>
            Benchmark
          </button>
          <button type="button" onClick={handleAnalyzeComplexity}>
            Analyze Complexity
          </button>
          <button type="button" onClick={handleStoreBaseline}>
            Store Baseline
          </button>
          <button type="button" onClick={handleCompareProfile}>
            Compare Profile
          </button>
          <button type="button" onClick={handleSimulate}>
            Simulate
          </button>
          <button type="button" id="btn-generate-report" onClick={handleGenerateReport}>
            Generate Report
          </button>
        </div>
      </div>

      <div className="content">
        <aside className="workspace-pane">
          <div className="workspace-header">
            <strong>Workspace</strong>
            <input
              className="workspace-input"
              type="text"
              value={projectPathInput}
              onChange={(event) => setProjectPathInput(event.target.value)}
              placeholder="Project path/file to load"
            />
            <div className="workspace-actions">
              <button type="button" onClick={handleLoadProject}>
                Load Project
              </button>
            </div>
            <input
              className="workspace-input"
              type="text"
              value={createPathInput}
              onChange={(event) => setCreatePathInput(event.target.value)}
              placeholder="Path for +File/+Dir"
            />
            <input
              className="workspace-input"
              type="text"
              value={renamePathInput}
              onChange={(event) => setRenamePathInput(event.target.value)}
              placeholder="Rename selected to..."
            />
            <div className="workspace-actions">
              <button type="button" onClick={() => handleCreate("file")}>
                +File
              </button>
              <button type="button" onClick={() => handleCreate("directory")}>
                +Dir
              </button>
              <button type="button" onClick={handleRename}>
                Rename
              </button>
              <button type="button" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
          <div className="workspace-body">
            {renderTree(workspaceEntries, selectedWorkspacePath, handleSelectWorkspaceEntry)}
          </div>
          <section className="callstack-pane">
            <div className="callstack-header">
              <strong>Call Stack</strong>
              <span className="callstack-meta">
                {callStackSnapshot.stepIndex
                  ? `Step #${callStackSnapshot.stepIndex}`
                  : "No simulation yet"}
              </span>
            </div>
            {callStackSnapshot.frames.length === 0 ? (
              <div className="callstack-empty">Run Simulate to populate the call stack.</div>
            ) : (
              <ol className="callstack-list">
                {[...callStackSnapshot.frames].reverse().map((frame, index) => {
                  const paramText = formatStackVariables(frame.params);
                  const localText = formatStackVariables(frame.locals);
                  return (
                    <li
                      key={`${frame.frameId}-${frame.functionName}`}
                      className={`callstack-frame ${index === 0 ? "callstack-frame--top" : ""}`}
                    >
                      <div className="callstack-frame-title">
                        <span>{frame.functionName}</span>
                        <span className="callstack-line">L{frame.line ?? "-"}</span>
                      </div>
                      {paramText ? (
                        <div className="callstack-frame-meta">Params: {paramText}</div>
                      ) : null}
                      {localText ? (
                        <div className="callstack-frame-meta">Locals: {localText}</div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          <section className="memory-pane">
            <div className="memory-header">
              <strong>Memory</strong>
              <span className="memory-meta">
                {memorySnapshot.stepIndex ? `Step #${memorySnapshot.stepIndex}` : "No simulation yet"}
              </span>
            </div>
            {!memorySnapshot.snapshot ? (
              <div className="memory-empty">Run Simulate to populate memory.</div>
            ) : (
              <div className="memory-grid">
                <div className="memory-block">
                  <div className="memory-title">Stack</div>
                  <div className="memory-row">
                    Frames: {memorySnapshot.snapshot.stack.frames}
                  </div>
                  <div className="memory-row">
                    Params: {memorySnapshot.snapshot.stack.params}
                  </div>
                  <div className="memory-row">
                    Locals: {memorySnapshot.snapshot.stack.locals}
                  </div>
                </div>
                <div className="memory-block">
                  <div className="memory-title">Heap</div>
                  <div className="memory-row">
                    Allocs: {memorySnapshot.snapshot.heap.allocations} (unknown{" "}
                    {memorySnapshot.snapshot.heap.unknownAllocs})
                  </div>
                  <div className="memory-row">
                    Frees: {memorySnapshot.snapshot.heap.frees} (unknown{" "}
                    {memorySnapshot.snapshot.heap.unknownFrees})
                  </div>
                  <div className="memory-row">Live: {memorySnapshot.snapshot.heap.live}</div>
                  <div className="memory-row">
                    Bytes live: {memorySnapshot.snapshot.heap.bytesLive}
                  </div>
                </div>
              </div>
            )}
          </section>
        </aside>

        <section className="editor-pane">
          <div className="tabbar">
            {tabs.map((tab) => (
              <div key={tab.id} className={`tab ${tab.id === activeTab.id ? "active" : ""}`}>
                <button type="button" className="tab-label" onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                </button>
                <button
                  type="button"
                  className="tab-close"
                  aria-label={`Close ${tab.label}`}
                  onClick={() => closeTab(tab.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="editor-host">
            <CppEditor
              tab={activeTab}
              diagnostics={diagnostics.filter((item) =>
                isDiagnosticForTab(item.file, activeTab.path, activeTab.label)
              )}
              focusDiagnostic={
                focusedDiagnostic &&
                isDiagnosticForTab(focusedDiagnostic.file, activeTab.path, activeTab.label)
                  ? focusedDiagnostic
                  : null
              }
              onCodeChange={handleCodeChange}
              onSave={handleSave}
              onCompile={handleCompile}
            />
          </div>
        </section>

        <TerminalPane
          ref={terminalRef}
          quickFixCards={selectTopQuickFixCards(compileExplanations)}
          onQuickFixSelect={handleQuickFixSelect}
          profileHistory={profileHistory}
          profileHistoryWindow={PROFILE_HISTORY_WINDOW}
        />
      </div>

      <div className="status">{status}</div>
    </div>
  );
}

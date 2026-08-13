import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CppEditor from "./components/Editor/CppEditor";
import FileExplorer from "./components/FileExplorer/FileExplorer";
import BenchmarkModal from "./components/BenchmarkModal";
import Resizer from "./components/Resizer";
import InspectorPane from "./components/InspectorPane";
import TerminalPane from "./components/Terminal/TerminalPane";
import DiffViewer from "./components/Editor/DiffViewer";
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

function formatComplexityFactors(factors) {
  if (!factors) {
    return "";
  }
  if (Array.isArray(factors)) {
    return factors.join(", ");
  }
  if (typeof factors === "object") {
    return Object.entries(factors)
      .map(([key, val]) => `${key}: ${val}`)
      .join(", ");
  }
  return String(factors);
}

function toComplexityMessage(result) {
  if (!result) {
    return "";
  }
  const payload = parseAnalyzeStdoutPayload(result);
  const complexity = payload?.complexityEstimate ?? result.complexity ?? {};
  const time = complexity.time ?? {};
  const space = complexity.space ?? {};
  const formattedTimeFactors = formatComplexityFactors(time.factors);
  const formattedSpaceFactors = formatComplexityFactors(space.factors);
  const lines = [
    "Complexity Analysis:",
    `Time: ${time.bigO ?? "N/A"} (${time.confidence ?? "unknown"})`,
    formattedTimeFactors ? `  Factors: ${formattedTimeFactors}` : "",
    time.notes && Array.isArray(time.notes) && time.notes.length > 0 ? `  Notes: ${time.notes.join("; ")}` : "",
    `Space: ${space.bigO ?? "N/A"} (${space.confidence ?? "unknown"})`,
    formattedSpaceFactors ? `  Factors: ${formattedSpaceFactors}` : "",
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

/* renderTree removed — replaced by FileExplorer component */

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
  const [workspaceRootPath, setWorkspaceRootPath] = useState("");
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState("");
  const [activeProject, setActiveProject] = useState(null);
  const [compileExplanations, setCompileExplanations] = useState([]);
  const [focusedDiagnostic, setFocusedDiagnostic] = useState(null);

  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [profileHistory, setProfileHistory] = useState([]);
  const [lastAnalyzeResult, setLastAnalyzeResult] = useState(null);
  const [lastCompileResult, setLastCompileResult] = useState(null);
  const [batchBenchmarkResults, setBatchBenchmarkResults] = useState([]);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [isDiffViewerOpen, setIsDiffViewerOpen] = useState(false);
  const [optimizedCodeData, setOptimizedCodeData] = useState("");
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulationStepIndex, setSimulationStepIndex] = useState(0);
  const terminalRef = useRef(null);
  const contentRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const cppEditorRef = useRef(null);

  const handleLeftResize = useCallback((deltaX) => {
    if (!contentRef.current) return;
    const currentWidth = parseFloat(getComputedStyle(contentRef.current).getPropertyValue("--left-sidebar-width")) || 280;
    const newWidth = Math.max(150, Math.min(800, currentWidth + deltaX));
    contentRef.current.style.setProperty("--left-sidebar-width", `${newWidth}px`);
  }, []);

  const handleRightResize = useCallback((deltaX) => {
    if (!contentRef.current) return;
    const currentWidth = parseFloat(getComputedStyle(contentRef.current).getPropertyValue("--right-sidebar-width")) || 360;
    const newWidth = Math.max(200, Math.min(800, currentWidth - deltaX));
    contentRef.current.style.setProperty("--right-sidebar-width", `${newWidth}px`);
    
    // trigger xterm resize
    if (terminalRef.current && terminalRef.current.resize) {
      setTimeout(() => terminalRef.current.resize(), 10);
    } else {
      window.dispatchEvent(new Event("resize"));
    }
  }, []);

  const handleBottomResize = useCallback((deltaY) => {
    if (!contentRef.current) return;
    // The resizer sits above the terminal panel, so dragging down (positive delta) decreases terminal height
    // Actually, we can attach this to the app-shell or content flex direction
    const currentHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bottom-panel-height")) || 250;
    const newHeight = Math.max(100, Math.min(800, currentHeight - deltaY));
    document.documentElement.style.setProperty("--bottom-panel-height", `${newHeight}px`);
    
    if (terminalRef.current && terminalRef.current.resize) {
      setTimeout(() => terminalRef.current.resize(), 10);
    } else {
      window.dispatchEvent(new Event("resize"));
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    try {
      const result = await ipcClient.workspaceList({});
      setWorkspaceEntries(result.entries);
      if (result.path) {
        setWorkspaceRootPath(result.path);
      }
    } catch (error) {
      console.error("Workspace refresh failed:", error);
    }
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



  const handleSelectWorkspaceEntry = useCallback(
    async (entry) => {
      setSelectedWorkspacePath(entry.relativePath);
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

  async function handleCompile(silent = false, currentCode = null) {
    if (!activeTab) {
      return;
    }

    if (silent !== true) setStatus("Compiling...");
    try {
      let compilePayload;
      const codeToCompile = currentCode ?? activeTab.code;

      if (activeProject?.type === "cmake") {
        compilePayload = {
          projectType: "cmake",
          projectRootPath: `workspace\\${activeProject.rootPath}`.replace(/\\+/g, "\\"),
          buildPath: `workspace\\${activeProject.buildPath}`.replace(/\\+/g, "\\")
        };
        if (silent !== true) terminalRef.current?.writeSystem(
          `[cmake] Building project at ${activeProject.rootPath}...`
        );
      } else if (activeProject?.type === "multi-file" && activeProject.sourceFiles?.length > 1) {
        compilePayload = {
          projectType: "multi-file",
          compiler: "clang++",
          sourceFiles: activeProject.sourceFiles.map((f) => `workspace\\${f}`.replace(/\\+/g, "\\")),
          outputPath: `workspace\\${activeProject.buildPath}\\app.exe`.replace(/\\+/g, "\\")
        };
        if (silent !== true) terminalRef.current?.writeSystem(
          `[multi-file] Compiling ${activeProject.sourceFiles.length} files...`
        );
      } else {
        compilePayload = {
          compiler: "clang++",
          sourcePath: toWorkspaceSourcePath(activeTab.path),
          outputPath: `${toWorkspaceSourcePath(activeProject?.buildPath ?? "build")}\\app.exe`,
          code: codeToCompile
        };
      }

      const result = await ipcClient.compile(compilePayload);
      if (silent !== true) {
        terminalRef.current?.writeSystem(
          [
            "Compile completed.",
            result.stdout ? `stdout:\n${result.stdout}` : "",
            result.stderr ? `stderr:\n${result.stderr}` : "",
            toExplanationMessage(result.explanations)
          ]
            .filter(Boolean)
            .join("\n"),
          result.stderr ? "error" : "success"
        );
      }
      
      if (result.explanations) {
        setCompileExplanations(result.explanations);
      }
      if (silent !== true) setLastCompileResult(result);
      
      setDiagnostics(
        (result.diagnostics ?? []).map((item) => ({
          ...item,
          severity: mapSeverity(item.type)
        }))
      );
      
      if (silent !== true) {
        setStatus(
          result.code === 0
            ? "Compile succeeded."
            : `Compile failed.\n${result.stderr || result.stdout}`
        );
        refreshWorkspace().catch(() => {});
      }
    } catch (error) {
      if (silent !== true) setCompileExplanations([]);
      setDiagnostics([]);
      if (silent !== true) {
        setStatus(`Compile error.\n${error.message}`);
        terminalRef.current?.writeSystem(`Compile error: ${error.message}`, "error");
      }
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
          .join("\n"),
        result.code === 0 ? "success" : "error"
      );
      setStatus(
        result.code === 0
          ? `Run succeeded.\n${result.stdout}`
          : `Run failed.\n${result.stderr || result.stdout}`
      );
    } catch (error) {
      setStatus(`Run error.\n${error.message}`);
      terminalRef.current?.writeSystem(`Run error: ${error.message}`, "error");
    }
  }



  async function handleBenchmark() {
    if (!activeTab) {
      return;
    }
    
    if (activeProject && activeProject.type === "multi-file") {
      setStatus("Benchmarking multi-file project...");
      try {
        const results = [];
        for (const file of activeProject.sourceFiles) {
          setStatus(`Benchmarking ${file}...`);
          terminalRef.current?.writeSystem(`Benchmarking ${file}...`, "system");
          const outputPath = `${toWorkspaceSourcePath(activeProject.buildPath ?? "build")}\\benchmark_tmp.exe`;
          const result = await ipcClient.benchmark({
            compiler: "clang++",
            sourcePath: toWorkspaceSourcePath(file),
            outputPath: outputPath,
            runs: 5,
            warmupRuns: 1
          });
          terminalRef.current?.writeSystem(`[${file}] ` + toBenchmarkMessage(result), result.status === "error" ? "error" : "success");
          results.push({ ...result, fileName: file, outputPath });
        }
        setBatchBenchmarkResults(results);
        setIsBenchmarkModalOpen(true);
        setStatus("Batch benchmarking completed.");
      } catch (error) {
        setStatus(`Batch benchmark error.\n${error.message}`);
        terminalRef.current?.writeSystem(`Batch benchmark error: ${error.message}`, "error");
      }
      return;
    }
    
    if (activeProject && activeProject.type !== "single-file") {
      setStatus("Benchmark supports single-file or multi-file projects only.");
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
      terminalRef.current?.writeSystem(toBenchmarkMessage(result), result.status === "error" ? "error" : "success");
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
      terminalRef.current?.writeSystem(`Benchmark error: ${error.message}`, "error");
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
          .join("\n\n"),
        "info"
      );
      setStatus("Complexity, risk, and NLP analysis completed.");
      setLastAnalyzeResult(result);
    } catch (error) {
      setStatus(`Complexity analysis error.\n${error.message}`);
      terminalRef.current?.writeSystem(`Analysis error: ${error.message}`, "error");
    }
  }

  async function handleOptimize() {
    if (!activeTab) {
      return;
    }
    
    setStatus("Optimizing code...");
    terminalRef.current?.writeSystem("Starting optimization...", "info");
    try {
      const result = await ipcClient.optimize({
        sourcePath: toWorkspaceSourcePath(activeTab.path),
        code: activeTab.code
      });
      
      if (result.status === "ok" && result.optimizedCode && result.optimizedCode !== activeTab.code) {
        setOptimizedCodeData(result.optimizedCode);
        setIsDiffViewerOpen(true);
        setStatus("Optimization completed. Review changes.");
      } else if (result.status === "ok") {
        setStatus("Optimization completed. Suggestions updated.");
      } else {
        setStatus(`Optimization failed: ${result.error || "Unknown error"}`);
        terminalRef.current?.writeSystem(`Optimization failed: ${result.error}`, "error");
      }
      
      if (result.suggestions && Array.isArray(result.suggestions.suggestions) && result.suggestions.suggestions.length > 0) {
        const rulesMessage = ["Rule-based suggestions:"];
        result.suggestions.suggestions.forEach(s => {
          rulesMessage.push(`- ${s.title} (${Math.round(s.confidence * 100)}%)`);
          rulesMessage.push(`  ${s.rationale}`);
        });
        terminalRef.current?.writeSystem(rulesMessage.join('\n'), "info");
      }

      if (result.algorithmRecommendations && result.algorithmRecommendations.length > 0) {
        const algoMessage = ["Algorithm Recommendations:"];
        result.algorithmRecommendations.forEach(r => {
          algoMessage.push(`- ${r.name} (${r.complexity})`);
          algoMessage.push(`  Use when: ${r.use_when}`);
          algoMessage.push(`  Notes: ${r.notes}`);
          algoMessage.push(`  Template:\n${r.template}`);
        });
        terminalRef.current?.writeSystem(algoMessage.join('\n'), "info");
      }
    } catch (error) {
      setStatus(`Optimization error.\n${error.message}`);
      terminalRef.current?.writeSystem(`Optimization error: ${error.message}`, "error");
    }
  }

  async function handleSimulate() {
    if (!activeTab) {
      setStatus("No active tab to simulate.");
      return;
    }

    setStatus("Simulating execution...");
    terminalRef.current?.writeSystem("Starting simulation...", "info");
    try {
      const result = await ipcClient.simulate({
        sourcePath: toWorkspaceSourcePath(activeTab.path),
        code: activeTab.code,
        language: "cpp"
      });
      setSimulationResult(result);
      setSimulationStepIndex(0);
      const totalSteps = result.executionTrace?.length || 0;
      setStatus(`Simulation complete (${totalSteps} trace steps).`);
      terminalRef.current?.writeSystem(
        `Simulation completed successfully with ${totalSteps} trace steps.`,
        "success"
      );
    } catch (error) {
      setStatus(`Simulation error.\n${error.message}`);
      terminalRef.current?.writeSystem(`Simulation error: ${error.message}`, "error");
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
      terminalRef.current?.writeSystem("Baseline profile stored.", "success");
    } catch (error) {
      setStatus(`Store baseline error.\n${error.message}`);
      terminalRef.current?.writeSystem(`Store baseline error: ${error.message}`, "error");
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
      terminalRef.current?.writeSystem(toComparisonMessage(result), "info");
      setStatus("Profiling comparison completed.");
    } catch (error) {
      setStatus(`Compare profile error.\n${error.message}`);
      terminalRef.current?.writeSystem(`Compare error: ${error.message}`, "error");
    }
  }

  async function handleGenerateReport() {
    setStatus("Generating report...");
    try {
      const sourcePath = activeTab ? toWorkspaceSourcePath(activeTab.path) : undefined;
      const base = activeTab && activeTab.path ? activeTab.path.split(/[\\/]/).pop().replace(/\.[^/.]+$/, "") : "report";
      const filename = `${base}_report.html`;

      const result = await ipcClient.reportGenerate({
        sourcePath: sourcePath,
        outputPath: filename,
        compiler: "clang++",
        analyzeResult: lastAnalyzeResult ?? undefined,
        benchmarkResult: benchmarkResult ?? undefined,
        compileResult: lastCompileResult ?? undefined
      });
      terminalRef.current?.writeSystem(
        `Report generated: ${result.outputPath} (${result.sizeBytes} bytes)`,
        "success"
      );
      setStatus(`Report saved: ${result.outputPath}`);
      await refreshWorkspace();

      if (window.confirm(`Report generated!\n\nDo you want to open ${filename} in your default browser?`)) {
        try {
          await ipcClient.workspaceOpenExternal({ targetPath: filename });
          setStatus(`Opened externally: ${filename}`);
        } catch (err) {
          setStatus(`Open error.\n${err.message}`);
        }
      }
    } catch (error) {
      setStatus(`Report error.\n${error.message}`);
      terminalRef.current?.writeSystem(`Report error: ${error.message}`, "error");
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

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          await ipcClient.workspaceWrite({
            targetPath: activeTab.path,
            content: code
          });
          refreshWorkspace().catch(() => {});
          setStatus(`Auto-saved: ${activeTab.path}`);
          
          await handleCompile(true, code);
        } catch (error) {
          setStatus(`Auto-save error.\n${error.message}`);
        }
      }, 1000);
    }
  }


  async function handleCreate(path, kind) {
    const normalizedInputPath = normalizeWorkspacePath(path);
    if (!normalizedInputPath) {
      setStatus("Enter path first.");
      return;
    }
    try {
      await ipcClient.workspaceCreate({
        targetPath: normalizedInputPath,
        kind
      });
      // Small delay to ensure the OS has written the directory entry before we read it
      await new Promise((resolve) => setTimeout(resolve, 150));
      await refreshWorkspace();
      if (kind === "file") {
        openWorkspaceTab({
          path: normalizedInputPath,
          code: ""
        });
      }
      setSelectedWorkspacePath(normalizedInputPath);
      setStatus(`${kind} created: ${normalizedInputPath}`);
    } catch (error) {
      setStatus(`Create error.\n${error.message}`);
    }
  }

  async function handleRename(oldPath, newPath) {
    const normalizedOld = normalizeWorkspacePath(oldPath);
    const normalizedNew = normalizeWorkspacePath(newPath);
    if (!normalizedOld || !normalizedNew) {
      setStatus("Invalid rename paths.");
      return;
    }
    try {
      await ipcClient.workspaceRename({
        targetPath: normalizedOld,
        nextPath: normalizedNew
      });
      renameWorkspacePath(normalizedOld, normalizedNew);
      setSelectedWorkspacePath(normalizedNew);
      await refreshWorkspace();
      setStatus(`Renamed: ${normalizedOld} -> ${normalizedNew}`);
    } catch (error) {
      setStatus(`Rename error.\n${error.message}`);
    }
  }

  async function handleDelete(targetPath) {
    const normalized = normalizeWorkspacePath(targetPath || selectedWorkspacePath);
    if (!normalized) {
      setStatus("Select item first.");
      return;
    }
    const confirmed = window.confirm(`Delete ${normalized}?`);
    if (!confirmed) {
      return;
    }
    try {
      await ipcClient.workspaceDelete({
        targetPath: normalized
      });
      removeWorkspacePath(normalized);
      setSelectedWorkspacePath("");
      await refreshWorkspace();
      setStatus(`Deleted: ${normalized}`);
    } catch (error) {
      setStatus(`Delete error.\n${error.message}`);
    }
  }



  async function handleSelectFolder() {
    try {
      setStatus("Opening folder dialog...");
      const result = await ipcClient.workspaceSelectFolder({});
      if (result && result.path) {
        setWorkspaceRootPath(result.path);
        await refreshWorkspace();
        setStatus(`Workspace root changed to: ${result.path}`);
      } else {
        setStatus("Folder selection canceled.");
      }
    } catch (error) {
      setStatus(`Select folder error: ${error.message}`);
    }
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <strong>CortexV5 - Monaco C++ IDE</strong>
        <div className="actions">
          <button type="button" onClick={handleSave} data-tooltip="Save active file">
            Save
          </button>
          <button type="button" onClick={() => cppEditorRef.current?.formatDocument()} data-tooltip="Format code (Shift+Alt+F)">
            Format
          </button>
          <button type="button" onClick={handleBenchmark} data-tooltip="Run benchmark test">
            Benchmark
          </button>
          <button type="button" onClick={handleSimulate} data-tooltip="Simulate C++ execution trace">
            Simulate
          </button>
          <button type="button" onClick={handleOptimize} data-tooltip="Optimize code using ML model">
            Optimize
          </button>
          <button type="button" onClick={handleStoreBaseline} data-tooltip="Store benchmark as baseline">
            Store Baseline
          </button>
          <button type="button" onClick={handleCompareProfile} data-tooltip="Compare with baseline">
            Compare Profile
          </button>
          <button type="button" onClick={handleGenerateReport} data-tooltip="Generate performance report">
            Generate Report
          </button>
        </div>
      </div>

      <div className="main-area">
        <div className="content" ref={contentRef}>
          <aside className="workspace-pane">
          <FileExplorer
            entries={workspaceEntries}
            rootPath={workspaceRootPath}
            selectedPath={selectedWorkspacePath}
            onSelectFolder={handleSelectFolder}
            onSelectEntry={handleSelectWorkspaceEntry}
            onCreate={handleCreate}
            onRename={handleRename}
            onDelete={handleDelete}
            onRefresh={() => refreshWorkspace().catch(() => {})}
          />
        </aside>

        <Resizer onDrag={handleLeftResize} />

        <section className="editor-pane">
          {activeTab ? (
            <>
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
                      data-tooltip="Close tab"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="editor-host">
                <CppEditor
                  ref={cppEditorRef}
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
            </>
          ) : (
            <div className="editor-empty">No active tab. Open a file from the explorer or create a new tab.</div>
          )}
        </section>

        <Resizer onDrag={handleRightResize} direction="horizontal" />

        <div className="right-sidebar" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {isDiffViewerOpen && (
            <>
              <section className="diff-viewer-pane" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #334155' }}>
                <DiffViewer 
                  originalCode={activeTab?.code || ""}
                  modifiedCode={optimizedCodeData}
                  language={activeTab?.language || "cpp"}
                  onAccept={(newCode) => {
                    handleCodeChange(newCode);
                    setIsDiffViewerOpen(false);
                    setStatus("Optimized code applied.");
                  }}
                  onReject={() => {
                    setIsDiffViewerOpen(false);
                    setStatus("Optimized code rejected.");
                  }}
                  onClose={() => {
                    setIsDiffViewerOpen(false);
                  }}
                />
              </section>
              <Resizer onDrag={() => {}} direction="vertical" />
            </>
          )}

          <InspectorPane
            quickFixCards={selectTopQuickFixCards(compileExplanations)}
            onQuickFixSelect={handleQuickFixSelect}
            profileHistory={profileHistory}
            profileHistoryWindow={PROFILE_HISTORY_WINDOW}
            simulationResult={simulationResult}
            simulationStepIndex={simulationStepIndex}
            onSimulationStepChange={setSimulationStepIndex}
          />
        </div>
      </div>

      <Resizer onDrag={handleBottomResize} direction="vertical" />
      
      <TerminalPane 
        ref={terminalRef} 
        onCompile={handleCompile}
        onRun={handleRun}
      />
    </div>
      {isBenchmarkModalOpen && (
        <BenchmarkModal
          results={batchBenchmarkResults}
          onClose={() => setIsBenchmarkModalOpen(false)}
        />
      )}
    </div>
  );
}

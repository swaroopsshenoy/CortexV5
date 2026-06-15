"use strict";

const path = require("node:path");
const fs = require("node:fs/promises");

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function badge(text, color) {
  return `<span class="badge" style="background:${color}">${esc(text)}</span>`;
}

function riskColor(riskClass) {
  if (!riskClass) return "#555";
  const lower = riskClass.toLowerCase();
  if (lower === "high") return "#e53e3e";
  if (lower === "medium") return "#dd6b20";
  return "#38a169";
}

function confidenceColor(band) {
  if (band === "high") return "#38a169";
  if (band === "medium") return "#d69e2e";
  return "#e53e3e";
}

function severityColor(sev) {
  const s = String(sev).toLowerCase();
  if (s === "critical") return "#e53e3e";
  if (s === "high") return "#dd6b20";
  if (s === "medium") return "#d69e2e";
  return "#4a5568";
}

function sectionHeader(title, icon = "") {
  return `<h2 class="section-title">${icon ? `<span class="icon">${icon}</span>` : ""}${esc(title)}</h2>`;
}

function buildMetaSection(meta) {
  const rows = Object.entries(meta)
    .map(([k, v]) => `<tr><td class="meta-key">${esc(k)}</td><td>${esc(String(v))}</td></tr>`)
    .join("");
  return `<table class="meta-table">${rows}</table>`;
}

function buildPerformanceRiskSection(risk) {
  if (!risk || risk.status !== "ok") {
    const msg = risk?.status === "unavailable"
      ? `Unavailable: ${risk.reason ?? "model not found"}`
      : "No performance risk data.";
    return `<p class="muted">${esc(msg)}</p>`;
  }
  const prob = typeof risk.probability === "number"
    ? `${Math.round(risk.probability * 100)}%`
    : "N/A";
  const causeRows = (risk.topCauses ?? []).slice(0, 8).map(c =>
    `<tr>
      <td>${esc(c.label ?? c.feature)}</td>
      <td>${esc(String(c.value))}</td>
      <td>${c.contribution.toFixed(4)}</td>
    </tr>`
  ).join("");

  return `
    <div class="risk-summary">
      <div class="risk-card">
        <div class="risk-label">Risk Class</div>
        <div class="risk-value" style="color:${riskColor(risk.riskClass)}">${esc(risk.riskClass ?? "N/A")}</div>
      </div>
      <div class="risk-card">
        <div class="risk-label">Probability</div>
        <div class="risk-value">${esc(prob)}</div>
      </div>
      <div class="risk-card">
        <div class="risk-label">Confidence</div>
        <div class="risk-value" style="color:${confidenceColor(risk.confidenceBand)}">${esc(risk.confidenceBand ?? "N/A")}</div>
      </div>
    </div>
    ${causeRows ? `
    <h3>Top Causes</h3>
    <table class="data-table">
      <thead><tr><th>Feature</th><th>Value</th><th>Contribution</th></tr></thead>
      <tbody>${causeRows}</tbody>
    </table>` : ""}
  `;
}

function buildComplexitySection(stdoutOrPayload) {
  let payload = stdoutOrPayload;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = null; }
  }
  const complexity = payload?.complexityEstimate ?? payload?.complexity ?? {};
  const time = complexity.time ?? {};
  const space = complexity.space ?? {};
  if (!time.bigO && !space.bigO) {
    return `<p class="muted">No complexity data available.</p>`;
  }
  return `
    <div class="complexity-grid">
      <div class="complexity-card">
        <div class="complexity-label">Time Complexity</div>
        <div class="complexity-value">${esc(time.bigO ?? "N/A")}</div>
        <div class="complexity-meta">Confidence: ${esc(time.confidence ?? "unknown")}</div>
        ${time.factors ? `<div class="complexity-meta">Factors: ${esc(time.factors.join(", "))}</div>` : ""}
        ${Array.isArray(time.notes) && time.notes.length > 0 ? `<div class="complexity-meta">Notes: ${esc(time.notes.join("; "))}</div>` : ""}
      </div>
      <div class="complexity-card">
        <div class="complexity-label">Space Complexity</div>
        <div class="complexity-value">${esc(space.bigO ?? "N/A")}</div>
        <div class="complexity-meta">Confidence: ${esc(space.confidence ?? "unknown")}</div>
        ${space.factors ? `<div class="complexity-meta">Factors: ${esc(space.factors.join(", "))}</div>` : ""}
        ${Array.isArray(space.notes) && space.notes.length > 0 ? `<div class="complexity-meta">Notes: ${esc(space.notes.join("; "))}</div>` : ""}
      </div>
    </div>
  `;
}

function buildBenchmarkSection(benchmark) {
  if (!benchmark || benchmark.status !== "ok") {
    return `<p class="muted">No benchmark data. Run Benchmark first.</p>`;
  }
  const s = benchmark.summary ?? {};
  return `
    <div class="bench-grid">
      ${[
        ["Mean", s.meanMs],
        ["Median", s.medianMs],
        ["Min", s.minMs],
        ["Max", s.maxMs],
        ["P95", s.p95Ms]
      ].map(([label, val]) => `
        <div class="bench-card">
          <div class="bench-label">${label}</div>
          <div class="bench-value">${val !== null && val !== undefined ? `${val} ms` : "N/A"}</div>
        </div>`).join("")}
    </div>
    <p class="bench-meta">Runs: ${s.runCount ?? 0} &nbsp;|&nbsp; Warmup: ${s.warmupRuns ?? 0}</p>
  `;
}

function buildDiagnosticsSection(diagnostics) {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) {
    return `<p class="muted">No diagnostics.</p>`;
  }
  const rows = diagnostics.map(d =>
    `<tr>
      <td>${badge(d.type, d.type === "error" ? "#e53e3e" : "#d69e2e")}</td>
      <td>${esc(d.file)}</td>
      <td>${d.line}:${d.column}</td>
      <td>${esc(d.message)}</td>
    </tr>`
  ).join("");
  return `
    <table class="data-table">
      <thead><tr><th>Type</th><th>File</th><th>Location</th><th>Message</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildExplanationsSection(explanations) {
  if (!Array.isArray(explanations) || explanations.length === 0) {
    return `<p class="muted">No compiler explanations.</p>`;
  }
  return explanations.slice(0, 10).map(exp => `
    <div class="explanation-card">
      <div class="explanation-header">
        ${badge(exp.severity, severityColor(exp.severity))}
        ${badge(exp.category, "#4299e1")}
        <strong>${esc(exp.title)}</strong>
        <span class="muted">(${Math.round((exp.confidence ?? 0) * 100)}% ${esc(exp.confidenceBand)})</span>
      </div>
      <p>${esc(exp.summary)}</p>
      ${exp.quickFixes?.length > 0 ? `
        <ul class="fix-list">${exp.quickFixes.slice(0, 3).map(f => `<li>${esc(f)}</li>`).join("")}</ul>
      ` : ""}
    </div>
  `).join("");
}

function buildNlpSection(nlpExplanations) {
  if (!Array.isArray(nlpExplanations) || nlpExplanations.length === 0) {
    return `<p class="muted">No NLP explanations.</p>`;
  }
  return nlpExplanations.slice(0, 6).map(item => `
    <div class="nlp-card">
      <div class="nlp-header">
        ${badge(item.metadata?.domain ?? "general", "#805ad5")}
        ${badge(item.metadata?.confidenceBand ?? "low", confidenceColor(item.metadata?.confidenceBand))}
        <strong>${esc(item.collapsed?.title ?? "Insight")}</strong>
      </div>
      <p>${esc(item.collapsed?.summary ?? "")}</p>
      ${item.expanded?.whatHappened ? `<p class="nlp-detail">${esc(item.expanded.whatHappened)}</p>` : ""}
      ${Array.isArray(item.expanded?.actions) && item.expanded.actions.length > 0 ? `
        <ul class="fix-list">${item.expanded.actions.slice(0, 3).map(a => `<li>${esc(a)}</li>`).join("")}</ul>
      ` : ""}
    </div>
  `).join("");
}

function buildOptimizationsSection(optimizationSuggestions) {
  const suggestions = Array.isArray(optimizationSuggestions) ? optimizationSuggestions : [];
  if (suggestions.length === 0) {
    return `<p class="muted">No optimization suggestions. Run Analyze Complexity.</p>`;
  }
  return suggestions.slice(0, 10).map(s => `
    <div class="opt-card">
      <div class="opt-header">
        ${badge(s.confidenceBand ?? "low", confidenceColor(s.confidenceBand))}
        <strong>${esc(s.title ?? s.id)}</strong>
      </div>
      <p>${esc(s.rationale ?? "")}</p>
      ${Array.isArray(s.actions) && s.actions.length > 0 ? `
        <ul class="fix-list">${s.actions.slice(0, 4).map(a => `<li>${esc(a)}</li>`).join("")}</ul>
      ` : ""}
    </div>
  `).join("");
}

function buildCodeSmellsSection(codeSmells) {
  if (!Array.isArray(codeSmells) || codeSmells.length === 0) {
    return `<p class="muted">No code smells detected.</p>`;
  }
  const rows = codeSmells.slice(0, 15).map(smell =>
    `<tr>
      <td>${esc(smell.kind ?? smell.type ?? "smell")}</td>
      <td>${badge(smell.severity ?? "low", severityColor(smell.severity))}</td>
      <td>${esc(smell.message ?? smell.description ?? "")}</td>
    </tr>`
  ).join("");
  return `
    <table class="data-table">
      <thead><tr><th>Kind</th><th>Severity</th><th>Description</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildSemanticSection(semanticIssues) {
  if (!Array.isArray(semanticIssues) || semanticIssues.length === 0) {
    return `<p class="muted">No semantic issues detected.</p>`;
  }
  const rows = semanticIssues.slice(0, 15).map(issue =>
    `<tr>
      <td>${esc(issue.kind ?? "issue")}</td>
      <td>${badge(issue.severity ?? "low", severityColor(issue.severity))}</td>
      <td>${esc(issue.message ?? "")}</td>
      <td>${esc(issue.remediation ?? "")}</td>
    </tr>`
  ).join("");
  return `
    <table class="data-table">
      <thead><tr><th>Kind</th><th>Severity</th><th>Message</th><th>Remediation</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildHtml({ meta, analyzeResult, benchmarkResult, compileResult }) {
  const generatedAt = new Date().toISOString();

  let stdoutPayload = null;
  if (analyzeResult?.stdout) {
    try { stdoutPayload = JSON.parse(analyzeResult.stdout); } catch { /* ignore */ }
  }

  const features = stdoutPayload?.features ?? {};
  const complexityEstimate = stdoutPayload?.complexityEstimate ?? null;
  const semanticIssues = stdoutPayload?.semanticIssues ?? [];
  const codeSmells = stdoutPayload?.codeSmells ?? [];
  const optimizationSuggestions = stdoutPayload?.optimizationSuggestions ?? [];
  const performanceRisk = analyzeResult?.performanceRisk ?? null;
  const nlpExplanations = analyzeResult?.nlpExplanations ?? [];
  const diagnostics = compileResult?.diagnostics ?? [];
  const explanations = compileResult?.explanations ?? [];

  const css = `
    :root {
      --bg: #0f1117;
      --surface: #1a1d2e;
      --surface2: #242740;
      --accent: #7c3aed;
      --accent2: #4f46e5;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --border: #2d3748;
      --radius: 8px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; font-size: 14px; line-height: 1.6; }
    a { color: var(--accent); }
    .report-wrapper { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
    .report-header { text-align: center; padding: 48px 0 32px; border-bottom: 1px solid var(--border); margin-bottom: 40px; }
    .report-header h1 { font-size: 2.2rem; font-weight: 800; background: linear-gradient(135deg, #7c3aed, #4f46e5); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .report-header .subtitle { color: var(--muted); margin-top: 8px; font-size: 0.95rem; }
    .report-section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; margin-bottom: 24px; }
    .section-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
    .icon { font-size: 1.2rem; }
    .muted { color: var(--muted); font-size: 0.9rem; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; color: #fff; margin-right: 4px; }
    .meta-table { width: 100%; border-collapse: collapse; }
    .meta-table td { padding: 6px 12px; border-bottom: 1px solid var(--border); }
    .meta-table .meta-key { color: var(--muted); font-weight: 600; width: 180px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .data-table th { text-align: left; padding: 8px 10px; background: var(--surface2); color: var(--muted); font-weight: 600; border-bottom: 1px solid var(--border); }
    .data-table td { padding: 7px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
    .risk-summary { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .risk-card { background: var(--surface2); border-radius: var(--radius); padding: 16px 24px; flex: 1; min-width: 120px; text-align: center; }
    .risk-label { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .risk-value { font-size: 1.4rem; font-weight: 800; }
    .complexity-grid { display: flex; gap: 16px; flex-wrap: wrap; }
    .complexity-card { background: var(--surface2); border-radius: var(--radius); padding: 16px 20px; flex: 1; min-width: 180px; }
    .complexity-label { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .complexity-value { font-size: 1.8rem; font-weight: 800; color: var(--accent); margin-bottom: 8px; }
    .complexity-meta { font-size: 0.82rem; color: var(--muted); }
    .bench-grid { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .bench-card { background: var(--surface2); border-radius: var(--radius); padding: 12px 20px; flex: 1; min-width: 100px; text-align: center; }
    .bench-label { color: var(--muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .bench-value { font-size: 1.2rem; font-weight: 700; margin-top: 4px; }
    .bench-meta { color: var(--muted); font-size: 0.85rem; }
    .explanation-card, .nlp-card, .opt-card { background: var(--surface2); border-radius: var(--radius); padding: 14px 18px; margin-bottom: 12px; }
    .explanation-header, .nlp-header, .opt-header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
    .nlp-detail { color: var(--muted); font-size: 0.88rem; margin-top: 4px; }
    .fix-list { padding-left: 18px; margin-top: 6px; }
    .fix-list li { color: var(--muted); font-size: 0.87rem; margin-bottom: 2px; }
    .report-footer { text-align: center; color: var(--muted); font-size: 0.82rem; padding: 32px 0 16px; border-top: 1px solid var(--border); margin-top: 40px; }
    @media print {
      body { background: #fff; color: #111; }
      .report-wrapper { max-width: 100%; }
      .report-section { break-inside: avoid; }
    }
  `;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cortex++ Analysis Report${meta.sourcePath ? ` – ${esc(path.basename(meta.sourcePath))}` : ""}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>${css}</style>
</head>
<body>
<div class="report-wrapper">

  <header class="report-header">
    <h1>Cortex++ Analysis Report</h1>
    <div class="subtitle">
      ${meta.sourcePath ? `<strong>${esc(meta.sourcePath)}</strong> &nbsp;|&nbsp;` : ""}
      Generated: ${generatedAt}
    </div>
  </header>

  <section class="report-section">
    ${sectionHeader("Report Metadata", "📋")}
    ${buildMetaSection({
      "Source File": meta.sourcePath ?? "Unknown",
      "Generated At": generatedAt,
      "Compiler": meta.compiler ?? "clang++",
      "Platform": meta.platform ?? process.platform,
      "Cortex Version": "V5"
    })}
  </section>

  <section class="report-section">
    ${sectionHeader("Performance Risk Prediction", "🎯")}
    ${buildPerformanceRiskSection(performanceRisk)}
  </section>

  <section class="report-section">
    ${sectionHeader("Complexity Analysis", "📊")}
    ${buildComplexitySection(complexityEstimate ?? analyzeResult?.stdout)}
  </section>

  <section class="report-section">
    ${sectionHeader("Benchmark Results", "⚡")}
    ${buildBenchmarkSection(benchmarkResult)}
  </section>

  <section class="report-section">
    ${sectionHeader("Compiler Diagnostics", "🔴")}
    ${buildDiagnosticsSection(diagnostics)}
  </section>

  <section class="report-section">
    ${sectionHeader("Error Explanations", "💡")}
    ${buildExplanationsSection(explanations)}
  </section>

  <section class="report-section">
    ${sectionHeader("Optimization Suggestions", "🚀")}
    ${buildOptimizationsSection(optimizationSuggestions)}
  </section>

  <section class="report-section">
    ${sectionHeader("Code Smells", "🌡️")}
    ${buildCodeSmellsSection(codeSmells)}
  </section>

  <section class="report-section">
    ${sectionHeader("Semantic Issues", "🔍")}
    ${buildSemanticSection(semanticIssues)}
  </section>

  <section class="report-section">
    ${sectionHeader("NLP Explanations", "🧠")}
    ${buildNlpSection(nlpExplanations)}
  </section>

  <footer class="report-footer">
    Cortex++ V5 &nbsp;|&nbsp; Intelligent C++ Research &amp; Optimization Platform &nbsp;|&nbsp; ${generatedAt}
  </footer>

</div>
</body>
</html>`;

  return html;
}

function createReportService({ projectRoot, toProjectPath }) {
  async function generateReport(payload) {
    const {
      sourcePath,
      compiler,
      analyzeResult,
      benchmarkResult,
      compileResult,
      outputPath
    } = payload;

    const meta = { sourcePath, compiler: compiler ?? "clang++" };
    const html = buildHtml({ meta, analyzeResult, benchmarkResult, compileResult });

    const resolvedOutput = outputPath
      ? toProjectPath(outputPath)
      : (() => {
          const base = sourcePath
            ? path.basename(sourcePath, path.extname(sourcePath))
            : "report";
          return toProjectPath(`workspace\\${base}_report.html`);
        })();

    await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
    await fs.writeFile(resolvedOutput, html, "utf8");

    return {
      ok: true,
      outputPath: resolvedOutput,
      sizeBytes: Buffer.byteLength(html, "utf8")
    };
  }

  return { generateReport };
}

module.exports = { createReportService };

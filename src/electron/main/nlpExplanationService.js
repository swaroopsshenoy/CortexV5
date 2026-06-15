const fs = require("node:fs/promises");
const path = require("node:path");
const { parseAnalyzeStdout, humanizeFeatureName } = require("./performanceRiskFeatures");

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be non-empty string`);
  }
}

function getByPath(object, dottedPath) {
  const parts = dottedPath.split(".");
  let current = object;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function renderTemplateString(template, params) {
  return String(template ?? "").replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = params[key];
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  });
}

function buildTopCauseSummary(topCauses, limit = 3) {
  return (topCauses ?? [])
    .slice(0, limit)
    .map((cause) => `${cause.label ?? humanizeFeatureName(cause.feature)} (${cause.value})`)
    .join(", ");
}

function buildAnalyzeContext(analyzePayload, performanceRisk) {
  const features = analyzePayload?.features ?? {};
  const complexity = analyzePayload?.complexityEstimate ?? {};
  const semanticIssues = analyzePayload?.semanticChecks?.issues ?? [];
  const memoryRiskCount = semanticIssues.filter((item) => item.checkType === "memory_risk").length;
  const optimizationSuggestions = analyzePayload?.optimizationSuggestions?.suggestions ?? [];
  const topOptimization = optimizationSuggestions[0] ?? null;
  const probability =
    typeof performanceRisk?.probability === "number" ? performanceRisk.probability : null;

  return {
    performanceRisk: performanceRisk ?? { status: "unavailable" },
    complexity: {
      time: complexity?.time ?? {},
      space: complexity?.space ?? {}
    },
    semantic: {
      memoryRiskCount
    },
    optimization: {
      count: optimizationSuggestions.length
    },
    params: {
      riskClass: performanceRisk?.riskClass ?? "unknown",
      probabilityPercent:
        probability === null ? "N/A" : `${Math.round(probability * 100)}%`,
      topCauseSummary: buildTopCauseSummary(performanceRisk?.topCauses),
      timeBigO: complexity?.time?.bigO ?? "unknown",
      spaceBigO: complexity?.space?.bigO ?? "unknown",
      loopTotal: features?.loops?.total ?? 0,
      nestingDepth: features?.nesting?.maxDepth ?? 0,
      semanticMemoryRiskCount: memoryRiskCount,
      optimizationCount: optimizationSuggestions.length,
      topOptimizationTitle: topOptimization?.title ?? "N/A",
      topOptimizationRationale: topOptimization?.rationale ?? "N/A"
    }
  };
}

function matchesWhenClause(when, context) {
  if (!when || typeof when !== "object") {
    return true;
  }

  for (const [key, expected] of Object.entries(when)) {
    if (key.endsWith(".min")) {
      const pathKey = key.replace(/\.min$/, "");
      const actual = getByPath(context, pathKey);
      if (typeof actual !== "number" || actual < Number(expected)) {
        return false;
      }
      continue;
    }

    const actual = getByPath(context, key);
    if (actual !== expected) {
      return false;
    }
  }
  return true;
}

function applyMlEnhancement(draft, context) {
  const causes = context.performanceRisk?.topCauses ?? [];
  const mlActions = causes.slice(0, 2).map((cause) => {
    const label = cause.label ?? humanizeFeatureName(cause.feature);
    return `Investigate ${label.toLowerCase()} (value ${cause.value}).`;
  });
  const mergedActions = [...draft.actions, ...mlActions];
  const uniqueActions = [];
  const seen = new Set();
  for (const action of mergedActions) {
    const normalized = action.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    uniqueActions.push(action);
  }
  return {
    ...draft,
    actions: uniqueActions.slice(0, 6),
    pipelineStages: [...(draft.pipelineStages ?? ["rule"]), "ml"]
  };
}

function buildSections(record) {
  return {
    collapsed: {
      title: record.title,
      summary: record.summary
    },
    expanded: {
      whatHappened: record.explanation,
      actions: record.actions.slice(0, 5)
    },
    metadata: {
      id: record.id,
      domain: record.domain,
      confidenceBand: record.confidenceBand,
      pipelineStages: record.pipelineStages
    }
  };
}

function createNlpExplanationService(options = {}) {
  assertNonEmptyString(options.projectRoot, "projectRoot");
  const templatesRoot =
    options.templatesRoot ??
    path.join(options.projectRoot, "resources", "nlp_explanation_templates");
  const runProcess = options.runProcess;
  const pythonCommand = options.pythonCommand ?? "python";
  const driverPath =
    options.driverPath ??
    path.join(options.projectRoot, "src", "electron", "main", "py", "nlp_refine_driver.py");
  const enableRefinement = options.enableRefinement !== false;

  let templatesCache = null;

  async function loadTemplates() {
    if (templatesCache) {
      return templatesCache;
    }
    const filePath = path.join(templatesRoot, "templates.json");
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (!Array.isArray(parsed.templates)) {
      throw new Error("templates.json must include templates array");
    }
    templatesCache = parsed.templates;
    return templatesCache;
  }

  function generateRuleDrafts(context) {
    return templatesCache
      .filter((template) => matchesWhenClause(template.when, context))
      .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
      .map((template) => {
        const params = context.params;
        const record = {
          id: template.id,
          domain: template.domain,
          title: renderTemplateString(template.title, params),
          summary: renderTemplateString(template.summary, params),
          explanation: renderTemplateString(template.explanation, params),
          actions: (template.actions ?? []).map((item) => renderTemplateString(item, params)),
          confidenceBand: context.performanceRisk?.confidenceBand ?? "medium",
          pipelineStages: ["rule"]
        };
        return buildSections(applyMlEnhancement(record, context));
      });
  }

  async function refineWithPython(drafts) {
    if (!enableRefinement || typeof runProcess !== "function") {
      return drafts;
    }
    const payload = JSON.stringify({
      items: drafts.map((item) => ({
        id: item.metadata.id,
        title: item.collapsed.title,
        summary: item.collapsed.summary,
        explanation: item.expanded.whatHappened,
        actions: item.expanded.actions
      }))
    });
    const result = await runProcess(pythonCommand, [driverPath], {
      cwd: options.projectRoot,
      input: payload
    });
    if (result.code !== 0) {
      return drafts.map((item) => ({
        ...item,
        metadata: {
          ...item.metadata,
          pipelineStages: [...(item.metadata.pipelineStages ?? []), "nlp_refine_skipped"]
        }
      }));
    }
    let parsed;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      return drafts;
    }
    const refinedById = new Map((parsed.items ?? []).map((item) => [item.id, item]));
    return drafts.map((draft) => {
      const refined = refinedById.get(draft.metadata.id);
      if (!refined) {
        return draft;
      }
      return {
        collapsed: {
          title: refined.title ?? draft.collapsed.title,
          summary: refined.summary ?? draft.collapsed.summary
        },
        expanded: {
          whatHappened: refined.explanation ?? draft.expanded.whatHappened,
          actions: Array.isArray(refined.actions) ? refined.actions : draft.expanded.actions
        },
        metadata: {
          ...draft.metadata,
          pipelineStages: [...(draft.metadata.pipelineStages ?? []), "nlp_refine"],
          refinementEngine: parsed.engine ?? "rule_fallback"
        }
      };
    });
  }

  async function generateFromAnalyzeContext(analyzePayload, performanceRisk) {
    await loadTemplates();
    const context = buildAnalyzeContext(analyzePayload, performanceRisk);
    const ruleDrafts = generateRuleDrafts(context);
    return refineWithPython(ruleDrafts);
  }

  return Object.freeze({
    async generateFromAnalyzeResult(analyzeResult, performanceRisk) {
      if (!analyzeResult || analyzeResult.code !== 0) {
        return [];
      }
      const analyzePayload = parseAnalyzeStdout(analyzeResult.stdout);
      if (!analyzePayload) {
        return [];
      }
      return generateFromAnalyzeContext(analyzePayload, performanceRisk);
    },

    async refineCompilerExplanation(payload = {}) {
      const explanation = payload.explanation;
      if (!explanation || typeof explanation !== "object") {
        return {};
      }
      const drafts = [
        buildSections({
          id: explanation.issue_id ?? explanation.key ?? "compiler.diagnostic",
          domain: "compiler",
          title: explanation.title ?? "Compiler diagnostic",
          summary: explanation.summary ?? "",
          explanation: explanation.explanation ?? "",
          actions: explanation.quickFixes ?? [],
          confidenceBand: explanation.confidenceBand ?? "medium",
          pipelineStages: ["rule"]
        })
      ];
      const refined = await refineWithPython(drafts);
      const first = refined[0];
      if (!first) {
        return {};
      }
      return {
        summary: first.collapsed.summary,
        explanation: first.expanded.whatHappened,
        quickFixes: first.expanded.actions
      };
    },

    renderTemplateString,
    buildAnalyzeContext,
    matchesWhenClause
  });
}

module.exports = {
  createNlpExplanationService,
  renderTemplateString,
  buildAnalyzeContext,
  matchesWhenClause
};

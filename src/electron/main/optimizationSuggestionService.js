const fs = require("node:fs/promises");
const path = require("node:path");

const CONDITION_TYPES = new Set(["metric_threshold", "semantic_count", "smell_count"]);
const OPERATORS = new Set([">=", ">", "<=", "<", "=="]);
const RULE_CATEGORIES = new Set(["core", "stl"]);
const PREVIEW_ALLOWED_RULES = new Set([
  "opt.stl.range-loop-modernization",
  "opt-modernize-stl-loops",
  "opt.stl.pass-by-const-reference",
  "opt.remove-copy-hotspots"
]);
const CONFIDENCE_BANDS = Object.freeze({
  high: 0.85,
  medium: 0.6
});

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be non-empty string`);
  }
}

function assertStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} must be string[]`);
  }
}

function validateCondition(condition, contextLabel) {
  if (typeof condition !== "object" || condition === null || Array.isArray(condition)) {
    throw new Error(`Invalid condition in ${contextLabel}`);
  }
  if (!CONDITION_TYPES.has(condition.type)) {
    throw new Error(`Unsupported condition type in ${contextLabel}`);
  }
  if (!OPERATORS.has(condition.operator)) {
    throw new Error(`Unsupported operator in ${contextLabel}`);
  }
  if (typeof condition.value !== "number") {
    throw new Error(`Condition value must be number in ${contextLabel}`);
  }
  if (condition.weight !== undefined && typeof condition.weight !== "number") {
    throw new Error(`Condition weight must be number in ${contextLabel}`);
  }
  if (condition.required !== undefined && typeof condition.required !== "boolean") {
    throw new Error(`Condition required must be boolean in ${contextLabel}`);
  }

  if (condition.type === "metric_threshold") {
    assertNonEmptyString(condition.metricPath, `metricPath in ${contextLabel}`);
  } else if (condition.type === "semantic_count") {
    assertNonEmptyString(condition.checkType, `checkType in ${contextLabel}`);
  } else if (condition.type === "smell_count") {
    assertNonEmptyString(condition.smellType, `smellType in ${contextLabel}`);
  }
}

function validateRule(rule, contextLabel) {
  if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
    throw new Error(`Invalid rule in ${contextLabel}`);
  }
  assertNonEmptyString(rule.id, `id in ${contextLabel}`);
  assertNonEmptyString(rule.title, `title in ${contextLabel}`);
  assertNonEmptyString(rule.rationale, `rationale in ${contextLabel}`);
  assertStringArray(rule.actions, `actions in ${contextLabel}`);
  assertStringArray(rule.references, `references in ${contextLabel}`);
  if (typeof rule.priority !== "number") {
    throw new Error(`priority must be number in ${contextLabel}`);
  }
  if (typeof rule.baseConfidence !== "number") {
    throw new Error(`baseConfidence must be number in ${contextLabel}`);
  }
  if (typeof rule.maxConfidence !== "number") {
    throw new Error(`maxConfidence must be number in ${contextLabel}`);
  }
  if (rule.category !== undefined && !RULE_CATEGORIES.has(rule.category)) {
    throw new Error(`category must be one of ${[...RULE_CATEGORIES].join(", ")} in ${contextLabel}`);
  }
  if (rule.stlSignalWeight !== undefined && typeof rule.stlSignalWeight !== "number") {
    throw new Error(`stlSignalWeight must be number in ${contextLabel}`);
  }
  if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
    throw new Error(`conditions must be non-empty array in ${contextLabel}`);
  }
  rule.conditions.forEach((condition, index) =>
    validateCondition(condition, `${contextLabel}#condition${index}`)
  );
}

function getByPath(payload, metricPath) {
  return String(metricPath)
    .split(".")
    .reduce((current, segment) => (current && Object.prototype.hasOwnProperty.call(current, segment) ? current[segment] : undefined), payload);
}

function evaluateOperator(leftValue, operator, rightValue) {
  if (operator === ">=") {
    return leftValue >= rightValue;
  }
  if (operator === ">") {
    return leftValue > rightValue;
  }
  if (operator === "<=") {
    return leftValue <= rightValue;
  }
  if (operator === "<") {
    return leftValue < rightValue;
  }
  return leftValue === rightValue;
}

function resolveConditionValue(payload, condition) {
  if (condition.type === "metric_threshold") {
    const value = getByPath(payload, condition.metricPath);
    return typeof value === "number" ? value : null;
  }

  if (condition.type === "semantic_count") {
    const issues = payload?.semanticChecks?.issues ?? [];
    return issues.filter((issue) => issue.checkType === condition.checkType).length;
  }

  const smells = payload?.codeSmells?.issues ?? [];
  return smells.filter((issue) => issue.smellType === condition.smellType).length;
}

function calculateStlSignalBoost(payload, rule) {
  if (rule.category !== "stl") {
    return 0;
  }
  const stlMetrics = payload?.features?.stl;
  if (!stlMetrics || typeof stlMetrics !== "object") {
    return 0;
  }
  const containerRefs = typeof stlMetrics.containerReferences === "number" ? stlMetrics.containerReferences : 0;
  const algorithmCalls = typeof stlMetrics.algorithmCalls === "number" ? stlMetrics.algorithmCalls : 0;
  const iteratorUsage = typeof stlMetrics.iteratorUsage === "number" ? stlMetrics.iteratorUsage : 0;
  const stlTotal = typeof stlMetrics.total === "number" ? stlMetrics.total : containerRefs + algorithmCalls + iteratorUsage;
  const baseWeight = typeof rule.stlSignalWeight === "number" ? rule.stlSignalWeight : 0.08;
  const signalScore =
    Math.min(1, stlTotal / 8) * 0.5 +
    Math.min(1, containerRefs / 4) * 0.2 +
    Math.min(1, algorithmCalls / 3) * 0.2 +
    Math.min(1, iteratorUsage / 3) * 0.1;
  return Math.min(0.15, baseWeight * signalScore);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getConfidenceBand(confidence) {
  if (confidence >= CONFIDENCE_BANDS.high) {
    return "high";
  }
  if (confidence >= CONFIDENCE_BANDS.medium) {
    return "medium";
  }
  return "low";
}

function calculateSemanticSeverityPressure(payload) {
  const issues = payload?.semanticChecks?.issues ?? [];
  if (!Array.isArray(issues) || issues.length === 0) {
    return 0;
  }

  const severityWeightMap = {
    HIGH: 1,
    MEDIUM: 0.65,
    LOW: 0.35
  };
  const weighted = issues.reduce((accumulator, issue) => {
    const key = String(issue?.severity ?? "").toUpperCase();
    return accumulator + (severityWeightMap[key] ?? 0.5);
  }, 0);
  return clampNumber(weighted / 8, 0, 1);
}

function calculateSmellDensity(payload) {
  const smells = payload?.codeSmells?.issues ?? [];
  if (!Array.isArray(smells) || smells.length === 0) {
    return 0;
  }
  return clampNumber(smells.length / 5, 0, 1);
}

function calibrateSuggestionConfidence(rule, suggestion, payload, hasRefactorPreview) {
  const matchStrength = suggestion.possibleConditionWeight > 0
    ? clampNumber(suggestion.matchedConditionWeight / suggestion.possibleConditionWeight, 0, 1)
    : 0;
  const stlSignalNormalized = clampNumber(suggestion.stlSignalBoost / 0.15, 0, 1);
  const semanticSeverityPressure = calculateSemanticSeverityPressure(payload);
  const smellDensity = calculateSmellDensity(payload);
  const previewAvailability = hasRefactorPreview ? 1 : 0;
  const rawConfidence = clampNumber(suggestion.preliminaryConfidence, 0, 1);
  const calibratedRaw =
    rawConfidence * 0.8 +
    matchStrength * 0.15 +
    stlSignalNormalized * 0.03 +
    semanticSeverityPressure * 0.01 +
    smellDensity * 0.005 +
    previewAvailability * 0.005;
  const calibratedConfidence = clampNumber(
    Math.min(rule.maxConfidence, calibratedRaw),
    0,
    1
  );

  return {
    confidence: calibratedConfidence,
    confidenceBand: getConfidenceBand(calibratedConfidence),
    calibrationBreakdown: {
      rawConfidence,
      weights: {
        rawConfidence: 0.8,
        matchStrength: 0.15,
        stlSignal: 0.03,
        semanticSeverity: 0.01,
        smellDensity: 0.005,
        previewAvailability: 0.005
      },
      signals: {
        matchStrength,
        stlSignalNormalized,
        semanticSeverityPressure,
        smellDensity,
        previewAvailability
      }
    }
  };
}

function toUnixPath(filePath) {
  return String(filePath ?? "").replace(/\\/g, "/");
}

function buildUnifiedDiff(filePath, originalSource, modifiedSource) {
  if (originalSource === modifiedSource) {
    return "";
  }

  const originalLines = String(originalSource ?? "").split(/\r?\n/);
  const modifiedLines = String(modifiedSource ?? "").split(/\r?\n/);
  let start = 0;
  while (
    start < originalLines.length &&
    start < modifiedLines.length &&
    originalLines[start] === modifiedLines[start]
  ) {
    start += 1;
  }

  let endOriginal = originalLines.length - 1;
  let endModified = modifiedLines.length - 1;
  while (
    endOriginal >= start &&
    endModified >= start &&
    originalLines[endOriginal] === modifiedLines[endModified]
  ) {
    endOriginal -= 1;
    endModified -= 1;
  }

  const originalSlice = originalLines.slice(start, endOriginal + 1);
  const modifiedSlice = modifiedLines.slice(start, endModified + 1);
  const oldCount = Math.max(1, originalSlice.length);
  const newCount = Math.max(1, modifiedSlice.length);
  const oldStart = start + 1;
  const newStart = start + 1;

  return [
    `--- a/${toUnixPath(filePath)}`,
    `+++ b/${toUnixPath(filePath)}`,
    `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
    ...originalSlice.map((line) => `-${line}`),
    ...modifiedSlice.map((line) => `+${line}`)
  ].join("\n");
}

function applyConstReferenceRefactor(sourceContent) {
  const source = String(sourceContent ?? "");
  const pattern =
    /\b(std::(?:vector|string|map|set|unordered_map|unordered_set|list|deque|array|queue|stack|priority_queue)\s*(?:<[^>\n]+>)?)\s+([A-Za-z_]\w*)\s*(?=[,)])/;
  const match = source.match(pattern);
  if (!match) {
    return null;
  }

  const replacement = `const ${match[1]}& ${match[2]}`;
  return source.replace(pattern, replacement);
}

function applyLoopModernizationRefactor(sourceContent) {
  const source = String(sourceContent ?? "");
  const loopPattern =
    /for\s*\(\s*(?:int|size_t|std::size_t)\s+([A-Za-z_]\w*)\s*=\s*0\s*;\s*\1\s*<\s*([A-Za-z_]\w*)\.size\(\)\s*;\s*\+\+\1\s*\)\s*\{([\s\S]*?)\}/m;
  const match = source.match(loopPattern);
  if (!match) {
    return null;
  }

  const indexName = match[1];
  const containerName = match[2];
  const body = match[3];
  const anyIndexUse = new RegExp(`\\b${indexName}\\b`, "g");
  const containerIndexUse = new RegExp(
    `${containerName}\\s*\\[\\s*${indexName}\\s*\\]`,
    "g"
  );
  const indexUseCount = (body.match(anyIndexUse) ?? []).length;
  const containerUseCount = (body.match(containerIndexUse) ?? []).length;

  if (indexUseCount === 0 || indexUseCount !== containerUseCount) {
    return null;
  }

  const rewrittenBody = body.replace(containerIndexUse, "item");
  const replacement = `for (const auto& item : ${containerName}) {${rewrittenBody}}`;
  return source.replace(loopPattern, replacement);
}

function createRefactorPreview(rule, suggestion, payload, options = {}) {
  const sourceContent = payload?.sourceContent;
  const sourcePath = payload?.sourcePath;
  if (typeof sourceContent !== "string" || typeof sourcePath !== "string") {
    return null;
  }
  if (!PREVIEW_ALLOWED_RULES.has(rule.id)) {
    return null;
  }

  const confidenceThreshold = options.refactorConfidenceThreshold ?? 0.85;
  const confidenceValue =
    typeof suggestion.preliminaryConfidence === "number"
      ? suggestion.preliminaryConfidence
      : suggestion.confidence;
  if (confidenceValue < confidenceThreshold) {
    return null;
  }

  let modifiedSource = null;
  let refactorType = null;
  if (rule.id === "opt.stl.pass-by-const-reference" || rule.id === "opt.remove-copy-hotspots") {
    modifiedSource = applyConstReferenceRefactor(sourceContent);
    refactorType = "const-reference";
  } else if (rule.id === "opt.stl.range-loop-modernization" || rule.id === "opt-modernize-stl-loops") {
    modifiedSource = applyLoopModernizationRefactor(sourceContent);
    refactorType = "loop-modernization";
  }

  if (typeof modifiedSource !== "string" || modifiedSource === sourceContent) {
    return null;
  }

  const unifiedDiff = buildUnifiedDiff(sourcePath, sourceContent, modifiedSource);
  if (!unifiedDiff) {
    return null;
  }

  return {
    suggestionId: rule.id,
    refactorType,
    confidenceGate: confidenceThreshold,
    unifiedDiff
  };
}

function evaluateRule(payload, rule) {
  let score = 0;
  let matchedConditionWeight = 0;
  let possibleConditionWeight = 0;
  const matchedEvidence = [];

  for (const condition of rule.conditions) {
    const conditionWeight = condition.weight ?? 0.15;
    possibleConditionWeight += conditionWeight;
    const leftValue = resolveConditionValue(payload, condition);
    const passed = leftValue !== null && evaluateOperator(leftValue, condition.operator, condition.value);
    const required = condition.required !== false;

    if (!passed && required) {
      return null;
    }
    if (passed) {
      score += conditionWeight;
      matchedConditionWeight += conditionWeight;
      if (typeof condition.hint === "string" && condition.hint.trim()) {
        matchedEvidence.push(condition.hint.trim());
      }
    }
  }

  const stlBoost = calculateStlSignalBoost(payload, rule);
  const preliminaryConfidence = Math.min(
    rule.maxConfidence,
    Math.max(0, rule.baseConfidence + score + stlBoost)
  );
  return {
    id: rule.id,
    title: rule.title,
    rationale: rule.rationale,
    actions: rule.actions,
    preliminaryConfidence,
    references: rule.references,
    category: rule.category ?? "core",
    score: preliminaryConfidence + rule.priority / 100,
    matchedEvidence,
    stlSignalBoost: stlBoost,
    matchedConditionWeight,
    possibleConditionWeight
  };
}

function normalizeRuleContent(content, filePath) {
  const parsed = JSON.parse(content);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  if (list.length === 0) {
    throw new Error(`No rules found in ${filePath}`);
  }
  list.forEach((rule, index) => validateRule(rule, `${filePath}#${index}`));
  return list;
}

function createOptimizationSuggestionService(options = {}) {
  assertNonEmptyString(options.databaseRoot, "databaseRoot");
  let cache = null;

  async function loadRules() {
    if (cache) {
      return cache;
    }
    const entries = await fs.readdir(options.databaseRoot, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => path.join(options.databaseRoot, entry.name))
      .sort((left, right) => left.localeCompare(right));

    const loaded = [];
    for (const filePath of files) {
      const raw = await fs.readFile(filePath, "utf8");
      loaded.push(...normalizeRuleContent(raw, filePath));
    }

    cache = loaded;
    return loaded;
  }

  return Object.freeze({
    async loadRules() {
      return loadRules();
    },
    async generate(payload = {}) {
      const rules = await loadRules();
      const confidenceThreshold = options.refactorConfidenceThreshold ?? 0.85;
      const matches = rules
        .map((rule) => {
          const suggestion = evaluateRule(payload, rule);
          if (!suggestion) {
            return null;
          }
          return {
            rule,
            suggestion
          };
        })
        .filter((entry) => entry !== null)
        .map((entry) => {
          const previewCandidate = createRefactorPreview(
            entry.rule,
            entry.suggestion,
            payload,
            options
          );
          const calibrated = calibrateSuggestionConfidence(
            entry.rule,
            entry.suggestion,
            payload,
            previewCandidate !== null
          );
          const preview = calibrated.confidence >= confidenceThreshold ? previewCandidate : null;
          return {
            ...entry.suggestion,
            confidence: calibrated.confidence,
            confidenceBand: calibrated.confidenceBand,
            calibrationBreakdown: calibrated.calibrationBreakdown,
            score: calibrated.confidence + entry.rule.priority / 100,
            refactorPreview: preview
          };
        })
        .sort((left, right) => right.score - left.score);

      return {
        scope: "single-active-file",
        ruleSetVersion: "1.0",
        suggestions: matches.map((item, index) => ({
          ...item,
          rank: index + 1
        })),
        refactorPreviews: matches
          .map((item) => item.refactorPreview)
          .filter((preview) => preview !== null)
      };
    }
  });
}

module.exports = {
  createOptimizationSuggestionService
};

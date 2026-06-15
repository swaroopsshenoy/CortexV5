const fs = require("node:fs/promises");
const path = require("node:path");
const DEFAULT_FUZZY_THRESHOLD = 0.5;
const COMPILER_CATEGORIES = Object.freeze(["Syntax", "Type", "Template", "Linker", "General"]);
const SEVERITY_VALUES = Object.freeze(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const QUICK_FIX_ACTION_TYPES = Object.freeze(["edit", "check", "read"]);

const QUICK_FIX_ACTION_KEYWORDS = Object.freeze({
  edit: [
    "add", "remove", "replace", "change", "convert", "declare", "include", "pass", "use", "move",
    "keep", "provide", "adjust", "define", "link", "compile", "cast"
  ],
  check: ["check", "verify", "confirm", "inspect", "ensure", "review", "trace"],
  read: ["read", "open", "consult", "reference", "documentation", "docs"]
});

const CATEGORY_RELEVANCE_TOKENS = Object.freeze({
  Syntax: ["semicolon", "brace", "token", "expression", "syntax"],
  Type: ["type", "convert", "cast", "operand", "argument", "parameter"],
  Template: ["template", "typename", "instantiation", "specialization"],
  Linker: ["link", "reference", "definition", "object", "library"],
  General: []
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

function validateDbEntry(entry, filePath, compiler) {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new Error(`Invalid DB entry format in ${filePath}`);
  }

  assertNonEmptyString(entry.id, `id in ${filePath}`);
  assertNonEmptyString(entry.title, `title in ${filePath}`);
  assertNonEmptyString(entry.explanation, `explanation in ${filePath}`);
  assertNonEmptyString(entry.messagePattern, `messagePattern in ${filePath}`);
  assertStringArray(entry.quickFixes, `quickFixes in ${filePath}`);

  if (entry.compiler !== compiler) {
    throw new Error(`Compiler mismatch in ${filePath}`);
  }

  return {
    id: entry.id,
    compiler: entry.compiler,
    type: entry.type === "warning" ? "warning" : "error",
    messagePattern: entry.messagePattern,
    title: entry.title,
    explanation: entry.explanation,
    quickFixes: entry.quickFixes
  };
}

function compilePattern(pattern, filePath) {
  try {
    return new RegExp(pattern, "i");
  } catch (error) {
    throw new Error(`Invalid regex in ${filePath}: ${error.message}`);
  }
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }
  return normalized.split(/\s+/);
}

function uniqueTokens(value) {
  return new Set(tokenize(value));
}

function getTokenOverlapScore(leftText, rightText) {
  const leftTokens = uniqueTokens(leftText);
  const rightTokens = uniqueTokens(rightText);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlapCount = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlapCount += 1;
    }
  }

  const denominator = Math.max(leftTokens.size, rightTokens.size);
  return overlapCount / denominator;
}

function computeLevenshteinDistance(leftText, rightText) {
  const left = normalizeText(leftText);
  const right = normalizeText(rightText);
  const leftLength = left.length;
  const rightLength = right.length;

  if (leftLength === 0) {
    return rightLength;
  }
  if (rightLength === 0) {
    return leftLength;
  }

  const previousRow = Array.from({ length: rightLength + 1 }, (_, index) => index);
  const currentRow = new Array(rightLength + 1);

  for (let i = 1; i <= leftLength; i += 1) {
    currentRow[0] = i;
    for (let j = 1; j <= rightLength; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      const deletion = previousRow[j] + 1;
      const insertion = currentRow[j - 1] + 1;
      const substitution = previousRow[j - 1] + substitutionCost;
      currentRow[j] = Math.min(deletion, insertion, substitution);
    }
    for (let j = 0; j <= rightLength; j += 1) {
      previousRow[j] = currentRow[j];
    }
  }

  return previousRow[rightLength];
}

function getLevenshteinSimilarity(leftText, rightText) {
  const left = normalizeText(leftText);
  const right = normalizeText(rightText);
  const denominator = Math.max(left.length, right.length);
  if (denominator === 0) {
    return 1;
  }
  const distance = computeLevenshteinDistance(left, right);
  return Math.max(0, 1 - distance / denominator);
}

function simplifyPatternText(messagePattern) {
  return String(messagePattern ?? "").replace(/[^a-zA-Z0-9]+/g, " ");
}

function toSingleLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toSentenceCase(value) {
  const normalized = toSingleLine(value);
  if (!normalized) {
    return "";
  }
  return normalized[0].toUpperCase() + normalized.slice(1);
}

function inferCategory(entryId) {
  if (/\.syntax\./i.test(entryId)) {
    return "Syntax";
  }
  if (/\.type\./i.test(entryId)) {
    return "Type";
  }
  if (/\.template\./i.test(entryId)) {
    return "Template";
  }
  if (/\.linker\./i.test(entryId)) {
    return "Linker";
  }
  return "General";
}

function mapSeverity(diagnosticType) {
  if (diagnosticType === "error") {
    return "HIGH";
  }
  return "MEDIUM";
}

function inferQuickFixActionType(text) {
  const normalized = normalizeText(text);
  for (const actionType of QUICK_FIX_ACTION_TYPES) {
    const keywords = QUICK_FIX_ACTION_KEYWORDS[actionType] ?? [];
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return actionType;
    }
  }
  return "check";
}

function inferQuickFixImpact(actionType, severity) {
  if (actionType === "edit") {
    return severity === "HIGH" || severity === "CRITICAL" ? "HIGH" : "MEDIUM";
  }
  if (actionType === "check") {
    return "MEDIUM";
  }
  return "LOW";
}

function formatQuickFixText(text) {
  const sentence = toSentenceCase(text);
  if (!sentence) {
    return "";
  }
  if (/[.!?]$/.test(sentence)) {
    return sentence;
  }
  return `${sentence}.`;
}

function isNearDuplicateQuickFix(leftText, rightText) {
  const normalizedLeft = normalizeText(leftText);
  const normalizedRight = normalizeText(rightText);
  if (!normalizedLeft || !normalizedRight) {
    return true;
  }
  if (normalizedLeft === normalizedRight) {
    return true;
  }
  const overlap = getTokenOverlapScore(normalizedLeft, normalizedRight);
  const similarity = getLevenshteinSimilarity(normalizedLeft, normalizedRight);
  return overlap >= 0.8 || similarity >= 0.86;
}

function scoreQuickFixCard(text, diagnostic, context) {
  const normalizedText = normalizeText(text);
  const actionType = inferQuickFixActionType(text);
  const diagnosticOverlap = getTokenOverlapScore(normalizedText, diagnostic.message);
  const categoryOverlap = getTokenOverlapScore(
    normalizedText,
    (CATEGORY_RELEVANCE_TOKENS[context.category] ?? []).join(" ")
  );
  const actionBoost = actionType === "edit" ? 0.16 : actionType === "check" ? 0.1 : 0.04;
  const matcherBoost = context.matcherType === "regex" ? 0.08 : context.matcherType === "fuzzy" ? 0.05 : 0;
  const severityBoost = context.severity === "HIGH" || context.severity === "CRITICAL" ? 0.08 : 0.04;
  return Math.min(0.99, 0.38 + diagnosticOverlap * 0.3 + categoryOverlap * 0.2 + actionBoost + matcherBoost + severityBoost);
}

function buildQuickFixCards(rawQuickFixes, diagnostic, context) {
  const sanitized = rawQuickFixes
    .map((item) => formatQuickFixText(item))
    .filter((item) => item.length > 0);

  const deduped = [];
  for (const quickFix of sanitized) {
    if (!deduped.some((existingQuickFix) => isNearDuplicateQuickFix(existingQuickFix, quickFix))) {
      deduped.push(quickFix);
    }
  }

  const rankedCards = deduped
    .map((text) => {
      const actionType = inferQuickFixActionType(text);
      const relevanceScore = scoreQuickFixCard(text, diagnostic, context);
      return {
        id: "",
        text,
        actionType,
        expectedImpact: inferQuickFixImpact(actionType, context.severity),
        relevanceScore,
        reason:
          actionType === "edit"
            ? "Direct code change likely resolves issue."
            : actionType === "check"
              ? "Validation step narrows root cause quickly."
              : "Background reading supports safe next edits."
      };
    })
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, 5)
    .map((card, index) => ({
      ...card,
      id: `fix-${index + 1}`,
      priority: index + 1
    }));

  return rankedCards;
}

function buildSummary(entryTitle, explanation, diagnosticMessage) {
  const summarySource = toSingleLine(explanation || diagnosticMessage || entryTitle);
  if (!summarySource) {
    return toSentenceCase(entryTitle || "Diagnostic found.");
  }
  const [firstSentence] = summarySource.split(/(?<=[.!?])\s+/);
  return toSentenceCase(firstSentence || summarySource);
}

function getConfidenceBand(confidence) {
  if (confidence >= 0.85) {
    return "high";
  }
  if (confidence >= 0.6) {
    return "medium";
  }
  return "low";
}

function scoreRegexMatch(entry, diagnostic) {
  if (!entry.regex.test(diagnostic.message)) {
    return -1;
  }

  const patternText = simplifyPatternText(entry.messagePattern);
  const tokenScore = getTokenOverlapScore(patternText, diagnostic.message);
  const levenshteinScore = getLevenshteinSimilarity(patternText, diagnostic.message);
  const specificityScore = Math.min(0.2, entry.messagePattern.length / 180);

  return Math.min(0.99, 0.72 + specificityScore + tokenScore * 0.12 + levenshteinScore * 0.08);
}

function scoreFuzzyMatch(entry, diagnostic) {
  const patternText = simplifyPatternText(entry.messagePattern);
  const tokenScore = getTokenOverlapScore(patternText, diagnostic.message);
  const levenshteinScore = getLevenshteinSimilarity(patternText, diagnostic.message);
  const fuzzyScore = tokenScore * 0.68 + levenshteinScore * 0.32;
  if (fuzzyScore < DEFAULT_FUZZY_THRESHOLD) {
    return -1;
  }
  return Math.min(0.8, 0.42 + fuzzyScore * 0.5);
}

function scoreEntryMatch(entry, diagnostic) {
  if (entry.type !== diagnostic.type) {
    return null;
  }

  const regexScore = scoreRegexMatch(entry, diagnostic);
  if (regexScore >= 0) {
    return {
      score: regexScore,
      matcherType: "regex"
    };
  }

  const fuzzyScore = scoreFuzzyMatch(entry, diagnostic);
  if (fuzzyScore >= 0) {
    return {
      score: fuzzyScore,
      matcherType: "fuzzy"
    };
  }

  return null;
}

async function readCompilerDatabaseEntries(databaseRoot, compiler) {
  const compilerDatabasePath = path.join(databaseRoot, compiler);
  const dirents = await fs.readdir(compilerDatabasePath, { withFileTypes: true });
  const files = dirents
    .filter((item) => item.isFile() && item.name.toLowerCase().endsWith(".json"))
    .map((item) => path.join(compilerDatabasePath, item.name));

  const rawEntries = await Promise.all(
    files.map(async (filePath) => {
      const content = await fs.readFile(filePath, "utf8");
      return {
        filePath,
        parsed: JSON.parse(content)
      };
    })
  );

  return rawEntries.map(({ filePath, parsed }) => {
    const entry = validateDbEntry(parsed, filePath, compiler);
    return {
      ...entry,
      regex: compilePattern(entry.messagePattern, filePath)
    };
  });
}

function normalizeRewriteOutput(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {};
  }
  return result;
}

function createRewriteAdapter(adapter) {
  if (adapter === undefined) {
    return async () => ({});
  }
  if (typeof adapter !== "function") {
    throw new Error("rewriteAdapter must be function");
  }
  return async (payload) => normalizeRewriteOutput(await adapter(payload));
}

function buildProgressiveSections({
  title,
  summary,
  explanation,
  quickFixes,
  confidence,
  confidenceBand,
  matcherType,
  compiler,
  category,
  severity,
  issueId,
  diagnostic,
  quickFixCards
}) {
  return {
    collapsed: {
      title,
      summary
    },
    expanded: {
      whatHappened: explanation,
      quickFixes: quickFixes.slice(0, 3),
      quickFixCards: quickFixCards.slice(0, 3)
    },
    deepDive: {
      whyThisMatched:
        matcherType === "regex"
          ? "Message matched a known diagnostic pattern."
          : matcherType === "fuzzy"
            ? "Message was close to a known pattern using fuzzy matching."
            : "No reliable match found, so fallback guidance was used.",
      originalDiagnostic: diagnostic.message
    },
    metadata: {
      issue_id: issueId,
      compiler,
      category,
      severity,
      matcherType,
      confidence,
      confidenceBand
    }
  };
}

function buildExplanationRecord({
  entry,
  diagnostic,
  compiler,
  confidence,
  matcherType,
  summaryOverride,
  explanationOverride,
  quickFixesOverride
}) {
  const issueId = entry?.id ?? `generic.${diagnostic.type}`;
  const title = toSentenceCase(entry?.title ?? (diagnostic.type === "warning" ? "Compiler warning" : "Compiler error"));
  const explanation = toSentenceCase(explanationOverride ?? entry?.explanation ?? diagnostic.message);
  const quickFixes = Array.isArray(quickFixesOverride) && quickFixesOverride.every((item) => typeof item === "string")
    ? quickFixesOverride.map((item) => toSentenceCase(item))
    : (entry?.quickFixes ?? [
      "Read full message and inspect location.",
      "Fix syntax/types near marked position."
    ]).map((item) => toSentenceCase(item));
  const category = COMPILER_CATEGORIES.includes(inferCategory(issueId)) ? inferCategory(issueId) : "General";
  const severity = SEVERITY_VALUES.includes(mapSeverity(diagnostic.type))
    ? mapSeverity(diagnostic.type)
    : "MEDIUM";
  const summary = toSentenceCase(summaryOverride ?? buildSummary(title, explanation, diagnostic.message));
  const confidenceBand = getConfidenceBand(confidence);
  const quickFixCards = buildQuickFixCards(quickFixes, diagnostic, {
    category,
    severity,
    matcherType
  });
  const rankedQuickFixes = quickFixCards.map((card) => card.text);
  const sections = buildProgressiveSections({
    title,
    summary,
    explanation,
    quickFixes: rankedQuickFixes,
    confidence,
    confidenceBand,
    matcherType,
    compiler,
    category,
    severity,
    issueId,
    diagnostic,
    quickFixCards
  });

  return {
    key: issueId,
    issue_id: issueId,
    title,
    category,
    severity,
    compiler,
    matcherType,
    summary,
    explanation,
    quickFixes: rankedQuickFixes,
    quickFixCards,
    confidence,
    confidenceBand,
    sections,
    diagnostic
  };
}

async function createFallbackExplanation(diagnostic, compiler, rewriteAdapter) {
  const confidence = 0.25;
  const baseFallback = buildExplanationRecord({
    entry: null,
    diagnostic,
    compiler,
    confidence,
    matcherType: "fallback"
  });
  const rewrite = await rewriteAdapter({
    compiler,
    diagnostic,
    explanation: baseFallback
  });
  return buildExplanationRecord({
    entry: null,
    diagnostic,
    compiler,
    confidence,
    matcherType: "fallback",
    summaryOverride: rewrite.summary,
    explanationOverride: rewrite.explanation,
    quickFixesOverride: rewrite.quickFixes
  });
}

function createErrorExplanationService(options = {}) {
  assertNonEmptyString(options.databaseRoot, "databaseRoot");
  if (options.onUnmappedDiagnostic !== undefined && typeof options.onUnmappedDiagnostic !== "function") {
    throw new Error("onUnmappedDiagnostic must be function");
  }
  const rewriteAdapter = createRewriteAdapter(options.rewriteAdapter);

  return Object.freeze({
    async mapDiagnostics(payload = {}) {
      const compiler = payload.compiler;
      const diagnostics = payload.diagnostics;
      assertNonEmptyString(compiler, "compiler");
      if (!Array.isArray(diagnostics)) {
        throw new Error("diagnostics must be array");
      }
      if (diagnostics.length === 0) {
        return [];
      }

      const entries = await readCompilerDatabaseEntries(options.databaseRoot, compiler);

      return Promise.all(diagnostics.map(async (diagnostic) => {
        let bestEntry = null;
        let bestScore = -1;
        let bestMatcherType = "fallback";

        for (const entry of entries) {
          const match = scoreEntryMatch(entry, diagnostic);
          if (match && match.score > bestScore) {
            bestScore = match.score;
            bestEntry = entry;
            bestMatcherType = match.matcherType;
          }
        }

        if (!bestEntry) {
          options.onUnmappedDiagnostic?.({
            compiler,
            diagnostic,
            reason: "no-match"
          });
          return createFallbackExplanation(diagnostic, compiler, rewriteAdapter);
        }

        const confidence = Math.min(0.99, bestScore);
        const baseExplanation = buildExplanationRecord({
          entry: bestEntry,
          diagnostic,
          compiler,
          confidence,
          matcherType: bestMatcherType
        });
        const rewrite = await rewriteAdapter({
          compiler,
          diagnostic,
          explanation: baseExplanation
        });
        return buildExplanationRecord({
          entry: bestEntry,
          diagnostic,
          compiler,
          confidence,
          matcherType: bestMatcherType,
          summaryOverride: rewrite.summary,
          explanationOverride: rewrite.explanation,
          quickFixesOverride: rewrite.quickFixes
        });
      }));
    }
  });
}

module.exports = {
  createErrorExplanationService
};

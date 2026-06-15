const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createOptimizationSuggestionService } = require("./optimizationSuggestionService");
const realRuleDatabaseRoot = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "resources",
  "optimization_rule_database"
);

async function withTempRuleDb(ruleFiles, callback) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-opt-rules-"));
  try {
    for (const [fileName, payload] of ruleFiles) {
      await fs.writeFile(path.join(tempDir, fileName), JSON.stringify(payload, null, 2), "utf8");
    }
    return await callback(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

test("rule loader reads and validates JSON rules", async () => {
  const rules = [
    {
      id: "opt.test.rule",
      title: "Test rule",
      rationale: "Rationale",
      actions: ["Do action"],
      references: ["https://example.com/rule"],
      priority: 5,
      baseConfidence: 0.5,
      maxConfidence: 0.9,
      conditions: [
        {
          type: "metric_threshold",
          metricPath: "features.nesting.maxDepth",
          operator: ">=",
          value: 3,
          weight: 0.2,
          hint: "Depth high."
        }
      ]
    }
  ];

  await withTempRuleDb([["rules.json", rules]], async (databaseRoot) => {
    const service = createOptimizationSuggestionService({ databaseRoot });
    const loaded = await service.loadRules();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].id, "opt.test.rule");
  });
});

test("matcher emits structured suggestion for matched rule", async () => {
  const rules = [
    {
      id: "opt.deep.nesting",
      title: "Flatten nesting",
      rationale: "Nesting depth is high.",
      actions: ["Extract nested logic"],
      references: ["https://example.com/nesting"],
      priority: 7,
      baseConfidence: 0.55,
      maxConfidence: 0.95,
      conditions: [
        {
          type: "metric_threshold",
          metricPath: "features.nesting.maxDepth",
          operator: ">=",
          value: 4,
          weight: 0.2,
          hint: "Nesting depth threshold exceeded."
        }
      ]
    }
  ];

  await withTempRuleDb([["rules.json", rules]], async (databaseRoot) => {
    const service = createOptimizationSuggestionService({ databaseRoot });
    const result = await service.generate({
      features: { nesting: { maxDepth: 5 } },
      semanticChecks: { issues: [] },
      codeSmells: { issues: [] }
    });

    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].id, "opt.deep.nesting");
    assert.ok(result.suggestions[0].confidence >= 0.7);
    assert.equal(result.suggestions[0].confidenceBand, "medium");
    assert.ok(result.suggestions[0].calibrationBreakdown);
    assert.ok(result.suggestions[0].matchedEvidence.length >= 1);
    assert.equal(result.suggestions[0].rank, 1);
  });
});

test("ranking sorts suggestions by score", async () => {
  const rules = [
    {
      id: "opt.lower.score",
      title: "Lower score",
      rationale: "Lower score rationale.",
      actions: ["Action A"],
      references: ["https://example.com/a"],
      priority: 5,
      baseConfidence: 0.5,
      maxConfidence: 0.9,
      conditions: [
        {
          type: "semantic_count",
          checkType: "unused_variable",
          operator: ">=",
          value: 1,
          weight: 0.12
        }
      ]
    },
    {
      id: "opt.higher.score",
      title: "Higher score",
      rationale: "Higher score rationale.",
      actions: ["Action B"],
      references: ["https://example.com/b"],
      priority: 9,
      baseConfidence: 0.6,
      maxConfidence: 0.95,
      conditions: [
        {
          type: "semantic_count",
          checkType: "unused_variable",
          operator: ">=",
          value: 1,
          weight: 0.25
        }
      ]
    }
  ];

  await withTempRuleDb([["rank.json", rules]], async (databaseRoot) => {
    const service = createOptimizationSuggestionService({ databaseRoot });
    const result = await service.generate({
      features: {},
      semanticChecks: {
        issues: [{ checkType: "unused_variable" }]
      },
      codeSmells: { issues: [] }
    });

    assert.equal(result.suggestions.length, 2);
    assert.equal(result.suggestions[0].id, "opt.higher.score");
    assert.equal(result.suggestions[1].id, "opt.lower.score");
    assert.equal(result.suggestions[0].rank, 1);
    assert.equal(result.suggestions[1].rank, 2);
  });
});

test("stl hint rule triggers range loop modernization", async () => {
  const service = createOptimizationSuggestionService({ databaseRoot: realRuleDatabaseRoot });
  const result = await service.generate({
    features: {
      loops: { for: 3, total: 3 },
      stl: { containerReferences: 2, algorithmCalls: 0, iteratorUsage: 0, total: 2 }
    },
    semanticChecks: { issues: [] },
    codeSmells: { issues: [] }
  });

  const rule = result.suggestions.find((item) => item.id === "opt.stl.range-loop-modernization");
  assert.ok(rule);
  assert.equal(rule.category, "stl");
});

test("stl hint rule triggers const reference suggestion", async () => {
  const service = createOptimizationSuggestionService({ databaseRoot: realRuleDatabaseRoot });
  const result = await service.generate({
    features: {
      loops: { for: 1, total: 1 },
      stl: { containerReferences: 1, algorithmCalls: 0, iteratorUsage: 0, total: 1 }
    },
    semanticChecks: { issues: [{ checkType: "copy_hotspot" }] },
    codeSmells: { issues: [] }
  });

  const rule = result.suggestions.find((item) => item.id === "opt.stl.pass-by-const-reference");
  assert.ok(rule);
  assert.equal(rule.category, "stl");
});

test("stl hint rule triggers reserve capacity suggestion", async () => {
  const service = createOptimizationSuggestionService({ databaseRoot: realRuleDatabaseRoot });
  const result = await service.generate({
    features: {
      loops: { for: 1, total: 3 },
      stl: { containerReferences: 2, algorithmCalls: 0, iteratorUsage: 0, total: 2 }
    },
    semanticChecks: { issues: [] },
    codeSmells: { issues: [] }
  });

  const rule = result.suggestions.find((item) => item.id === "opt.stl.reserve-capacity");
  assert.ok(rule);
});

test("stl hint rule triggers algorithm substitution suggestion", async () => {
  const service = createOptimizationSuggestionService({ databaseRoot: realRuleDatabaseRoot });
  const result = await service.generate({
    features: {
      loops: { for: 3, total: 3 },
      stl: { containerReferences: 1, algorithmCalls: 0, iteratorUsage: 0, total: 1 }
    },
    semanticChecks: { issues: [] },
    codeSmells: { issues: [] }
  });

  const rule = result.suggestions.find((item) => item.id === "opt.stl.use-standard-algorithms");
  assert.ok(rule);
});

test("stl hint rule triggers iterator traversal suggestion", async () => {
  const service = createOptimizationSuggestionService({ databaseRoot: realRuleDatabaseRoot });
  const result = await service.generate({
    features: {
      loops: { for: 1, total: 2 },
      stl: { containerReferences: 1, algorithmCalls: 1, iteratorUsage: 2, total: 4 }
    },
    semanticChecks: { issues: [] },
    codeSmells: { issues: [] }
  });

  const rule = result.suggestions.find((item) => item.id === "opt.stl.iterator-safe-traversal");
  assert.ok(rule);
});

test("stl category receives confidence boost", async () => {
  const rules = [
    {
      id: "opt.stl.boosted",
      category: "stl",
      title: "STL boosted",
      rationale: "STL boost rule",
      actions: ["Action A"],
      references: ["https://example.com/stl"],
      priority: 1,
      baseConfidence: 0.5,
      maxConfidence: 0.95,
      conditions: [
        {
          type: "metric_threshold",
          metricPath: "features.stl.containerReferences",
          operator: ">=",
          value: 1,
          weight: 0.1
        }
      ]
    }
  ];

  await withTempRuleDb([["stl.json", rules]], async (databaseRoot) => {
    const service = createOptimizationSuggestionService({ databaseRoot });
    const result = await service.generate({
      features: {
        stl: { containerReferences: 4, algorithmCalls: 2, iteratorUsage: 2, total: 8 }
      },
      semanticChecks: { issues: [] },
      codeSmells: { issues: [] }
    });

    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].category, "stl");
    assert.ok(result.suggestions[0].stlSignalBoost > 0);
    assert.ok(result.suggestions[0].confidence > 0.6);
    assert.equal(result.suggestions[0].confidenceBand, "medium");
    assert.ok(result.suggestions[0].calibrationBreakdown.signals.stlSignalNormalized > 0);
  });
});

test("high-confidence const-reference suggestion produces unified diff preview", async () => {
  const rules = [
    {
      id: "opt.stl.pass-by-const-reference",
      category: "stl",
      title: "Prefer const references",
      rationale: "Reduce copies.",
      actions: ["Use const reference"],
      references: ["https://example.com/const-ref"],
      priority: 9,
      baseConfidence: 0.8,
      maxConfidence: 0.98,
      conditions: [
        {
          type: "semantic_count",
          checkType: "copy_hotspot",
          operator: ">=",
          value: 1,
          weight: 0.12
        }
      ]
    }
  ];

  await withTempRuleDb([["const-ref.json", rules]], async (databaseRoot) => {
    const service = createOptimizationSuggestionService({ databaseRoot });
    const result = await service.generate({
      sourcePath: "workspace\\main.cpp",
      sourceContent: "int sum(std::vector<int> values) {\n  return values.size();\n}\n",
      features: { stl: { containerReferences: 2, algorithmCalls: 0, iteratorUsage: 0, total: 2 } },
      semanticChecks: { issues: [{ checkType: "copy_hotspot" }] },
      codeSmells: { issues: [] }
    });

    assert.equal(result.refactorPreviews.length, 1);
    assert.equal(result.refactorPreviews[0].suggestionId, "opt.stl.pass-by-const-reference");
    assert.ok(result.refactorPreviews[0].unifiedDiff.includes("const std::vector<int>& values"));
    assert.equal(result.suggestions[0].confidenceBand, "high");
  });
});

test("high-confidence loop modernization suggestion produces unified diff preview", async () => {
  const rules = [
    {
      id: "opt.stl.range-loop-modernization",
      category: "stl",
      title: "Modernize loops",
      rationale: "Use range loops.",
      actions: ["Use range-based loop"],
      references: ["https://example.com/range-loop"],
      priority: 9,
      baseConfidence: 0.84,
      maxConfidence: 0.98,
      conditions: [
        {
          type: "metric_threshold",
          metricPath: "features.loops.for",
          operator: ">=",
          value: 1,
          weight: 0.04
        }
      ]
    }
  ];

  await withTempRuleDb([["range-loop.json", rules]], async (databaseRoot) => {
    const service = createOptimizationSuggestionService({ databaseRoot });
    const result = await service.generate({
      sourcePath: "workspace\\main.cpp",
      sourceContent:
        "void f(std::vector<int>& nums) {\n  for (int i = 0; i < nums.size(); ++i) {\n    use(nums[i]);\n  }\n}\n",
      features: {
        loops: { for: 2, total: 2 },
        stl: { containerReferences: 1, algorithmCalls: 0, iteratorUsage: 1, total: 2 }
      },
      semanticChecks: { issues: [] },
      codeSmells: { issues: [] }
    });

    assert.equal(result.refactorPreviews.length, 1);
    assert.ok(result.refactorPreviews[0].unifiedDiff.includes("for (const auto& item : nums)"));
    assert.ok(result.refactorPreviews[0].unifiedDiff.includes("use(item);"));
    assert.equal(result.suggestions[0].confidenceBand, "high");
  });
});

test("preview gate blocks low-confidence suggestions", async () => {
  const rules = [
    {
      id: "opt.stl.pass-by-const-reference",
      category: "stl",
      title: "Prefer const references",
      rationale: "Reduce copies.",
      actions: ["Use const reference"],
      references: ["https://example.com/const-ref"],
      priority: 1,
      baseConfidence: 0.3,
      maxConfidence: 0.6,
      conditions: [
        {
          type: "semantic_count",
          checkType: "copy_hotspot",
          operator: ">=",
          value: 1,
          weight: 0.1
        }
      ]
    }
  ];

  await withTempRuleDb([["low-confidence.json", rules]], async (databaseRoot) => {
    const service = createOptimizationSuggestionService({ databaseRoot });
    const result = await service.generate({
      sourcePath: "workspace\\main.cpp",
      sourceContent: "int sum(std::vector<int> values) { return values.size(); }\n",
      features: { stl: { containerReferences: 1, algorithmCalls: 0, iteratorUsage: 0, total: 1 } },
      semanticChecks: { issues: [{ checkType: "copy_hotspot" }] },
      codeSmells: { issues: [] }
    });

    assert.equal(result.suggestions.length, 1);
    assert.equal(result.refactorPreviews.length, 0);
    assert.equal(result.suggestions[0].confidenceBand, "low");
    assert.equal(result.suggestions[0].refactorPreview, null);
  });
});

test("confidence band mapping uses configured thresholds", async () => {
  const rules = [
    {
      id: "opt.band.low",
      title: "Low band rule",
      rationale: "Low confidence baseline.",
      actions: ["A"],
      references: ["https://example.com/low"],
      priority: 1,
      baseConfidence: 0.2,
      maxConfidence: 0.5,
      conditions: [
        {
          type: "metric_threshold",
          metricPath: "features.nesting.maxDepth",
          operator: ">=",
          value: 1,
          weight: 0.1
        }
      ]
    },
    {
      id: "opt.band.medium",
      title: "Medium band rule",
      rationale: "Medium confidence baseline.",
      actions: ["B"],
      references: ["https://example.com/medium"],
      priority: 1,
      baseConfidence: 0.55,
      maxConfidence: 0.8,
      conditions: [
        {
          type: "metric_threshold",
          metricPath: "features.nesting.maxDepth",
          operator: ">=",
          value: 1,
          weight: 0.12
        }
      ]
    },
    {
      id: "opt.band.high",
      title: "High band rule",
      rationale: "High confidence baseline.",
      actions: ["C"],
      references: ["https://example.com/high"],
      priority: 1,
      baseConfidence: 0.85,
      maxConfidence: 0.99,
      conditions: [
        {
          type: "metric_threshold",
          metricPath: "features.nesting.maxDepth",
          operator: ">=",
          value: 1,
          weight: 0.1
        }
      ]
    }
  ];

  await withTempRuleDb([["bands.json", rules]], async (databaseRoot) => {
    const service = createOptimizationSuggestionService({ databaseRoot });
    const result = await service.generate({
      features: { nesting: { maxDepth: 3 } },
      semanticChecks: { issues: [] },
      codeSmells: { issues: [] }
    });

    const byId = Object.fromEntries(result.suggestions.map((item) => [item.id, item]));
    assert.equal(byId["opt.band.low"].confidenceBand, "low");
    assert.equal(byId["opt.band.medium"].confidenceBand, "medium");
    assert.equal(byId["opt.band.high"].confidenceBand, "high");
  });
});

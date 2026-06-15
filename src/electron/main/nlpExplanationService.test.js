const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  createNlpExplanationService,
  renderTemplateString,
  buildAnalyzeContext,
  matchesWhenClause
} = require("./nlpExplanationService");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

test("renderTemplateString replaces parameters", () => {
  const rendered = renderTemplateString("Risk {{riskClass}} at {{probabilityPercent}}", {
    riskClass: "risk_high",
    probabilityPercent: "82%"
  });
  assert.equal(rendered, "Risk risk_high at 82%");
});

test("matchesWhenClause supports min constraints", () => {
  const context = {
    optimization: { count: 2 },
    semantic: { memoryRiskCount: 0 }
  };
  assert.equal(matchesWhenClause({ "optimization.count.min": 1 }, context), true);
  assert.equal(matchesWhenClause({ "semantic.memoryRiskCount.min": 1 }, context), false);
});

test("generateFromAnalyzeResult builds refined NLP explanations", async () => {
  const service = createNlpExplanationService({
    projectRoot: PROJECT_ROOT,
    runProcess: async () => ({
      code: 0,
      stdout: JSON.stringify({
        engine: "rule_fallback",
        items: [
          {
            id: "nlp.performance.risk_high",
            title: "High performance risk.",
            summary: "Refined summary.",
            explanation: "Refined explanation.",
            actions: ["Action one."]
          }
        ]
      }),
      stderr: ""
    })
  });

  const analyzeStdout = JSON.stringify({
    features: {
      loops: { total: 5, for: 5, while: 0, doWhile: 0, rangeFor: 0 },
      nesting: { maxDepth: 5 },
      recursion: { recursiveFunctionCount: 1, functionCount: 3 },
      pointers: { declarations: 0, dereferences: 0, addressOf: 0, total: 0 },
      stl: { containerReferences: 0, algorithmCalls: 0, iteratorUsage: 0, total: 0 },
      allocations: {
        heapNew: 2,
        heapDelete: 0,
        mallocFamily: 0,
        freeCalls: 0,
        stackArrayDeclarations: 0,
        total: 2
      }
    },
    semanticChecks: { issues: [] },
    codeSmells: { issues: [] },
    complexityEstimate: {
      time: { bigO: "O(n^2)" },
      space: { bigO: "O(n)" }
    },
    optimizationSuggestions: {
      suggestions: [
        {
          title: "Modernize loop",
          rationale: "Range-for can simplify iteration."
        }
      ]
    }
  });

  const explanations = await service.generateFromAnalyzeResult(
    { code: 0, stdout: analyzeStdout, stderr: "" },
    {
      status: "ok",
      riskClass: "risk_high",
      probability: 0.9,
      confidenceBand: "high",
      topCauses: [{ feature: "loops_total", label: "Total loops", value: 5, contribution: 0.4 }]
    }
  );

  assert.ok(explanations.length >= 2);
  const riskExplanation = explanations.find((item) => item.metadata.id === "nlp.performance.risk_high");
  assert.ok(riskExplanation);
  assert.equal(riskExplanation.collapsed.summary, "Refined summary.");
  assert.ok(riskExplanation.metadata.pipelineStages.includes("ml"));
  assert.ok(riskExplanation.metadata.pipelineStages.includes("nlp_refine"));
});

test("refineCompilerExplanation returns rewritten quick fixes", async () => {
  const service = createNlpExplanationService({
    projectRoot: PROJECT_ROOT,
    runProcess: async () => ({
      code: 0,
      stdout: JSON.stringify({
        engine: "rule_fallback",
        items: [
          {
            id: "compiler.diagnostic",
            title: "Missing semicolon.",
            summary: "A statement is incomplete.",
            explanation: "Add the missing semicolon at line end.",
            actions: ["Insert semicolon after statement."]
          }
        ]
      }),
      stderr: ""
    })
  });

  const refined = await service.refineCompilerExplanation({
    explanation: {
      issue_id: "compiler.diagnostic",
      title: "Missing semicolon",
      summary: "statement incomplete",
      explanation: "add semicolon",
      quickFixes: ["add semicolon"]
    }
  });

  assert.equal(refined.summary, "A statement is incomplete.");
  assert.equal(refined.quickFixes[0], "Insert semicolon after statement.");
});

test("buildAnalyzeContext maps optimization and semantic counts", () => {
  const context = buildAnalyzeContext(
    {
      features: { loops: { total: 1 }, nesting: { maxDepth: 2 } },
      semanticChecks: { issues: [{ checkType: "memory_risk" }] },
      complexityEstimate: { time: { bigO: "O(n)" }, space: { bigO: "O(1)" } },
      optimizationSuggestions: { suggestions: [{ title: "A", rationale: "B" }] }
    },
    { status: "ok", riskClass: "risk_low", probability: 0.6, confidenceBand: "medium", topCauses: [] }
  );
  assert.equal(context.semantic.memoryRiskCount, 1);
  assert.equal(context.optimization.count, 1);
  assert.equal(context.params.topOptimizationTitle, "A");
});

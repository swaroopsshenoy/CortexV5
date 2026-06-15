const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createErrorExplanationService } = require("./errorExplanationService");

const databaseRoot = path.resolve(__dirname, "..", "..", "..", "resources", "compiler_error_database");

async function listJsonFiles(dirPath) {
  const dirents = await fs.readdir(dirPath, { withFileTypes: true });
  return dirents.filter((item) => item.isFile() && item.name.endsWith(".json")).map((item) => item.name);
}

test("clang++ and g++ databases include expanded coverage", async () => {
  const clangFiles = await listJsonFiles(path.join(databaseRoot, "clang++"));
  const gccFiles = await listJsonFiles(path.join(databaseRoot, "g++"));

  assert.ok(clangFiles.length >= 14, "clang++ database should include expanded entries");
  assert.ok(gccFiles.length >= 14, "g++ database should include expanded entries");
});

test("service maps frequent clang++ errors", async () => {
  const service = createErrorExplanationService({ databaseRoot });
  const diagnostics = [
    {
      file: "main.cpp",
      line: 10,
      column: 2,
      type: "error",
      message: "expected '}'"
    },
    {
      file: "main.cpp",
      line: 15,
      column: 8,
      type: "error",
      message: "no matching function for call to 'push_back'"
    },
    {
      file: "main.cpp",
      line: 21,
      column: 14,
      type: "error",
      message: "no type named 'value_type' in 'int'"
    },
    {
      file: "main.cpp",
      line: 28,
      column: 1,
      type: "error",
      message: "undefined reference to `helper()'"
    }
  ];

  const explanations = await service.mapDiagnostics({
    compiler: "clang++",
    diagnostics
  });

  assert.deepEqual(
    explanations.map((item) => item.key),
    [
      "clang.syntax.expected-closing-brace",
      "clang.type.no-matching-function",
      "clang.template.no-type-named",
      "clang.linker.undefined-reference"
    ]
  );
  assert.ok(explanations.every((item) => item.confidenceBand === "high"));
  assert.ok(explanations.every((item) => item.category));
  assert.ok(explanations.every((item) => item.issue_id === item.key));
  assert.ok(explanations.every((item) => item.sections?.collapsed?.summary));
  assert.ok(explanations.every((item) => item.quickFixCards.length > 0));
  assert.ok(explanations.every((item) => item.quickFixCards[0].priority === 1));
});

test("service maps frequent g++ errors", async () => {
  const service = createErrorExplanationService({ databaseRoot });
  const diagnostics = [
    {
      file: "main.cpp",
      line: 7,
      column: 12,
      type: "error",
      message: "expected primary-expression before ')' token"
    },
    {
      file: "main.cpp",
      line: 16,
      column: 18,
      type: "error",
      message: "invalid operands of types 'int' and 'const char [2]' to binary 'operator+'"
    },
    {
      file: "main.cpp",
      line: 31,
      column: 9,
      type: "error",
      message: "too few template arguments for class template 'vector'"
    },
    {
      file: "main.cpp",
      line: 38,
      column: 1,
      type: "error",
      message: "multiple definition of `main'; first defined here"
    }
  ];

  const explanations = await service.mapDiagnostics({
    compiler: "g++",
    diagnostics
  });

  assert.deepEqual(
    explanations.map((item) => item.key),
    [
      "gcc.syntax.expected-primary-expression",
      "gcc.type.invalid-operands",
      "gcc.template.too-few-arguments",
      "gcc.linker.multiple-definition"
    ]
  );
  assert.ok(explanations.every((item) => item.confidenceBand === "high"));
  assert.ok(explanations.every((item) => item.severity === "HIGH"));
  assert.ok(explanations.every((item) => item.compiler === "g++"));
  assert.ok(explanations.every((item) => item.quickFixCards.every((card) => card.id.startsWith("fix-"))));
});

test("fuzzy fallback resolves close diagnostic phrasing", async () => {
  const service = createErrorExplanationService({ databaseRoot });
  const [explanation] = await service.mapDiagnostics({
    compiler: "clang++",
    diagnostics: [
      {
        file: "main.cpp",
        line: 12,
        column: 6,
        type: "error",
        message: "function call has no matching overload"
      }
    ]
  });

  assert.equal(explanation.key, "clang.type.no-matching-function");
  assert.equal(explanation.confidenceBand, "medium");
  assert.equal(explanation.matcherType, "fuzzy");
});

test("unmapped diagnostics still return fallback explanation", async () => {
  const unmappedEvents = [];
  const service = createErrorExplanationService({
    databaseRoot,
    onUnmappedDiagnostic: (event) => {
      unmappedEvents.push(event);
    }
  });
  const [explanation] = await service.mapDiagnostics({
    compiler: "clang++",
    diagnostics: [
      {
        file: "main.cpp",
        line: 3,
        column: 3,
        type: "error",
        message: "some completely unknown diagnostic message"
      }
    ]
  });

  assert.equal(explanation.key, "generic.error");
  assert.equal(explanation.title, "Compiler error");
  assert.equal(explanation.confidenceBand, "low");
  assert.equal(explanation.matcherType, "fallback");
  assert.equal(explanation.severity, "HIGH");
  assert.ok(explanation.quickFixes.length >= 1);
  assert.equal(unmappedEvents.length, 1);
  assert.equal(unmappedEvents[0].compiler, "clang++");
  assert.equal(unmappedEvents[0].reason, "no-match");
  assert.equal(unmappedEvents[0].diagnostic.message, "some completely unknown diagnostic message");
});

test("rewrite adapter can override deterministic text output", async () => {
  const service = createErrorExplanationService({
    databaseRoot,
    rewriteAdapter: async ({ explanation }) => ({
      summary: `Refined: ${explanation.summary}`,
      explanation: `${explanation.explanation} Please check recent changes.`,
      quickFixes: [...explanation.quickFixes, "Run build again after updates."]
    })
  });

  const [explanation] = await service.mapDiagnostics({
    compiler: "clang++",
    diagnostics: [
      {
        file: "main.cpp",
        line: 5,
        column: 1,
        type: "error",
        message: "expected ';' after expression"
      }
    ]
  });

  assert.ok(explanation.summary.startsWith("Refined:"));
  assert.ok(explanation.explanation.includes("Please check recent changes."));
  assert.ok(explanation.quickFixes.includes("Run build again after updates."));
});

test("quick-fix pipeline dedupes and ranks fixes with action metadata", async () => {
  const service = createErrorExplanationService({
    databaseRoot,
    rewriteAdapter: async ({ explanation }) => ({
      quickFixes: [
        "check function name spelling and namespace",
        "Check function name spelling and namespace.",
        "convert argument type to expected parameter type",
        "read library docs for overload rules"
      ]
    })
  });

  const [explanation] = await service.mapDiagnostics({
    compiler: "clang++",
    diagnostics: [
      {
        file: "main.cpp",
        line: 11,
        column: 2,
        type: "error",
        message: "no matching function for call to 'foo'"
      }
    ]
  });

  assert.equal(explanation.quickFixes.length, 3);
  assert.deepEqual(
    explanation.quickFixCards.map((card) => card.priority),
    [1, 2, 3]
  );
  assert.equal(explanation.quickFixCards[0].actionType, "edit");
  assert.equal(explanation.quickFixCards[1].actionType, "check");
  assert.equal(explanation.quickFixCards[2].actionType, "read");
  assert.ok(explanation.quickFixCards[0].relevanceScore >= explanation.quickFixCards[2].relevanceScore);
  assert.ok(explanation.sections.expanded.quickFixCards.length > 0);
});

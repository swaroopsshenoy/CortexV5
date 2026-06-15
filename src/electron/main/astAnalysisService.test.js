const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  createAstAnalysisService,
  parseAstDumpToTree,
  extractAstFeatures,
  extractSemanticChecks,
  extractCodeSmells,
  estimateComplexity
} = require("./astAnalysisService");
const optimizationRulesRoot = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "resources",
  "optimization_rule_database"
);

function createSampleAst() {
  return {
    format: "clang-cindex-json",
    translationUnit: {
      kind: "CursorKind.TRANSLATION_UNIT",
      spelling: "",
      children: [
        {
          kind: "CursorKind.FUNCTION_DECL",
          spelling: "factorial",
          children: [
            {
              kind: "CursorKind.IF_STMT",
              spelling: "",
              children: [
                {
                  kind: "CursorKind.CALL_EXPR",
                  spelling: "factorial",
                  displayname: "factorial(int)",
                  children: []
                }
              ]
            }
          ]
        },
        {
          kind: "CursorKind.FOR_STMT",
          spelling: "",
          children: []
        },
        {
          kind: "CursorKind.WHILE_STMT",
          spelling: "",
          children: []
        },
        {
          kind: "CursorKind.CXX_FOR_RANGE_STMT",
          spelling: "",
          children: []
        },
        {
          kind: "CursorKind.VAR_DECL",
          spelling: "ptr",
          type: "int *",
          children: []
        },
        {
          kind: "CursorKind.UNARY_OPERATOR",
          spelling: "operator*",
          children: []
        },
        {
          kind: "CursorKind.UNARY_OPERATOR",
          spelling: "operator&",
          children: []
        },
        {
          kind: "CursorKind.TYPE_REF",
          spelling: "std::vector<int>",
          children: []
        },
        {
          kind: "CursorKind.CALL_EXPR",
          spelling: "std::sort",
          displayname: "std::sort(It,It)",
          children: []
        },
        {
          kind: "CursorKind.TYPE_REF",
          spelling: "std::vector<int>::iterator",
          children: []
        },
        {
          kind: "CursorKind.CXX_NEW_EXPR",
          spelling: "",
          children: []
        },
        {
          kind: "CursorKind.CXX_DELETE_EXPR",
          spelling: "",
          children: []
        },
        {
          kind: "CursorKind.CALL_EXPR",
          spelling: "malloc",
          displayname: "malloc(size_t)",
          children: []
        },
        {
          kind: "CursorKind.CALL_EXPR",
          spelling: "free",
          displayname: "free(void*)",
          children: []
        },
        {
          kind: "CursorKind.VAR_DECL",
          spelling: "stackBuf",
          type: "char[32]",
          children: []
        }
      ]
    },
    diagnostics: []
  };
}

function createSemanticSampleAst() {
  return {
    format: "clang-cindex-json",
    translationUnit: {
      kind: "CursorKind.TRANSLATION_UNIT",
      spelling: "",
      children: [
        {
          kind: "CursorKind.FUNCTION_DECL",
          spelling: "work",
          children: [
            {
              kind: "CursorKind.COMPOUND_STMT",
              children: [
                {
                  kind: "CursorKind.VAR_DECL",
                  spelling: "unusedVar",
                  type: "int",
                  location: { file: "main.cpp", line: 3, column: 5 },
                  children: []
                },
                {
                  kind: "CursorKind.VAR_DECL",
                  spelling: "usedVar",
                  type: "int",
                  location: { file: "main.cpp", line: 4, column: 5 },
                  children: []
                },
                {
                  kind: "CursorKind.DECL_REF_EXPR",
                  spelling: "usedVar",
                  location: { file: "main.cpp", line: 5, column: 9 },
                  children: []
                },
                {
                  kind: "CursorKind.RETURN_STMT",
                  location: { file: "main.cpp", line: 6, column: 3 },
                  children: []
                },
                {
                  kind: "CursorKind.CALL_EXPR",
                  spelling: "doWork",
                  location: { file: "main.cpp", line: 7, column: 3 },
                  children: []
                }
              ]
            }
          ]
        },
        {
          kind: "CursorKind.FUNCTION_DECL",
          spelling: "copyHeavy",
          children: [
            {
              kind: "CursorKind.PARM_DECL",
              spelling: "payload",
              type: "std::vector<int>",
              location: { file: "main.cpp", line: 11, column: 15 },
              children: []
            }
          ]
        },
        {
          kind: "CursorKind.CXX_NEW_EXPR",
          spelling: "",
          location: { file: "main.cpp", line: 15, column: 3 },
          children: []
        },
        {
          kind: "CursorKind.CALL_EXPR",
          spelling: "malloc",
          displayname: "malloc(size_t)",
          location: { file: "main.cpp", line: 16, column: 3 },
          children: []
        },
        {
          kind: "CursorKind.CALL_EXPR",
          spelling: "strcpy",
          displayname: "strcpy(char*, const char*)",
          location: { file: "main.cpp", line: 17, column: 3 },
          children: []
        }
      ]
    },
    diagnostics: []
  };
}

function createSmellSampleAst() {
  return {
    format: "clang-cindex-json",
    translationUnit: {
      kind: "CursorKind.TRANSLATION_UNIT",
      spelling: "",
      children: [
        {
          kind: "CursorKind.FUNCTION_DECL",
          spelling: "longFunc",
          location: { file: "main.cpp", line: 20, column: 1 },
          children: [
            {
              kind: "CursorKind.COMPOUND_STMT",
              location: { file: "main.cpp", line: 21, column: 1 },
              children: Array.from({ length: 24 }, (_, index) => ({
                kind: "CursorKind.CALL_EXPR",
                spelling: `step${index}`,
                location: { file: "main.cpp", line: 22 + index, column: 3 },
                children: []
              }))
            }
          ]
        },
        {
          kind: "CursorKind.CLASS_DECL",
          spelling: "LargeType",
          location: { file: "main.cpp", line: 100, column: 1 },
          children: Array.from({ length: 14 }, (_, index) => ({
            kind: "CursorKind.FIELD_DECL",
            spelling: `field${index}`,
            location: { file: "main.cpp", line: 101 + index, column: 3 },
            children: []
          }))
        },
        {
          kind: "CursorKind.INTEGER_LITERAL",
          spelling: "42",
          location: { file: "main.cpp", line: 140, column: 7 },
          children: []
        },
        {
          kind: "CursorKind.INTEGER_LITERAL",
          spelling: "7",
          location: { file: "main.cpp", line: 141, column: 7 },
          children: []
        },
        {
          kind: "CursorKind.INTEGER_LITERAL",
          spelling: "9",
          location: { file: "main.cpp", line: 142, column: 7 },
          children: []
        },
        {
          kind: "CursorKind.INTEGER_LITERAL",
          spelling: "13",
          location: { file: "main.cpp", line: 143, column: 7 },
          children: []
        },
        {
          kind: "CursorKind.INTEGER_LITERAL",
          spelling: "99",
          location: { file: "main.cpp", line: 144, column: 7 },
          children: []
        },
        {
          kind: "CursorKind.COMPOUND_STMT",
          location: { file: "main.cpp", line: 160, column: 1 },
          children: [
            {
              kind: "CursorKind.CALL_EXPR",
              spelling: "prepare",
              location: { file: "main.cpp", line: 161, column: 3 },
              children: []
            },
            {
              kind: "CursorKind.IF_STMT",
              location: { file: "main.cpp", line: 162, column: 3 },
              children: []
            },
            {
              kind: "CursorKind.RETURN_STMT",
              location: { file: "main.cpp", line: 163, column: 3 },
              children: []
            }
          ]
        },
        {
          kind: "CursorKind.COMPOUND_STMT",
          location: { file: "main.cpp", line: 170, column: 1 },
          children: [
            {
              kind: "CursorKind.CALL_EXPR",
              spelling: "prepareAgain",
              location: { file: "main.cpp", line: 171, column: 3 },
              children: []
            },
            {
              kind: "CursorKind.IF_STMT",
              location: { file: "main.cpp", line: 172, column: 3 },
              children: []
            },
            {
              kind: "CursorKind.RETURN_STMT",
              location: { file: "main.cpp", line: 173, column: 3 },
              children: []
            }
          ]
        },
        {
          kind: "CursorKind.IF_STMT",
          location: { file: "main.cpp", line: 180, column: 1 },
          children: [
            {
              kind: "CursorKind.IF_STMT",
              location: { file: "main.cpp", line: 181, column: 3 },
              children: [
                {
                  kind: "CursorKind.IF_STMT",
                  location: { file: "main.cpp", line: 182, column: 5 },
                  children: [
                    {
                      kind: "CursorKind.IF_STMT",
                      location: { file: "main.cpp", line: 183, column: 7 },
                      children: [
                        {
                          kind: "CursorKind.IF_STMT",
                          location: { file: "main.cpp", line: 184, column: 9 },
                          children: []
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    diagnostics: []
  };
}

test("parseAstDumpToTree builds nested node structure", () => {
  const dump = [
    "TranslationUnitDecl 0x1 <invalid sloc> <invalid sloc>",
    "|-FunctionDecl 0x2 <main.cpp:1:1, line:3:1> line:1:5 main 'int ()'",
    "| `-CompoundStmt 0x3 <col:12, line:3:1>",
    "|   `-ReturnStmt 0x4 <line:2:3, col:10>",
    "`-TypedefDecl 0x5 <line:5:1, col:13> col:13 size_t 'unsigned long'",
  ].join("\n");

  const parsed = parseAstDumpToTree(dump);
  assert.equal(parsed.format, "clang-ast-dump-tree");
  assert.equal(parsed.roots.length, 1);
  assert.equal(parsed.roots[0].kind, "TranslationUnitDecl");
  assert.equal(parsed.roots[0].children[0].kind, "FunctionDecl");
});

test("analyze uses clang.cindex json output when available", async () => {
  const service = createAstAnalysisService({
    projectRoot: "C:\\project",
    optimizationRulesRoot,
    toProjectPath: (inputPath) => `C:\\project\\${inputPath}`,
    runProcess: async (command) => {
      if (command === "python") {
        return {
          code: 0,
          stdout: JSON.stringify({
            format: "clang-cindex-json",
            translationUnit: { kind: "TranslationUnitDecl", children: [] },
            diagnostics: []
          }),
          stderr: ""
        };
      }
      return {
        code: 1,
        stdout: "",
        stderr: "unexpected fallback"
      };
    }
  });

  const result = await service.analyze({
    sourcePath: "workspace\\main.cpp",
    args: []
  });

  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.engine, "clang.cindex");
  assert.equal(parsed.ast.format, "clang-cindex-json");
  assert.ok(parsed.features);
  assert.ok(parsed.semanticChecks);
  assert.ok(parsed.codeSmells);
  assert.ok(parsed.optimizationSuggestions);
});

test("analyze falls back to ast-dump when cindex unavailable", async () => {
  const calls = [];
  const service = createAstAnalysisService({
    projectRoot: "C:\\project",
    optimizationRulesRoot,
    toProjectPath: (inputPath) => `C:\\project\\${inputPath}`,
    runProcess: async (command) => {
      calls.push(command);
      if (command === "python") {
        return {
          code: 3,
          stdout: "",
          stderr: "CINDEX_UNAVAILABLE: missing binding"
        };
      }
      return {
        code: 0,
        stdout: "TranslationUnitDecl 0x1 <invalid sloc> <invalid sloc>\n`-FunctionDecl 0x2 <main.cpp:1:1> main 'int ()'",
        stderr: ""
      };
    }
  });

  const result = await service.analyze({
    sourcePath: "workspace\\main.cpp",
    args: []
  });

  assert.equal(result.code, 0);
  assert.deepEqual(calls, ["python", "clang++"]);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.engine, "clang-ast-dump");
  assert.equal(parsed.ast.format, "clang-ast-dump-tree");
  assert.ok(parsed.features);
  assert.ok(parsed.semanticChecks);
  assert.ok(parsed.codeSmells);
  assert.ok(parsed.optimizationSuggestions);
});

test("feature extractor counts loops", () => {
  const features = extractAstFeatures(createSampleAst());
  assert.equal(features.loops.total, 3);
  assert.equal(features.loops.for, 1);
  assert.equal(features.loops.while, 1);
  assert.equal(features.loops.rangeFor, 1);
});

test("feature extractor computes nesting depth", () => {
  const features = extractAstFeatures(createSampleAst());
  assert.equal(features.nesting.maxDepth, 1);
});

test("feature extractor detects recursion", () => {
  const features = extractAstFeatures(createSampleAst());
  assert.equal(features.recursion.recursiveFunctionCount, 1);
  assert.deepEqual(features.recursion.recursiveFunctions, ["factorial"]);
});

test("feature extractor counts pointer usage", () => {
  const features = extractAstFeatures(createSampleAst());
  assert.equal(features.pointers.declarations, 1);
  assert.equal(features.pointers.dereferences, 1);
  assert.equal(features.pointers.addressOf, 1);
});

test("feature extractor counts STL usage", () => {
  const features = extractAstFeatures(createSampleAst());
  assert.equal(features.stl.containerReferences, 2);
  assert.equal(features.stl.algorithmCalls, 1);
  assert.equal(features.stl.iteratorUsage, 1);
});

test("feature extractor counts allocations", () => {
  const features = extractAstFeatures(createSampleAst());
  assert.equal(features.allocations.heapNew, 1);
  assert.equal(features.allocations.heapDelete, 1);
  assert.equal(features.allocations.mallocFamily, 1);
  assert.equal(features.allocations.freeCalls, 1);
  assert.equal(features.allocations.stackArrayDeclarations, 1);
});

test("semantic checker detects dead code", () => {
  const ast = createSemanticSampleAst();
  const semanticChecks = extractSemanticChecks(ast, extractAstFeatures(ast));
  const deadCodeIssues = semanticChecks.issues.filter((item) => item.checkType === "dead_code");
  assert.ok(deadCodeIssues.length >= 1);
  assert.equal(deadCodeIssues[0].severity, "MEDIUM");
});

test("semantic checker detects unused variables", () => {
  const ast = createSemanticSampleAst();
  const semanticChecks = extractSemanticChecks(ast, extractAstFeatures(ast));
  const unusedVariableIssues = semanticChecks.issues.filter(
    (item) => item.checkType === "unused_variable"
  );
  assert.ok(unusedVariableIssues.length >= 1);
  assert.equal(unusedVariableIssues[0].severity, "LOW");
});

test("semantic checker detects memory risks", () => {
  const ast = createSemanticSampleAst();
  const semanticChecks = extractSemanticChecks(ast, extractAstFeatures(ast));
  const memoryIssues = semanticChecks.issues.filter((item) => item.checkType === "memory_risk");
  assert.ok(memoryIssues.length >= 2);
  assert.ok(memoryIssues.every((item) => item.severity === "HIGH"));
});

test("semantic checker detects copy hotspots", () => {
  const ast = createSemanticSampleAst();
  const semanticChecks = extractSemanticChecks(ast, extractAstFeatures(ast));
  const copyIssues = semanticChecks.issues.filter((item) => item.checkType === "copy_hotspot");
  assert.ok(copyIssues.length >= 1);
  assert.equal(copyIssues[0].severity, "MEDIUM");
});

test("smell detector finds long function", () => {
  const ast = createSmellSampleAst();
  const smells = extractCodeSmells(ast, extractAstFeatures(ast));
  const issues = smells.issues.filter((item) => item.smellType === "long_function");
  assert.ok(issues.length >= 1);
  assert.equal(issues[0].severity, "MEDIUM");
  assert.ok(issues[0].confidence >= 0.6);
});

test("smell detector finds deep nesting", () => {
  const ast = createSmellSampleAst();
  const smells = extractCodeSmells(ast, extractAstFeatures(ast));
  const issues = smells.issues.filter((item) => item.smellType === "deep_nesting");
  assert.ok(issues.length >= 1);
  assert.equal(issues[0].severity, "HIGH");
});

test("smell detector finds large class", () => {
  const ast = createSmellSampleAst();
  const smells = extractCodeSmells(ast, extractAstFeatures(ast));
  const issues = smells.issues.filter((item) => item.smellType === "large_class");
  assert.ok(issues.length >= 1);
  assert.equal(issues[0].severity, "MEDIUM");
});

test("smell detector finds magic numbers", () => {
  const ast = createSmellSampleAst();
  const smells = extractCodeSmells(ast, extractAstFeatures(ast));
  const issues = smells.issues.filter((item) => item.smellType === "magic_numbers");
  assert.ok(issues.length >= 1);
  assert.equal(issues[0].severity, "LOW");
});

test("smell detector finds duplicate blocks", () => {
  const ast = createSmellSampleAst();
  const smells = extractCodeSmells(ast, extractAstFeatures(ast));
  const issues = smells.issues.filter((item) => item.smellType === "duplicate_blocks");
  assert.ok(issues.length >= 1);
  assert.equal(issues[0].severity, "MEDIUM");
});

test("complexity estimator detects O(1) with no loops", () => {
  const features = extractAstFeatures(createSampleAst());
  features.loops.total = 0;
  features.recursion.recursiveFunctionCount = 0;
  features.stl.algorithmCalls = 0;

  const complexity = estimateComplexity(features);

  assert.equal(complexity.time.bigO, "O(1)");
  assert.ok(complexity.space);
});

test("complexity estimator detects O(n) with single loop", () => {
  const features = extractAstFeatures(createSampleAst());
  features.loops.total = 1;
  features.nesting.maxDepth = 1;
  features.recursion.recursiveFunctionCount = 0;

  const complexity = estimateComplexity(features);

  assert.equal(complexity.time.bigO, "O(n)");
  assert.equal(complexity.time.confidence, "high");
});

test("complexity estimator detects O(n^2) with nested loops", () => {
  const features = extractAstFeatures(createSampleAst());
  features.loops.total = 2;
  features.nesting.maxDepth = 2;
  features.recursion.recursiveFunctionCount = 0;

  const complexity = estimateComplexity(features);

  assert.equal(complexity.time.bigO, "O(n^2)");
  assert.equal(complexity.time.confidence, "high");
});

test("complexity estimator detects O(n log n) with STL algorithms", () => {
  const features = extractAstFeatures(createSampleAst());
  features.loops.total = 0;
  features.stl.algorithmCalls = 1;
  features.recursion.recursiveFunctionCount = 0;

  const complexity = estimateComplexity(features);

  assert.equal(complexity.time.bigO, "O(n log n)");
});

test("complexity estimator includes space analysis", () => {
  const features = extractAstFeatures(createSampleAst());
  features.recursion.recursiveFunctionCount = 1;
  features.allocations.total = 1;

  const complexity = estimateComplexity(features);

  assert.ok(complexity.space);
  assert.equal(complexity.space.bigO, "O(n)");
  assert.ok(complexity.space.factors);
  assert.ok(Array.isArray(complexity.space.notes));
});


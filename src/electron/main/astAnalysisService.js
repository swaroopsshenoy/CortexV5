const path = require("node:path");
const fs = require("node:fs/promises");
const { createOptimizationSuggestionService } = require("./optimizationSuggestionService");

const CINDEX_UNAVAILABLE_MARKERS = ["CINDEX_UNAVAILABLE", "LIBCLANG_UNAVAILABLE"];
const LOOP_THRESHOLD = 8;
const NESTING_THRESHOLD = 4;
const RECURSION_THRESHOLD = 0;
const POINTER_THRESHOLD = 10;
const STL_THRESHOLD = 12;
const ALLOCATION_THRESHOLD = 6;
const DEAD_CODE_THRESHOLD = 0;
const UNUSED_VARIABLE_THRESHOLD = 0;
const MEMORY_RISK_THRESHOLD = 0;
const COPY_HOTSPOT_THRESHOLD = 0;
const LONG_FUNCTION_THRESHOLD = 20;
const DEEP_NESTING_SMELL_THRESHOLD = 4;
const LARGE_CLASS_MEMBER_THRESHOLD = 12;
const MAGIC_NUMBER_THRESHOLD = 4;
const DUPLICATE_BLOCK_THRESHOLD = 1;

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

function toNormalizedLocationToken(line) {
  const bracketMatch = line.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1];
  }
  const sourceLocationMatch = line.match(/([A-Za-z]:\\[^:\s]+:\d+:\d+|[^:\s]+:\d+:\d+)/);
  return sourceLocationMatch?.[1] ?? null;
}

function parseAstDumpNode(rawLine) {
  const line = String(rawLine ?? "")
    .trim()
    .replace(/^[|`\-\s]+/, "");
  if (!line) {
    return null;
  }

  const kindMatch = line.match(/^([A-Za-z_][\w:]*)(?:\s+0x[0-9a-f]+)?\s*(.*)$/i);
  if (!kindMatch) {
    return null;
  }

  const rest = kindMatch[2] ?? "";
  const quotedNameMatch = rest.match(/'([^']+)'/);
  const identifierMatch = rest.match(/\b([A-Za-z_]\w*)\b/);

  return {
    kind: kindMatch[1],
    name: quotedNameMatch?.[1] ?? identifierMatch?.[1] ?? null,
    spelling: quotedNameMatch?.[1] ?? null,
    location: toNormalizedLocationToken(rest),
    raw: line,
    children: []
  };
}

function parseAstDumpToTree(astDumpText) {
  const lines = String(astDumpText ?? "").split(/\r?\n/);
  const roots = [];
  const stack = [];

  for (const rawLine of lines) {
    if (!rawLine || !rawLine.trim()) {
      continue;
    }
    if (!/^[\s|`-]*[A-Za-z_]/.test(rawLine)) {
      continue;
    }

    const depthPrefix = rawLine.match(/^[\s|`-]*/)?.[0] ?? "";
    const depth = Math.max(0, Math.floor(depthPrefix.length / 2));
    const node = parseAstDumpNode(rawLine);
    if (!node) {
      continue;
    }

    while (stack.length > depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  return {
    format: "clang-ast-dump-tree",
    roots
  };
}

function toLowerText(value) {
  return String(value ?? "").toLowerCase();
}

function normalizeNodeKind(kind) {
  const kindText = String(kind ?? "");
  const cursorKindMatch = kindText.match(/CursorKind\.([A-Z_]+)/);
  if (cursorKindMatch?.[1]) {
    return cursorKindMatch[1];
  }
  return kindText.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();
}

function getNodeChildren(node) {
  if (Array.isArray(node?.children)) {
    return node.children;
  }
  if (Array.isArray(node?.roots)) {
    return node.roots;
  }
  return [];
}

function getNodeLabel(node) {
  return [node?.name, node?.spelling, node?.displayname, node?.raw, node?.type]
    .filter((item) => typeof item === "string")
    .join(" ");
}

function getNodeIdentifier(node) {
  if (typeof node?.spelling === "string" && node.spelling.trim()) {
    return node.spelling.trim();
  }
  if (typeof node?.name === "string" && node.name.trim()) {
    return node.name.trim();
  }
  if (typeof node?.displayname === "string" && node.displayname.trim()) {
    return node.displayname.trim().split("(")[0];
  }
  return "";
}

function parseLineFromLocationToken(location) {
  const locationText = String(location ?? "");
  const match = locationText.match(/:(\d+)(?::\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseColumnFromLocationToken(location) {
  const locationText = String(location ?? "");
  const match = locationText.match(/:(\d+):(\d+)/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[2]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getNodeLine(node) {
  if (typeof node?.location === "object" && node.location !== null) {
    if (Number.isFinite(node.location.line)) {
      return Number(node.location.line);
    }
    return null;
  }
  return parseLineFromLocationToken(node?.location);
}

function getNodeColumn(node) {
  if (typeof node?.location === "object" && node.location !== null) {
    if (Number.isFinite(node.location.column)) {
      return Number(node.location.column);
    }
    return null;
  }
  return parseColumnFromLocationToken(node?.location);
}

function getNodeFile(node) {
  if (typeof node?.location === "object" && node.location !== null) {
    if (typeof node.location.file === "string" && node.location.file.length > 0) {
      return node.location.file;
    }
    return null;
  }
  const locationText = String(node?.location ?? "");
  const match = locationText.match(/^([^:]+):\d+/);
  return match?.[1] ?? null;
}

function isFunctionNode(kind) {
  return ["FUNCTION_DECL", "CXX_METHOD", "FUNCTIONTEMPLATE", "CONSTRUCTOR", "DESTRUCTOR"].includes(
    kind
  );
}

function isCallNode(kind) {
  return ["CALL_EXPR", "CXXMEMBERCALL_EXPR", "CXX_OPERATOR_CALL_EXPR"].includes(kind);
}

function isControlNode(kind) {
  return [
    "IF_STMT",
    "SWITCH_STMT",
    "FOR_STMT",
    "WHILE_STMT",
    "DO_STMT",
    "CXX_FOR_RANGE_STMT"
  ].includes(kind);
}

function extractLoopMetrics(root) {
  const loops = {
    total: 0,
    for: 0,
    while: 0,
    doWhile: 0,
    rangeFor: 0,
    threshold: LOOP_THRESHOLD,
    exceedsThreshold: false
  };

  function visit(node) {
    const kind = normalizeNodeKind(node?.kind);
    if (kind === "FOR_STMT") {
      loops.total += 1;
      loops.for += 1;
    } else if (kind === "WHILE_STMT") {
      loops.total += 1;
      loops.while += 1;
    } else if (kind === "DO_STMT") {
      loops.total += 1;
      loops.doWhile += 1;
    } else if (kind === "CXX_FOR_RANGE_STMT") {
      loops.total += 1;
      loops.rangeFor += 1;
    }

    for (const child of getNodeChildren(node)) {
      visit(child);
    }
  }

  visit(root);
  loops.exceedsThreshold = loops.total > loops.threshold;
  return loops;
}

function extractNestingMetrics(root) {
  const nesting = {
    maxDepth: 0,
    threshold: NESTING_THRESHOLD,
    exceedsThreshold: false
  };

  function visit(node, depth) {
    const kind = normalizeNodeKind(node?.kind);
    const nextDepth = isControlNode(kind) ? depth + 1 : depth;
    nesting.maxDepth = Math.max(nesting.maxDepth, nextDepth);
    for (const child of getNodeChildren(node)) {
      visit(child, nextDepth);
    }
  }

  visit(root, 0);
  nesting.exceedsThreshold = nesting.maxDepth > nesting.threshold;
  return nesting;
}

function extractRecursionMetrics(root) {
  const recursiveFunctions = new Set();
  const functionNames = new Set();
  const recursion = {
    recursiveFunctionCount: 0,
    recursiveFunctions: [],
    threshold: RECURSION_THRESHOLD,
    exceedsThreshold: false
  };

  function visit(node, functionStack) {
    const kind = normalizeNodeKind(node?.kind);
    const functionName =
      typeof node?.spelling === "string" && node.spelling.trim()
        ? node.spelling.trim()
        : typeof node?.name === "string" && node.name.trim()
          ? node.name.trim()
          : null;

    if (isFunctionNode(kind) && functionName) {
      functionNames.add(functionName);
    }

    if (isCallNode(kind) && functionStack.length > 0) {
      const currentFunction = functionStack[functionStack.length - 1];
      const callTarget =
        typeof node?.spelling === "string" && node.spelling.trim()
          ? node.spelling.trim()
          : typeof node?.displayname === "string"
            ? node.displayname.split("(")[0].trim()
            : typeof node?.name === "string"
              ? node.name.trim()
              : "";
      if (callTarget && callTarget === currentFunction) {
        recursiveFunctions.add(currentFunction);
      }
    }

    const nextStack =
      isFunctionNode(kind) && functionName ? [...functionStack, functionName] : functionStack;
    for (const child of getNodeChildren(node)) {
      visit(child, nextStack);
    }
  }

  visit(root, []);
  recursion.recursiveFunctions = [...recursiveFunctions].sort((left, right) =>
    left.localeCompare(right)
  );
  recursion.recursiveFunctionCount = recursion.recursiveFunctions.length;
  recursion.exceedsThreshold = recursion.recursiveFunctionCount > recursion.threshold;
  recursion.functionCount = functionNames.size;
  return recursion;
}

function extractPointerMetrics(root) {
  const pointers = {
    declarations: 0,
    dereferences: 0,
    addressOf: 0,
    threshold: POINTER_THRESHOLD,
    exceedsThreshold: false
  };

  function visit(node) {
    const kind = normalizeNodeKind(node?.kind);
    const label = toLowerText(getNodeLabel(node));
    const typeText = toLowerText(node?.type);

    if (["VAR_DECL", "PARM_DECL", "FIELD_DECL"].includes(kind) && (label.includes("*") || typeText.includes("*"))) {
      pointers.declarations += 1;
    }

    if (kind === "UNARY_OPERATOR" || kind === "CXX_OPERATOR_CALL_EXPR") {
      if (label.includes("operator*") || /\s\*/.test(label)) {
        pointers.dereferences += 1;
      }
      if (label.includes("operator&") || /\s&/.test(label)) {
        pointers.addressOf += 1;
      }
    }

    if (label.includes("->")) {
      pointers.dereferences += 1;
    }

    for (const child of getNodeChildren(node)) {
      visit(child);
    }
  }

  visit(root);
  pointers.total = pointers.declarations + pointers.dereferences + pointers.addressOf;
  pointers.exceedsThreshold = pointers.total > pointers.threshold;
  return pointers;
}

function extractStlMetrics(root) {
  const stlContainers = [
    "std::vector",
    "std::string",
    "std::map",
    "std::set",
    "std::unordered_map",
    "std::unordered_set",
    "std::list",
    "std::deque",
    "std::array",
    "std::queue",
    "std::stack",
    "std::priority_queue"
  ];
  const stlAlgorithms = [
    "std::sort",
    "std::find",
    "std::transform",
    "std::for_each",
    "std::accumulate",
    "std::lower_bound",
    "std::upper_bound",
    "std::remove",
    "std::copy",
    "std::count"
  ];

  const stl = {
    containerReferences: 0,
    algorithmCalls: 0,
    iteratorUsage: 0,
    threshold: STL_THRESHOLD,
    exceedsThreshold: false
  };

  function visit(node) {
    const label = toLowerText(getNodeLabel(node));
    for (const container of stlContainers) {
      if (label.includes(container)) {
        stl.containerReferences += 1;
      }
    }
    for (const algorithm of stlAlgorithms) {
      if (label.includes(algorithm)) {
        stl.algorithmCalls += 1;
      }
    }
    if (label.includes("iterator")) {
      stl.iteratorUsage += 1;
    }

    for (const child of getNodeChildren(node)) {
      visit(child);
    }
  }

  visit(root);
  stl.total = stl.containerReferences + stl.algorithmCalls + stl.iteratorUsage;
  stl.exceedsThreshold = stl.total > stl.threshold;
  return stl;
}

function extractAllocationMetrics(root) {
  const allocations = {
    heapNew: 0,
    heapDelete: 0,
    mallocFamily: 0,
    freeCalls: 0,
    stackArrayDeclarations: 0,
    threshold: ALLOCATION_THRESHOLD,
    exceedsThreshold: false
  };

  function visit(node) {
    const kind = normalizeNodeKind(node?.kind);
    const label = toLowerText(getNodeLabel(node));
    const typeText = toLowerText(node?.type);

    if (kind === "CXX_NEW_EXPR") {
      allocations.heapNew += 1;
    }
    if (kind === "CXX_DELETE_EXPR") {
      allocations.heapDelete += 1;
    }
    if (kind === "CALL_EXPR") {
      if (/\b(malloc|calloc|realloc)\b/.test(label)) {
        allocations.mallocFamily += 1;
      }
      if (/\bfree\b/.test(label)) {
        allocations.freeCalls += 1;
      }
    }
    if (kind === "VAR_DECL" && (typeText.includes("[") || /\[[^\]]+\]/.test(label))) {
      allocations.stackArrayDeclarations += 1;
    }

    for (const child of getNodeChildren(node)) {
      visit(child);
    }
  }

  visit(root);
  allocations.total =
    allocations.heapNew +
    allocations.heapDelete +
    allocations.mallocFamily +
    allocations.freeCalls +
    allocations.stackArrayDeclarations;
  allocations.exceedsThreshold = allocations.total > allocations.threshold;
  return allocations;
}

function extractAstFeatures(astRoot) {
  const root = astRoot?.translationUnit ?? astRoot;
  const loops = extractLoopMetrics(root);
  const nesting = extractNestingMetrics(root);
  const recursion = extractRecursionMetrics(root);
  const pointers = extractPointerMetrics(root);
  const stl = extractStlMetrics(root);
  const allocations = extractAllocationMetrics(root);

  return {
    scope: "single-active-file",
    thresholds: {
      loops: LOOP_THRESHOLD,
      nestingDepth: NESTING_THRESHOLD,
      recursion: RECURSION_THRESHOLD,
      pointers: POINTER_THRESHOLD,
      stl: STL_THRESHOLD,
      allocations: ALLOCATION_THRESHOLD
    },
    loops,
    nesting,
    recursion,
    pointers,
    stl,
    allocations
  };
}

function createSemanticIssue(payload) {
  return {
    issueId: payload.issueId,
    checkType: payload.checkType,
    severity: payload.severity,
    title: payload.title,
    location: payload.location ?? null,
    evidence: payload.evidence,
    suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : []
  };
}

function isTerminatorNode(kind) {
  return ["RETURN_STMT", "BREAK_STMT", "CONTINUE_STMT", "CXX_THROW_EXPR", "GOTO_STMT"].includes(kind);
}

function isExecutableNode(kind) {
  return ![
    "NULL_STMT",
    "DECL_STMT",
    "VAR_DECL",
    "PARM_DECL",
    "TYPE_REF",
    "NAMESPACE_REF",
    "TEMPLATE_REF",
    "TYPEDEF_DECL"
  ].includes(kind);
}

function collectDeadCodeIssues(root) {
  const issues = [];

  function visit(node, functionName) {
    const kind = normalizeNodeKind(node?.kind);
    const nextFunctionName = isFunctionNode(kind) ? getNodeIdentifier(node) || functionName : functionName;

    if (kind === "COMPOUND_STMT") {
      let terminated = false;
      for (const child of getNodeChildren(node)) {
        const childKind = normalizeNodeKind(child?.kind);
        if (terminated && isExecutableNode(childKind)) {
          issues.push(
            createSemanticIssue({
              issueId: "semantic.dead-code.after-terminator",
              checkType: "dead_code",
              severity: "MEDIUM",
              title: "Potential dead code after control terminator",
              location: {
                file: getNodeFile(child),
                line: getNodeLine(child),
                column: getNodeColumn(child)
              },
              evidence: `Statement '${childKind}' appears after a terminating statement.`,
              suggestions: [
                "Remove unreachable statements after return/break/continue/throw.",
                "Move required logic before the terminating statement."
              ]
            })
          );
        }
        if (isTerminatorNode(childKind)) {
          terminated = true;
        }
        visit(child, nextFunctionName);
      }
      return;
    }

    for (const child of getNodeChildren(node)) {
      visit(child, nextFunctionName);
    }
  }

  visit(root, "");
  return issues;
}

function collectUnusedVariableIssues(root) {
  const declarations = [];
  const usage = new Map();

  function visit(node) {
    const kind = normalizeNodeKind(node?.kind);
    const identifier = getNodeIdentifier(node);
    if (kind === "VAR_DECL" && identifier) {
      declarations.push(node);
      usage.set(identifier, usage.get(identifier) ?? 0);
    }
    if (kind === "DECL_REF_EXPR" && identifier) {
      usage.set(identifier, (usage.get(identifier) ?? 0) + 1);
    }

    for (const child of getNodeChildren(node)) {
      visit(child);
    }
  }

  visit(root);

  return declarations
    .filter((node) => {
      const identifier = getNodeIdentifier(node);
      return (usage.get(identifier) ?? 0) === 0;
    })
    .map((node) => {
      const identifier = getNodeIdentifier(node);
      return createSemanticIssue({
        issueId: "semantic.unused-variable",
        checkType: "unused_variable",
        severity: "LOW",
        title: "Unused variable declaration",
        location: {
          file: getNodeFile(node),
          line: getNodeLine(node),
          column: getNodeColumn(node)
        },
        evidence: `Variable '${identifier}' is declared but never referenced.`,
        suggestions: [
          "Remove the unused variable.",
          "Use the variable where intended, or mark it intentionally unused."
        ]
      });
    });
}

function collectMemoryRiskIssues(root, features) {
  const issues = [];

  if (features.allocations.heapNew > features.allocations.heapDelete) {
    issues.push(
      createSemanticIssue({
        issueId: "semantic.memory.new-delete-imbalance",
        checkType: "memory_risk",
        severity: "HIGH",
        title: "Potential heap allocation leak",
        location: null,
        evidence: `'new' count (${features.allocations.heapNew}) is greater than 'delete' count (${features.allocations.heapDelete}).`,
        suggestions: [
          "Ensure every heap allocation has a matching delete path.",
          "Prefer smart pointers to manage dynamic memory automatically."
        ]
      })
    );
  }

  if (features.allocations.mallocFamily > features.allocations.freeCalls) {
    issues.push(
      createSemanticIssue({
        issueId: "semantic.memory.malloc-free-imbalance",
        checkType: "memory_risk",
        severity: "HIGH",
        title: "Potential C-allocation leak",
        location: null,
        evidence: `'malloc/calloc/realloc' count (${features.allocations.mallocFamily}) is greater than 'free' count (${features.allocations.freeCalls}).`,
        suggestions: [
          "Add free() calls for each malloc-family allocation path.",
          "Prefer RAII wrappers or standard containers over manual memory management."
        ]
      })
    );
  }

  const riskyCalls = [];
  function visit(node) {
    const kind = normalizeNodeKind(node?.kind);
    const label = toLowerText(getNodeLabel(node));
    if (kind === "CALL_EXPR" && /\b(strcpy|strcat|gets|sprintf)\b/.test(label)) {
      riskyCalls.push(node);
    }
    for (const child of getNodeChildren(node)) {
      visit(child);
    }
  }
  visit(root);

  for (const callNode of riskyCalls) {
    issues.push(
      createSemanticIssue({
        issueId: "semantic.memory.unsafe-c-api",
        checkType: "memory_risk",
        severity: "HIGH",
        title: "Potentially unsafe C string API usage",
        location: {
          file: getNodeFile(callNode),
          line: getNodeLine(callNode),
          column: getNodeColumn(callNode)
        },
        evidence: `Call '${getNodeIdentifier(callNode)}' may overflow buffers when bounds are unchecked.`,
        suggestions: [
          "Use safer bounded variants or std::string/std::vector alternatives.",
          "Validate destination buffer sizes before copy/format operations."
        ]
      })
    );
  }

  return issues;
}

function collectCopyHotspotIssues(root) {
  const issues = [];

  function visit(node) {
    const kind = normalizeNodeKind(node?.kind);
    if (kind === "PARM_DECL") {
      const typeText = toLowerText(node?.type);
      const parameterName = getNodeIdentifier(node);
      const isStdType = typeText.includes("std::");
      const isReference = typeText.includes("&");
      const isPointer = typeText.includes("*");
      if (isStdType && !isReference && !isPointer) {
        issues.push(
          createSemanticIssue({
            issueId: "semantic.copy-hotspot.pass-by-value",
            checkType: "copy_hotspot",
            severity: "MEDIUM",
            title: "Pass-by-value copy hotspot",
            location: {
              file: getNodeFile(node),
              line: getNodeLine(node),
              column: getNodeColumn(node)
            },
            evidence: `Parameter '${parameterName || "<unnamed>"}' uses '${node.type}' by value, which can trigger expensive copies.`,
            suggestions: [
              "Use const reference for read-only large objects.",
              "Use move semantics where ownership transfer is intended."
            ]
          })
        );
      }
    }

    for (const child of getNodeChildren(node)) {
      visit(child);
    }
  }

  visit(root);
  return issues;
}

function extractSemanticChecks(astRoot, features) {
  const root = astRoot?.translationUnit ?? astRoot;
  const deadCodeIssues = collectDeadCodeIssues(root);
  const unusedVariableIssues = collectUnusedVariableIssues(root);
  const memoryRiskIssues = collectMemoryRiskIssues(root, features);
  const copyHotspotIssues = collectCopyHotspotIssues(root);
  const issues = [
    ...deadCodeIssues,
    ...unusedVariableIssues,
    ...memoryRiskIssues,
    ...copyHotspotIssues
  ];

  return {
    scope: "single-active-file",
    thresholds: {
      deadCode: DEAD_CODE_THRESHOLD,
      unusedVariables: UNUSED_VARIABLE_THRESHOLD,
      memoryRisks: MEMORY_RISK_THRESHOLD,
      copyHotspots: COPY_HOTSPOT_THRESHOLD
    },
    issues
  };
}

function createCodeSmellIssue(payload) {
  return {
    smellId: payload.smellId,
    smellType: payload.smellType,
    severity: payload.severity,
    confidence: payload.confidence,
    title: payload.title,
    location: payload.location ?? null,
    evidence: payload.evidence,
    suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : []
  };
}

function collectLongFunctionSmells(root) {
  const issues = [];

  function countFunctionStatements(node) {
    let count = 0;
    const executionKinds = new Set([
      "CALL_EXPR",
      "CXXMEMBERCALL_EXPR",
      "CXX_OPERATOR_CALL_EXPR",
      "BINARY_OPERATOR",
      "UNARY_OPERATOR",
      "CXX_NEW_EXPR",
      "CXX_DELETE_EXPR"
    ]);

    function visit(current) {
      const kind = normalizeNodeKind(current?.kind);
      if (
        (kind.endsWith("_STMT") && kind !== "COMPOUND_STMT" && kind !== "NULL_STMT") ||
        executionKinds.has(kind)
      ) {
        count += 1;
      }
      for (const child of getNodeChildren(current)) {
        visit(child);
      }
    }

    for (const child of getNodeChildren(node)) {
      visit(child);
    }
    return count;
  }

  function visit(node) {
    const kind = normalizeNodeKind(node?.kind);
    if (isFunctionNode(kind)) {
      const statementCount = countFunctionStatements(node);
      if (statementCount > LONG_FUNCTION_THRESHOLD) {
        const overflow = statementCount - LONG_FUNCTION_THRESHOLD;
        const confidence = Math.min(0.99, 0.6 + overflow / (LONG_FUNCTION_THRESHOLD * 2));
        issues.push(
          createCodeSmellIssue({
            smellId: "smell.long-function",
            smellType: "long_function",
            severity: "MEDIUM",
            confidence,
            title: "Long function detected",
            location: {
              file: getNodeFile(node),
              line: getNodeLine(node),
              column: getNodeColumn(node)
            },
            evidence: `Function '${getNodeIdentifier(node) || "<anonymous>"}' contains ${statementCount} statements.`,
            suggestions: [
              "Split the function into smaller focused helpers.",
              "Extract repeated logic into reusable utilities."
            ]
          })
        );
      }
    }

    for (const child of getNodeChildren(node)) {
      visit(child);
    }
  }

  visit(root);
  return issues;
}

function collectDeepNestingSmells(features) {
  if (features.nesting.maxDepth <= DEEP_NESTING_SMELL_THRESHOLD) {
    return [];
  }
  const overflow = features.nesting.maxDepth - DEEP_NESTING_SMELL_THRESHOLD;
  const confidence = Math.min(0.99, 0.65 + overflow * 0.07);
  return [
    createCodeSmellIssue({
      smellId: "smell.deep-nesting",
      smellType: "deep_nesting",
      severity: "HIGH",
      confidence,
      title: "Deep control-flow nesting detected",
      location: null,
      evidence: `Maximum nesting depth is ${features.nesting.maxDepth}, above threshold ${DEEP_NESTING_SMELL_THRESHOLD}.`,
      suggestions: [
        "Use guard clauses to reduce nested branches.",
        "Extract nested logic into dedicated functions."
      ]
    })
  ];
}

function collectLargeClassSmells(root) {
  const issues = [];

  function visit(node) {
    const kind = normalizeNodeKind(node?.kind);
    if (kind === "CLASS_DECL" || kind === "STRUCT_DECL") {
      const members = getNodeChildren(node).filter((child) => {
        const childKind = normalizeNodeKind(child?.kind);
        return ["FIELD_DECL", "CXX_METHOD", "CONSTRUCTOR", "DESTRUCTOR", "VAR_DECL"].includes(
          childKind
        );
      });
      if (members.length > LARGE_CLASS_MEMBER_THRESHOLD) {
        const confidence = Math.min(
          0.99,
          0.62 + (members.length - LARGE_CLASS_MEMBER_THRESHOLD) * 0.04
        );
        issues.push(
          createCodeSmellIssue({
            smellId: "smell.large-class",
            smellType: "large_class",
            severity: "MEDIUM",
            confidence,
            title: "Large class/struct detected",
            location: {
              file: getNodeFile(node),
              line: getNodeLine(node),
              column: getNodeColumn(node)
            },
            evidence: `Type '${getNodeIdentifier(node) || "<anonymous>"}' declares ${members.length} members.`,
            suggestions: [
              "Split responsibilities into smaller classes.",
              "Move unrelated state/behavior into helper types."
            ]
          })
        );
      }
    }

    for (const child of getNodeChildren(node)) {
      visit(child);
    }
  }

  visit(root);
  return issues;
}

function collectMagicNumberSmells(root) {
  const numericNodes = [];

  function readNumericLiteral(node) {
    const candidates = [node?.spelling, node?.displayname, node?.name, node?.raw]
      .filter((item) => typeof item === "string")
      .join(" ");
    const match = candidates.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function visit(node) {
    const kind = normalizeNodeKind(node?.kind);
    if (kind === "INTEGER_LITERAL" || kind === "FLOATING_LITERAL") {
      const value = readNumericLiteral(node);
      if (Number.isFinite(value) && ![0, 1, -1].includes(value)) {
        numericNodes.push({ node, value });
      }
    }
    for (const child of getNodeChildren(node)) {
      visit(child);
    }
  }

  visit(root);
  if (numericNodes.length <= MAGIC_NUMBER_THRESHOLD) {
    return [];
  }

  const confidence = Math.min(0.99, 0.58 + (numericNodes.length - MAGIC_NUMBER_THRESHOLD) * 0.06);
  const first = numericNodes[0]?.node ?? null;
  return [
    createCodeSmellIssue({
      smellId: "smell.magic-numbers",
      smellType: "magic_numbers",
      severity: "LOW",
      confidence,
      title: "Frequent magic numbers detected",
      location: first
        ? {
            file: getNodeFile(first),
            line: getNodeLine(first),
            column: getNodeColumn(first)
          }
        : null,
      evidence: `${numericNodes.length} non-trivial numeric literals found (excluding 0/1/-1).`,
      suggestions: [
        "Replace repeated literals with named constants.",
        "Group related constants into enums or constexpr values."
      ]
    })
  ];
}

function collectDuplicateBlockSmells(root) {
  const signatures = new Map();

  function visit(node) {
    const kind = normalizeNodeKind(node?.kind);
    if (kind === "COMPOUND_STMT") {
      const statementKinds = getNodeChildren(node)
        .map((child) => normalizeNodeKind(child?.kind))
        .filter((childKind) => childKind.length > 0);
      if (statementKinds.length >= 3) {
        const signature = statementKinds.join(">");
        const entry = signatures.get(signature) ?? [];
        entry.push(node);
        signatures.set(signature, entry);
      }
    }

    for (const child of getNodeChildren(node)) {
      visit(child);
    }
  }

  visit(root);

  const duplicated = [...signatures.entries()].filter(([, nodes]) => nodes.length > DUPLICATE_BLOCK_THRESHOLD);
  if (duplicated.length === 0) {
    return [];
  }

  const [signature, nodes] = duplicated[0];
  const first = nodes[0];
  const confidence = Math.min(0.99, 0.64 + (nodes.length - 1) * 0.08);
  return [
    createCodeSmellIssue({
      smellId: "smell.duplicate-blocks",
      smellType: "duplicate_blocks",
      severity: "MEDIUM",
      confidence,
      title: "Duplicate block structure detected",
      location: {
        file: getNodeFile(first),
        line: getNodeLine(first),
        column: getNodeColumn(first)
      },
      evidence: `Block signature '${signature}' appears ${nodes.length} times.`,
      suggestions: [
        "Extract duplicated blocks into a shared function.",
        "Parameterize variable parts to keep one implementation."
      ]
    })
  ];
}

function extractCodeSmells(astRoot, features) {
  const root = astRoot?.translationUnit ?? astRoot;
  const issues = [
    ...collectLongFunctionSmells(root),
    ...collectDeepNestingSmells(features),
    ...collectLargeClassSmells(root),
    ...collectMagicNumberSmells(root),
    ...collectDuplicateBlockSmells(root)
  ];

  return {
    scope: "single-active-file",
    thresholds: {
      longFunctionStatements: LONG_FUNCTION_THRESHOLD,
      deepNestingDepth: DEEP_NESTING_SMELL_THRESHOLD,
      largeClassMembers: LARGE_CLASS_MEMBER_THRESHOLD,
      magicNumbers: MAGIC_NUMBER_THRESHOLD,
      duplicateBlocks: DUPLICATE_BLOCK_THRESHOLD
    },
    issues
  };
}

function buildComplexityEstimate(payload) {
  return {
    bigO: payload.bigO,
    confidence: payload.confidence,
    factors: payload.factors,
    notes: payload.notes
  };
}

function estimateTimeComplexity(features) {
  const loopTotal = features?.loops?.total ?? 0;
  const loopDepth = features?.nesting?.maxDepth ?? 0;
  const recursionCount = features?.recursion?.recursiveFunctionCount ?? 0;
  const stlAlgorithms = features?.stl?.algorithmCalls ?? 0;
  const loopsExceeds = features?.loops?.exceedsThreshold ?? false;
  const nestingExceeds = features?.nesting?.exceedsThreshold ?? false;
  const notes = [];
  let bigO = "O(1)";
  let confidence = "medium";

  if (loopTotal > 0) {
    if (loopDepth <= 1) {
      bigO = "O(n)";
      confidence = "high";
    } else if (loopDepth === 2) {
      bigO = "O(n^2)";
      confidence = "high";
    } else {
      bigO = `O(n^${loopDepth})`;
      confidence = "medium";
    }
    notes.push("Loop nesting drives time.");
  }

  if (stlAlgorithms > 0 && loopTotal === 0 && recursionCount === 0) {
    bigO = "O(n log n)";
    confidence = "medium";
    notes.push("STL algorithms suggest n log n.");
  }

  if (recursionCount > 0) {
    if (loopDepth >= 1 || loopTotal > 0) {
      bigO = "O(n^2)";
    } else {
      bigO = "O(n)";
    }
    confidence = "low";
    notes.push("Recursion detected.");
  }

  if (loopsExceeds || nestingExceeds) {
    confidence = confidence === "high" ? "medium" : "low";
  }

  return buildComplexityEstimate({
    bigO,
    confidence,
    factors: {
      loops: loopTotal,
      nestingDepth: loopDepth,
      recursion: recursionCount,
      stlAlgorithms
    },
    notes
  });
}

function estimateSpaceComplexity(features) {
  const recursionCount = features?.recursion?.recursiveFunctionCount ?? 0;
  const allocationTotal = features?.allocations?.total ?? 0;
  const allocationThreshold = features?.allocations?.threshold ?? 0;
  const notes = [];
  let bigO = "O(1)";
  let confidence = "medium";

  if (recursionCount > 0) {
    bigO = "O(n)";
    confidence = "low";
    notes.push("Call stack grows with recursion.");
  }

  if (allocationTotal > 0) {
    bigO = "O(n)";
    confidence = allocationTotal > allocationThreshold ? "medium" : "low";
    notes.push("Heap/stack allocations detected.");
  }

  return buildComplexityEstimate({
    bigO,
    confidence,
    factors: {
      recursion: recursionCount,
      allocations: allocationTotal,
      heapNew: features?.allocations?.heapNew ?? 0,
      mallocFamily: features?.allocations?.mallocFamily ?? 0
    },
    notes
  });
}

function estimateComplexity(features) {
  return {
    scope: "single-active-file",
    time: estimateTimeComplexity(features),
    space: estimateSpaceComplexity(features)
  };
}

function buildProcessLikeResponse(payload) {
  return {
    code: payload.code,
    stdout: payload.stdout ?? "",
    stderr: payload.stderr ?? ""
  };
}

function createAstAnalysisService(options = {}) {
  assertNonEmptyString(options.projectRoot, "projectRoot");
  if (typeof options.toProjectPath !== "function") {
    throw new Error("toProjectPath must be function");
  }
  if (typeof options.runProcess !== "function") {
    throw new Error("runProcess must be function");
  }

  const pythonCommand = options.pythonCommand ?? "python";
  const cindexScriptPath =
    options.cindexScriptPath ??
    path.join(options.projectRoot, "src", "electron", "main", "py", "ast_cindex_driver.py");
  const optimizationSuggestionService = createOptimizationSuggestionService({
    databaseRoot:
      options.optimizationRulesRoot ??
      path.join(options.projectRoot, "resources", "optimization_rule_database")
  });

  return Object.freeze({
    async analyze(payload = {}) {
      const sourcePath = options.toProjectPath(payload.sourcePath ?? "workspace\\main.cpp");
      const extraArgs = payload.args ?? [];
      assertStringArray(extraArgs, "args");
      let sourceContent = "";
      try {
        sourceContent = await fs.readFile(sourcePath, "utf8");
      } catch {
        sourceContent = "";
      }

      const cindexResult = await options.runProcess(
        pythonCommand,
        [cindexScriptPath, "--source", sourcePath, ...extraArgs],
        { cwd: options.projectRoot }
      );

      if (cindexResult.code === 0) {
        const parsed = JSON.parse(cindexResult.stdout);
        const features = extractAstFeatures(parsed);
        const semanticChecks = extractSemanticChecks(parsed, features);
        const codeSmells = extractCodeSmells(parsed, features);
        const complexityEstimate = estimateComplexity(features);
        const optimizationSuggestions = await optimizationSuggestionService.generate({
          sourcePath,
          sourceContent,
          features,
          semanticChecks,
          codeSmells
        });
        return buildProcessLikeResponse({
          code: 0,
          stdout: JSON.stringify(
            {
              engine: "clang.cindex",
              sourcePath,
              ast: parsed,
              features,
              semanticChecks,
              codeSmells,
              complexityEstimate,
              optimizationSuggestions
            },
            null,
            2
          ),
          stderr: cindexResult.stderr
        });
      }

      const shouldFallback = CINDEX_UNAVAILABLE_MARKERS.some((marker) =>
        String(cindexResult.stderr ?? "").includes(marker)
      );
      if (!shouldFallback) {
        return buildProcessLikeResponse({
          code: cindexResult.code,
          stdout: cindexResult.stdout,
          stderr: cindexResult.stderr
        });
      }

      const astDumpResult = await options.runProcess(
        "clang++",
        ["-Xclang", "-ast-dump", "-fsyntax-only", sourcePath, ...extraArgs],
        { cwd: options.projectRoot }
      );

      if (astDumpResult.code !== 0) {
        return buildProcessLikeResponse({
          code: astDumpResult.code,
          stdout: astDumpResult.stdout,
          stderr: [cindexResult.stderr, astDumpResult.stderr].filter(Boolean).join("\n")
        });
      }

      const parsedTree = parseAstDumpToTree(astDumpResult.stdout);
      const features = extractAstFeatures(parsedTree);
      const semanticChecks = extractSemanticChecks(parsedTree, features);
      const codeSmells = extractCodeSmells(parsedTree, features);
      const complexityEstimate = estimateComplexity(features);
      const optimizationSuggestions = await optimizationSuggestionService.generate({
        sourcePath,
        sourceContent,
        features,
        semanticChecks,
        codeSmells
      });
      return buildProcessLikeResponse({
        code: 0,
        stdout: JSON.stringify(
          {
            engine: "clang-ast-dump",
            sourcePath,
            ast: parsedTree,
            features,
            semanticChecks,
            codeSmells,
            complexityEstimate,
            optimizationSuggestions
          },
          null,
          2
        ),
        stderr: cindexResult.stderr
      });
    }
  });
}

module.exports = {
  createAstAnalysisService,
  parseAstDumpToTree,
  extractAstFeatures,
  extractSemanticChecks,
  extractCodeSmells,
  estimateComplexity
};

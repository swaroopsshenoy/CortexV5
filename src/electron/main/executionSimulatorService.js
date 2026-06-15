const fs = require("node:fs/promises");

const SUPPORTED_LANGUAGE = "cpp";
const DEFAULT_LOOP_CAP = 20;
const LOOP_KIND_LABELS = Object.freeze({
  for: "for",
  while: "while"
});
const SCOPE_KIND_LABELS = Object.freeze({
  function: "function",
  block: "block",
  loop: "loop"
});
const VARIABLE_KIND_LABELS = Object.freeze({
  param: "param",
  local: "local"
});
const UNINITIALIZED_VALUE = "<uninitialized>";
const PARAM_PLACEHOLDER_VALUE = "<param>";
const STEP_EVENT_TYPES = new Set([
  "line-enter",
  "evaluate",
  "branch",
  "assign",
  "loop-iteration",
  "statement",
  "return",
  "unsupported",
  "end"
]);
const UNSUPPORTED_KEYWORDS = ["switch", "do", "goto", "try", "catch"];
const NON_FUNCTION_PREFIXES = /^(?:if|for|while|switch|catch|else)\b/;
const DECLARATION_EXCLUDE_PREFIXES =
  /^(?:return|if|for|while|switch|catch|using|typedef|class|struct|enum|namespace|template)\b/;

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be non-empty string`);
  }
}

function assertLanguage(language) {
  if (language !== SUPPORTED_LANGUAGE) {
    throw new Error(`Unsupported simulation language: ${language}`);
  }
}

function normalizeLoopCap(value) {
  if (value === undefined) {
    return DEFAULT_LOOP_CAP;
  }
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new Error("maxLoopIterations must be integer between 1 and 200");
  }
  return value;
}

function stripInlineComment(input) {
  const line = String(input ?? "");
  const commentIndex = line.indexOf("//");
  return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
}

function normalizeCodeLine(input) {
  return stripInlineComment(input).trim();
}

function isSkippableLine(lineText) {
  return lineText.length === 0 || lineText === "{" || lineText === "}";
}

function findNextMeaningfulLine(lines, startLine) {
  for (let line = startLine; line < lines.length; line += 1) {
    const normalized = normalizeCodeLine(lines[line]);
    if (!isSkippableLine(normalized)) {
      return line;
    }
  }
  return null;
}

function buildBraceMap(lines) {
  const stack = [];
  const map = new Map();

  for (let line = 0; line < lines.length; line += 1) {
    const raw = String(lines[line] ?? "");
    const code = stripInlineComment(raw);
    for (let index = 0; index < code.length; index += 1) {
      const ch = code[index];
      if (ch === "{") {
        stack.push(line);
      } else if (ch === "}") {
        const openLine = stack.pop();
        if (openLine !== undefined && !map.has(openLine)) {
          map.set(openLine, line);
        }
      }
    }
  }

  return map;
}

function resolveStatementRange(lines, braceMap, headerLine) {
  const header = String(lines[headerLine] ?? "");
  if (header.includes("{")) {
    const closeLine = braceMap.get(headerLine);
    if (Number.isInteger(closeLine)) {
      return {
        startLine: headerLine + 1,
        endLine: closeLine - 1,
        consumedEndLine: closeLine,
        isBlock: true
      };
    }
  }

  const bodyLine = findNextMeaningfulLine(lines, headerLine + 1);
  if (bodyLine === null) {
    return {
      startLine: headerLine + 1,
      endLine: headerLine,
      consumedEndLine: headerLine,
      isBlock: false
    };
  }

  const bodyText = normalizeCodeLine(lines[bodyLine]);
  if (bodyText === "{") {
    const closeLine = braceMap.get(bodyLine);
    if (Number.isInteger(closeLine)) {
      return {
        startLine: bodyLine + 1,
        endLine: closeLine - 1,
        consumedEndLine: closeLine,
        isBlock: true
      };
    }
  }

  return {
    startLine: bodyLine,
    endLine: bodyLine,
    consumedEndLine: bodyLine,
    isBlock: false
  };
}

function findElseLine(lines, fromLine) {
  const candidate = findNextMeaningfulLine(lines, fromLine + 1);
  if (candidate === null) {
    return null;
  }
  const raw = String(lines[candidate] ?? "");
  if (/^\s*\}?\s*else\b/.test(raw)) {
    return candidate;
  }
  return null;
}

function extractFirstParenContent(statement) {
  const text = String(statement ?? "");
  const firstOpen = text.indexOf("(");
  if (firstOpen < 0) {
    return null;
  }
  let depth = 0;
  let content = "";
  for (let index = firstOpen; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === "(") {
      depth += 1;
      if (depth === 1) {
        continue;
      }
    }
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        return content.trim();
      }
    }
    if (depth >= 1) {
      content += ch;
    }
  }
  return null;
}

function detectFunctionHeader(statement) {
  if (!statement.includes("(") || !statement.includes(")") || !statement.includes("{")) {
    return null;
  }
  if (NON_FUNCTION_PREFIXES.test(statement)) {
    return null;
  }
  const nameMatch = statement.match(/([A-Za-z_]\w*)\s*\(/);
  if (!nameMatch) {
    return null;
  }
  return {
    name: nameMatch[1],
    paramsText: extractFirstParenContent(statement) ?? ""
  };
}

function parseParameterNames(paramText) {
  const text = String(paramText ?? "").trim();
  if (!text || /^void$/i.test(text)) {
    return [];
  }
  return text
    .split(",")
    .map((raw) => raw.split("=").shift()?.trim() ?? "")
    .map((raw) => raw.match(/([A-Za-z_]\w*)\s*$/)?.[1] ?? "")
    .filter(Boolean);
}

function parseDeclaration(statement) {
  if (!statement.endsWith(";") || DECLARATION_EXCLUDE_PREFIXES.test(statement)) {
    return null;
  }
  const declarationWithInit = statement.match(
    /^\s*([A-Za-z_][\w:<>,\s*&]*?)\s+([A-Za-z_]\w*)\s*(=|\+=|-=|\*=|\/=|%=)\s*([^;]+);$/
  );
  if (declarationWithInit) {
    return {
      name: declarationWithInit[2],
      operator: declarationWithInit[3],
      expression: declarationWithInit[4].trim(),
      hasInit: true
    };
  }

  const declarationNoInit = statement.match(/^\s*([A-Za-z_][\w:<>,\s*&]*?)\s+([A-Za-z_]\w*)\s*;$/);
  if (declarationNoInit) {
    return {
      name: declarationNoInit[2],
      operator: null,
      expression: null,
      hasInit: false
    };
  }
  return null;
}

function parseAssignment(statement) {
  const assignmentMatch = statement.match(
    /^\s*([A-Za-z_]\w*)\s*(=|\+=|-=|\*=|\/=|%=)\s*([^;]+);?$/
  );
  if (!assignmentMatch) {
    return null;
  }
  if (/[=!<>]=/.test(statement)) {
    return null;
  }
  return {
    variable: assignmentMatch[1],
    operator: assignmentMatch[2],
    expression: assignmentMatch[3].trim()
  };
}

function parseHeapAllocation(expression) {
  const text = String(expression ?? "");
  const mallocMatch = text.match(/\bmalloc\s*\(\s*(\d+)\s*\)/);
  if (mallocMatch) {
    return { kind: "malloc", bytes: Number(mallocMatch[1]) };
  }
  const callocMatch = text.match(/\bcalloc\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (callocMatch) {
    return { kind: "calloc", bytes: Number(callocMatch[1]) * Number(callocMatch[2]) };
  }
  const reallocMatch = text.match(/\brealloc\s*\([^,]+,\s*(\d+)\s*\)/);
  if (reallocMatch) {
    return { kind: "realloc", bytes: Number(reallocMatch[1]) };
  }
  if (/\bnew\b/.test(text) || /\bmake_unique\s*</.test(text) || /\bmake_shared\s*</.test(text)) {
    return { kind: "new", bytes: null };
  }
  return null;
}

function parseHeapFree(statement) {
  const deleteMatch = statement.match(/^\s*delete(?:\s*\[\])?\s+([A-Za-z_]\w*)\s*;?$/);
  if (deleteMatch) {
    return { kind: "delete", variable: deleteMatch[1] };
  }
  const freeMatch = statement.match(/\bfree\s*\(\s*([A-Za-z_]\w*)\s*\)\s*;?$/);
  if (freeMatch) {
    return { kind: "free", variable: freeMatch[1] };
  }
  return null;
}

function deriveAssignedValue(variable, operator, expression) {
  if (operator === "=") {
    return expression;
  }
  return `${variable} ${operator} ${expression}`;
}

function evaluateCondition(conditionText) {
  const condition = String(conditionText ?? "").trim();
  if (!condition) {
    return { value: true, indeterminate: true };
  }
  if (/^true$/i.test(condition)) {
    return { value: true, indeterminate: false };
  }
  if (/^false$/i.test(condition)) {
    return { value: false, indeterminate: false };
  }

  const numericComparison = condition.match(/^\s*(-?\d+)\s*(==|!=|<=|>=|<|>)\s*(-?\d+)\s*$/);
  if (numericComparison) {
    const left = Number(numericComparison[1]);
    const op = numericComparison[2];
    const right = Number(numericComparison[3]);
    if (op === "==") {
      return { value: left === right, indeterminate: false };
    }
    if (op === "!=") {
      return { value: left !== right, indeterminate: false };
    }
    if (op === "<=") {
      return { value: left <= right, indeterminate: false };
    }
    if (op === ">=") {
      return { value: left >= right, indeterminate: false };
    }
    if (op === "<") {
      return { value: left < right, indeterminate: false };
    }
    return { value: left > right, indeterminate: false };
  }

  if (/^-?\d+$/.test(condition)) {
    return { value: Number(condition) !== 0, indeterminate: false };
  }
  return { value: true, indeterminate: true };
}

function parseForLoopIterationPlan(forStatement, maxLoopIterations) {
  const conditionAndControl = extractFirstParenContent(forStatement);
  const basePlan = {
    loopVariable: null,
    startValue: null,
    stepValue: null
  };
  if (!conditionAndControl) {
    return {
      ...basePlan,
      iterations: 1,
      branchDecision: "indeterminate",
      capHit: false,
      reason: "Missing for-loop control expression"
    };
  }

  const parts = conditionAndControl.split(";").map((item) => item.trim());
  if (parts.length !== 3) {
    return {
      ...basePlan,
      iterations: maxLoopIterations,
      branchDecision: "indeterminate",
      capHit: true,
      reason: "Unsupported for-loop control format"
    };
  }

  const initText = parts[0];
  const conditionText = parts[1];
  const updateText = parts[2];
  const initMatch = initText.match(/(?:int|long|size_t|std::size_t|auto)?\s*([A-Za-z_]\w*)\s*=\s*(-?\d+)/);
  const conditionMatch = conditionText.match(/([A-Za-z_]\w*)\s*(<=|<|>=|>)\s*(-?\d+)/);

  if (!initMatch || !conditionMatch || initMatch[1] !== conditionMatch[1]) {
    return {
      ...basePlan,
      iterations: maxLoopIterations,
      branchDecision: "indeterminate",
      capHit: true,
      reason: "Indeterminate loop bounds"
    };
  }

  const variable = initMatch[1];
  const startValue = Number(initMatch[2]);
  const operator = conditionMatch[2];
  const boundValue = Number(conditionMatch[3]);

  let stepValue = null;
  if (new RegExp(`\\+\\+\\s*${variable}`).test(updateText) || new RegExp(`${variable}\\s*\\+\\+`).test(updateText)) {
    stepValue = 1;
  } else if (
    new RegExp(`--\\s*${variable}`).test(updateText) ||
    new RegExp(`${variable}\\s*--`).test(updateText)
  ) {
    stepValue = -1;
  } else {
    const plusAssignMatch = updateText.match(new RegExp(`${variable}\\s*\\+=\\s*(\\d+)`));
    const minusAssignMatch = updateText.match(new RegExp(`${variable}\\s*-=\\s*(\\d+)`));
    if (plusAssignMatch) {
      stepValue = Number(plusAssignMatch[1]);
    } else if (minusAssignMatch) {
      stepValue = -Number(minusAssignMatch[1]);
    }
  }

  if (!Number.isFinite(stepValue) || stepValue === 0) {
    return {
      ...basePlan,
      iterations: maxLoopIterations,
      branchDecision: "indeterminate",
      capHit: true,
      reason: "Unsupported loop update expression"
    };
  }

  function conditionSatisfied(value) {
    if (operator === "<") {
      return value < boundValue;
    }
    if (operator === "<=") {
      return value <= boundValue;
    }
    if (operator === ">") {
      return value > boundValue;
    }
    return value >= boundValue;
  }

  let count = 0;
  let cursor = startValue;
  while (conditionSatisfied(cursor)) {
    count += 1;
    cursor += stepValue;
    if (count >= maxLoopIterations) {
      return {
        ...basePlan,
        iterations: maxLoopIterations,
        branchDecision: "true",
        capHit: true,
        reason: "Loop iteration cap reached"
      };
    }
  }
  return {
    loopVariable: variable,
    startValue,
    stepValue,
    iterations: count,
    branchDecision: count > 0 ? "true" : "false",
    capHit: false,
    reason: ""
  };
}

function parseWhileLoopIterationPlan(whileStatement, maxLoopIterations) {
  const conditionText = extractFirstParenContent(whileStatement);
  const decision = evaluateCondition(conditionText);
  if (decision.indeterminate) {
    return {
      iterations: maxLoopIterations,
      branchDecision: "indeterminate",
      capHit: true,
      reason: "Indeterminate while-loop condition"
    };
  }
  if (!decision.value) {
    return {
      iterations: 0,
      branchDecision: "false",
      capHit: false,
      reason: ""
    };
  }
  return {
    iterations: maxLoopIterations,
    branchDecision: "true",
    capHit: true,
    reason: "Condition remains true; loop capped for safety"
  };
}

function detectUnsupportedConstruct(statement) {
  return UNSUPPORTED_KEYWORDS.find((keyword) => new RegExp(`^${keyword}\\b`).test(statement)) ?? null;
}

function createExecutionTrace({ sourceCode, sourcePath, maxLoopIterations }) {
  const lines = String(sourceCode ?? "").split(/\r?\n/);
  const braceMap = buildBraceMap(lines);
  const warnings = [];
  const trace = [];
  const warningKeys = new Set();
  const scopeStack = [];
  const callStack = [];
  const heapState = {
    allocations: 0,
    frees: 0,
    bytesAllocated: 0,
    bytesFreed: 0,
    unknownAllocs: 0,
    unknownFrees: 0
  };
  const heapBindings = new Map();
  let scopeIdCounter = 1;
  let frameIdCounter = 1;
  let unsupportedCount = 0;
  let loopCapHits = 0;

  function pushScope(kind) {
    const scope = {
      scopeId: scopeIdCounter++,
      kind,
      locals: new Map()
    };
    scopeStack.push(scope);
    return scope;
  }

  function popScope() {
    scopeStack.pop();
  }

  function pushFrame(functionName, line, scopeId) {
    callStack.push({
      frameId: frameIdCounter++,
      functionName,
      scopeId,
      line: Number.isInteger(line) ? line : null
    });
  }

  function popFrame() {
    callStack.pop();
  }

  function snapshotScopes() {
    return {
      scopes: scopeStack.map((scope) => ({
        scopeId: scope.scopeId,
        kind: scope.kind,
        locals: Array.from(scope.locals.values()).map((entry) => ({ ...entry }))
      }))
    };
  }

  function snapshotCallStack() {
    return callStack.map((frame) => {
      const scope = scopeStack.find((candidate) => candidate.scopeId === frame.scopeId);
      const entries = scope
        ? Array.from(scope.locals.values()).map((entry) => ({ ...entry }))
        : [];
      return {
        frameId: frame.frameId,
        functionName: frame.functionName,
        scopeId: frame.scopeId,
        line: frame.line,
        params: entries.filter((entry) => entry.kind === VARIABLE_KIND_LABELS.param),
        locals: entries.filter((entry) => entry.kind === VARIABLE_KIND_LABELS.local)
      };
    });
  }

  function countStackEntries(kind) {
    let total = 0;
    scopeStack.forEach((scope) => {
      scope.locals.forEach((entry) => {
        if (entry.kind === kind) {
          total += 1;
        }
      });
    });
    return total;
  }

  function snapshotMemory() {
    const allocations = heapState.allocations;
    const frees = heapState.frees;
    const bytesAllocated = heapState.bytesAllocated;
    const bytesFreed = heapState.bytesFreed;
    return {
      stack: {
        frames: callStack.length,
        locals: countStackEntries(VARIABLE_KIND_LABELS.local),
        params: countStackEntries(VARIABLE_KIND_LABELS.param)
      },
      heap: {
        allocations,
        frees,
        live: Math.max(0, allocations - frees),
        bytesAllocated,
        bytesFreed,
        bytesLive: Math.max(0, bytesAllocated - bytesFreed),
        unknownAllocs: heapState.unknownAllocs,
        unknownFrees: heapState.unknownFrees
      }
    };
  }

  function recordAllocation(bytes) {
    heapState.allocations += 1;
    if (Number.isFinite(bytes)) {
      heapState.bytesAllocated += bytes;
    } else {
      heapState.unknownAllocs += 1;
    }
  }

  function recordFree(bytes) {
    heapState.frees += 1;
    if (Number.isFinite(bytes)) {
      heapState.bytesFreed += bytes;
    } else {
      heapState.unknownFrees += 1;
    }
  }

  function trackAllocation(expression, variableName) {
    const allocation = parseHeapAllocation(expression);
    if (!allocation) {
      return null;
    }
    recordAllocation(allocation.bytes);
    if (variableName) {
      heapBindings.set(
        variableName,
        Number.isFinite(allocation.bytes) ? allocation.bytes : null
      );
    }
    return allocation;
  }

  function trackFree(statement) {
    const free = parseHeapFree(statement);
    if (!free) {
      return null;
    }
    const boundBytes = heapBindings.get(free.variable);
    recordFree(Number.isFinite(boundBytes) ? boundBytes : null);
    heapBindings.delete(free.variable);
    return free;
  }

  function declareVariable(name, value, declaredLine, kind = VARIABLE_KIND_LABELS.local) {
    if (scopeStack.length === 0) {
      return;
    }
    const scope = scopeStack[scopeStack.length - 1];
    scope.locals.set(name, {
      name,
      value,
      kind,
      declaredLine: Number.isInteger(declaredLine) ? declaredLine : null
    });
  }

  function assignVariable(name, value, assignedLine) {
    if (scopeStack.length === 0) {
      return;
    }
    for (let index = scopeStack.length - 1; index >= 0; index -= 1) {
      const scope = scopeStack[index];
      const existing = scope.locals.get(name);
      if (existing) {
        existing.value = value;
        return;
      }
    }
    declareVariable(name, value, assignedLine, VARIABLE_KIND_LABELS.local);
  }

  function registerFunctionParams(paramsText, declaredLine) {
    const paramNames = parseParameterNames(paramsText);
    paramNames.forEach((name) => {
      declareVariable(name, PARAM_PLACEHOLDER_VALUE, declaredLine, VARIABLE_KIND_LABELS.param);
    });
  }

  function pushWarning(payload) {
    const key = `${payload.code}:${payload.line ?? 0}:${payload.message}`;
    if (warningKeys.has(key)) {
      return;
    }
    warningKeys.add(key);
    warnings.push({
      code: payload.code,
      message: payload.message,
      line: Number.isInteger(payload.line) ? payload.line : null
    });
  }

  function pushStep(payload) {
    if (!STEP_EVENT_TYPES.has(payload.eventType)) {
      throw new Error(`Unsupported step event type: ${payload.eventType}`);
    }
    const currentLine = Number.isInteger(payload.line) ? payload.line : null;
    trace.push({
      stepIndex: trace.length + 1,
      eventType: payload.eventType,
      phase: payload.phase ?? "execution",
      line: currentLine,
      column: null,
      currentLine,
      detail: payload.detail ?? "",
      variableSnapshot: snapshotScopes(),
      callStack: snapshotCallStack(),
      memorySnapshot: snapshotMemory(),
      variable: payload.variable,
      value: payload.value,
      decision: payload.decision,
      iteration: payload.iteration,
      loopKind: payload.loopKind
    });
  }

  function simulateBodyRange(range, scopeKind) {
    if (range.isBlock && scopeStack.length > 0) {
      pushScope(scopeKind);
      simulateRange(range.startLine, range.endLine);
      popScope();
      return;
    }
    simulateRange(range.startLine, range.endLine);
  }

  function simulateRange(startLine, endLine) {
    let line = startLine;
    while (line <= endLine && line < lines.length) {
      const rawLine = String(lines[line] ?? "");
      const statement = normalizeCodeLine(rawLine);

      if (isSkippableLine(statement)) {
        line += 1;
        continue;
      }

      const oneIndexedLine = line + 1;
      pushStep({
        eventType: "line-enter",
        line: oneIndexedLine,
        detail: statement
      });

      const unsupportedKeyword = detectUnsupportedConstruct(statement);
      if (unsupportedKeyword) {
        unsupportedCount += 1;
        pushWarning({
          code: "unsupported_construct",
          line: oneIndexedLine,
          message: `Construct '${unsupportedKeyword}' is not fully simulated in Step 1 baseline`
        });
        pushStep({
          eventType: "unsupported",
          line: oneIndexedLine,
          detail: `Unsupported construct encountered: ${unsupportedKeyword}`
        });
        line += 1;
        continue;
      }

      const heapFree = trackFree(statement);
      if (heapFree) {
        pushStep({
          eventType: "statement",
          line: oneIndexedLine,
          detail: `Free heap allocation (${heapFree.kind})`
        });
        line += 1;
        continue;
      }

      if (/^(?:else\s+)?if\s*\(/.test(statement)) {
        const conditionText = extractFirstParenContent(statement);
        const decision = evaluateCondition(conditionText);
        const chosenIfBranch = decision.indeterminate ? true : decision.value;
        if (decision.indeterminate) {
          pushWarning({
            code: "indeterminate_condition",
            line: oneIndexedLine,
            message: "Condition is indeterminate; selected first path deterministically"
          });
        }
        pushStep({
          eventType: "evaluate",
          line: oneIndexedLine,
          detail: `Evaluate condition: ${conditionText ?? "<unknown>"}`,
          decision: decision.indeterminate ? "indeterminate" : decision.value ? "true" : "false"
        });
        pushStep({
          eventType: "branch",
          line: oneIndexedLine,
          detail: chosenIfBranch ? "Taking if branch" : "Taking else branch",
          decision: decision.indeterminate ? "indeterminate" : chosenIfBranch ? "true" : "false"
        });

        const thenRange = resolveStatementRange(lines, braceMap, line);
        const elseLine = findElseLine(lines, thenRange.consumedEndLine);
        let consumedEnd = thenRange.consumedEndLine;

        if (chosenIfBranch) {
          simulateBodyRange(thenRange, SCOPE_KIND_LABELS.block);
        }

        if (elseLine !== null) {
          const elseRange = resolveStatementRange(lines, braceMap, elseLine);
          if (!chosenIfBranch) {
            simulateBodyRange(elseRange, SCOPE_KIND_LABELS.block);
          }
          consumedEnd = elseRange.consumedEndLine;
        }

        line = consumedEnd + 1;
        continue;
      }

      if (/^for\s*\(/.test(statement)) {
        const loopPlan = parseForLoopIterationPlan(statement, maxLoopIterations);
        const bodyRange = resolveStatementRange(lines, braceMap, line);
        const shouldTrack = scopeStack.length > 0;
        let loopCursor =
          loopPlan.loopVariable && Number.isFinite(loopPlan.startValue) ? loopPlan.startValue : null;
        if (loopPlan.branchDecision === "indeterminate") {
          pushWarning({
            code: "indeterminate_condition",
            line: oneIndexedLine,
            message: "For-loop condition is indeterminate; selected first path deterministically"
          });
        }
        if (shouldTrack) {
          pushScope(SCOPE_KIND_LABELS.loop);
          const controlText = extractFirstParenContent(statement);
          const initText = controlText?.split(";")[0]?.trim() ?? "";
          if (initText) {
            const initStatement = `${initText};`;
            const initDeclaration = parseDeclaration(initStatement);
            if (initDeclaration) {
              const initValue = initDeclaration.hasInit
                ? deriveAssignedValue(
                    initDeclaration.name,
                    initDeclaration.operator,
                    initDeclaration.expression
                  )
                : UNINITIALIZED_VALUE;
              declareVariable(initDeclaration.name, initValue, oneIndexedLine);
              if (initDeclaration.hasInit) {
                trackAllocation(initDeclaration.expression, initDeclaration.name);
              }
            } else {
              const initAssignment = parseAssignment(initStatement);
              if (initAssignment) {
                assignVariable(
                  initAssignment.variable,
                  deriveAssignedValue(
                    initAssignment.variable,
                    initAssignment.operator,
                    initAssignment.expression
                  ),
                  oneIndexedLine
                );
                trackAllocation(initAssignment.expression, initAssignment.variable);
              }
            }
          }
          if (loopPlan.loopVariable && Number.isFinite(loopPlan.startValue)) {
            assignVariable(loopPlan.loopVariable, String(loopPlan.startValue), oneIndexedLine);
          }
        }
        pushStep({
          eventType: "evaluate",
          line: oneIndexedLine,
          detail: "Evaluate for-loop condition",
          decision: loopPlan.branchDecision
        });
        pushStep({
          eventType: "branch",
          line: oneIndexedLine,
          detail: loopPlan.iterations > 0 ? "Entering loop body" : "Skipping loop body",
          decision: loopPlan.branchDecision
        });
        for (let iteration = 1; iteration <= loopPlan.iterations; iteration += 1) {
          pushStep({
            eventType: "loop-iteration",
            line: oneIndexedLine,
            detail: `for-loop iteration ${iteration}`,
            iteration,
            loopKind: LOOP_KIND_LABELS.for
          });
          if (bodyRange.isBlock && shouldTrack) {
            pushScope(SCOPE_KIND_LABELS.block);
            simulateRange(bodyRange.startLine, bodyRange.endLine);
            popScope();
          } else {
            simulateRange(bodyRange.startLine, bodyRange.endLine);
          }
          if (loopCursor !== null && Number.isFinite(loopPlan.stepValue)) {
            loopCursor += loopPlan.stepValue;
            assignVariable(loopPlan.loopVariable, String(loopCursor), oneIndexedLine);
          }
        }
        if (loopPlan.capHit) {
          loopCapHits += 1;
          pushWarning({
            code: "loop_iteration_cap_reached",
            line: oneIndexedLine,
            message: `Loop execution capped at ${maxLoopIterations} iterations (${loopPlan.reason})`
          });
        }
        if (shouldTrack) {
          popScope();
        }
        line = bodyRange.consumedEndLine + 1;
        continue;
      }

      if (/^while\s*\(/.test(statement)) {
        const loopPlan = parseWhileLoopIterationPlan(statement, maxLoopIterations);
        const bodyRange = resolveStatementRange(lines, braceMap, line);
        const shouldTrack = scopeStack.length > 0;
        if (loopPlan.branchDecision === "indeterminate") {
          pushWarning({
            code: "indeterminate_condition",
            line: oneIndexedLine,
            message: "While-loop condition is indeterminate; selected first path deterministically"
          });
        }
        pushStep({
          eventType: "evaluate",
          line: oneIndexedLine,
          detail: "Evaluate while-loop condition",
          decision: loopPlan.branchDecision
        });
        pushStep({
          eventType: "branch",
          line: oneIndexedLine,
          detail: loopPlan.iterations > 0 ? "Entering loop body" : "Skipping loop body",
          decision: loopPlan.branchDecision
        });
        for (let iteration = 1; iteration <= loopPlan.iterations; iteration += 1) {
          pushStep({
            eventType: "loop-iteration",
            line: oneIndexedLine,
            detail: `while-loop iteration ${iteration}`,
            iteration,
            loopKind: LOOP_KIND_LABELS.while
          });
          if (bodyRange.isBlock && shouldTrack) {
            pushScope(SCOPE_KIND_LABELS.loop);
            simulateRange(bodyRange.startLine, bodyRange.endLine);
            popScope();
          } else {
            simulateRange(bodyRange.startLine, bodyRange.endLine);
          }
        }
        if (loopPlan.capHit) {
          loopCapHits += 1;
          pushWarning({
            code: "loop_iteration_cap_reached",
            line: oneIndexedLine,
            message: `Loop execution capped at ${maxLoopIterations} iterations (${loopPlan.reason})`
          });
        }
        line = bodyRange.consumedEndLine + 1;
        continue;
      }

      const functionHeader = detectFunctionHeader(statement);
      if (functionHeader) {
        const bodyRange = resolveStatementRange(lines, braceMap, line);
        const functionScope = pushScope(SCOPE_KIND_LABELS.function);
        registerFunctionParams(functionHeader.paramsText, oneIndexedLine);
        pushFrame(functionHeader.name, oneIndexedLine, functionScope.scopeId);
        pushStep({
          eventType: "statement",
          line: oneIndexedLine,
          detail: `Enter function ${functionHeader.name}`
        });
        simulateRange(bodyRange.startLine, bodyRange.endLine);
        popFrame();
        popScope();
        line = bodyRange.consumedEndLine + 1;
        continue;
      }

      const declaration = parseDeclaration(statement);
      if (declaration) {
        if (declaration.hasInit) {
          pushStep({
            eventType: "evaluate",
            line: oneIndexedLine,
            detail: `Evaluate assignment expression for '${declaration.name}'`
          });
          const assignedValue = deriveAssignedValue(
            declaration.name,
            declaration.operator,
            declaration.expression
          );
          declareVariable(declaration.name, assignedValue, oneIndexedLine);
          trackAllocation(declaration.expression, declaration.name);
          pushStep({
            eventType: "assign",
            line: oneIndexedLine,
            detail: `${declaration.name} ${declaration.operator} ${declaration.expression}`,
            variable: declaration.name,
            value: assignedValue
          });
        } else {
          declareVariable(declaration.name, UNINITIALIZED_VALUE, oneIndexedLine);
          pushStep({
            eventType: "statement",
            line: oneIndexedLine,
            detail: `Declare variable ${declaration.name}`
          });
        }
        line += 1;
        continue;
      }

      const assignment = parseAssignment(statement);
      if (assignment) {
        pushStep({
          eventType: "evaluate",
          line: oneIndexedLine,
          detail: `Evaluate assignment expression for '${assignment.variable}'`
        });
        const assignedValue = deriveAssignedValue(
          assignment.variable,
          assignment.operator,
          assignment.expression
        );
        assignVariable(assignment.variable, assignedValue, oneIndexedLine);
        trackAllocation(assignment.expression, assignment.variable);
        pushStep({
          eventType: "assign",
          line: oneIndexedLine,
          detail: `${assignment.variable} ${assignment.operator} ${assignment.expression}`,
          variable: assignment.variable,
          value: assignedValue
        });
        line += 1;
        continue;
      }

      if (/^return\b/.test(statement)) {
        trackAllocation(statement, null);
        pushStep({
          eventType: "return",
          line: oneIndexedLine,
          detail: "Return statement reached"
        });
        line += 1;
        continue;
      }

      const inlineAllocation = trackAllocation(statement, null);
      pushStep({
        eventType: "statement",
        line: oneIndexedLine,
        detail: inlineAllocation ? `Heap allocation (${inlineAllocation.kind})` : "Execute statement"
      });
      line += 1;
    }
  }

  simulateRange(0, lines.length - 1);
  pushStep({
    eventType: "end",
    phase: "completed",
    line: null,
    detail: "Simulation completed"
  });

  const simulatedLines = new Set(trace.map((item) => item.currentLine).filter((item) => item !== null))
    .size;
  const status = unsupportedCount > 0 || warnings.length > 0 ? "partial" : "ok";
  return {
    status,
    engine: "execution-simulator-v1",
    language: SUPPORTED_LANGUAGE,
    sourcePath,
    maxLoopIterations,
    executionTrace: trace,
    warnings,
    summary: {
      totalSteps: trace.length,
      simulatedLines,
      unsupportedCount,
      warningCount: warnings.length,
      loopCapHits
    },
    currentLine: null,
    phase: "completed"
  };
}

function createExecutionSimulatorService(options = {}) {
  assertNonEmptyString(options.projectRoot, "projectRoot");
  if (typeof options.toProjectPath !== "function") {
    throw new Error("toProjectPath must be function");
  }

  return Object.freeze({
    async simulate(payload = {}) {
      const sourcePath = options.toProjectPath(payload.sourcePath ?? "workspace\\main.cpp");
      const maxLoopIterations = normalizeLoopCap(payload.maxLoopIterations);
      const language = payload.language ?? SUPPORTED_LANGUAGE;
      assertLanguage(language);

      let sourceCode = "";
      if (typeof payload.code === "string") {
        sourceCode = payload.code;
      } else {
        sourceCode = await fs.readFile(sourcePath, "utf8");
      }

      return createExecutionTrace({
        sourceCode,
        sourcePath,
        maxLoopIterations
      });
    }
  });
}

module.exports = {
  createExecutionSimulatorService,
  createExecutionTrace
};

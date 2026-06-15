const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createExecutionSimulatorService,
  createExecutionTrace
} = require("./executionSimulatorService");

test("trace emits baseline events for assignment and control flow", () => {
  const sourceCode = [
    "int main() {",
    "  int x = 0;",
    "  if (x < 10) {",
    "    x = x + 1;",
    "  }",
    "  for (int i = 0; i < 2; ++i) {",
    "    x += i;",
    "  }",
    "  return x;",
    "}"
  ].join("\n");

  const result = createExecutionTrace({
    sourceCode,
    sourcePath: "workspace\\main.cpp",
    maxLoopIterations: 20
  });

  const eventTypes = new Set(result.executionTrace.map((item) => item.eventType));
  assert.equal(result.language, "cpp");
  assert.ok(eventTypes.has("assign"));
  assert.ok(eventTypes.has("branch"));
  assert.ok(eventTypes.has("loop-iteration"));
  assert.ok(eventTypes.has("return"));
  assert.equal(result.executionTrace.at(-1).eventType, "end");
});

test("trace captures variable snapshots with scoping", () => {
  const sourceCode = [
    "int main(int argc, char** argv) {",
    "  int x = 1;",
    "  if (x > 0) {",
    "    int y = 2;",
    "    x += y;",
    "  }",
    "  return x;",
    "}"
  ].join("\n");

  const result = createExecutionTrace({
    sourceCode,
    sourcePath: "workspace\\main.cpp",
    maxLoopIterations: 20
  });

  const assignX = result.executionTrace.find(
    (step) => step.eventType === "assign" && step.variable === "x"
  );
  assert.ok(assignX?.variableSnapshot);
  assert.ok(assignX?.callStack);
  const functionScope = assignX.variableSnapshot.scopes[0];
  const paramNames = functionScope.locals
    .filter((item) => item.kind === "param")
    .map((item) => item.name);
  assert.ok(paramNames.includes("argc"));
  assert.ok(paramNames.includes("argv"));
  const callStackFrame = assignX.callStack.at(-1);
  assert.ok(callStackFrame);
  assert.equal(callStackFrame.functionName, "main");
  const stackParamNames = callStackFrame.params.map((item) => item.name);
  assert.ok(stackParamNames.includes("argc"));
  assert.ok(stackParamNames.includes("argv"));
  const stackLocalNames = callStackFrame.locals.map((item) => item.name);
  assert.ok(stackLocalNames.includes("x"));

  const assignY = result.executionTrace.find(
    (step) => step.eventType === "assign" && step.variable === "y"
  );
  assert.ok(assignY);
  assert.equal(assignY.variableSnapshot.scopes.length, 2);
  const innerScopeNames = assignY.variableSnapshot.scopes[1].locals.map((item) => item.name);
  assert.ok(innerScopeNames.includes("y"));

  const returnStep = result.executionTrace.find((step) => step.eventType === "return");
  const returnNames = returnStep.variableSnapshot.scopes.flatMap((scope) =>
    scope.locals.map((item) => item.name)
  );
  assert.ok(!returnNames.includes("y"));
});

test("trace captures heap summary for allocations", () => {
  const sourceCode = [
    "int main() {",
    "  int* p = new int;",
    "  int* q = (int*)malloc(32);",
    "  delete p;",
    "  free(q);",
    "  return 0;",
    "}"
  ].join("\n");
  const result = createExecutionTrace({
    sourceCode,
    sourcePath: "workspace\\main.cpp",
    maxLoopIterations: 20
  });
  const endStep = result.executionTrace.at(-1);
  assert.ok(endStep?.memorySnapshot);
  const heap = endStep.memorySnapshot.heap;
  assert.equal(heap.allocations, 2);
  assert.equal(heap.frees, 2);
  assert.equal(heap.live, 0);
  assert.equal(heap.bytesAllocated, 32);
  assert.equal(heap.bytesFreed, 32);
  assert.equal(heap.unknownAllocs, 1);
  assert.equal(heap.unknownFrees, 1);
});

test("trace caps indeterminate while loops and emits warning", () => {
  const sourceCode = ["int main() {", "  while (ready) {", "    x += 1;", "  }", "}"].join("\n");
  const result = createExecutionTrace({
    sourceCode,
    sourcePath: "workspace\\main.cpp",
    maxLoopIterations: 3
  });

  assert.equal(result.summary.loopCapHits, 1);
  assert.ok(result.warnings.some((item) => item.code === "loop_iteration_cap_reached"));
});

test("trace returns partial status for unsupported constructs", () => {
  const sourceCode = ["int main() {", "  switch (x) {", "    default: break;", "  }", "}"].join("\n");
  const result = createExecutionTrace({
    sourceCode,
    sourcePath: "workspace\\main.cpp",
    maxLoopIterations: 20
  });

  assert.equal(result.status, "partial");
  assert.ok(result.warnings.some((item) => item.code === "unsupported_construct"));
});

test("service uses provided code and resolves source path", async () => {
  const service = createExecutionSimulatorService({
    projectRoot: "C:\\project",
    toProjectPath: (inputPath) => `C:\\project\\${inputPath}`
  });
  const result = await service.simulate({
    language: "cpp",
    sourcePath: "workspace\\main.cpp",
    code: "int main() { return 0; }",
    maxLoopIterations: 20
  });

  assert.equal(result.sourcePath, "C:\\project\\workspace\\main.cpp");
  assert.ok(result.executionTrace.length >= 1);
});

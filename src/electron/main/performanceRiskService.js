const fs = require("node:fs");
const path = require("node:path");
const {
  buildFeatureVector,
  parseAnalyzeStdout,
  humanizeFeatureName
} = require("./performanceRiskFeatures");

function createPerformanceRiskService(options = {}) {
  const projectRoot = options.projectRoot;
  const toProjectPath = options.toProjectPath;
  const runProcess = options.runProcess;
  const pythonCommand = options.pythonCommand ?? "python";

  if (typeof projectRoot !== "string" || projectRoot.trim().length === 0) {
    throw new Error("projectRoot must be non-empty string");
  }
  if (typeof toProjectPath !== "function") {
    throw new Error("toProjectPath must be function");
  }
  if (typeof runProcess !== "function") {
    throw new Error("runProcess must be function");
  }

  const modelPath = toProjectPath(options.modelPath ?? "resources\\ml_models\\performance_risk.joblib");

  // In packaged builds, use frozen PyInstaller executable; otherwise use Python script
  const isFrozen = process.env.CORTEX_PYTHON_FROZEN === "true";
  const driverPath = isFrozen
    ? path.join(process.resourcesPath ?? projectRoot, "python", "performance_risk_driver.exe")
    : path.join(projectRoot, "src", "electron", "main", "py", "performance_risk_driver.py");
  const driverCommand = isFrozen ? driverPath : pythonCommand;
  const driverArgs = isFrozen
    ? ["--model", modelPath]
    : [driverPath, "--model", modelPath];

  function unavailable(reason) {
    return {
      status: "unavailable",
      reason,
      riskClass: null,
      probability: null,
      confidenceBand: null,
      probabilities: null,
      topCauses: []
    };
  }

  function decorateCauses(causes) {
    return (causes ?? []).map((item) => ({
      ...item,
      label: humanizeFeatureName(item.feature)
    }));
  }

  return Object.freeze({
    async predictFromAnalyzeResult(analyzeResult) {
      if (!analyzeResult || analyzeResult.code !== 0) {
        return unavailable("analyze_failed");
      }

      const analyzePayload = parseAnalyzeStdout(analyzeResult.stdout);
      if (!analyzePayload?.features) {
        return unavailable("analyze_payload_missing_features");
      }

      if (!fs.existsSync(modelPath)) {
        return unavailable("model_not_found");
      }

      const features = buildFeatureVector(analyzePayload, projectRoot);
      const inputJson = JSON.stringify({ features });

      const driverResult = await runProcess(
        driverCommand,
        driverArgs,
        {
          cwd: projectRoot,
          input: inputJson
        }
      );

      if (driverResult.code !== 0) {
        return {
          status: "error",
          reason: driverResult.stderr || "prediction_failed",
          riskClass: null,
          probability: null,
          confidenceBand: null,
          probabilities: null,
          topCauses: []
        };
      }

      let parsed;
      try {
        parsed = JSON.parse(driverResult.stdout);
      } catch {
        return {
          status: "error",
          reason: "invalid_prediction_json",
          riskClass: null,
          probability: null,
          confidenceBand: null,
          probabilities: null,
          topCauses: []
        };
      }

      return {
        ...parsed,
        topCauses: decorateCauses(parsed.topCauses)
      };
    }
  });
}

module.exports = {
  createPerformanceRiskService
};

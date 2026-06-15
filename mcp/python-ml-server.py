import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from mcp.server.fastmcp import FastMCP
from sklearn.ensemble import RandomForestClassifier

mcp = FastMCP("cortex-python-ml")


@mcp.tool()
def train_random_forest(
    csv_path: str,
    target_column: str,
    model_output_path: str = "mcp/model-random-forest.joblib",
    n_estimators: int = 300,
    random_state: int = 42,
) -> dict[str, Any]:
    """
    Train a RandomForest model from CSV data and save it.
    """
    df = pd.read_csv(csv_path)
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")

    X = df.drop(columns=[target_column])
    y = df[target_column]
    model = RandomForestClassifier(n_estimators=n_estimators, random_state=random_state)
    model.fit(X, y)

    output = Path(model_output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "feature_order": list(X.columns)}, output)
    return {
        "model_path": str(output),
        "rows": int(df.shape[0]),
        "features": list(X.columns),
        "target_column": target_column,
    }


@mcp.tool()
def predict_random_forest(model_path: str, features_json: str) -> dict[str, Any]:
    """
    Predict using a saved RandomForest model.
    features_json example:
    {"feature_a": 1.2, "feature_b": 0.7}
    """
    payload = joblib.load(model_path)
    model = payload["model"]
    feature_order = payload["feature_order"]

    feature_map = json.loads(features_json)
    row = [[feature_map.get(name) for name in feature_order]]
    prediction = model.predict(row)[0]
    probs = getattr(model, "predict_proba", None)
    probabilities = probs(row)[0].tolist() if callable(probs) else None

    return {
        "prediction": prediction.item() if hasattr(prediction, "item") else prediction,
        "probabilities": probabilities,
        "feature_order": feature_order,
    }


@mcp.tool()
def explain_diagnostic(diagnostic_text: str) -> dict[str, str]:
    """
    Provide structured NLP-style explanation for compiler or runtime diagnostics.
    """
    lower = diagnostic_text.lower()
    if "undefined reference" in lower:
        category = "linker-error"
        summary = "A symbol was declared/used but not linked from object files or libraries."
        fix = "Check missing source files in target, link order, and required libraries."
    elif "no matching function" in lower:
        category = "type-signature-error"
        summary = "No function overload matches the call expression."
        fix = "Verify argument types/count, template deduction, and const/reference qualifiers."
    else:
        category = "general-diagnostic"
        summary = "Diagnostic requires context-specific investigation."
        fix = "Inspect nearest callsite/declaration and rebuild with full warning output."

    return {"category": category, "summary": summary, "suggested_fix": fix}


if __name__ == "__main__":
    mcp.run()

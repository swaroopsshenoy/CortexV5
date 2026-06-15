import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np


def project_root() -> Path:
    return Path(__file__).resolve().parents[4]


def confidence_band(probability: float) -> str:
    if probability >= 0.75:
        return "high"
    if probability >= 0.5:
        return "medium"
    return "low"


def top_causes(
    feature_order: list[str],
    feature_values: dict[str, float],
    importances: list[float],
    feature_means: dict[str, float],
    limit: int = 5,
) -> list[dict]:
    scored = []
    for index, feature in enumerate(feature_order):
        value = float(feature_values.get(feature, 0.0))
        mean = float(feature_means.get(feature, 0.0))
        deviation = abs(value - mean)
        contribution = float(importances[index]) * (1.0 + deviation)
        scored.append(
            {
                "feature": feature,
                "value": value,
                "contribution": contribution,
            }
        )
    scored.sort(key=lambda item: item["contribution"], reverse=True)
    return scored[:limit]


def predict_payload(model_path: Path, features: dict[str, float]) -> dict:
    payload = joblib.load(model_path)
    model = payload["model"]
    feature_order = payload["feature_order"]
    feature_means = payload.get("feature_means") or {}

    row = [[float(features.get(name, 0.0)) for name in feature_order]]
    prediction = model.predict(row)[0]
    probabilities = model.predict_proba(row)[0]
    classes = list(model.classes_)
    probability_map = {classes[index]: float(probabilities[index]) for index in range(len(classes))}
    predicted_probability = float(probability_map.get(prediction, max(probabilities)))

    importances = getattr(model, "feature_importances_", np.zeros(len(feature_order)))
    causes = top_causes(feature_order, features, list(importances), feature_means)

    return {
        "status": "ok",
        "riskClass": str(prediction),
        "probability": predicted_probability,
        "confidenceBand": confidence_band(predicted_probability),
        "probabilities": probability_map,
        "topCauses": causes,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--input-json", default="-")
    args = parser.parse_args()

    model_path = Path(args.model)
    if not model_path.exists():
        sys.stderr.write(f"MODEL_NOT_FOUND: {model_path}\n")
        return 2

    raw = sys.stdin.read() if args.input_json == "-" else Path(args.input_json).read_text(encoding="utf-8")
    try:
        request = json.loads(raw)
    except json.JSONDecodeError as error:
        sys.stderr.write(f"INVALID_JSON: {error}\n")
        return 3

    features = request.get("features")
    if not isinstance(features, dict):
        sys.stderr.write("INVALID_FEATURES: expected object\n")
        return 4

    response = predict_payload(model_path, features)
    sys.stdout.write(json.dumps(response))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

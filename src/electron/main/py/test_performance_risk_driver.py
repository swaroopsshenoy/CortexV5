import json
import tempfile
import unittest
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

from feature_spec import load_feature_columns
from performance_risk_driver import predict_payload


class PerformanceRiskDriverTest(unittest.TestCase):
    def test_predict_payload_returns_risk_and_causes(self) -> None:
        columns = load_feature_columns()
        X = np.array([[1.0] * len(columns), [5.0] * len(columns)])
        y = np.array(["risk_low", "risk_high"])
        model = RandomForestClassifier(n_estimators=20, random_state=7)
        model.fit(X, y)

        with tempfile.TemporaryDirectory() as temp_dir:
            model_path = Path(temp_dir) / "model.joblib"
            feature_means = {name: 2.0 for name in columns}
            joblib.dump(
                {
                    "model": model,
                    "feature_order": columns,
                    "feature_means": feature_means,
                },
                model_path,
            )
            features = {name: 5.0 for name in columns}
            result = predict_payload(model_path, features)

        self.assertEqual(result["status"], "ok")
        self.assertIn(result["riskClass"], {"risk_low", "risk_high"})
        self.assertTrue(result["topCauses"])
        self.assertIn("contribution", result["topCauses"][0])


if __name__ == "__main__":
    unittest.main()

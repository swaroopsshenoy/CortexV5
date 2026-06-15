import json
import unittest
from io import StringIO
import sys

from nlp_refine_driver import refine_item


class NlpRefineDriverTest(unittest.TestCase):
    def test_refine_item_polishes_text_and_dedupes_actions(self) -> None:
        refined = refine_item(
            {
                "id": "demo",
                "title": "high risk",
                "summary": "model says risk",
                "explanation": "nested loops detected",
                "actions": ["check loops", "check loops", "profile code"],
            }
        )
        self.assertTrue(refined["summary"].endswith("."))
        self.assertEqual(len(refined["actions"]), 2)


if __name__ == "__main__":
    unittest.main()

import json
import os
import re
import sys
from pathlib import Path


def polish_sentence(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", str(text or "")).strip()
    if not cleaned:
        return ""
    if cleaned[-1] not in ".!?":
        cleaned = f"{cleaned}."
    return cleaned[0].upper() + cleaned[1:]


def refine_item(item: dict) -> dict:
    actions = item.get("actions") or []
    polished_actions = []
    seen = set()
    for action in actions:
        polished = polish_sentence(action)
        key = polished.lower()
        if not polished or key in seen:
            continue
        seen.add(key)
        polished_actions.append(polished)

    return {
        "id": item.get("id"),
        "title": polish_sentence(item.get("title")),
        "summary": polish_sentence(item.get("summary")),
        "explanation": polish_sentence(item.get("explanation")),
        "actions": polished_actions[:6],
    }


def refine_with_transformers(items: list[dict]) -> list[dict] | None:
    model_path = os.environ.get("CORTEX_NLP_MODEL_PATH", "").strip()
    if not model_path:
        return None
    try:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer  # type: ignore
        import torch  # type: ignore
    except ImportError:
        return None

    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_path)

    refined: list[dict] = []
    for item in items:
        prompt = (
            "Rewrite this C++ explanation for a beginner. Keep facts, be concise.\n"
            f"Summary: {item.get('summary', '')}\n"
            f"Explanation: {item.get('explanation', '')}"
        )
        encoded = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
        with torch.no_grad():
            output = model.generate(**encoded, max_new_tokens=120)
        rewritten = tokenizer.decode(output[0], skip_special_tokens=True)
        updated = dict(item)
        if rewritten.strip():
            updated["explanation"] = polish_sentence(rewritten)
        refined.append(refine_item(updated))
    return refined


def main() -> int:
    raw = sys.stdin.read()
    try:
        request = json.loads(raw)
    except json.JSONDecodeError as error:
        sys.stderr.write(f"INVALID_JSON: {error}\n")
        return 2

    items = request.get("items")
    if not isinstance(items, list):
        sys.stderr.write("INVALID_ITEMS: expected list\n")
        return 3

    engine = "rule_fallback"
    refined = refine_with_transformers(items)
    if refined is None:
        refined = [refine_item(item) for item in items]
    else:
        engine = "transformers"

    sys.stdout.write(json.dumps({"engine": engine, "items": refined}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

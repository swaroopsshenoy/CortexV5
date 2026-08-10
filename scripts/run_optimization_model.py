#!/usr/bin/env python3
"""Run DeepSeek-Coder-1.3B-Instruct for C++ code optimization on stdin.

Uses HuggingFace transformers (already installed) — no llama-cpp-python build needed.
Model loaded in float16 to halve memory usage (~2.6GB → ~1.3GB RAM).
"""

import sys
import os
import re
import subprocess
import tempfile
from pathlib import Path
import gc
import warnings

warnings.filterwarnings("ignore")

try:
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM
except ImportError:
    print("Missing ML libraries. pip install torch transformers", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "resources" / "ml_models" / "code_optimization_model"

SYSTEM_PROMPT = """You are a C++ optimization expert. Given unoptimized C++ code, return ONLY the optimized version.
Rules:
- Preserve correctness and functionality
- Improve time/space complexity where possible
- Remove dead code, redundant loops, unnecessary operations
- Use efficient algorithms (two-pointer, prefix sums, hash maps, etc.)
- Keep the same function signatures and main() structure
- Output ONLY valid compilable C++ code, no explanations, no markdown fences"""


def validate_cpp_output(code: str) -> bool:
    """Check if output is valid C++ by compiling with -fsyntax-only."""
    if not code or len(code.strip()) < 20:
        return False

    # Quick heuristic checks before invoking compiler
    # Must contain at least basic C++ structure
    if not any(kw in code for kw in ["int ", "void ", "return", "#include", "main"]):
        return False

    # Check for garbled output patterns (repeated fragments, missing brackets)
    open_braces = code.count("{")
    close_braces = code.count("}")
    if open_braces == 0 and close_braces == 0:
        return False
    if abs(open_braces - close_braces) > 1:
        return False
    
    open_parens = code.count("(")
    close_parens = code.count(")")
    if abs(open_parens - close_parens) > 1:
        return False

    # Try actual compilation
    try:
        with tempfile.NamedTemporaryFile(suffix=".cpp", delete=False, mode="w", encoding="utf-8") as f:
            f.write(code)
            temp_path = f.name
        
        res = subprocess.run(
            ["clang++", "-fsyntax-only", "-w", temp_path],
            capture_output=True, text=True, timeout=5
        )
        if res.returncode != 0:
            # Try g++ as fallback
            res = subprocess.run(
                ["g++", "-fsyntax-only", "-w", temp_path],
                capture_output=True, text=True, timeout=5
            )
        return res.returncode == 0
    except Exception:
        # If no compiler available, accept if heuristics passed
        return True
    finally:
        try:
            Path(temp_path).unlink()
        except Exception:
            pass


def format_code(code: str) -> str:
    """Format C++ code using clang-format."""
    try:
        proc = subprocess.run(
            ["clang-format"],
            input=code, text=True,
            capture_output=True, check=True, timeout=5
        )
        return proc.stdout
    except Exception:
        return code


def strip_markdown_fences(text: str) -> str:
    """Remove markdown code fences or extract C++ code block from model output."""
    text = text.strip()
    
    # 1. If there's an explicit ```cpp or ``` code block, extract its contents
    matches = re.findall(r'```(?:cpp|c\+\+)?\s*\n(.*?)```', text, re.DOTALL)
    if matches:
        # Return the last or largest code block
        return max(matches, key=len).strip()

    # 2. If text starts with ``` or ends with ```
    pattern = r'^```(?:cpp|c\+\+)?\s*\n(.*?)```\s*$'
    match = re.match(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # 3. If there is conversational prefix before #include or function definition, extract from first C++ keyword
    cpp_start = re.search(r'(#include|int\s+main|void|int\s+\w+)', text)
    if cpp_start:
        return text[cpp_start.start():].strip()

    return text


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    # Check for model — either a directory with model files, or give download instructions
    config_path = MODEL_DIR / "config.json"
    if not config_path.exists():
        print(f"Error: Model not found at {MODEL_DIR}", file=sys.stderr)
        print(f"Run: python scripts/download_model.py", file=sys.stderr)
        sys.exit(1)

    code = sys.stdin.read().strip()
    if not code:
        print(code)
        return 0

    try:
        # Load tokenizer and model
        tokenizer = AutoTokenizer.from_pretrained(
            str(MODEL_DIR),
            trust_remote_code=True
        )
        
        # Determine device
        if torch.cuda.is_available():
            device = "cuda"
            print("Using CUDA GPU", file=sys.stderr)
        else:
            device = "cpu"
            print("Using CPU (slower inference)", file=sys.stderr)

        model = AutoModelForCausalLM.from_pretrained(
            str(MODEL_DIR),
            dtype=torch.float16,
            low_cpu_mem_usage=True,
            trust_remote_code=True,
        ).to(device)
        model.eval()

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a C++ code optimization tool. Optimize the provided C++ program to run as fast as possible.\n"
                    "- Replace inefficient O(N^2) nested loops with optimal O(N) or O(N log N) algorithms (such as two pointers, prefix sums, binary search, or hash maps).\n"
                    "- Delete empty or useless loops.\n"
                    "- Return ONLY valid executable C++ code. No markdown fences, no explanations, no extra text."
                )
            },
            {
                "role": "user",
                "content": f"Optimize this C++ program to improve its time complexity:\n\n{code}"
            }
        ]

        if hasattr(tokenizer, "apply_chat_template"):
            prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        else:
            prompt = (
                f"### System:\n{messages[0]['content']}\n\n"
                f"### User:\n{messages[1]['content']}\n\n"
                f"### Response:\n"
            )

        inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048).to(device)
        prompt_length = inputs["input_ids"].shape[1]

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=1024,
                do_sample=False,
                pad_token_id=tokenizer.eos_token_id,
                eos_token_id=tokenizer.eos_token_id,
            )

        generated_tokens = outputs[0][prompt_length:]
        raw_output = tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()
        # Clean byte-fallback characters if present
        raw_output = raw_output.replace("Ġ", " ").replace("Ċ", "\n").replace("\u0120", " ").replace("\u010a", "\n")
        optimized_code = strip_markdown_fences(raw_output)

        # Free model memory immediately
        del model, tokenizer, inputs, outputs
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        # Validate the output is real C++
        if validate_cpp_output(optimized_code) and optimized_code != code:
            optimized_code = format_code(optimized_code)
            print(optimized_code)
        else:
            # Model output invalid or identical — return original
            print(f"Debug Raw Output:\n{optimized_code}\n", file=sys.stderr)
            print(f"Warning: Model output failed validation, returning original code", file=sys.stderr)
            print(code)

    except Exception as e:
        print(f"Inference error: {e}", file=sys.stderr)
        sys.exit(1)

    return 0

if __name__ == "__main__":
    sys.exit(main())

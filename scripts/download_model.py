#!/usr/bin/env python3
"""Download DeepSeek-Coder-1.3B-Instruct model for code optimization."""

import sys
import os
from pathlib import Path

try:
    from huggingface_hub import snapshot_download
except ImportError:
    print("Installing huggingface_hub...")
    os.system(f"{sys.executable} -m pip install huggingface_hub")
    from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "resources" / "ml_models" / "code_optimization_model"

REPO_ID = "deepseek-ai/deepseek-coder-1.3b-instruct"


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    config_path = MODEL_DIR / "config.json"

    # Check if model already has DeepSeek files
    if config_path.exists():
        content = config_path.read_text()
        if "DeepseekForCausalLM" in content or "deepseek" in content.lower():
            print(f"Model already downloaded at {MODEL_DIR}")
            return 0
        else:
            # Old T5 model — clean it up
            print("Removing old T5 model files...")
            for f in MODEL_DIR.iterdir():
                if f.is_file():
                    f.unlink()
                    print(f"  Deleted {f.name}")

    print(f"Downloading {REPO_ID}...")
    print(f"Destination: {MODEL_DIR}")
    print("This will download ~2.6GB. Please wait...\n")

    snapshot_download(
        repo_id=REPO_ID,
        local_dir=str(MODEL_DIR),
        ignore_patterns=["*.md", "*.txt", ".gitattributes"],
    )

    # Verify
    if (MODEL_DIR / "config.json").exists():
        total_size = sum(f.stat().st_size for f in MODEL_DIR.rglob("*") if f.is_file())
        print(f"\nDone! Model saved to {MODEL_DIR}")
        print(f"Total size: {total_size / (1024**3):.1f} GB")
    else:
        print("Download may have failed.", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())

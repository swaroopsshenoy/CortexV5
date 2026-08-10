#!/usr/bin/env python3
"""Train a Seq2Seq model (CodeT5) for C++ code optimization using dataset.jsonl."""

import argparse
import json
import os
from pathlib import Path

# Force CPU for local quick training if no GPU is explicitly desired, 
# though HuggingFace will auto-detect GPU if available.

try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, Trainer, TrainingArguments, DataCollatorForSeq2Seq
    from datasets import Dataset
except ImportError as e:
    print(f"Missing required ML libraries. Please install them: {e}")
    print("pip install torch transformers datasets")
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET = ROOT / "resources" / "ml_performance_dataset" / "dataset.jsonl"
DEFAULT_OUTPUT_DIR = ROOT / "resources" / "ml_models" / "code_optimization_model"

def main():
    parser = argparse.ArgumentParser(description="Train Code Optimization Seq2Seq Model")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET, help="Path to dataset.jsonl")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_DIR, help="Path to save the model")
    parser.add_argument("--model-name", type=str, default="t5-small", help="Base model to fine-tune")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=4, help="Training batch size")
    args = parser.parse_args()

    if not args.dataset.exists():
        print(f"Error: Dataset not found at {args.dataset}")
        return 1

    print(f"Loading dataset from {args.dataset}...")
    data = []
    with open(args.dataset, "r", encoding="utf-8") as f:
        content = f.read().strip()
        
    if '\n' in content:
        # Standard JSONL (lines separated by physical newlines)
        items_raw = [line for line in content.splitlines() if line.strip()]
        is_legacy = False
    else:
        # Legacy backslash-n format
        items_raw = content.split('}\\n{')
        is_legacy = True

    for i, s in enumerate(items_raw):
        if is_legacy:
            if i > 0:
                s = '{' + s
            if i < len(items_raw) - 1:
                s = s + '}'
        try:
            item = json.loads(s)
            data.append({
                "unoptimized": item.get("unoptimized", ""),
                "optimized": item.get("optimized", "")
            })
        except json.JSONDecodeError as e:
            print(f"Skipping an item due to decode error: {e}")
            continue

    if not data:
        print("Dataset is empty or invalid.")
        return 1

    print(f"Loaded {len(data)} examples. Initializing {args.model_name}...")
    
    from transformers import T5Tokenizer, T5ForConditionalGeneration
    tokenizer = T5Tokenizer.from_pretrained(args.model_name, legacy=False)
    model = T5ForConditionalGeneration.from_pretrained(args.model_name)

    # Convert to HuggingFace Dataset
    hf_dataset = Dataset.from_list(data)

    def preprocess_function(examples):
        def escape_cpp(code):
            return (code.replace("<", "xleftangle")
                        .replace(">", "xrightangle")
                        .replace("{", "xleftbrace")
                        .replace("}", "xrightbrace")
                        .replace("^", "xcaret")
                        .replace("~", "xtilde"))

        inputs = [
            escape_cpp("Optimize this C++ code: " + code)
            for code in examples["unoptimized"]
        ]
        targets = [
            escape_cpp(code)
            for code in examples["optimized"]
        ]
        
        model_inputs = tokenizer(inputs, max_length=512, truncation=True, padding="max_length")
        
        # Tokenize targets
        labels = tokenizer(text_target=targets, max_length=512, truncation=True, padding="max_length")
        
        model_inputs["labels"] = labels["input_ids"]
        return model_inputs

    print("Tokenizing dataset...")
    tokenized_dataset = hf_dataset.map(preprocess_function, batched=True)
    
    # Split into train/val
    split = tokenized_dataset.train_test_split(test_size=0.1, seed=42)
    train_dataset = split["train"]
    eval_dataset = split["test"]

    data_collator = DataCollatorForSeq2Seq(tokenizer, model=model, padding=True)

    print("Setting up Trainer...")
    training_args = TrainingArguments(
        output_dir=str(args.output / "checkpoints"),
        eval_strategy="epoch",
        learning_rate=3e-4,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        num_train_epochs=args.epochs,
        weight_decay=0.01,
        warmup_steps=50,
        save_total_limit=2,
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        logging_dir=str(args.output / "logs"),
        logging_steps=10,
        report_to="none"
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
        processing_class=tokenizer,
    )

    print("Starting training...")
    trainer.train()

    print(f"Saving fine-tuned model and tokenizer to {args.output}...")
    args.output.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)
    
    print("Training complete! Consider adding AST validation to your pipeline to prevent hallucinations during inference.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

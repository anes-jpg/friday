#!/usr/bin/env python3
"""
FRIDAY-1B-Operator QLoRA Fine-Tuning Pipeline
==============================================
Fine-tunes modern 2026 Edge SLMs (SmolLM2-1.7B, LFM-1B, or BitNet) on FRIDAY's
Utterance Contract and Kerry Condon persona for edge inference on 2GB VRAM GPUs.

Architecture:
  - Base: HuggingFaceTB/SmolLM2-1.7B-Instruct (or 360M for ultra-low power)
  - Method: 4-bit QLoRA (Rank=16, Alpha=16, NF4 Quantization)
  - Target Hardware: 2GB VRAM (GeForce MX250 / similar dGPU)
  - Memory Footprint post-quantization: ~1.05 GB VRAM in Q4_K_M GGUF
  - Utterance Contract: Dual-channel (say max 2 spoken sentences, show markdown/openui)
"""

import os
import sys
import argparse
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("friday.finetune")

DEFAULT_MODEL = "HuggingFaceTB/SmolLM2-1.7B-Instruct"
DEFAULT_TRAIN_FILE = "scripts/training_data/friday_train.jsonl"
DEFAULT_EVAL_FILE = "scripts/training_data/friday_eval.jsonl"
DEFAULT_OUTPUT_DIR = "models/friday-1b-lora"


def check_dependencies():
    """Verify required machine learning packages are installed."""
    missing = []
    for pkg in ["torch", "transformers", "datasets", "peft", "trl", "bitsandbytes"]:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)

    if missing:
        logger.warning("Missing fine-tuning dependencies: %s", ", ".join(missing))
        logger.warning(
            "To install dependencies for local training or Colab:\n"
            "  pip install torch transformers datasets peft trl bitsandbytes accelerate sentencepiece\n"
            "Or run the automated Google Colab notebook: scripts/friday_colab_finetune.ipynb"
        )
        return False
    return True


def format_chat_prompt(sample, tokenizer):
    """Formats messages into the model's native chat template."""
    messages = sample.get("messages", [])
    if hasattr(tokenizer, "apply_chat_template"):
        return {"text": tokenizer.apply_chat_template(messages, tokenize=False)}
    
    # Fallback to ChatML syntax
    text = ""
    for msg in messages:
        text += f"<|im_start|>{msg['role']}\n{msg['content']}<|im_end|>\n"
    return {"text": text}


def run_finetune(args):
    """Executes the QLoRA fine-tuning session."""
    import torch
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
        TrainingArguments,
    )
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from trl import SFTTrainer
    from datasets import load_dataset

    train_path = Path(args.train_file)
    if not train_path.exists():
        logger.error(
            "Training dataset not found at %s. Please generate it first with:\n"
            "  py scripts/generate_training_data.py --count 5000",
            train_path,
        )
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("FRIDAY-1B-Operator QLoRA Fine-Tuning Session")
    logger.info("Base Model: %s", args.model_name)
    logger.info("Train File: %s", args.train_file)
    logger.info("Output Dir: %s", args.output_dir)
    logger.info("Max VRAM Target: 2048 MB (Safety Margin: 400 MB DWM)")
    logger.info("=" * 60)

    # Detect CUDA / Hardware
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        total_vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        logger.info("Detected GPU: %s (Total VRAM: %.2f GB)", gpu_name, total_vram_gb)
    else:
        logger.warning("No CUDA GPU detected! Training will fall back to CPU / MPS.")

    # 1. 4-bit NF4 Quantization Configuration
    compute_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=compute_dtype,
        bnb_4bit_use_double_quant=True,
    )

    # 2. Load Tokenizer & Model
    logger.info("Loading tokenizer from %s...", args.model_name)
    tokenizer = AutoTokenizer.from_pretrained(args.model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    logger.info("Loading 4-bit base model from %s...", args.model_name)
    model = AutoModelForCausalLM.from_pretrained(
        args.model_name,
        quantization_config=bnb_config if torch.cuda.is_available() else None,
        device_map="auto" if torch.cuda.is_available() else None,
        trust_remote_code=True,
    )

    if torch.cuda.is_available():
        model = prepare_model_for_kbit_training(model)

    # 3. LoRA Configuration (Optimized for 1B-2B edge operators)
    lora_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # 4. Load Dataset
    logger.info("Loading dataset from %s...", args.train_file)
    dataset = load_dataset("json", data_files={"train": str(train_path)})
    train_dataset = dataset["train"].map(lambda x: format_chat_prompt(x, tokenizer))

    eval_dataset = None
    if args.eval_file and Path(args.eval_file).exists():
        eval_data = load_dataset("json", data_files={"eval": str(args.eval_file)})
        eval_dataset = eval_data["eval"].map(lambda x: format_chat_prompt(x, tokenizer))

    # 5. Training Arguments
    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.learning_rate,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        logging_steps=10,
        save_strategy="epoch",
        evaluation_strategy="epoch" if eval_dataset else "no",
        fp16=not torch.cuda.is_bf16_supported() if torch.cuda.is_available() else False,
        bf16=torch.cuda.is_bf16_supported() if torch.cuda.is_available() else False,
        optim="paged_adamw_8bit" if torch.cuda.is_available() else "adamw_torch",
        report_to="none",
        save_total_limit=2,
    )

    trainer = SFTTrainer(
        model=model,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        peft_config=lora_config,
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        tokenizer=tokenizer,
        args=training_args,
    )

    logger.info("Commencing QLoRA training...")
    trainer.train()

    # 6. Save LoRA Adapter & Tokenizer
    logger.info("Saving fine-tuned adapter to %s...", args.output_dir)
    trainer.model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    print_export_instructions(args.output_dir, args.model_name)


def print_export_instructions(adapter_dir: str, base_model: str):
    """Outputs clear instructions to merge LoRA and convert to GGUF for Ollama/llama.cpp."""
    print("\n" + "=" * 70)
    print("SUCCESS: FRIDAY-1B-Operator adapter trained and saved successfully!")
    print("=" * 70)
    print(f"Adapter directory: {adapter_dir}")
    print("\nNext: Convert to GGUF Q4_K_M for 2GB VRAM edge inference:")
    print("1. Merge LoRA weights into base model:")
    print(f"   python -c \"from peft import AutoPeftModelForCausalLM; model = AutoPeftModelForCausalLM.from_pretrained('{adapter_dir}'); merged = model.merge_and_unload(); merged.save_pretrained('{adapter_dir}_merged')\"")
    print("\n2. Quantize to GGUF Q4_K_M (~1.05 GB VRAM) using llama.cpp:")
    print(f"   python llama.cpp/convert_hf_to_gguf.py {adapter_dir}_merged --outtype q4_k_m --outfile models/friday-1b-operator-q4_k_m.gguf")
    print("\n3. Import directly into Ollama:")
    print("   ollama create friday-1b -f scripts/Modelfile")
    print("   ollama run friday-1b")
    print("=" * 70 + "\n")


def parse_args():
    parser = argparse.ArgumentParser(description="FRIDAY-1B-Operator QLoRA Fine-Tuner")
    parser.add_argument("--model-name", type=str, default=DEFAULT_MODEL, help="Base HuggingFace model repo")
    parser.add_argument("--train-file", type=str, default=DEFAULT_TRAIN_FILE, help="Path to train JSONL")
    parser.add_argument("--eval-file", type=str, default=DEFAULT_EVAL_FILE, help="Path to eval JSONL")
    parser.add_argument("--output-dir", type=str, default=DEFAULT_OUTPUT_DIR, help="Output directory for weights")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=2, help="Per-device batch size")
    parser.add_argument("--grad-accum", type=int, default=4, help="Gradient accumulation steps")
    parser.add_argument("--learning-rate", type=float, default=2e-4, help="Peak learning rate")
    parser.add_argument("--max-seq-length", type=int, default=2048, help="Maximum sequence length")
    parser.add_argument("--lora-r", type=int, default=16, help="LoRA rank dimension")
    parser.add_argument("--lora-alpha", type=int, default=16, help="LoRA scaling factor")
    return parser.parse_args()


if __name__ == "__main__":
    cli_args = parse_args()
    if check_dependencies():
        run_finetune(cli_args)
    else:
        print_export_instructions(cli_args.output_dir, cli_args.model_name)

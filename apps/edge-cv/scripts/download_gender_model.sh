#!/usr/bin/env bash
# Express Display SmartVision - Gender Model Downloader
# Downloads the GoogleNet gender classification model from the ONNX Model Zoo.

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MODEL_DIR="$DIR/../models"
MODEL_PATH="$MODEL_DIR/gender_googlenet.onnx"
MODEL_URL="https://media.githubusercontent.com/media/onnx/models/main/validated/vision/body_analysis/age_gender/models/gender_googlenet.onnx"

mkdir -p "$MODEL_DIR"

if [ -f "$MODEL_PATH" ]; then
    echo "Model already exists at: $MODEL_PATH"
else
    echo "Downloading GoogleNet Gender Classification model (approx. 23MB)..."
    curl -sL -o "$MODEL_PATH" "$MODEL_URL"
    echo "Download complete: $MODEL_PATH"
fi

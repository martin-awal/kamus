#!/bin/bash
# Opus-MT Indonesian<->English (Helsinki-NLP, converted to ONNX by Xenova) for in-browser translation, ~108 MB per direction.
# Files go to ./models/opus-mt/Xenova/<model>/ and are served to browsers from /models/opus-mt/.
set -e
cd "$(dirname "$0")/.."
for M in opus-mt-id-en opus-mt-en-id; do
  D="models/opus-mt/Xenova/$M"; mkdir -p "$D/onnx"
  for F in config.json generation_config.json tokenizer.json tokenizer_config.json special_tokens_map.json onnx/encoder_model_quantized.onnx onnx/decoder_model_merged_quantized.onnx; do
    [ -s "$D/$F" ] || curl -fL --retry 3 -C - -o "$D/$F" "https://huggingface.co/Xenova/$M/resolve/main/$F"
  done
done
echo "Done."

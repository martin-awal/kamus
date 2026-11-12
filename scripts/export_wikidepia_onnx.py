"""Export the Wikidepia VITS model (Coqui TTS 0.8) to ONNX for in-browser inference (onnxruntime-web).

Run inside .tts-env:  .tts-env/bin/python scripts/export_wikidepia_onnx.py
Writes models/wikidepia-v1.2/web/{vits.onnx, tokens.json, speakers.json}.
Coqui 0.8 has no ONNX exporter, so this re-implements Vits.inference with the noise/length scales as inputs.
"""
import json
import os
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wikidepia_onnx_lib import MD, OUT, Infer, load  # noqa: E402

OUT.mkdir(exist_ok=True)
syn, model, tok, sid_map = load()

wrap = Infer(model)
text = "ˈsaja səˈdaŋ ˈbərada di dʒaˈkarta."
ids = torch.LongTensor(tok.text_to_ids(text))[None]
lens = torch.LongTensor([ids.shape[1]])
sid = torch.LongTensor([sid_map["wibowo"]])
scales = torch.tensor([0.0, 1.0, 0.0])           # deterministic, for the equivalence check
with torch.no_grad():
    ref = wrap(ids, lens, scales, sid)
print("torch ref:", tuple(ref.shape), file=sys.stderr)
out = OUT / "vits.onnx"
torch.onnx.export(wrap, (ids, lens, scales, sid), str(out), opset_version=15, input_names=["input", "input_lengths", "scales", "sid"],
                  output_names=["output"], dynamic_axes={"input": {1: "phonemes"}, "output": {2: "samples"}})
print("exported", out, out.stat().st_size // 1_000_000, "MB", file=sys.stderr)

vocab = tok.characters.vocab                      # id -> symbol (blank/pad included)
json.dump({"vocab": vocab, "blank_id": tok.characters.blank_id, "add_blank": bool(tok.add_blank),
           "sample_rate": int(model.config.audio.sample_rate), "lowercase": True},
          open(OUT / "tokens.json", "w"), ensure_ascii=False)
json.dump({k: int(v) for k, v in sid_map.items() if k in ("wibowo", "ardi", "gadis")}, open(OUT / "speakers.json", "w"))
# reference ids/waveform for testing the JS tokenizer and the browser inference
json.dump({"text": text, "ids": ids[0].tolist(), "sid": int(sid), "wav_len": int(ref.shape[-1]), "wav_head": ref[0, 0, :2000:100].tolist()},
          open(OUT / "reference.json", "w"), ensure_ascii=False)
print("ok", file=sys.stderr)

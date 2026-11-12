"""Compare vits.onnx (onnxruntime) with the PyTorch model for several inputs, deterministic scales. Run inside .tts-env."""
import sys, time
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import onnxruntime as ort, torch
from wikidepia_onnx_lib import MD, Infer, load
syn, model, tok, sid_map = load()
wrap = Infer(model)
sess = ort.InferenceSession(str(MD / "web" / "vits.onnx"), providers=["CPUExecutionProvider"])
texts = ["ˈsaja səˈdaŋ ˈbərada di dʒaˈkarta.", "ˈmakan", "ˈpaɡi", "di", "a", "səˈlamat ˈpaɡi, ˈapa ˈkabar?", "təˈrima ˈkasih", "ˈsaja ˈsuka ˈmakan ˈnasi ɡoˈrəŋ ˈdi ˈrumah ˈsaja bərsaˈma ˈkəluˈarɡa."]
scales = torch.tensor([0.0, 1.0, 0.0])
for text in texts:
    ids = torch.LongTensor(tok.text_to_ids(text))[None]; lens = torch.LongTensor([ids.shape[1]])
    for spk in ("wibowo", "gadis"):
        sid = torch.LongTensor([sid_map[spk]])
        with torch.no_grad(): ref = wrap(ids, lens, scales, sid).numpy().ravel()
        try:
            t = time.time(); out = sess.run(None, {"input": ids.numpy(), "input_lengths": lens.numpy(), "scales": scales.numpy(), "sid": sid.numpy()})[0].ravel(); dt = time.time() - t
        except Exception as e:
            print(f"{text!r:50s} {spk:7s} ORT ERROR: {str(e)[:150]}"); continue
        n = min(len(ref), len(out)); corr = float(np.corrcoef(ref[:n], out[:n])[0, 1]) if n > 1 else float("nan")
        print(f"{text[:44]!r:48s} {spk:7s} ids={ids.shape[1]:3d} torch={len(ref):6d} ort={len(out):6d} maxdiff={np.abs(ref[:n]-out[:n]).max():.4f} corr={corr:.4f} ort_time={dt:.2f}s")

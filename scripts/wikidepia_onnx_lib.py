"""Shared by export/check scripts: loads the Wikidepia VITS model and wraps its inference for ONNX. Run inside .tts-env."""
import os
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parent.parent
MD = ROOT / "models" / "wikidepia-v1.2"
OUT = MD / "web"

from TTS.tts.utils.helpers import generate_path  # noqa: E402


@torch.jit.script
def seq_mask_dyn(lengths: torch.Tensor) -> torch.Tensor:
    """sequence_mask whose length stays a graph computation (plain tracing would freeze it to the example's length)."""
    max_len = int(lengths.max())
    return torch.arange(max_len).unsqueeze(0) < lengths.unsqueeze(1)


class Infer(torch.nn.Module):
    """Vits.inference (single batch, no language embedding) with scales = [noise_scale, length_scale, noise_scale_dp]."""

    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, x, x_lengths, scales, sid):
        m = self.m
        g = m.emb_g(sid).unsqueeze(-1)
        x, m_p, logs_p, x_mask = m.text_encoder(x, x_lengths, lang_emb=None)
        logw = m.duration_predictor(x, x_mask, g=g if m.args.condition_dp_on_speaker else None, reverse=True,
                                    noise_scale=scales[2], lang_emb=None)
        w = torch.exp(logw) * x_mask * scales[1]
        w_ceil = torch.ceil(w)
        y_lengths = torch.clamp_min(torch.sum(w_ceil, [1, 2]), 1).long()
        y_mask = seq_mask_dyn(y_lengths).to(x_mask.dtype).unsqueeze(1)
        attn_mask = x_mask * y_mask.transpose(1, 2)
        attn = generate_path(w_ceil.squeeze(1), attn_mask.squeeze(1).transpose(1, 2))
        m_p = torch.matmul(attn.transpose(1, 2), m_p.transpose(1, 2)).transpose(1, 2)
        logs_p = torch.matmul(attn.transpose(1, 2), logs_p.transpose(1, 2)).transpose(1, 2)
        z_p = m_p + torch.randn_like(m_p) * torch.exp(logs_p) * scales[0]
        z = m.flow(z_p, y_mask, g=g, reverse=True)
        z, _, _, y_mask = m.upsampling_z(z, y_lengths=y_lengths, y_mask=y_mask)
        return m.waveform_decoder((z * y_mask)[:, :, : m.max_inference_len], g=g)


def load():
    """Returns (synthesizer, model, tokenizer, speaker-name->id map). Must run with cwd=MD (relative speakers.pth)."""
    from TTS.utils.synthesizer import Synthesizer
    os.chdir(MD)
    syn = Synthesizer(tts_checkpoint=str(MD / "checkpoint_1260000-inference.pth"), tts_config_path=str(MD / "config.json"),
                      tts_speakers_file=str(MD / "speakers.pth"), use_cuda=False)
    model = syn.tts_model.eval()
    return syn, model, model.tokenizer, model.speaker_manager.ids

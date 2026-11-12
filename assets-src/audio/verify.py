"""Numeric verification of rendered / encoded audio (we cannot listen, so measure)."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np

from .synth import SR, db


def decode_ogg(path: Path) -> np.ndarray:
    """Decode with ffmpeg to float32 stereo (2, n)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<f4").reshape(-1, 2).T.astype(np.float64)


def probe(path: Path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,sample_rate,channels",
                          "-show_entries", "format=duration,size", "-of", "json", str(path)],
                         check=True, capture_output=True, text=True).stdout
    j = json.loads(out)
    s = j["streams"][0]
    return dict(codec=s["codec_name"], sr=int(s["sample_rate"]), ch=int(s["channels"]),
                dur=float(j["format"]["duration"]), size=int(j["format"]["size"]))


def analyze(x: np.ndarray, loop: bool) -> dict:
    """x: (2, n) float. Returns the metrics used in the report."""
    n = x.shape[1]
    mono = x.mean(axis=0)
    r = {}
    r["dur"] = n / SR
    r["peak"] = db(np.max(np.abs(x)))
    r["rms"] = db(np.sqrt(np.mean(x**2)))
    r["dc"] = db(abs(np.mean(x)))
    mid, side = x.sum(axis=0) / 2, (x[0] - x[1]) / 2
    r["width"] = float(np.sum(side**2) / (np.sum(mid**2) + 1e-30))
    r["lr_db"] = db(np.sqrt(np.mean(x[0] ** 2))) - db(np.sqrt(np.mean(x[1] ** 2)))
    w = max(1, int(0.02 * SR))
    k = n // w
    win = np.sqrt(np.mean(x[:, : k * w].reshape(2, k, w) ** 2, axis=(0, 2)))
    r["silence"] = float(np.mean(win < 1e-3))                    # < -60 dBFS
    spec = np.abs(np.fft.rfft(mono)) ** 2
    f = np.fft.rfftfreq(n, 1 / SR)
    tot = spec.sum() + 1e-30
    r["bass"] = spec[(f >= 20) & (f < 250)].sum() / tot
    r["mid"] = spec[(f >= 250) & (f < 2000)].sum() / tot
    r["high"] = spec[(f >= 2000) & (f < 8000)].sum() / tot
    r["air"] = spec[f >= 8000].sum() / tot
    if loop:
        diffs = np.abs(np.diff(x, axis=1))
        p999 = np.percentile(diffs, 99.9)
        jump = np.max(np.abs(x[:, 0] - x[:, -1]))
        r["seam_jump"] = jump
        r["seam_ratio"] = jump / max(p999, 1e-9)            # < 1: seam no rougher than ordinary content
        w = int(0.010 * SR)
        k = x.shape[1] // w
        lv = np.sqrt(np.mean(x[:, : k * w].reshape(2, k, w) ** 2, axis=(0, 2)))
        r["seam_hole_db"] = db(np.sqrt(np.mean(x[:, -w:] ** 2))) - db(np.median(lv))   # level just before seam
        r["seam_edge_peak"] = db(np.abs(np.concatenate([x[:, -64:], x[:, :64]], axis=1)).max())
    else:
        r["end_peak"] = db(np.max(np.abs(x[:, -int(0.001 * SR):])))
        r["start_peak"] = db(np.max(np.abs(x[:, : int(0.002 * SR)])))
    return r


HEADER = (f"{'file':<16}{'codec':>7}{'ch':>3}{'dur s':>7}{'KB':>6}{'peak':>7}{'rms':>7}{'sil%':>6}"
          f"{'bass':>6}{'mid':>6}{'high':>6}{'air':>6}{'S/M':>6}{'L-R':>6}  seam/ends")


def row(name: str, pr: dict, a: dict, loop: bool) -> str:
    seam = (f"jump={a['seam_jump']:.4f} jump/p99.9step={a['seam_ratio']:.2f} pre-seam level={a['seam_hole_db']:+.1f}dB vs median"
            if loop else f"end={a['end_peak']:.0f}dB start={a['start_peak']:.0f}dB (one-shot)")
    return (f"{name:<16}{pr['codec']:>7}{pr['ch']:>3}{a['dur']:>7.2f}{pr['size'] / 1024:>6.0f}{a['peak']:>7.1f}"
            f"{a['rms']:>7.1f}{a['silence'] * 100:>6.1f}{a['bass'] * 100:>5.0f}%{a['mid'] * 100:>5.0f}%"
            f"{a['high'] * 100:>5.0f}%{a['air'] * 100:>5.1f}%{a['width'] * 100:>5.0f}%{a['lr_db']:>+6.1f}  {seam}")

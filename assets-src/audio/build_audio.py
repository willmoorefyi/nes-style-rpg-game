"""CLI: python3 -I assets-src/audio/build_audio.py [--out assets] [--only a,b] [--no-verify]

Run from the repository root.  Builds all audio into <out>/audio/{music,sfx}/ and prints the
verification table (duration, peak, RMS, silence, spectral balance, loop seam, theory check).
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))          # -I drops the script dir; add assets-src ourselves

import audio  # noqa: E402
from audio import verify  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default=str(HERE.parent.parent / "assets"), help="assets/ directory")
    ap.add_argument("--only", default="", help="comma separated names, e.g. title,battle")
    ap.add_argument("--no-verify", action="store_true")
    args = ap.parse_args()
    out = Path(args.out)
    only = [s for s in args.only.split(",") if s] or None
    t0 = time.time()
    audio.build(out, only=only, verbose=True)
    print(f"built in {time.time() - t0:.1f}s\n")
    if args.no_verify:
        return 0

    from audio.music import theory_report
    names = [(n, "music") for n in audio.MUSIC_NAMES] + [(n, "sfx") for n in audio.SFX_NAMES]
    print(verify.HEADER)
    reg = audio.song_registry()
    notes = []
    for name, kind in names:
        if only and name not in only:
            continue
        path = out / "audio" / kind / f"{name}.ogg"
        pr = verify.probe(path)
        x = verify.decode_ogg(path)
        loop = kind == "music" and name not in ("victory", "gameover")
        a = verify.analyze(x, loop)
        print(verify.row(f"{kind}/{name}", pr, a, loop))
        if kind == "music":
            bad, ratio = theory_report(reg[name]())
            notes.append(f"  {name}: theory violations={len(bad)}, melody chord-tone ratio on strong beats={ratio:.0%}")
    print("\nTheory check (scale + chord tones; '!' notes exempt):")
    print("\n".join(notes))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Procedural SNES-flavoured game audio for the FF-style RPG (numpy only, no samples).

Public API
    build(out_root, only=None, verbose=False)
        out_root is the repo's ``assets/`` directory.  Writes ``out_root/audio/music/*.ogg`` and
        ``out_root/audio/sfx/*.ogg`` (Ogg Vorbis, 44.1 kHz stereo) with exactly the names listed
        in ``assets/data/audio-manifest.json``.  Needs ``ffmpeg`` with the native ``vorbis``
        encoder on PATH.  Output is deterministic (fixed RNG seeds).

CLI (run from the repo root)
    python3 -I assets-src/audio/build_audio.py [--only title,battle] [--no-verify]
Note ``python3 -I`` does not put the script directory on sys.path, so ``build_audio.py`` adds
``assets-src`` itself.  Importers must do the same:  sys.path.insert(0, "assets-src").

Layout
    synth.py        oscillators (band-limited wavetables), ADSR, filters, circular echo/reverb, Bus
    instruments.py  voices: pulse lead, flute, FM bell/celesta, harp/guitar/pizz, bass, strings,
                    brass, wind + drum kit.  Register new voices in INSTRUMENTS.
    music.py        the DSL (P("C5:4 E5:8 r:8"), Chord, Pad/Arp/Bass/Stab/Drums generators), Song /
                    Section / Track, theory_report() and render_song()
    songs_field.py  title, overworld, town, shop, dungeon
    songs_fight.py  battle, boss, victory, gameover
    sfx.py          the seven sound effects
    verify.py       ffprobe + numeric analysis (peak/RMS/silence/spectral balance/loop seam)
    build_audio.py  CLI

How looping works
    Looping tracks are rendered *circularly*: note tails wrap around the buffer end and the echo /
    reverb are applied by FFT multiplication over the whole loop, so the end of the loop contains
    the tails of the start and there is no gap, click, or level step at the seam.  The length is
    forced to a multiple of 256 samples because ffmpeg's Vorbis encoder pads to that block size,
    and padding would otherwise leave a silent gap when the browser loops the buffer.
    ``victory`` and ``gameover`` are one-shots (AudioManager.playMusic(id, false)): they are
    rendered non-circularly with a ringing tail and end in a fade to silence.

How to add a track
    1. Write a function returning ``Song(...)`` in songs_field.py / songs_fight.py (copy a
       neighbour): choose ``bpm``, ``bar_beats``, ``scale`` (pitch classes), ``Track`` list and
       ``Section`` list.  Each Section gives a chord string ("Am:1 F:1 C:2 G:2", durations in the
       same 1/2/4/8 notation, 1 = a whole note) and a part per track: a note string for melodies
       (checked against the scale + current chord; mark deliberate chromatics with '!') or a
       generator (Pad, Arp, Bass, Stab, Drums) that follows the chords.
    2. Add it to the ALL dict of that module (the name must match audio-manifest.json).
    3. Run the CLI; fix any theory violations it reports and check the verification table.
"""
from __future__ import annotations

import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

__all__ = ["build", "MUSIC_NAMES", "SFX_NAMES"]

MUSIC_NAMES = ["title", "overworld", "town", "shop", "dungeon", "battle", "boss", "victory", "gameover"]
SFX_NAMES = ["cursor-move", "cursor-select", "cursor-cancel", "battle-hit", "battle-miss", "battle-victory",
             "spell-cast"]


def _write_wav(path: Path, x: np.ndarray) -> None:
    pcm = (np.clip(x.T, -1.0, 1.0) * 32767.0).round().astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(44100)
        w.writeframes(pcm.tobytes())


def _encode(wav: Path, ogg: Path) -> None:
    ogg.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "vorbis", "-strict", "-2",
                    "-q:a", "5", "-ar", "44100", "-ac", "2", str(ogg)], check=True)


def _encode_calibrated(x: np.ndarray, target_db: float, wav: Path, ogg: Path) -> None:
    """Encode, decode again, and re-scale so the *decoded* peak lands on target_db (Vorbis overshoots)."""
    from .verify import decode_ogg
    from .synth import db, undb
    for _ in range(3):
        _write_wav(wav, x)
        _encode(wav, ogg)
        err = target_db - db(np.max(np.abs(decode_ogg(ogg))))
        if abs(err) < 0.12:
            return
        x = x * undb(err)


def song_registry() -> dict:
    from . import songs_fight, songs_field
    return {**songs_field.ALL, **songs_fight.ALL}


def render_music(name: str) -> tuple[np.ndarray, bool]:
    """Returns (stereo float array, is_loop)."""
    from .music import render_song, theory_report
    song = song_registry()[name]()
    bad, _ = theory_report(song)
    if bad:
        raise ValueError("music-theory check failed:\n  " + "\n  ".join(bad))
    return render_song(song), song.loop


def build(out_root, only=None, verbose: bool = False) -> None:
    """Synthesize every manifest audio file into out_root/audio/{music,sfx}/NAME.ogg."""
    from .sfx import render_sfx
    out_root = Path(out_root)
    wanted = set(only) if only else None
    with tempfile.TemporaryDirectory() as tmp:
        for name in MUSIC_NAMES:
            if wanted and name not in wanted:
                continue
            x, _ = render_music(name)
            wav = Path(tmp) / f"{name}.wav"
            _encode_calibrated(x, -3.0, wav, out_root / "audio" / "music" / f"{name}.ogg")
            if verbose:
                print(f"music/{name}.ogg  {x.shape[1] / 44100:.1f}s")
        for name in SFX_NAMES:
            if wanted and name not in wanted:
                continue
            x = render_sfx(name)
            wav = Path(tmp) / f"{name}.wav"
            _encode_calibrated(x, -1.0, wav, out_root / "audio" / "sfx" / f"{name}.ogg")
            if verbose:
                print(f"sfx/{name}.ogg  {x.shape[1] / 44100:.2f}s")

"""Tiny sequencing DSL + song renderer.

Notation (one string per pattern, whitespace separated):
    C5:4        note, duration 4 = quarter (1 = whole, 2 = half, 8, 16; "4." dotted; "8t" triplet)
    r:4         rest
    F#4:8@0.7   optional velocity after '@'
    Bb5!:2      trailing '!' marks a *deliberate* chromatic note (exempt from the theory check)
    [C4 E4 G4]:2   chord (simultaneous notes)
Durations are in beats where one beat is a quarter note.  A bar is Song.bar_beats beats.

Chord symbols (Chord.parse): C, Am, F#m7, Bb, G7, Dm7, Cmaj7, Esus4, Bdim, Am7b5, D/F# ...

Generated parts (bass / pad / arp / stab / drums) are classes with .gen(ctx) -> events and are
driven by the chord timeline of each Section, so only melodies are written note by note.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable

import numpy as np

from . import instruments as I
from . import synth as S
from .synth import SR

PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def pc_of(name: str) -> int:
    base = PC[name[0]]
    for ch in name[1:]:
        base += 1 if ch == "#" else -1 if ch == "b" else 0
    return base % 12


# --------------------------------------------------------------------------- events & parsing
@dataclass
class Ev:
    t: float                 # start, beats (relative to pattern / section)
    dur: float               # gate, beats
    notes: tuple             # midi numbers (or drum lane chars)
    vel: float = 0.85
    chroma: bool = False


@dataclass
class Pattern:
    events: list = field(default_factory=list)
    length: float = 0.0

    def __add__(self, other: "Pattern") -> "Pattern":
        ev = list(self.events) + [Ev(e.t + self.length, e.dur, e.notes, e.vel, e.chroma) for e in other.events]
        return Pattern(ev, self.length + other.length)

    def transpose(self, semis: int) -> "Pattern":
        return Pattern([Ev(e.t, e.dur, tuple(n + semis for n in e.notes), e.vel, e.chroma) for e in self.events],
                       self.length)

    def shift_scale(self, steps: int, scale_pcs: set) -> "Pattern":
        """Move every in-scale note `steps` scale degrees (diatonic harmony / answer lines)."""
        ladder = [m for m in range(0, 128) if m % 12 in scale_pcs]
        index = {m: i for i, m in enumerate(ladder)}

        def mv(m):
            if m in index and 0 <= index[m] + steps < len(ladder):
                return ladder[index[m] + steps]
            return m
        return Pattern([Ev(e.t, e.dur, tuple(mv(n) for n in e.notes), e.vel, e.chroma) for e in self.events],
                       self.length)


_PITCH = re.compile(r"^([A-G])([#b]?)(-?\d)(!?)$")
_TOK = re.compile(r"\[[^\]]+\]\S*|\S+")


def midi_of(tok: str) -> tuple[int, bool]:
    m = _PITCH.match(tok)
    if not m:
        raise ValueError(f"bad pitch {tok!r}")
    letter, acc, octv, bang = m.groups()
    return 12 * (int(octv) + 1) + PC[letter] + (1 if acc == "#" else -1 if acc == "b" else 0), bool(bang)


def dur_beats(spec: str) -> float:
    m = re.match(r"^(\d+)(\.|t)?$", spec)
    if not m:
        raise ValueError(f"bad duration {spec!r}")
    b = 4.0 / int(m.group(1))
    if m.group(2) == ".":
        b *= 1.5
    elif m.group(2) == "t":
        b *= 2.0 / 3.0
    return b


def P(text: str, default_vel: float = 0.85) -> Pattern:
    """Parse a note string into a Pattern."""
    t = 0.0
    out = []
    for tok in _TOK.findall(text):
        head, _, tail = tok.rpartition(":") if ":" in tok else (tok, "", "")
        if not head:
            raise ValueError(f"missing duration in {tok!r}")
        vel = default_vel
        if "@" in tail:
            tail, v = tail.split("@")
            vel = float(v)
        d = dur_beats(tail)
        if head == "r":
            t += d
            continue
        chroma = False
        notes = []
        body = head[1:-1].split() if head.startswith("[") else [head]
        for b in body:
            m, bang = midi_of(b)
            notes.append(m)
            chroma |= bang
        out.append(Ev(t, d, tuple(notes), vel, chroma))
        t += d
    return Pattern(out, t)


# --------------------------------------------------------------------------- chords
_QUAL = {
    "": (0, 4, 7), "m": (0, 3, 7), "7": (0, 4, 7, 10), "m7": (0, 3, 7, 10), "maj7": (0, 4, 7, 11),
    "dim": (0, 3, 6), "m7b5": (0, 3, 6, 10), "sus4": (0, 5, 7), "sus2": (0, 2, 7), "6": (0, 4, 7, 9),
    "5": (0, 7), "add9": (0, 4, 7, 14),
}
_CHORD = re.compile(r"^([A-G][#b]?)(m7b5|maj7|m7|dim|sus4|sus2|add9|m|7|6|5|)(?:/([A-G][#b]?))?$")


@dataclass(frozen=True)
class Chord:
    name: str
    root: int
    intervals: tuple
    bass_pc: int

    @staticmethod
    def parse(name: str) -> "Chord":
        m = _CHORD.match(name)
        if not m:
            raise ValueError(f"bad chord {name!r}")
        root = pc_of(m.group(1))
        bass = pc_of(m.group(3)) if m.group(3) else root
        return Chord(name, root, _QUAL[m.group(2)], bass)

    @property
    def pcs(self) -> set:
        return {(self.root + i) % 12 for i in self.intervals}

    def ladder(self, lo: int, count: int) -> list:
        """`count` ascending chord tones starting at the first one >= lo."""
        pcs = self.pcs
        return [m for m in range(lo, lo + 12 * 6) if m % 12 in pcs][:count]


def parse_chords(text: str) -> list:
    """'Am:1 F:2 G:2' -> [(start, dur, Chord)]  (durations in beats)."""
    t = 0.0
    out = []
    for tok in text.split():
        name, _, d = tok.rpartition(":")
        db = dur_beats(d)
        out.append((t, db, Chord.parse(name)))
        t += db
    return out


# --------------------------------------------------------------------------- generated parts
@dataclass
class Ctx:
    chords: list            # [(start, dur, Chord)] relative to the section
    length: float           # section length in beats
    bar_beats: float


class Pad:
    def __init__(self, lo=55, count=4, vel=0.8):
        self.lo, self.count, self.vel = lo, count, vel

    def gen(self, ctx):
        return [Ev(s, d, tuple(c.ladder(self.lo, self.count)), self.vel) for s, d, c in ctx.chords]


class Arp:
    def __init__(self, order, step=0.5, lo=60, span=6, vel=0.7, accent=1.0):
        self.order, self.step, self.lo, self.span, self.vel, self.accent = order, step, lo, span, vel, accent

    def gen(self, ctx):
        out = []
        for s, d, c in ctx.chords:
            tones = c.ladder(self.lo, self.span)
            n = int(round(d / self.step))
            for i in range(n):
                idx = self.order[i % len(self.order)]
                v = self.vel * (self.accent if i % len(self.order) == 0 else 1.0)
                out.append(Ev(s + i * self.step, self.step * 0.9, (tones[idx % len(tones)],), v))
        return out


_BASS_TOK = {
    "r": lambda c: 0, "8": lambda c: 12, "3": lambda c: c.intervals[1], "5": lambda c: 6 if 6 in c.intervals else 7,
    "6": lambda c: 9, "7": lambda c: 11 if 11 in c.intervals else 10, "l5": lambda c: -5,
    "13": lambda c: 12 + c.intervals[1], "-1": lambda c: -1, "2": lambda c: 2,
}


class Bass:
    """template: [(beat, dur, token)] repeated every `unit` beats inside each chord."""

    def __init__(self, template, unit=4.0, lo=36, vel=0.85):
        self.template, self.unit, self.lo, self.vel = template, unit, lo, vel

    def gen(self, ctx):
        out = []
        for s, d, c in ctx.chords:
            root = self.lo + ((c.bass_pc - self.lo) % 12)
            u = 0.0
            while u < d - 1e-9:
                for beat, dur, tok in self.template:
                    t = u + beat
                    if t >= d - 1e-9:
                        continue
                    note = root + _BASS_TOK[tok](c)
                    out.append(Ev(s + t, min(dur, d - t), (note,), self.vel * (1.0 if beat % 1 == 0 else 0.85)))
                u += self.unit
        return out


class Stab:
    """Chord stabs on a rhythm [(beat, dur)] repeated every `unit` beats."""

    def __init__(self, rhythm, unit=4.0, lo=60, count=3, vel=0.85):
        self.rhythm, self.unit, self.lo, self.count, self.vel = rhythm, unit, lo, count, vel

    def gen(self, ctx):
        out = []
        for s, d, c in ctx.chords:
            u = 0.0
            while u < d - 1e-9:
                for beat, dur in self.rhythm:
                    if u + beat < d - 1e-9:
                        out.append(Ev(s + u + beat, dur, tuple(c.ladder(self.lo, self.count)), self.vel))
                u += self.unit
        return out


_STEP_VEL = {"x": 0.8, "X": 1.0, "o": 0.4}


class Drums:
    """pattern: {lane: 'x...X...'} with 4 steps per beat.  `fill` replaces every `fill_every`th bar."""

    def __init__(self, pattern, fill=None, fill_every=4, start_bar=0, crash_first=False):
        self.pattern, self.fill, self.fill_every = pattern, fill, fill_every
        self.start_bar, self.crash_first = start_bar, crash_first

    def gen(self, ctx):
        out = []
        bars = int(round(ctx.length / ctx.bar_beats))
        steps = int(round(ctx.bar_beats * 4))
        for b in range(bars):
            pat = self.pattern
            if self.fill and (b + 1) % self.fill_every == 0:
                pat = self.fill
            for lane, line in pat.items():
                assert len(line) == steps, f"drum lane {lane!r} has {len(line)} steps, need {steps}"
                for i, ch in enumerate(line):
                    if ch in _STEP_VEL:
                        out.append(Ev(b * ctx.bar_beats + i * 0.25, 0.2, (lane,), _STEP_VEL[ch]))
            if self.crash_first and b == 0:
                out.append(Ev(0.0, 0.2, ("C",), 0.8))
        return out


# --------------------------------------------------------------------------- song structure
@dataclass
class Track:
    name: str
    inst: str                       # key in INSTRUMENTS, or "drums"
    kw: dict = field(default_factory=dict)
    pan: float = 0.0
    gain: float = 1.0
    bus: str = "fx"                 # "fx" (echo + reverb) or "dry" (reverb only)
    gate: float = 0.94              # fraction of the written duration the note is held
    check: bool = False             # melodic part -> theory check
    humanize: float = 0.004         # seconds of random timing jitter (not on drums)


@dataclass
class Section:
    bars: int
    chords: str
    parts: dict                     # track name -> str | Pattern | generator
    levels: dict = field(default_factory=dict)   # per-track gain multiplier in this section


@dataclass
class Song:
    name: str
    bpm: float
    bar_beats: float
    key: str                        # e.g. "E minor" (documentation / report)
    scale: tuple                    # allowed pitch classes
    tracks: list
    sections: list
    echo: dict = field(default_factory=lambda: dict(delays=(0.19, 0.23), fb=0.42, wet=0.34, damp=3200.0))
    reverb: dict = field(default_factory=lambda: dict(wet=0.18, rt60=1.4))
    loop: bool = True
    tail: float = 0.0               # extra seconds after the last bar (one-shots only)
    fade_out: float = 0.0
    peak_db: float = -3.0
    eq_low: float = 4.0
    eq_high: float = 3.0
    drive: float = 0.7
    motif: str = ""

    # -- timeline -------------------------------------------------------------------------
    @property
    def total_beats(self) -> float:
        return sum(s.bars * self.bar_beats for s in self.sections)

    @property
    def n_samples(self) -> int:
        n = self.total_beats * 60.0 / self.bpm * SR + self.tail * SR
        if self.loop:                      # multiple of 256 -> Vorbis decodes sample-exact
            return int(round(n / 256.0)) * 256
        return int(round(n))

    def events(self):
        """Yield (track, abs_beat_start, Ev, section_index) for every event."""
        base = 0.0
        tr = {t.name: t for t in self.tracks}
        for si, sec in enumerate(self.sections):
            length = sec.bars * self.bar_beats
            ctx = Ctx(parse_chords(sec.chords), length, self.bar_beats)
            assert abs(sum(d for _, d, _ in ctx.chords) - length) < 1e-6, \
                f"{self.name} section {si}: chords sum {sum(d for _, d, _ in ctx.chords)} != {length}"
            for name, part in sec.parts.items():
                if part is None:
                    continue
                if isinstance(part, str):
                    part = P(part)
                if isinstance(part, Pattern):
                    assert part.length <= length + 1e-6 and part.length >= length - 1e-6, \
                        f"{self.name} section {si} part {name}: {part.length} beats, need {length}"
                    evs = part.events
                else:
                    evs = part.gen(ctx)
                for e in evs:
                    yield tr[name], base + e.t, e, si
            base += length

    def chord_timeline(self):
        out, base = [], 0.0
        for sec in self.sections:
            for s, d, c in parse_chords(sec.chords):
                out.append((base + s, d, c))
            base += sec.bars * self.bar_beats
        return out


# --------------------------------------------------------------------------- theory check
def theory_report(song: Song):
    """Returns (violations, strong_beat_chord_tone_ratio) for melodic ('check') tracks."""
    tl = song.chord_timeline()
    scale = set(song.scale)
    bad, strong, strong_ok = [], 0, 0
    for tr, t, e, si in song.events():
        if not tr.check:
            continue
        chord = next(c for s, d, c in tl if s - 1e-9 <= t < s + d - 1e-9)
        for m in e.notes:
            pc = m % 12
            ok_scale = pc in scale
            ok_chord = pc in chord.pcs
            if not (ok_scale or ok_chord or e.chroma):
                bad.append(f"{song.name}:{tr.name} beat {t:.2f} {NAMES[pc]}{m // 12 - 1} over {chord.name}")
            half = song.bar_beats / 2.0 if song.bar_beats == 4 else song.bar_beats
            if abs(t / half - round(t / half)) < 1e-6:      # downbeat / half-bar onsets
                strong += 1
                strong_ok += ok_chord
    return bad, (strong_ok / strong if strong else float("nan"))


# --------------------------------------------------------------------------- rendering
def render_song(song: Song, rng_seed: int = 7, stems: dict | None = None) -> np.ndarray:
    """Render to a stereo float array (2, n_samples), processed and normalised.
    If `stems` is a dict it is filled with per-track pre-fx RMS (dB re full scale, before master gain)."""
    energy: dict = {}
    S.reseed(1987)
    rng = np.random.default_rng(rng_seed)
    n = song.n_samples
    pad = 0 if song.loop else int(4.0 * SR)
    wrap = song.loop
    buses = {"fx": S.Bus(n + pad, wrap), "dry": S.Bus(n + pad, wrap)}
    sec_per_beat = 60.0 / song.bpm
    cache: dict = {}
    level = {}
    for si, sec in enumerate(song.sections):
        level[si] = sec.levels

    def voice(tr: Track, midi: float, gate_s: float):
        key = (tr.name, midi, round(gate_s, 3))
        if key not in cache:
            fn = I.INSTRUMENTS[tr.inst]
            cache[key] = fn(S.hz(midi), gate_s, **tr.kw)
        return cache[key]

    drum_cache = {}
    for tr, t, e, si in song.events():
        gain = tr.gain * level[si].get(tr.name, 1.0)
        jitter = 0.0 if tr.inst == "drums" or tr.humanize == 0 else rng.uniform(-tr.humanize, tr.humanize)
        start = int(round((t * sec_per_beat + jitter) * SR))
        if tr.inst == "drums":
            lane = e.notes[0]
            fn, lpan, lg = I.DRUMS[lane]
            if lane not in drum_cache:
                drum_cache[lane] = fn(**tr.kw) if lane == "T" else fn()
            buses[tr.bus].add(start, drum_cache[lane], tr.pan + lpan, gain * lg * e.vel)
            energy[tr.name] = energy.get(tr.name, 0.0) + float(np.sum(drum_cache[lane] ** 2)) * (gain * lg * e.vel) ** 2
            continue
        vel = e.vel * (1.0 + rng.uniform(-0.05, 0.05))
        gate_s = max(0.04, e.dur * sec_per_beat * tr.gate)
        for m in e.notes:
            sig = voice(tr, m, gate_s)
            g = gain * vel / (len(e.notes) ** 0.5)
            buses[tr.bus].add(start, sig, tr.pan, g)
            energy[tr.name] = energy.get(tr.name, 0.0) + float(np.sum(sig ** 2)) * g * g

    if stems is not None:
        stems.update({k: 10 * np.log10(v / n + 1e-18) for k, v in energy.items()})
    fx = buses["fx"].buf
    dry = buses["dry"].buf
    fx = S.echo(fx, **song.echo)
    fx = S.reverb(fx, **song.reverb)
    dry = S.reverb(dry, wet=song.reverb["wet"] * 0.7, rt60=song.reverb["rt60"])
    mix = fx + dry
    mix = S.dc_highpass(mix)
    mix = S.tilt_eq(mix, song.eq_low, song.eq_high)
    mix = mix[:, :n]
    mix = S.soft_clip(mix, song.drive)
    if not song.loop:
        mix = S.fade_in(mix, 0.002)
        mix = S.fade_out(mix, song.fade_out if song.fade_out else 0.35)
    return S.normalize(mix, song.peak_db)

"""Original compositions: title, overworld, town, shop, dungeon.

Duration reminder for the note strings:  1 = whole (4 beats), 2 = half, 4 = quarter (1 beat),
8 = eighth, 16 = sixteenth, "4." dotted, "8t" triplet.
"""
from __future__ import annotations

from .music import Arp, Bass, Drums, P, Pad, Section, Song, Stab, Track

MAJOR = (0, 2, 4, 5, 7, 9, 11)
NAT_MINOR = (0, 2, 3, 5, 7, 8, 10)
PHRYGIAN = (0, 1, 3, 5, 7, 8, 10)


def mode(root: int, steps) -> tuple:
    return tuple(sorted((root + s) % 12 for s in steps))


# =========================================================================== TITLE
def title() -> Song:
    """D major, 72 bpm, 4/4.  Motif: rising fourth then third (A4-D5-F#5), then answered by a
    stepwise fall.  Form: A  A'  B  A''  Outro (4 bars each, 20 bars, ~67 s)."""
    scale = mode(2, MAJOR)
    tracks = [
        Track("pad", "strings", dict(a=0.7, r=1.2, cutoff=2300.0), pan=0.0, gain=0.55),
        Track("harp", "harp", pan=-0.25, gain=0.3),
        Track("lead", "brass", dict(a=0.08, r=0.25, bright=3400.0, dark=1000.0), pan=0.05, gain=1.0, check=True),
        Track("bells", "celesta", pan=0.35, gain=0.5, check=True),
        Track("counter", "strings", dict(a=0.15, r=0.5, cutoff=3600.0), pan=0.2, gain=0.5, check=True),
        Track("solo", "flute", pan=-0.1, gain=0.9, check=True),
        Track("bass", "bass", gain=0.42),
        Track("drums", "drums", dict(f0=73.4), bus="dry", gain=0.7),
    ]
    A_LEAD = P("A4:4 D5:4 F#5:2  E5:4. D5:8 C#5:2  D5:4 F#5:4 B5:2  G5:4. F#5:8 E5:2")
    A2_LEAD = P("A4:4 D5:4 F#5:4 A5:4  A5:4. F#5:8 C#5:2  B4:4 D5:4 G5:2  E5:2 C#5:4 E5:4")
    B_LEAD = P("B4:4 D5:4  C#5:4. D5:8  D5:4 G5:4  F#5:4. E5:8  G5:4 B5:4  A5:4 G5:4  E5:2. C#5:4")
    B_COUNTER = P("D5:2 C#5:2 B4:2 A4:2 B4:2 D5:2 C#5:1")
    OUTRO = P("B5:2 A5:2  E5:2 A4:2  D5:2 F#5:2  E5:2 C#5:2")
    bass_t = [(0, 1.9, "r"), (2, 1.9, "5")]
    base = dict(
        pad=Pad(lo=57, count=4, vel=0.8),
        bass=Bass(bass_t, lo=38),
    )
    harp = Arp([0, 1, 2, 3, 4, 3, 2, 1], step=0.5, lo=50, span=6, vel=0.6)
    harp_busy = Arp([0, 2, 1, 3, 2, 4, 3, 5], step=0.5, lo=50, span=6, vel=0.65, accent=1.2)
    timp = Drums(dict(T="X.......o......."), fill=dict(T="X.......o.o.oxxX"), fill_every=4)
    timp_big = Drums(dict(T="X...o...X...o..."), fill=dict(T="X..xx.x.o.o.oxXX", C="X..............."),
                     fill_every=4, crash_first=True)
    secs = [
        Section(4, "D:1 A:1 Bm:1 G:1", {**base, "lead": A_LEAD, "harp": harp, "drums": timp}),
        Section(4, "D:1 F#m:1 G:1 A:1", {**base, "lead": A2_LEAD, "harp": harp, "bells": A2_LEAD.transpose(12),
                                         "drums": timp}),
        Section(4, "Bm:2 F#m:2 G:2 D:2 Em:2 G:2 A:1",
                {**base, "lead": B_LEAD, "counter": B_COUNTER, "harp": harp_busy, "drums": timp_big},
                levels={"pad": 1.15}),
        Section(4, "D:1 A:1 Bm:1 G:1",
                {**base, "lead": A_LEAD, "bells": A_LEAD.transpose(12),
                 "counter": A_LEAD.shift_scale(-2, set(scale)), "harp": harp_busy, "drums": timp_big},
                levels={"lead": 1.1, "pad": 1.2}),
        Section(4, "G:1 A:1 Bm:1 A:1",
                {**base, "solo": OUTRO, "harp": harp, "drums": timp}, levels={"pad": 0.9}),
    ]
    return Song("title", 72, 4, "D major", scale, tracks, secs,
                echo=dict(delays=(0.21, 0.25), fb=0.46, wet=0.36, damp=3000.0),
                reverb=dict(wet=0.22, rt60=1.8), motif="A4-D5-F#5 (rising 4th + 3rd)")


# =========================================================================== OVERWORLD
def overworld() -> Song:
    """G mixolydian, 108 bpm, 4/4.  Motif: broken G triad rising then a stepwise answer.
    Form: A (8)  B (8)  A' (8, harmonised)  B' (8, brass/pulse + flute), 32 bars ~71 s."""
    scale = mode(7, (0, 2, 4, 5, 7, 9, 10))
    sc = set(scale)
    tracks = [
        Track("lead", "pulse", dict(duty=0.25, a=0.006, d=0.12, s=0.7, r=0.1, cutoff=6500.0), pan=0.05,
              gain=0.5, check=True),
        Track("harm", "pulse", dict(duty=0.5, a=0.01, s=0.7, r=0.1, cutoff=3200.0), pan=-0.2, gain=0.4, check=True),
        Track("flute", "flute", pan=0.25, gain=0.5, check=True),
        Track("bells", "celesta", pan=0.35, gain=0.35, check=True),
        Track("bass", "bass", dict(cutoff=1100.0), gain=0.5),
        Track("gtr", "guitar", pan=-0.3, gain=0.38),
        Track("pad", "strings", dict(a=0.4, r=0.6, cutoff=2000.0), gain=0.4),
        Track("drums", "drums", dict(), bus="dry", gain=0.8),
    ]
    A_LEAD = P("G4:8 B4:8 D5:4 B4:8 D5:8 G5:4  C5:8 F5:8 A5:4 G5:8 F5:8 D5:4  "
               "E5:4 G5:8 E5:8 C5:4 E5:4  D5:4. E5:8 F#5:4 A5:4  "
               "G4:8 B4:8 D5:4 B4:8 D5:8 G5:4  A5:4 C6:4 A5:4 F5:4  "
               "G5:4 E5:4 G5:4 C6:4  B5:4. A5:8 G5:2")
    B_LEAD = P("B4:4. E5:8 G5:2  A5:4. G5:8 F5:2  E5:4. G5:8 C6:2  B5:4. A5:8 G5:2  "
               "G5:4. B5:8 E6:2  D6:4. C6:8 A5:2  C6:4 B5:4 A5:4 E5:4  F#5:4 A5:4 D6:2")
    B_FLUTE = P("G4:2 B4:2  A4:2 C5:2  G4:2 E5:2  D5:2 B4:2  B4:2 G5:2  F5:2 D5:2  E5:2 C5:2  A4:2 F#4:2")
    walk_a = Bass([(0, .9, "r"), (1, .9, "3"), (2, .9, "5"), (3, .9, "6")], lo=36)
    walk_b = Bass([(0, .9, "r"), (1, .9, "3"), (2, .9, "5"), (3, .9, "3")], lo=36)
    gtr = Arp([0, 1, 2, 1, 3, 2, 1, 2], step=0.5, lo=55, span=6, vel=0.6)
    pad = Pad(lo=55, count=3, vel=0.7)
    d_main = dict(k="x.......x.x.....", s="....x.......x...", h="x.x.x.x.x.x.x.x.")
    d_fill = dict(k="x.......x.......", s="....x.......xxxx", h="x.x.x.x.x.x.x.x.", **{"1": "..........x....."})
    drums = Drums(d_main, fill=d_fill, fill_every=4)
    drums_c = Drums(d_main, fill=d_fill, fill_every=4, crash_first=True)
    A, B = "G:1 F:1 C:1 D:1 G:1 F:1 C:1 G:1", "Em:1 F:1 C:1 G:1 Em:1 F:1 Am:1 D:1"
    secs = [
        Section(8, A, dict(lead=A_LEAD, bass=walk_a, gtr=gtr, pad=pad, drums=drums)),
        Section(8, B, dict(lead=B_LEAD, flute=B_FLUTE, bass=walk_b, gtr=gtr, pad=pad, drums=drums)),
        Section(8, A, dict(lead=A_LEAD, harm=A_LEAD.shift_scale(-2, sc), bells=A_LEAD.transpose(12),
                           bass=walk_a, gtr=gtr, pad=pad, drums=drums_c), levels={"pad": 1.2}),
        Section(8, B, dict(lead=B_LEAD, harm=B_LEAD.shift_scale(-2, sc), flute=B_FLUTE.transpose(12),
                           bells=B_LEAD.transpose(12), bass=walk_b, gtr=gtr, pad=pad, drums=drums_c),
                levels={"pad": 1.3, "lead": 1.1}),
    ]
    return Song("overworld", 108, 4, "G mixolydian", scale, tracks, secs,
                echo=dict(delays=(0.17, 0.21), fb=0.4, wet=0.3, damp=3400.0),
                reverb=dict(wet=0.17, rt60=1.3), motif="G4-B4-D5 broken triad rising to G5")


# =========================================================================== TOWN
def town() -> Song:
    """G major, 6/8 (dotted quarter = 96, written here as quarter = 144), pastoral.
    Motif: B-D-(E-D) lilt over a rocking guitar arpeggio.  Form: A B A' B' A'' (40 bars, 50 s)."""
    scale = mode(7, MAJOR)
    sc = set(scale)
    tracks = [
        Track("flute", "flute", pan=0.1, gain=0.7, check=True),
        Track("oboe", "pulse", dict(duty=0.125, a=0.03, d=0.2, s=0.6, r=0.15, cutoff=2600.0, vib=0.006),
              pan=-0.15, gain=0.45, check=True),
        Track("bells", "celesta", pan=0.35, gain=0.28, check=True),
        Track("gtr", "guitar", pan=-0.3, gain=0.45),
        Track("harp", "harp", pan=0.3, gain=0.3),
        Track("bass", "bass", dict(cutoff=800.0, saw_mix=0.15), gain=0.55),
        Track("pad", "strings", dict(a=0.5, r=0.8, cutoff=1900.0), gain=0.4),
        Track("drums", "drums", dict(), bus="dry", gain=0.6),
    ]
    A_LEAD = P("B4:4. D5:8 E5:8 D5:8  E5:4. G5:8 F#5:8 E5:8  D5:4. B4:8 D5:8 G5:8  F#5:4. E5:8 D5:8 C5:8  "
               "B4:4. D5:8 E5:8 D5:8  G5:4. E5:4.  F#5:4 A5:8 D6:4.  B5:4. G5:4.")
    B_LEAD = P("G5:4. B5:8 A5:8 G5:8  F#5:4. D5:4.  G5:4. E5:8 D5:8 C5:8  B4:4. D5:4.  "
               "C5:4. E5:8 A5:8 G5:8  G5:4. E5:4.  F#5:4. A5:4.  A5:2 F#5:4")
    A_CH = "G:2. C:2. G:2. D:2. G:2. C:2. D:2. G:2."
    B_CH = "Em:2. Bm:2. C:2. G:2. Am:2. Em:2. D:2. D:2."
    gtr = Arp([0, 2, 1, 2, 3, 2], step=0.5, lo=55, span=6, vel=0.6)
    harp = Arp([3, 4, 2, 4, 1, 4], step=0.5, lo=55, span=6, vel=0.5)
    bass = Bass([(0, 1.4, "r"), (1.5, 1.4, "5")], unit=3.0, lo=40)
    pad = Pad(lo=55, count=3, vel=0.7)
    drums = Drums(dict(k="x.....o.....", h="o.x.o.x.o.x."))
    base = dict(gtr=gtr, bass=bass, pad=pad, drums=drums)
    secs = [
        Section(8, A_CH, {**base, "flute": A_LEAD}),
        Section(8, B_CH, {**base, "flute": B_LEAD, "harp": harp}),
        Section(8, A_CH, {**base, "flute": A_LEAD, "bells": A_LEAD.transpose(12), "oboe": A_LEAD.shift_scale(-2, sc)}),
        Section(8, B_CH, {**base, "oboe": B_LEAD, "flute": B_LEAD.shift_scale(2, sc), "harp": harp,
                          "bells": B_LEAD.transpose(12)}),
        Section(8, A_CH, {**base, "flute": A_LEAD, "harp": harp, "oboe": A_LEAD.shift_scale(-2, sc)},
                levels={"pad": 1.3}),
    ]
    return Song("town", 144, 3, "G major (6/8)", scale, tracks, secs,
                echo=dict(delays=(0.2, 0.26), fb=0.4, wet=0.3, damp=3000.0),
                reverb=dict(wet=0.2, rt60=1.5), motif="B4. D5 E5 D5 lilt")


# =========================================================================== SHOP
def shop() -> Song:
    """F major, 120 bpm, bouncy pizzicato + celesta.  Form: A (8) B (8) A' (8) = 24 bars, 48 s."""
    scale = mode(5, MAJOR)
    sc = set(scale)
    tracks = [
        Track("lead", "pizz", pan=0.0, gain=0.6, check=True, gate=0.8),
        Track("bells", "celesta", pan=0.3, gain=0.4, check=True),
        Track("bells2", "chime", pan=-0.3, gain=0.18, check=True),
        Track("bass", "bass", dict(cutoff=1000.0, saw_mix=0.2), gain=0.5),
        Track("comp", "guitar", pan=-0.35, gain=0.35),
        Track("pad", "strings", dict(a=0.3, r=0.5, cutoff=1800.0), gain=0.3),
        Track("drums", "drums", dict(), bus="dry", gain=0.55),
    ]
    A_LEAD = P("A4:8 C5:8 F5:8 r:8 C5:8 F5:8 A5:4  D5:8 F5:8 A5:8 r:8 F5:8 A5:8 D6:4  "
               "G5:8 Bb5:8 D6:8 r:8 Bb5:8 G5:8 D5:4  E5:8 G5:8 C6:8 G5:8 E5:4 r:4  "
               "A4:8 C5:8 F5:8 r:8 C5:8 F5:8 A5:4  D6:8 A5:8 F5:8 A5:8 D5:4 F5:4  "
               "Bb4:8 D5:8 F5:8 Bb5:8 A5:8 G5:8 F5:4  E5:8 G5:8 Bb5:8 G5:8 E5:4 G5:4")
    B_LEAD = P("D6:4 Bb5:8 D6:8 F6:4 D6:4  Bb5:4 G5:8 Bb5:8 D6:2  C6:4 A5:8 C6:8 F6:2  E6:4 C6:4 G5:4 E5:4  "
               "D6:4 F6:4 D6:4 Bb5:4  C6:8 E6:8 A5:8 C6:8 E6:4 C6:4  D6:8 Bb5:8 G5:8 Bb5:8 D6:4 G5:4  "
               "G5:8 E5:8 C5:4 r:2")
    A_CH = "F:1 Dm:1 Gm:1 C:1 F:1 Dm:1 Bb:1 C:1"
    B_CH = "Bb:1 Gm:1 F:1 C:1 Bb:1 Am:1 Gm:1 C:1"
    bass = Bass([(0, .45, "r"), (1, .45, "8"), (1.5, .45, "5"), (2, .45, "r"), (3, .45, "8"), (3.5, .45, "5")], lo=36)
    comp = Stab([(1, .3), (3, .3)], lo=57, count=3, vel=0.6)
    comp2 = Stab([(1, .3), (2.5, .3), (3, .3)], lo=57, count=3, vel=0.6)
    pad = Pad(lo=53, count=3, vel=0.7)
    d = dict(k="x.......x.x.....", s="....o.......x...", h="x.o.x.o.x.o.x.o.")
    f = dict(k="x.......x.......", s="....o...o.o.oxxx", h="x.o.x.o.x.o.x.o.")
    drums = Drums(d, fill=f, fill_every=4)
    secs = [
        Section(8, A_CH, dict(lead=A_LEAD, bass=bass, comp=comp, drums=drums)),
        Section(8, B_CH, dict(bells=B_LEAD, lead=B_LEAD.shift_scale(-2, sc), bass=bass, comp=comp2, pad=pad,
                              drums=drums), levels={"lead": 0.7}),
        Section(8, A_CH, dict(lead=A_LEAD, bells=A_LEAD.transpose(12), bells2=A_LEAD.transpose(24),
                              bass=bass, comp=comp2, pad=pad, drums=drums)),
    ]
    return Song("shop", 120, 4, "F major", scale, tracks, secs,
                echo=dict(delays=(0.125, 0.1875), fb=0.38, wet=0.3, damp=3800.0),
                reverb=dict(wet=0.15, rt60=1.1), motif="A4-C5-F5 pizzicato triad bounce")


# =========================================================================== DUNGEON
def dungeon() -> Song:
    """E phrygian, 70 bpm, 4/4.  Low drone, slow heartbeat bass, sparse tolling bells; the
    F-B tritone and a deliberate Bb carry the unease.  Form A A' B A'' (16 bars, ~55 s)."""
    scale = mode(4, PHRYGIAN)
    tracks = [
        Track("drone", "strings", dict(a=1.6, r=2.2, cutoff=520.0, detune=14.0, vib=0.004), gain=0.55),
        Track("pulse", "bass", dict(a=0.02, d=0.3, s=0.6, r=0.4, cutoff=420.0, slide=0.3), gain=0.7),
        Track("bells", "deep_bell", pan=0.25, gain=0.45, check=True),
        Track("pluck", "harp", pan=-0.35, gain=0.3, check=True),
        Track("wind", "wind", dict(a=1.8, r=2.0), pan=0.0, gain=0.6),
        Track("drums", "drums", dict(f0=82.4), bus="dry", gain=0.5),
    ]
    A_B = P("B5:2 r:4 G5:4  r:2 F5:4 E5:4  A5:2 C6:2  B5:4 r:4 E5:2")
    A2_B = P("E5:2 G5:4 B5:4  r:2 C6:4 B5:4  A5:2 F5:2  G5:2 r:4 F5:4")
    B_B = P("C6:2 B5:4 A5:4  F5:2 B5:2  D5:2 Bb4!:2  G#5:2 B5:2")
    A3_B = P("B5:2 r:4 G5:4  r:1  D6:2 B5:2  F5:2 D5:2")
    pl_a = Arp([0, 2, 1, 3], step=1.0, lo=52, span=6, vel=0.5)
    base = dict(
        drone=Pad(lo=40, count=3, vel=0.8),
        pulse=Bass([(0, 0.8, "r"), (1.5, 0.5, "r")], lo=34),
        drums=Drums(dict(T="o.......o.......")),
    )
    secs = [
        Section(4, "Em:1 Em:1 F:1 Em:1", {**base, "bells": A_B, "wind": P("r:1 r:1 E5:1 r:1")}),
        Section(4, "Em:1 Am:1 F:1 Em:1", {**base, "bells": A2_B, "pluck": pl_a}),
        Section(4, "Am:1 F:1 Dm:1 E:1", {**base, "bells": B_B, "pluck": pl_a, "wind": P("E5:1 r:1 B5:1 r:1")},
                levels={"drone": 1.25, "pulse": 1.15}),
        Section(4, "Em:1 F:1 Em:1 Bdim:1", {**base, "bells": A3_B, "wind": P("r:1 r:1 r:1 E5:1")},
                levels={"drone": 0.9}),
    ]
    return Song("dungeon", 70, 4, "E phrygian", scale, tracks, secs,
                echo=dict(delays=(0.31, 0.37), fb=0.5, wet=0.4, damp=2600.0),
                reverb=dict(wet=0.3, rt60=2.4), motif="E-F rocking over a low drone")


ALL = dict(title=title, overworld=overworld, town=town, shop=shop, dungeon=dungeon)

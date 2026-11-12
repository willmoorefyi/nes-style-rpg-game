"""Original compositions: battle, boss, victory, gameover.  See songs_field.py for notation."""
from __future__ import annotations

from .music import Arp, Bass, Drums, P, Pad, Section, Song, Stab, Track
from .songs_field import NAT_MINOR, MAJOR, mode


# =========================================================================== BATTLE
def battle() -> Song:
    """E natural minor (+D# as a chord tone of B major), 150 bpm.  Bass ostinato E-E-e-E...,
    urgent syncopated pulse lead.  Form A (8) B (8) A' (8, harmonised) B' (8, brass) = 32 bars, ~51 s."""
    scale = mode(4, NAT_MINOR)
    sc = set(scale)
    tracks = [
        Track("lead", "pulse", dict(duty=0.25, a=0.004, d=0.1, s=0.75, r=0.08, vib=0.005, cutoff=6500.0),
              pan=0.05, gain=0.5, check=True),
        Track("harm", "pulse", dict(duty=0.125, a=0.004, s=0.7, r=0.08, cutoff=4000.0), pan=-0.25, gain=0.4,
              check=True),
        Track("brass", "brass", dict(a=0.03, r=0.1), pan=0.15, gain=0.65, check=True),
        Track("bass", "bass", dict(cutoff=1300.0, saw_mix=0.4, a=0.004, d=0.06, s=0.8, r=0.05, slide=0.2), gain=0.5),
        Track("arp", "pulse", dict(duty=0.125, a=0.002, d=0.05, s=0.3, r=0.04, cutoff=4500.0, vib=0.0), pan=-0.4,
              gain=0.45),
        Track("stab", "brass", dict(a=0.01, r=0.08, bright=3600.0), pan=-0.1, gain=0.7),
        Track("pad", "strings", dict(a=0.1, r=0.3, cutoff=2400.0), gain=0.4),
        Track("drums", "drums", dict(), bus="dry", gain=0.75),
    ]
    A_LEAD = P("E5:8 E5:16 G5:16 B5:8 G5:8 E5:4 B4:8 E5:8  C5:8 C5:16 E5:16 G5:8 E5:8 C5:4 G4:8 C5:8  "
               "D5:8 D5:16 F#5:16 A5:8 F#5:8 D5:4 A4:8 D5:8  B5:4. A5:8 G5:4 F#5:4  "
               "E5:8 E5:16 G5:16 B5:8 G5:8 E5:4 B4:8 E5:8  C5:8 C5:16 E5:16 G5:8 E5:8 C5:4 G4:8 C5:8  "
               "D5:8 D5:16 F#5:16 A5:8 F#5:8 D5:4 A4:8 D5:8  F#5:4 D#5:4 B4:4 D#5:4")
    B_LEAD = P("G5:4. G5:8 E6:4 D6:4  D6:4. D6:8 A5:4 F#5:4  G5:4 B5:4 E6:2  D6:4 B5:4 G5:2  "
               "E6:4. E6:8 C6:4 G5:4  F#6:4. E6:8 D6:4 A5:4  B5:4 D6:4 G6:4 D6:4  F#6:4 D#6:4 B5:2")
    A_CH = "Em:1 C:1 D:1 Em:1 Em:1 C:1 D:1 B:1"
    B_CH = "C:1 D:1 Em:1 Em:1 C:1 D:1 G:1 B:1"
    ost = Bass([(0, .45, "r"), (.5, .45, "r"), (1, .45, "8"), (1.5, .45, "r"),
                (2, .45, "r"), (2.5, .45, "r"), (3, .45, "8"), (3.5, .45, "5")], lo=36)
    arp = Arp([0, 1, 2, 3, 2, 1, 2, 3], step=0.25, lo=64, span=6, vel=0.55)
    stab = Stab([(0, .4), (1.5, .25), (2.5, .25)], lo=57, count=3, vel=0.6)
    pad = Pad(lo=52, count=3, vel=0.7)
    d_main = dict(k="x..x..x...x.x...", s="....x.......x...", h="x.x.x.x.x.x.x.x.")
    d_fill = dict(k="x.......x.......", s="....x.......x.xx", **{"1": "........x.x.....", "3": "..........x.x..."})
    drums = Drums(d_main, fill=d_fill, fill_every=4)
    drums_c = Drums(d_main, fill=d_fill, fill_every=4, crash_first=True)
    secs = [
        Section(8, A_CH, dict(lead=A_LEAD, bass=ost, pad=pad, drums=drums)),
        Section(8, B_CH, dict(lead=B_LEAD, bass=ost, arp=arp, stab=stab, pad=pad, drums=drums_c),
                levels={"pad": 1.2}),
        Section(8, A_CH, dict(lead=A_LEAD, harm=A_LEAD.shift_scale(-2, sc), bass=ost, arp=arp, pad=pad,
                              drums=drums_c)),
        Section(8, B_CH, dict(lead=B_LEAD, harm=B_LEAD.shift_scale(-2, sc), brass=B_LEAD, bass=ost, arp=arp,
                              stab=stab, pad=pad, drums=drums_c), levels={"pad": 1.3, "lead": 1.1}),
    ]
    return Song("battle", 150, 4, "E minor", scale, tracks, secs,
                echo=dict(delays=(0.12, 0.15), fb=0.32, wet=0.25, damp=3600.0),
                reverb=dict(wet=0.1, rt60=0.9), motif="E5-E5-G5-B5 syncopated arpeggio")


# =========================================================================== BOSS
def boss() -> Song:
    """C minor, 160 bpm.  Galloping bass, brass stabs, chromatic bridge (every bar of the bridge
    carries one note of a chromatic descent G-F#-F-E-Eb-D-Db-B as a chord tone of
    Cm-B-Bb-A-Ab-G-Db-G).  Form A (8) B (8) C bridge (8) A' (8) = 32 bars, 48 s."""
    scale = mode(0, NAT_MINOR)
    sc = set(scale)
    tracks = [
        Track("lead", "pulse", dict(duty=0.25, a=0.004, d=0.1, s=0.75, r=0.08, vib=0.005, cutoff=6000.0),
              pan=0.05, gain=0.48, check=True),
        Track("harm", "pulse", dict(duty=0.125, a=0.004, s=0.7, r=0.08, cutoff=3800.0), pan=-0.25, gain=0.4,
              check=True),
        Track("brass", "brass", dict(a=0.03, r=0.12, bright=4200.0), pan=0.15, gain=0.7, check=True),
        Track("bass", "bass", dict(cutoff=1400.0, saw_mix=0.5, a=0.004, d=0.06, s=0.8, r=0.05, slide=0.2), gain=0.5),
        Track("stab", "brass", dict(a=0.01, r=0.1, bright=3800.0), pan=-0.1, gain=0.75),
        Track("pad", "strings", dict(a=0.05, r=0.3, cutoff=2600.0, trem_rate=9.0, trem_depth=0.55), gain=0.42),
        Track("drums", "drums", dict(f0=65.4), bus="dry", gain=0.65),
    ]
    A_LEAD = P("C5:8 Eb5:8 G5:8 C6:8 Bb5:4 G5:4  Ab5:8 G5:8 F5:8 Eb5:8 D5:4 C5:4  Ab5:4. C6:8 Eb6:4 C6:4  "
               "D6:4. B5:8 G5:4 B5:4  "
               "C5:8 Eb5:8 G5:8 C6:8 Bb5:4 G5:4  Db6:4. C6:8 Ab5:4 F5:4  Bb5:4 D6:4 F6:4 D6:4  "
               "G5:8 B5:8 D6:8 G6:8 F6:4 D6:4")
    B_LEAD = P("C6:4. C6:8 Ab5:4 F5:4  Ab5:4 C6:4 F6:2  G5:4. G5:8 Eb5:4 C5:4  Eb5:4 G5:4 C6:2  "
               "Eb6:4. Eb6:8 C6:4 Ab5:4  D6:4. D6:8 Bb5:4 F5:4  D6:4 B5:4 G5:4 B5:4  "
               "D6:8 Eb6!:8 D6:8 B5:8 G5:2")
    chrom = ["G6", "F#6", "F6", "E6", "Eb6", "D6", "Db6", "B5"]
    C_LEAD = P(" ".join(f"{n}:8 {n}:8 {n}:8 {n}:8 {n}:2" for n in chrom))
    A_CH = "Cm:1 Cm:1 Ab:1 G:1 Cm:1 Db:1 Bb:1 G:1"
    B_CH = "Fm:1 Fm:1 Cm:1 Cm:1 Ab:1 Bb:1 G:1 G:1"
    C_CH = "Cm:1 B:1 Bb:1 A:1 Ab:1 G:1 Db:1 G:1"
    gallop = Bass([(0, .45, "r"), (.5, .2, "r"), (.75, .2, "r"), (1, .45, "r"), (1.5, .45, "r"),
                   (2, .45, "r"), (2.5, .2, "r"), (2.75, .2, "r"), (3, .45, "8"), (3.5, .45, "r")], lo=36)
    stab = Stab([(0, .45), (.75, .2), (1.5, .45), (2.5, .45), (3.25, .2)], lo=58, count=3, vel=0.8)
    pad = Pad(lo=48, count=4, vel=0.7)
    d_main = dict(k="x.x...x.x.x.x...", s="....x.......x..x", h="x.x.x.x.x.x.x.x.", T="x.......x.......")
    d_fill = dict(k="x.x.x.x.x.......", s="........x.x.xxxx", **{"1": "........xx..xx..", "3": "............x.xx"},
                  T="x...............")
    d_bridge = dict(k="x...x...x...x...", s="................", T="X.......X.......", **{"3": "..x...x...x...x."})
    d_bridge_fill = dict(k="x...x...x...x...", s="........x.x.xxxx", T="X.......X.......", **{"2": "......x.x.x....."})
    drums = Drums(d_main, fill=d_fill, fill_every=4, crash_first=True)
    drums_b = Drums(d_bridge, fill=d_bridge_fill, fill_every=4, crash_first=True)
    secs = [
        Section(8, A_CH, dict(lead=A_LEAD, bass=gallop, stab=stab, pad=pad, drums=drums)),
        Section(8, B_CH, dict(lead=B_LEAD, brass=B_LEAD, bass=gallop, stab=stab, pad=pad, drums=drums),
                levels={"pad": 1.2}),
        Section(8, C_CH, dict(lead=C_LEAD, brass=C_LEAD.transpose(-12), bass=gallop, stab=stab, pad=pad,
                              drums=drums_b), levels={"pad": 1.7, "stab": 0.8}),
        Section(8, A_CH, dict(lead=A_LEAD, harm=A_LEAD.shift_scale(-2, sc), brass=A_LEAD, bass=gallop, stab=stab,
                              pad=pad, drums=drums), levels={"pad": 1.3, "lead": 1.1}),
    ]
    return Song("boss", 160, 4, "C minor", scale, tracks, secs,
                echo=dict(delays=(0.14, 0.18), fb=0.36, wet=0.28, damp=3400.0),
                reverb=dict(wet=0.13, rt60=1.2), motif="C-Eb-G-C rising minor arpeggio + chromatic descent")


# =========================================================================== VICTORY (one-shot)
def victory() -> Song:
    """F major, 144 bpm, 3 bars + ringing tail (~7.7 s).  Rising F-A-C-F arpeggio, a sequence
    through Bb and Gm, then a held F major chord with bells and a cymbal crash."""
    scale = mode(5, MAJOR)
    sc = set(scale)
    tracks = [
        Track("lead", "brass", dict(a=0.025, r=0.3, bright=5200.0), pan=0.05, gain=0.9, check=True, gate=0.97),
        Track("harm", "brass", dict(a=0.03, r=0.3, bright=4200.0), pan=-0.25, gain=0.55, check=True, gate=0.97),
        Track("bells", "celesta", pan=0.3, gain=0.33, check=True),
        Track("chime", "chime", pan=-0.2, gain=0.33, check=True),
        Track("pad", "strings", dict(a=0.15, r=1.8, cutoff=2800.0), gain=0.4),
        Track("bass", "bass", dict(r=0.6), gain=0.35),
        Track("drums", "drums", dict(f0=87.3), bus="dry", gain=0.4),
    ]
    LEAD = P("F4:8 A4:8 C5:8 F5:8 D5:4. F5:8 Bb5:4 A5:8 G5:8 E5:4 G5:4 A5:1")
    sec = Section(3, "F:2 Bb:2 Gm:2 C:2 F:1", dict(
        lead=LEAD, harm=LEAD.shift_scale(-2, sc),
        bells=P("F5:8 A5:8 C6:8 F6:8 D6:4. F6:8 Bb6:4 A6:8 G6:8 E6:4 G6:4 [F6 A6 C7]:1"),
        chime=P("r:2 r:2 r:2 r:2 [F5 C6 F6 A6]:1"),
        pad=Pad(lo=53, count=4, vel=0.8),
        bass=Bass([(0, 1.9, "r"), (2, 1.9, "5")], lo=36),
        drums=Drums(dict(T="X.......x.x.x.x."), fill=dict(T="X...............", C="X..............."),
                    fill_every=3),
    ))
    # final bar: held chord in the pad, bells ring (the 'bells' pattern above rings its tail)
    return Song("victory", 144, 4, "F major", scale, tracks, [sec], echo=dict(delays=(0.21, 0.26), fb=0.42, wet=0.34),
                reverb=dict(wet=0.28, rt60=2.0), loop=False, tail=2.7, fade_out=0.7,
                motif="F4-A4-C5-F5 rising arpeggio, bell-topped final chord")


# =========================================================================== GAME OVER (one-shot)
def gameover() -> Song:
    """D minor, 66 bpm, 2 bars + tail (~7.8 s).  Solo string line sinks over Dm-Gm-A-Dm, a deep
    bell tolls, everything fades."""
    scale = mode(2, NAT_MINOR)
    tracks = [
        Track("lead", "strings", dict(a=0.25, r=1.2, cutoff=3200.0, vib=0.007, detune=5.0), pan=0.05, gain=0.7,
              check=True, gate=0.99),
        Track("pad", "strings", dict(a=0.9, r=2.0, cutoff=1500.0), gain=0.5),
        Track("bell", "deep_bell", pan=0.25, gain=0.5, check=True),
        Track("bass", "bass", dict(a=0.03, d=0.4, s=0.7, r=1.0, cutoff=500.0, slide=0.2), gain=0.3),
        Track("drums", "drums", dict(f0=73.4), bus="dry", gain=0.35),
    ]
    sec = Section(2, "Dm:2 Gm:2 A:2 Dm:2", dict(
        lead=P("A5:4 F5:4 G5:4 D5:4 E5:4 C#5:4 D5:2"),
        pad=Pad(lo=50, count=4, vel=0.8),
        bell=P("D4:2 r:2 r:2 D4:2"),
        bass=Bass([(0, 1.9, "r")], lo=33),
        drums=Drums(dict(T="X...............", ), fill=dict(T="o...o...o...xxX."), fill_every=2),
    ))
    return Song("gameover", 66, 4, "D minor", scale, tracks, [sec], echo=dict(delays=(0.3, 0.36), fb=0.5, wet=0.38,
                                                                           damp=2600.0),
                reverb=dict(wet=0.3, rt60=2.4), loop=False, tail=0.5, fade_out=4.0,
                motif="A5-F5-G5-D5 sinking figure")


ALL = dict(battle=battle, boss=boss, victory=victory, gameover=gameover)

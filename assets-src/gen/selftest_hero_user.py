"""Pass CB (docs/CLASS_BARBARIAN_PLAN.md 3.4, 5): selftests of gen/hero_user.py, the import of a user-rendered hero
class sheet, and of the pass's puppet / kneel additions. Synthetic 7 x 2 renders in a temp generator tree: the round
trip (approve, then check OK), every refusal of the cut (sha256, size, semi-alpha, a figure across a cell border, feet
off row 76, 17 colours, two colours with one final colour), a changed approved png failing check, the user-check
dispatch, selftest_roster.kneel_ok's `source: user` pairing, puppet's `alias_frames` (honoured, unknown names
refused) and `part_boxes`; then the real barbarian_berserker recipe."""
from __future__ import annotations

import hashlib
import json
import tempfile
from pathlib import Path
from typing import Callable

import numpy as np
import yaml
from PIL import Image

PAL = [(24, 19, 27), (80, 53, 46), (164, 167, 182), (223, 148, 102), (118, 118, 132)]


def render(nrows: int = 2, foot: int = 76, colours: list | None = None, cross: bool = False,
           semi: bool = False) -> np.ndarray:
    """A 560 x (80 nrows) render: one outlined block per cell standing on row `foot`; `colours` is one list for every
    row or (plan 11) a list of lists, one per row (its first colour the block's outline)."""
    per_row = colours if colours and isinstance(colours[0], list) else [colours or PAL] * nrows
    cols = per_row[0]
    a = np.zeros((80 * nrows, 560, 4), np.uint8)
    for r in range(nrows):
        cols = per_row[r]
        for c in range(7):
            x0, y0 = c * 80 + 20, r * 80 + 20
            blk = a[y0:r * 80 + foot + 1, x0:x0 + 30]
            blk[...] = (*cols[0], 255)
            inner = blk[1:-1, 1:-1]
            for i in range(inner.shape[0]):
                inner[i] = (*cols[1 + (i + c + r) % (len(cols) - 1)], 255)
    if cross:
        a[30, 78:83] = (*per_row[0][2], 255)
    if semi:
        a[40, 30, 3] = 128
    return a


def tree(td: Path, a: np.ndarray, rec_over: dict | None = None) -> dict:
    gen = td / "gen"
    (gen / "user_art" / "syn").mkdir(parents=True, exist_ok=True)
    (gen / "approved").mkdir(exist_ok=True)
    (gen / "anim").mkdir(exist_ok=True)
    p = gen / "user_art" / "syn" / "battle.png"
    Image.fromarray(a).save(p)
    rec = {"file": "user_art/syn/battle.png", "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
           "rows": ["syn_base", "syn_plus"], "columns": ["ready", "attack", "cast", "hurt", "down", "victory", "kneel"],
           "faces": "left", "approved": "2026-11-26", "user_review": "selftest"}
    rec.update(rec_over or {})
    (gen / "hero_user.yaml").write_text(yaml.safe_dump({"syn": rec}))
    return rec


def refused(fn) -> str:
    try:
        fn()
    except SystemExit as e:
        return str(e)
    return ""


def run_hero_user(check: Callable[[bool, str], None]) -> None:
    from gen import hero_user as HU
    from gen import pixelize as PX
    with tempfile.TemporaryDirectory() as t:
        td = Path(t)
        rec = tree(td, render())
        gen = td / "gen"
        cells, info = HU.cut(rec, gen)
        check(set(cells) == {"syn_base", "syn_plus"} and all(len(v) == 7 for v in cells.values()),
              "CB: the cut gives seven 80 x 80 cells per class row")
        fin = {tuple(d) for _, d in info["palette"]}
        check(tuple(PX.OUTLINE) in fin and all(tuple(PX.snap15(np.array(s, np.float32))) == tuple(d) or
                                              tuple(d) == tuple(PX.OUTLINE) for s, d in info["palette"]),
              "CB: the house palette: 15-bit colours, the darkest PX.OUTLINE")
        written = HU.approve("syn", gen / "approved", "2026-11-26")
        check(len(written) == 8 and Image.open(gen / "approved/syn_base/battle.png").size == (240, 160)
              and Image.open(gen / "approved/syn_base/battle_kneel.png").size == (80, 80),
              "CB: approve writes battle.png (3 x 2) and battle_kneel.png per class, with their jsons")
        metas = {(c, s): json.loads((gen / f"approved/{c}/{s}.json").read_text())
                 for c in ("syn_base", "syn_plus") for s in ("battle", "battle_kneel")}
        check(all(HU.check(m, gen) is None for m in metas.values()), "CB: every approved file re-imports byte for byte")
        m = metas[("syn_base", "battle")]
        check(m["backend"] == "user" and m["faces"] == "left" and "facing_fix" not in m and m["poses"] ==
              ["ready", "attack", "cast", "hurt", "down", "victory"] and m["bottom_row"] == 76,
              "CB: battle.json is backend user, faces left, no facing_fix, the six poses, bottom_row 76")
        check(HU.check({**m, "facing_fix": [{"pose": "hurt", "mirror": "figure"}]}, gen) is not None,
              "CB: a user hero json with a facing_fix is refused")
        img = np.asarray(Image.open(gen / "approved/syn_plus/battle_kneel.png")).copy()
        img[70, 40, :3] = (1, 2, 3)
        Image.fromarray(img).save(gen / "approved/syn_plus/battle_kneel.png")
        check("differs" in (HU.check(metas[("syn_plus", "battle_kneel")], gen) or ""),
              "CB: a changed approved png fails the re-import check")
        cases = {
            "sha256": (render(), {"sha256": "0" * 64}),
            "need": (render(nrows=1), None),
            "semi-transparent": (render(semi=True), None),
            "crosses the border": (render(cross=True), None),
            "feet on row": (render(foot=75), None),
            "colours": (render(colours=[(24, 19, 27)] + [(8 * i + 40, 100, 60) for i in range(16)]), None),
            "one-to-one": (render(colours=[(24, 19, 27), (100, 100, 100), (101, 100, 100), (200, 40, 40)]), None),
        }
        for word, (a, over) in cases.items():
            with tempfile.TemporaryDirectory() as t2:
                r2 = tree(Path(t2), a, over)
                why = refused(lambda: HU.cut(r2, Path(t2) / "gen"))
                check(word.split()[0] in why, f"CB: the cut refuses ({word}): {why[:90]}")
        # plan 11 (A1): `palette: rows`
        row0 = [(24, 19, 27)] + [(13 * i + 40, 100, 60) for i in range(15)]
        row1 = [(20, 24, 22)] + [(60, 13 * i + 40, 160) for i in range(15)]
        with tempfile.TemporaryDirectory() as t2:
            r2 = tree(Path(t2), render(colours=[row0, row1]))
            check("colours" in refused(lambda: HU.cut(r2, Path(t2) / "gen")),
                  "CB A1: 16 disjoint colours per row (32 in all) are refused with palette: sheet")
        with tempfile.TemporaryDirectory() as t2:
            g2 = Path(t2) / "gen"
            r2 = tree(Path(t2), render(colours=[row0, row1]), {"palette": "rows"})
            cells2, info2 = HU.cut(r2, g2)
            HU.approve("syn", g2 / "approved", "2026-11-27")
            ms = {c: json.loads((g2 / f"approved/{c}/battle.json").read_text()) for c in ("syn_base", "syn_plus")}
            fin = {c: {tuple(d) for _, d in m["cut"]["palette"]} for c, m in ms.items()}
            src = {c: {tuple(s) for s, _ in m["cut"]["palette"]} for c, m in ms.items()}
            check(src["syn_base"] == set(row0) and src["syn_plus"] == set(row1) and all(
                  tuple(PX.OUTLINE) in f for f in fin.values()) and all(m["cut"]["colours"] == 16 for m in ms.values()),
                  "CB A1: palette: rows imports each row with its own 16 colours, each row's darkest -> PX.OUTLINE")
            check(all(HU.check(m, g2) is None for m in ms.values()), "CB A1: the rows import re-imports byte for byte")
        shared = [(24, 19, 27), (60, 60, 60), (200, 40, 40), (40, 200, 40)]      # (24, 19, 27): the outline of row 0
        other = [(10, 10, 12), (24, 19, 27), (90, 90, 200), (220, 200, 40)]       # ... and a shade in row 1
        with tempfile.TemporaryDirectory() as t2:
            r2 = tree(Path(t2), render(colours=[shared, other]), {"palette": "rows"})
            cells3, _ = HU.cut(r2, Path(t2) / "gen")
            got = lambda cid, pose: {tuple(int(v) for v in p[:3]) for p in np.asarray(cells3[cid][pose]).reshape(-1, 4)
                                     if p[3]}
            snap = tuple(int(v) for v in PX.snap15(np.array([(24, 19, 27)], np.float32))[0])
            check(tuple(PX.OUTLINE) in got("syn_base", "ready") and snap not in got("syn_base", "ready")
                  and snap in got("syn_plus", "ready"),
                  "CB A1: a colour in both rows is mapped per row (the outline in row 0, its 15-bit shade in row 1)")
        with tempfile.TemporaryDirectory() as t2:
            r2 = tree(Path(t2), render(colours=[row0, row1 + [(250, 250, 5)]]), {"palette": "rows"})
            why = refused(lambda: HU.cut(r2, Path(t2) / "gen"))
            check(why.startswith("syn_plus:") and "17 colours" in why, f"CB A1: a row of 17 colours is refused naming it ({why[:50]})")
        with tempfile.TemporaryDirectory() as t2:
            r2 = tree(Path(t2), render(), {"palette": "per_pose"})
            check("palette must be" in refused(lambda: HU.recipe("syn", Path(t2) / "gen" / "hero_user.yaml")),
                  "CB A1: an unknown palette value is refused")
        # selftest_roster.kneel_ok: a user hero key needs `kneel: {source: user}`, and the block a user key
        from gen import selftest_roster as SR
        km = json.loads((gen / "approved/syn_base/battle_kneel.json").read_text())
        (gen / "anim/syn_base.yaml").write_text("kneel: {source: ai}\n")
        check("source: user" in (SR.kneel_ok(km, [], [], gen) or ""), "CB: kneel_ok refuses `source: ai` on a user key")
        (gen / "anim/syn_base.yaml").write_text("kneel: {source: user}\n")
        check(SR.kneel_ok(km, [], [], gen) is None, "CB: kneel_ok passes a user key with `source: user` by re-import")
        check("not backend user" in (SR.kneel_ok({**km, "backend": "gemini"}, [], [], gen) or ""),
              "CB: kneel_ok refuses `source: user` with a key that is not backend user")
    # the user-check dispatch and puppet's pass-CB keys on the real classes
    from gen import field_user as FU
    from gen import puppet as PU
    real = {c: json.loads((HU.HERE / f"approved/{c}/battle.json").read_text()) for c in ("barbarian", "berserker")}
    check(all(FU.user_check(m) is None for m in real.values()),
          "CB: field_user.user_check sends the barbarian / berserker battle.json to hero_user.check (re-import OK)")
    cfg = PU.load_cfg("barbarian")
    full = PU.battle_inbetweens("barbarian", cfg)
    cut = PU.battle_inbetweens("barbarian", {**cfg, "alias_frames": ["cast_rise"]})
    check(set(full) - set(cut) == {"cast_rise"}, "CB: alias_frames leaves the named in-between to its source keyframe")
    import gen.puppet as PUm
    bad = dict(yaml.safe_load((PU.ANIM / "barbarian.yaml").read_text()), alias_frames=["kneel"])
    with tempfile.TemporaryDirectory() as t3:
        anim = Path(t3)
        (anim / "barbarian.yaml").write_text(yaml.safe_dump(bad))
        old = PUm.ANIM
        PUm.ANIM = anim
        try:
            PU.load_cfg("barbarian")
            why = ""
        except ValueError as e:
            why = str(e)
        finally:
            PUm.ANIM = old
    check("alias_frames" in why, f"CB: load_cfg refuses an alias_frames name that is not an in-between ({why[:60]})")
    j = cfg["battle"]["ready"]
    lab = PU.segment(PU.battle_sheet_frames("barbarian")["ready"], j)
    names = list(PU.PARTS)
    x0, y0, x1, y1 = j["part_boxes"]["weapon_f"][0]
    sub = lab[y0:y1, x0:x1]
    check(bool((sub[sub >= 0] == names.index("weapon_f")).all()), "CB: part_boxes put every opaque px of the box in its part")
    check(PU.battle_inbetweens("warrior") and "tip_f" not in PU.load_cfg("warrior")["battle"]["ready"],
          "CB: a class without tip_f draws no weapon_f (warrior)")
    from gen import hero_user as HU2
    check(all(HU2.check(json.loads((HU2.HERE / f"approved/{c}/{s}.json").read_text())) is None
              for c in ("barbarian", "berserker") for s in ("battle", "battle_kneel")),
          "CB: the real barbarian_berserker recipe re-imports byte for byte")
    # plan 12 (A2): the pieces cap follows the source key (puppet.check and puppet_kneel.frame_checks)
    from gen import puppet_kneel as PK

    def blobs(k: int) -> Image.Image:
        """An 80 x 80 frame of k separate 4 x 4 outlined blocks standing on the feet row 76."""
        z = np.zeros((80, 80, 4), np.uint8)
        for i in range(k):
            x, y = 4 + 9 * i, 73
            z[y:y + 4, x:x + 4] = (*PX.OUTLINE, 255)
            z[y + 1:y + 3, x + 1:x + 3] = (120, 120, 120, 255)
        return Image.fromarray(z)
    five = blobs(5)
    fw = np.asarray(five).copy()                         # 5 pieces with the area of 6 blocks (one block doubled)
    fw[73:77, 0:4] = (*PX.OUTLINE, 255)                  # a 16-px block joined to the first one
    five_wide = Image.fromarray(fw)
    one = np.zeros((80, 80, 4), np.uint8)               # one piece with the area of three blocks (px ratio 1)
    one[73:77, 4:16] = (*PX.OUTLINE, 255)
    one[74:76, 5:15] = (120, 120, 120, 255)
    one = Image.fromarray(one)
    check(PU.check(blobs(3), one)["pieces"] == 3 and not PU.check(blobs(3), one)["ok"]
          and PU.check(blobs(2), blobs(2))["ok"],
          "CB A2: puppet.check keeps the cap 2 for a 1-piece key (3 pieces fail)")
    check(PU.check(blobs(5), five)["pieces"] == 5 and PU.check(blobs(5), five)["ok"]
          and not PU.check(blobs(6), five_wide)["ok"] and PU.check(blobs(6), five_wide)["px"] == 1.0,
          "CB A2: puppet.check allows a 5-piece key's 5 pieces, not 6 (same area)")
    pal = {(120, 120, 120), tuple(PX.OUTLINE)}
    kf = lambda img, ref, src: [f for f in PK.frame_checks("kneel_in1", img, src, 76, pal, ref) if "pieces" in f]
    check(bool(kf(blobs(3), None, one)) and not kf(blobs(5), None, five) and bool(kf(blobs(6), None, five))
          and not kf(blobs(5), five, one) and bool(kf(blobs(3), one, five)),
          "CB A2: frame_checks caps pieces at max(2, the pixel source's pieces); a 1-piece key over a 5-piece ready caps 2")
    # plan 13 (A3): keep_specks
    sp = np.asarray(blobs(1)).copy()
    sp[40, 40:43] = (120, 120, 120, 255)               # a 3-px speck away from the block
    drop, keep = (np.asarray(PU.outline(Image.fromarray(sp), k))[40, 40:43, 3] > 0 for k in (False, True))
    check(not drop.any() and keep.all(), "CB A3: outline drops a 3-px speck by default and keeps it with keep_specks")
    with tempfile.TemporaryDirectory() as t4:
        anim = Path(t4)
        (anim / "barbarian.yaml").write_text(yaml.safe_dump(dict(yaml.safe_load((PU.ANIM / "barbarian.yaml").read_text()),
                                                                  keep_specks=1)))
        old = PUm.ANIM
        PUm.ANIM = anim
        try:
            PU.load_cfg("barbarian")
            why = ""
        except ValueError as e:
            why = str(e)
        finally:
            PUm.ANIM = old
    check("keep_specks" in why, "CB A3: load_cfg refuses a non-boolean keep_specks")
    def opaque(c, keep):
        cfg = dict(PU.load_cfg(c), keep_specks=keep, alias_frames=[])
        return [int((np.asarray(PU.battle_inbetweens(c, cfg)[n])[..., 3] > 0).sum()) for n in ("atk_mid", "atk_follow")]
    dots = {c: (opaque(c, False), opaque(c, True)) for c in ("hunter", "ranger") if (PU.ANIM / f"{c}.yaml").is_file()}
    check(all(k > d for off, on in dots.values() for d, k in zip(off, on)),   # hunter / ranger only, where they exist
          f"CB A3: keep_specks keeps the dotted string in atk_mid / atk_follow (opaque px off / on {dots})")
    # plan 11: the barbarian JSON gate: metas() on today's cut equals the committed jsons (all keys but `imported`)
    rec = HU2.recipe("barbarian_berserker")
    _, binfo = HU2.cut(rec)
    same = True
    for row, cid in enumerate(rec["rows"]):
        for name, m in zip(("battle", "battle_kneel"), HU2.metas(cid, "barbarian_berserker", rec, row, binfo, "x")):
            have = json.loads((HU2.HERE / f"approved/{cid}/{name}.json").read_text())
            same &= {k: v for k, v in json.loads(json.dumps(m)).items() if k != "imported"} == \
                {k: v for k, v in have.items() if k != "imported"}
    check(same, "CB A1: metas() on the barbarian_berserker cut equals its four committed jsons (but `imported`)")

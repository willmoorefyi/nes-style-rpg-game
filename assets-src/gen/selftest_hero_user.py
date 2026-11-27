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
    """A 560 x (80 nrows) render: one outlined block per cell standing on row `foot`."""
    cols = colours or PAL
    a = np.zeros((80 * nrows, 560, 4), np.uint8)
    for r in range(nrows):
        for c in range(7):
            x0, y0 = c * 80 + 20, r * 80 + 20
            blk = a[y0:r * 80 + foot + 1, x0:x0 + 30]
            blk[...] = (*cols[0], 255)
            inner = blk[1:-1, 1:-1]
            for i in range(inner.shape[0]):
                inner[i] = (*cols[1 + (i + c + r) % (len(cols) - 1)], 255)
    if cross:
        a[30, 78:83] = (*cols[2], 255)
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

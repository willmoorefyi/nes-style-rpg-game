"""EF-H H1 (docs/ENEMY_FEEDBACK_PLAN.md EF-H): selftests of gen/monster_user.py, the import of a user-rendered sheet.
Synthetic rows (four outlined figures) in a temp generator tree: the split (exactly four 8-connected pieces, specks
dropped, semi-alpha refused), the scale rule (s = 1.0 in the band, shrink above it, an integer upscale under half of
it, the tallest pose's fit), the placement (anchors on the idle's x, feet on the feet row, the widened even cell, the
border clear), the house palette (<= 16 15-bit colours, PX.OUTLINE in every frame), the sha256 guard, approve's
shape and overwrite gate, the byte-for-byte re-import check, and its two consumers (selftest_roster.kneel_ok's
`backend: user` branch; the style lock in selftest.py); then the real dark_wizard recipe."""
from __future__ import annotations

import hashlib
import json
import tempfile
from pathlib import Path
from typing import Callable

import numpy as np
import yaml
from PIL import Image


def figure(h: int, w: int, foot: int, colours: list[tuple[int, int, int]]) -> np.ndarray:
    """An outlined w x h figure with horizontal colour bands and a 3-px foot block `foot` px right of its left side."""
    a = np.zeros((h, w + 8, 4), np.uint8)
    for y in range(h):
        c = colours[(y * len(colours)) // h]
        a[y, 1:w - 1] = (*c, 255)
    a[h - 6:, foot:foot + 3] = (*colours[0], 255)
    m = a[..., 3] > 0
    edge = m & ~(np.pad(m, 1)[2:, 1:-1] & np.pad(m, 1)[:-2, 1:-1] & np.pad(m, 1)[1:-1, 2:] & np.pad(m, 1)[1:-1, :-2])
    a[edge, :3] = (6, 4, 10)
    return a


COLS = [(40, 60, 90), (120, 130, 80), (160, 200, 30), (90, 90, 90), (200, 190, 170)]


def row(heights=(100, 80, 104, 90), widths=(40, 90, 60, 50), speck=False, alpha=255) -> Image.Image:
    sheet = np.zeros((144, 704, 4), np.uint8)
    for k, (h, w) in enumerate(zip(heights, widths)):
        f = figure(h, w, w // 2, COLS)
        x0 = 20 + k * 176
        sheet[135 - h + 1:136, x0:x0 + f.shape[1]] = f
    if speck:
        sheet[5:8, 5:8] = (200, 0, 0, 255)               # 9 px: dropped
    if alpha != 255:
        sheet[100, 30, 3] = alpha
    return Image.fromarray(sheet)


def tree(td: Path, img: Image.Image, sid: str = "syn") -> dict:
    (td / "user_art").mkdir(parents=True, exist_ok=True)
    img.save(td / "user_art" / f"{sid}.png")
    sha = hashlib.sha256((td / "user_art" / f"{sid}.png").read_bytes()).hexdigest()
    rec = {"file": f"user_art/{sid}.png", "sha256": sha,
           "poses": ["idle", "attack", "hurt", "kneel"], "flip": False, "size": "large", "tool": "test",
           "rendered": "2026-11-25", "author": "user", "refs": "unknown"}
    (td / "monster_user.yaml").write_text(yaml.safe_dump({sid: rec}))
    (td / "anim" / "monsters").mkdir(parents=True, exist_ok=True)
    (td / "anim" / "monsters" / f"{sid}.yaml").write_text("sprite: syn\nkneel: {source: ai}\n")
    return rec


def refused(fn) -> bool:
    try:
        fn()
    except SystemExit:
        return True
    return False


def _check_cut(check: Callable[[bool, str], None]) -> None:
    from gen import monster_user as U
    from gen import pixelize as PX
    from gen import spec as S
    band = S.MONSTER_BANDS["large"]
    cells = U.split(row(speck=True))
    check([U.height(m) for _, m in cells] == [100, 80, 104, 90],
          "EF-H split: four pieces left to right, a 9 px speck dropped")
    check(refused(lambda: U.split(Image.fromarray(np.asarray(row())[:, :530].copy())))
          and refused(lambda: U.split(row(alpha=128))),
          "EF-H split: three pieces refused; semi-transparent pixels refused")
    check(U.scale([112, 93, 115, 113], band) == (1.0, "idle in band")
          and U.scale([130, 100, 110, 90], band) == (120 / 130, "idle above band"),
          "EF-H scale: s = 1.0 for dark_wizard's 112 / 115; a 130 px idle shrinks to the band top")
    check(U.scale([40, 30, 42, 35], band) == (2.0, "integer upscale (idle under half the band)")
          and U.scale([80, 70, 82, 75], band) == (1.0, "idle below band")
          and U.scale([110, 90, 140, 100], band) == (round(121 / 140, 4), "fit tallest"),
          "EF-H scale: integer upscale under half the band, 1.0 below it, the tallest pose fits rows 2..122")
    figs, pal = U.quantize(cells, 1.0)
    frames, pinfo = U.place(figs, band)
    anchors = [U.anchor(np.asarray(f)) for f in frames]
    low = [int(np.where(np.asarray(f)[..., 3].any(1))[0].max()) for f in frames]
    a = [np.asarray(f) for f in frames]
    border = any(x[0].any() or x[-1].any() or x[:, 0].any() or x[:, -1].any() for x in (m[..., 3] for m in a))
    check(max(anchors) - min(anchors) <= 1.0 and low == [122] * 4 and pinfo["cw"] % 2 == 0 and pinfo["cw"] >= 128
          and all(f.size == (pinfo["cw"], 128) for f in frames) and not border,
          f"EF-H place: anchors on the idle's x {anchors}, feet on row 122, even cell {pinfo['cw']}, border clear")
    cols = {tuple(c) for x in a for c in x[x[..., 3] > 0][:, :3].tolist()}
    snapped = all(tuple(int(v) for v in PX.snap15(np.array(c, np.float32))) == c for c in cols - {PX.OUTLINE})
    check(len(pal) <= 16 and len(cols) <= 16 and snapped
          and all((x[x[..., 3] > 0][:, :3] == PX.OUTLINE).all(1).any() for x in a),
          f"EF-H colours: one house palette, {len(cols)} <= 16 15-bit colours, PX.OUTLINE in every frame")
    wide = U.split(row(widths=(40, 200, 60, 50)))
    _, winfo = U.place(U.quantize(wide, 1.0)[0], band)
    check(winfo["cw"] > 128, f"EF-H place: a wide attack widens the cell ({winfo['cw']})")


def _check_keep(check: Callable[[bool, str], None]) -> None:
    """EF-H pirate: a crimson coat edge is kept (no magenta-fringe erosion on a binary-alpha sheet), and a recipe
    `reserve` gives a small region (a face's skin, a blade's sparkle) its own palette slots within the 16."""
    from gen import monster_user as U
    from gen import monster_user_palette as UP
    from gen import pixelize as PX
    from gen import spec as S
    band = S.MONSTER_BANDS["large"]
    a = np.asarray(row()).copy()
    fig = a[..., 3] > 0
    body = fig & (a[..., :3].max(2) > 40)                                        # a many-colour body (k-means merges)
    jit = np.random.default_rng(7).integers(-14, 15, (*a.shape[:2], 3))
    a[body, :3] = np.clip(a[body, :3].astype(int) + jit[body], 41, 235).astype(np.uint8)
    edge = fig & ~np.pad(fig, 1)[1:-1, 2:]                                       # every right-edge px of each figure
    a[edge, :3] = (181, 42, 92)                                                  # the pirate's coat crimson
    a[40:44, 40:46] = (228, 136, 95, 255)                                        # a skin patch on the idle (24 px)
    a[60:63, 30:34] = (240, 250, 255, 255)                                       # a sparkle on the idle (12 px)
    a[80:88, 216:224] = (185, 38, 170, 255)                                      # vampire_lord's magenta magic (attack)
    img = Image.fromarray(a)
    cells = U.split(img)
    figs, pal0 = U.quantize(cells, 1.0)
    frames, info = U.place(figs, band)
    def lost(colour):
        return sum(int((~(np.asarray(f)[np.where(m)[0] + ty, np.where(m)[1] + tx, 3] > 0)
                        | (np.asarray(f)[np.where(m)[0] + ty, np.where(m)[1] + tx, :3] == PX.OUTLINE).all(1))[
                           (rc[m] == colour).all(1)].sum())
                   for (rc, m), f, (tx, ty) in zip(cells, frames, info["offsets"]))
    check(lost((181, 42, 92)) == 0 and lost((185, 38, 170)) == 0,
          f"EF-H keep: on a binary-alpha sheet the alpha is the figure: crimson edge px are not eroded as key fringe "
          f"({lost((181, 42, 92))} lost) and magenta magic is not keyed out as background ({lost((185, 38, 170))} lost)")
    rec = {"reserve": [{"name": "skin", "select": "skin", "slots": 1, "max_err": 20, "boxes": [[38, 38, 48, 46]]},
                       {"name": "steel", "select": "bright", "slots": 1, "max_err": 20, "boxes": [[28, 58, 36, 65]]}]}
    regions = UP.masks(img, rec)
    _, pal = U.quantize(cells, 1.0, lambda p: UP.reserve(p, img, rec, regions))
    def near(c, p):
        return float(np.sqrt(((p.astype(np.float32) - np.array(c, np.float32)) ** 2).sum(1)).min())
    skin, spark = (228, 136, 95), (240, 250, 255)
    check(near(skin, pal0) > 20 and near(spark, pal0) > 20 and int(regions["skin"].sum()) == 24
          and int(regions["steel"].sum()) == 12 and len(pal) <= 16 and near(skin, pal) <= 12 and near(spark, pal) <= 12
          and tuple(int(v) for v in pal[int(pal.sum(1).argmin())]) == PX.OUTLINE,
          f"EF-H reserve: the skin patch and the sparkle, merged by the plain house palette ({near(skin, pal0):.1f}, "
          f"{near(spark, pal0):.1f}), get their own slots ({near(skin, pal):.1f}, {near(spark, pal):.1f}), "
          f"<= 16 colours, PX.OUTLINE the darkest")
    check(refused(lambda: UP.masks(img, {"reserve": [{"name": "x", "select": "nope"}]})),
          "EF-H reserve: an unknown colour class is refused")


def _check_magic(check: Callable[[bool, str], None]) -> None:
    """EF-H vampire_lord: the attack's drawn purple-magenta magic is art, not key fringe. The in-between check
    (anim_checks.magenta) takes a per-sprite allowance (monster_check.MAGENTA_ART): exactly the approved palette's
    magic colours, each one the quantized colour of magic px of the user's render."""
    from gen import anim_checks as C
    from gen import monster_check as MC
    from gen import monster_user as U
    from gen import monster_user_palette as UP
    a = np.zeros((8, 8, 4), np.uint8)
    a[2:6, 2:6] = (206, 66, 189, 255)
    check(bool(C.magenta(a)) and not C.magenta(a, ((206, 66, 189),)) and bool(C.magenta(a, ((156, 16, 140),))),
          "EF-H magic: a magenta-ish px fails the key-fringe check unless its exact colour is allowed")
    allow = getattr(MC, "MAGENTA_ART", None)
    ok, why = allow is not None and set(allow) == {"vampire_lord"}, f"MAGENTA_ART {allow}"
    if ok:
        rec = U.recipe("vampire_lord")
        img = U.source(rec)
        frames, info = U.cut("vampire_lord", rec)
        magic = UP.masks(img, {"reserve": [r for r in rec["reserve"] if r["name"] == "magic"]})["magic"]
        (oy, ox), (tx, ty) = UP.origins(img, U.SPECK)[1], info["offsets"][1]
        vy, vx = np.where(magic[oy:oy + 128, ox:ox + info["cw"]])
        drawn = {tuple(int(v) for v in c) for c in np.asarray(frames[1])[vy + ty, vx + tx, :3]}
        pal = {tuple(int(v) for v in c) for c in info["palette"]}
        flagged = {c for c in pal if C.magenta(np.array([[[*c, 255]]], np.uint8))}
        ok, why = set(allow["vampire_lord"]) == flagged and flagged <= drawn, f"allowed {allow['vampire_lord']}, " \
            f"palette colours the check flags {sorted(flagged)}, the magic px's colours {sorted(drawn)}"
    check(ok, f"EF-H magic: monster_check.MAGENTA_ART allows only vampire_lord, exactly its palette's flagged colours, "
              f"each drawn by the render's magic ({why})")


def _check_swap(check: Callable[[bool, str], None]) -> None:
    """EF-H integrator ruling (2026-11-25, open for the user's veto): vampire_lord's attack key draws 1.67x the idle's
    area (the robe and the hair flung out), so the rigid-lean in-betweens cannot lift the idle -> attack swap step over
    the keys' own IoU + 0.02; monster_check.ATTACK_SWAP_IOU lowers that margin for its attack sequence only."""
    from gen import anim_checks as C
    from gen import monster_check as MC
    k0, k1 = np.zeros((40, 40, 4), np.uint8), np.zeros((40, 40, 4), np.uint8)
    k0[5:35, 10:20, 3] = 255
    k1[5:35, 14:24, 3] = 255                            # the keys' IoU 0.429
    p, n = k0.copy(), k1.copy()
    n[5:35, 24, 3] = 255                                # the swap step a shade below the keys' IoU (0.4)
    span, h = (k0, k1), 40
    fails = [e for e in C.continuity(p, n, span, h) if "IoU" in e]
    passes = [e for e in C.continuity(p, n, span, h, iou_margin=-0.03) if "IoU" in e]
    check(bool(fails) and not passes and getattr(MC, "ATTACK_SWAP_IOU", None) == {"vampire_lord": -0.03},
          f"EF-H swap: the adjacent-IoU margin (+0.02 over the keys' IoU) is lowered to -0.03 only for vampire_lord's "
          f"attack ({fails} / {passes}; ATTACK_SWAP_IOU {getattr(MC, 'ATTACK_SWAP_IOU', None)})")


def _check_tree(check: Callable[[bool, str], None]) -> None:
    from gen import monster_user as U
    from gen import selftest_roster as SRo
    with tempfile.TemporaryDirectory() as t:
        td = Path(t)
        rec = tree(td, row())
        frames, info = U.cut("syn", rec, td)
        check(info["scale"] == 1.0 and info["error"]["max"] >= 0 and info["report"]["outline"],
              f"EF-H cut: the measures {info['error']}")
        bad = {**rec, "sha256": "0" * 64}
        check(refused(lambda: U.source(bad, td)), "EF-H source: a sha256 mismatch is refused")
        appr = td / "approved"
        (appr / "syn").mkdir(parents=True)
        Image.new("RGBA", (80, 80), (1, 2, 3, 255)).save(appr / "syn" / "monster_small.png")
        refusal = refused(lambda: U.approve("syn", appr, "2026-11-25"))
        arc = appr / "_retired" / "syn_v1"
        arc.mkdir(parents=True)
        (arc / "monster_small.png").write_bytes((appr / "syn" / "monster_small.png").read_bytes())
        paths = U.approve("syn", appr, "2026-11-25")
        meta = json.loads((appr / "syn" / "monster_large.json").read_text())
        kneel = json.loads((appr / "syn" / "kneel.json").read_text())
        check(refusal and len(paths) == 4 and not (appr / "syn" / "monster_small.png").exists()
              and meta["backend"] == kneel["backend"] == "user" and meta["grid"] == [info["cw"], 128]
              and meta["layout"] == [3, 1] and meta["bottom_row"] == 122 and kneel["foot_row"] == 122
              and "j0" not in kneel and meta["sha256"] == rec["sha256"]
              and Image.open(appr / "syn" / "kneel.png").size == (info["cw"], 128),
              "EF-H approve: refused without an archive of monster_small; then monster_large + kneel (backend user, "
              "grid, layout, bottom_row, foot_row, no j0), monster_small removed")
        check(U.check(meta, td) is None and U.check(kneel, td) is None,
              "EF-H check: the approved sheet and kneel re-import byte for byte")
        k = np.asarray(Image.open(appr / "syn" / "kneel.png")).copy()
        k[60, 60] = (255, 255, 255, 255)
        Image.fromarray(k).save(appr / "syn" / "kneel.png")
        check(U.check(kneel, td) is not None and U.check({**meta, "sha256": "1" * 64}, td) is not None,
              "EF-H check: a changed kneel png and a changed sha256 are refused")
        k[60, 60] = np.asarray(frames[3])[60, 60]
        Image.fromarray(k).save(appr / "syn" / "kneel.png")
        ok = SRo.kneel_ok(kneel, [], [], td)
        (td / "anim" / "monsters" / "syn.yaml").write_text("sprite: syn\nkneel: {source: user}\n")
        check(ok is None and SRo.kneel_ok(kneel, [], [], td) is not None,
              f"EF-H kneel_ok: a `backend: user` kneel passes by re-import with `kneel: {{source: ai}}` ({ok}); "
              "`source: user` is refused")


def _check_real(check: Callable[[bool, str], None]) -> None:
    from gen import monster_user as U
    rec = U.recipe("dark_wizard")
    frames, info = U.cut("dark_wizard", rec)
    check(info["scale"] == 1.0 and info["native_heights"][0] == 112 and max(info["native_heights"]) == 115
          and info["cw"] >= 170 and info["error"]["glow_kept"] >= 0.95 and info["report"]["edges_ok"],
          f"EF-H dark_wizard: s = 1.0 (idle 112, tallest 115), cw {info['cw']} >= 170, glow kept "
          f"{info['error']['glow_kept']}, edges ok")
    meta_p = U.HERE / "approved" / "dark_wizard" / "monster_large.json"
    if meta_p.is_file():
        for name in ("monster_large", "kneel"):
            meta = json.loads((U.HERE / "approved" / "dark_wizard" / f"{name}.json").read_text())
            check(meta.get("backend") == "user" and U.check(meta) is None,
                  f"EF-H dark_wizard {name}: backend user, re-imported byte for byte")


def run_monster_user(check: Callable[[bool, str], None]) -> None:
    _check_cut(check)
    _check_keep(check)
    _check_magic(check)
    _check_swap(check)
    _check_tree(check)
    _check_real(check)

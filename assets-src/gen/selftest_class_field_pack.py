"""Pass CFP (docs/CLASS_FIELD_PACKS_PLAN.md 5): selftests of gen/class_field_pack.py, the ChatGPT walk-sheet pack
builder. A fixture pair (synthetic 2 x 7 battle sheets, one with a body box and a weapon view; the tracked warrior,
knight and boy field sheets as the references) is built twice: every file present, byte-identical trees, the design
crops equal to their source cells, the knight's side row mirrored to face left, the prompt's layout lines, the
promotion line only for the enhanced class, the refusals; then the real data file validates (and its battle sheets are
cropped where present). Reads no gen/cache and writes only temp dirs."""
from __future__ import annotations

import copy
import json
import tempfile
from pathlib import Path
from typing import Callable

import numpy as np
import yaml
from PIL import Image

FILES = ("prompt.txt", "README.md", "design_reference.png", "design_native.png", "poses_reference.png",
         "poses_native_144x288.png", "walk_reference.png", "grid_guide.png")
LINES = ("exactly 144 x 288 pixels", "48 x 96 cells", "row 93", "facing LEFT", "WALK CYCLE EMPHASIS", "OPPOSITE",
         "at most 46 px wide", "at most 92 px tall", "ONE connected figure per cell")


def battle_sheet(cw: int, ch: int, seed: int, box: tuple[int, int, int, int] | None = None) -> Image.Image:
    """2 rows x 7 cells; each cell (or its box) a block of its own colour with a 1 px dark outline."""
    a = np.zeros((2 * ch, 7 * cw, 4), np.uint8)
    for r in range(2):
        for c in range(7):
            x0, y0, x1, y1 = box or (8, 8, cw - 8, ch - 4)
            col = ((40 * c + seed) % 256, (90 * r + 30 + seed) % 256, (17 * c + 60 * r + 100) % 256, 255)
            a[r * ch + y0:r * ch + y1, c * cw + x0:c * cw + x1] = (16, 16, 24, 255)
            a[r * ch + y0 + 1:r * ch + y1 - 1, c * cw + x0 + 1:c * cw + x1 - 1] = col
            if box:                                       # a long weapon leaving the box
                a[r * ch + 2:r * ch + y0, c * cw + x0 + 4] = (90, 60, 30, 255)
    return Image.fromarray(a)


def fixture(td: Path) -> Path:
    battle_sheet(80, 80, 0).save(td / "pair_a.png")
    battle_sheet(160, 144, 50, (72, 64, 152, 144)).save(td / "pair_b.png")
    common = {"poses": ["ready", "victory"], "look": "a test hero in grey", "carry": "the test blade at the hip"}
    data = {
        "defaults": {"walk_reference": "boy"},
        "fx_base": {**common, "name": "Fxbase", "tier": "base", "partner": "fx_plus", "battle_sheet": str(td / "pair_a.png"),
                    "row": 0, "cell": [80, 80], "body_box": None, "weapon_view": None, "stand_in": "warrior"},
        "fx_plus": {**common, "name": "Fxplus", "tier": "enhanced", "partner": "fx_base",
                    "battle_sheet": str(td / "pair_b.png"), "row": 1, "cell": [160, 144],
                    "body_box": [72, 64, 152, 144], "weapon_view": "victory", "stand_in": "knight"},
    }
    p = td / "packs.yaml"
    p.write_text(yaml.safe_dump(data, sort_keys=False))
    return p


def tree_bytes(root: Path) -> dict[str, bytes]:
    return {str(f.relative_to(root)): f.read_bytes() for f in sorted(root.rglob("*")) if f.is_file()}


def refused(fn: Callable[[], object]) -> str | None:
    from gen import class_field_pack as C
    try:
        fn()
    except C.PackError as e:
        return str(e)
    return None


def run_class_field_pack(check: Callable[[bool, str], None]) -> None:
    from gen import class_field_pack as C
    with tempfile.TemporaryDirectory() as tdn:
        td = Path(tdn)
        data = fixture(td)
        C.build(["fx_base", "fx_plus"], td / "a", data)
        C.build(["fx_base", "fx_plus"], td / "b", data)
        missing = [f"{c}/{f}" for c in ("fx_base", "fx_plus") for f in FILES if not (td / "a" / c / f).exists()]
        missing += [f for f in ("README.md", "_template/prompt_template.txt", "_template/README.md")
                    if not (td / "a" / f).exists()]
        check(not missing, f"CFP: every pack file and the root index / _template written {missing or ''}")
        check(tree_bytes(td / "a") == tree_bytes(td / "b"), "CFP: two builds are byte-identical")

        # the design crops are the source cells / body box (trimmed to the opaque box + 2 px)
        _, entries = C.load(data)
        e1, e2 = entries["fx_base"], entries["fx_plus"]
        src = Image.open(td / "pair_a.png").convert("RGBA")
        ready = np.asarray(C.trim(src.crop((0, 0, 80, 80))))
        check(np.array_equal(np.asarray(C.trim(C.battle_crop(e1, "ready"))), ready),
              "CFP: the READY crop is the base row's first cell")
        srcb = Image.open(td / "pair_b.png").convert("RGBA")
        vic = srcb.crop((5 * 160 + 72, 144 + 64, 5 * 160 + 152, 144 + 144))
        check(np.array_equal(np.asarray(C.battle_crop(e2, "victory")), np.asarray(vic)),
              "CFP: the body-box crop is the enhanced row's VICTORY box (the weapon outside it cut away)")
        whole = np.asarray(C.battle_crop(e2, "victory", whole=True))
        check(whole.shape[:2] == (144, 160) and (whole[:64, ..., 3] > 0).any(),
              "CFP: the weapon view is the whole cell, the long weapon included")
        nat = Image.open(td / "a" / "fx_base" / "design_native.png")
        check(nat.width >= 2 * (ready.shape[1]), "CFP: design_native holds both poses at 1x")

        # the stand-in sheet as the game draws it: the knight's flip_rows [left] mirrored, warrior untouched
        knight = np.asarray(Image.open(td / "a" / "fx_plus" / "poses_native_144x288.png").convert("RGBA"))
        raw = np.asarray(Image.open(C.APPROVED / "knight" / "field.png").convert("RGBA"))
        meta = json.loads((C.APPROVED / "knight" / "field.json").read_text())
        side_ok = "left" in meta.get("flip_rows", []) and all(
            np.array_equal(knight[192:288, c * 48:(c + 1) * 48], raw[192:288, c * 48:(c + 1) * 48][:, ::-1])
            for c in range(3)) and np.array_equal(knight[:192], raw[:192])
        check(side_ok, "CFP: the knight's side row is mirrored to face LEFT, its other rows unchanged")
        war = np.asarray(Image.open(td / "a" / "fx_base" / "poses_native_144x288.png").convert("RGBA"))
        check(np.array_equal(war, np.asarray(Image.open(C.APPROVED / "warrior" / "field.png").convert("RGBA"))),
              "CFP: the warrior (no flips) is its approved sheet as is")
        walk = np.asarray(Image.open(td / "a" / "fx_base" / "walk_reference.png").convert("RGBA"))
        check(walk.shape[:2] == (288, 144), "CFP: walk_reference is the boy's 144 x 288 sheet at 1x")

        # the prompt lines
        p1 = (td / "a" / "fx_base" / "prompt.txt").read_text()
        p2 = (td / "a" / "fx_plus" / "prompt.txt").read_text()
        lost = [s for s in LINES if s not in p1 or s not in p2]
        check(not lost, f"CFP: both prompts hold the layout lines {lost or ''}")
        check("the test blade at the hip" in p1 and "a test hero in grey" in p1 and "{" not in p1,
              "CFP: the look and carry are filled in, no placeholder left")
        check("same person as the Fxbase" in p2 and "same person as the" not in p1,
              "CFP: the promotion line only in the enhanced prompt, naming the base class")
        r2 = (td / "a" / "fx_plus" / "README.md").read_text()
        check("~/temp/fx_plus_field_sheet.png" in r2 and "field_user.py cut fx_plus" in r2,
              "CFP: the README names the save file and the import steps")

        # refusals
        raw_data = yaml.safe_load(data.read_text())

        def bad(mut) -> str | None:
            d = copy.deepcopy(raw_data)
            mut(d)
            q = td / "bad.yaml"
            q.write_text(yaml.safe_dump(d))
            return refused(lambda: C.load(q))
        check("partner" in (bad(lambda d: d["fx_plus"].update(partner="fx_none")) or ""),
              "CFP: a partner that does not name back is refused")
        check("unknown pose" in (bad(lambda d: d["fx_base"].update(poses=["dance"])) or ""),
              "CFP: an unknown pose is refused")
        check("no approved field sheet" in (bad(lambda d: d["fx_base"].update(stand_in="no_such_hero")) or ""),
              "CFP: a stand-in without a field sheet is refused")
        check("body_box" in (bad(lambda d: d["fx_plus"].update(body_box=[72, 64, 200, 144])) or ""),
              "CFP: a body box outside the cell is refused")
        check("unknown class" in (refused(lambda: C.build(["fx_nobody"], td / "c", data)) or ""),
              "CFP: an unknown class id is refused")

    # the real data file
    why = refused(lambda: C.load())
    check(why is None, f"CFP: class_field_packs.yaml validates {why or ''}")
    if why is None:
        _, entries = C.load()
        for cid, e in entries.items():
            if not C.sheet_path(e).exists():
                print(f"  skip CFP {cid}: battle sheet {C.sheet_path(e)} not on this machine")
                continue
            empty = [p for p in e["poses"] if not (np.asarray(C.battle_crop(e, p))[..., 3] > 0).any()]
            check(not empty, f"CFP: {cid}'s battle crops are non-empty {empty or ''}")


if __name__ == "__main__":
    import sys
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    run_class_field_pack(_check)
    sys.exit(1 if fails else 0)

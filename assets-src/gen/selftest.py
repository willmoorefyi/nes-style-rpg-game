"""Offline self-checks for the sprite pipeline (no network, no backends imported).

  python3 -I assets-src/gen/selftest.py

Covers docs/ART_2X_PLAN.md Phase 1 item 12: guide geometry, crop-bleed, magenta key, budget guard + ledger,
and the size-reference crop.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from gen import generate as GEN  # noqa: E402
from gen import guides as G  # noqa: E402
from gen import pixelize as PX  # noqa: E402
from gen import spec as S  # noqa: E402

FAILS: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        FAILS.append(msg)


def native_masks(geom: S.SheetGeom, poses, order):
    g = np.asarray(G.sheet(poses, order, geom).convert("RGB")).astype(int)
    cw, ch = geom.cell_px
    cols = geom.layout[0]
    out = {}
    for i, name in enumerate(order):
        cell = g[(i // cols) * ch:(i // cols + 1) * ch, (i % cols) * cw:(i % cols + 1) * cw]
        drawn = cell.sum(2) < 750
        weapon = np.abs(cell - np.array(G.WEAPON)).sum(2) < 6
        to_nat = lambda m: np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(geom.grid, Image.Resampling.BOX)) > 127
        out[name] = (to_nat(drawn), to_nat(drawn & ~weapon))
    return out


def test_geometry() -> None:
    print("battle geometry")
    gw, gh = S.BATTLE_GEOM.grid
    for name, (allm, body) in native_masks(S.BATTLE_GEOM, S.BATTLE_POSES, S.BATTLE_ORDER).items():
        rows = np.where(body.any(1))[0]
        arows, acols = np.where(allm.any(1))[0], np.where(allm.any(0))[0]
        h = int(rows.max() - rows.min() + 1)
        lo, hi = (45, 53) if name == "down" else (68, 76)
        check(abs(int(rows.max()) - S.BATTLE_GEOM.bottom_row) <= 1, f"{name}: last opaque row {rows.max()} ~ {S.BATTLE_GEOM.bottom_row}")
        check(lo <= h <= hi, f"{name}: height {h} without weapon in {lo}-{hi}")
        check(arows.min() >= 0 and arows.max() <= gh - 1 and acols.min() >= 0 and acols.max() <= gw - 1
              and arows.min() > 0 and acols.min() > 0 and acols.max() < gw - 1,
              f"{name}: fits cell incl. weapon (rows {arows.min()}-{arows.max()}, cols {acols.min()}-{acols.max()})")
    print("field geometry")
    for d in S.FIELD_DIRECTIONS:
        for name, (allm, _) in native_masks(S.FIELD_GEOM, S.FIELD_POSES, S.field_order(d)).items():
            rows, cols = np.where(allm.any(1))[0], np.where(allm.any(0))[0]
            h, w = int(rows.max() - rows.min() + 1), int(cols.max() - cols.min() + 1)
            check(abs(int(rows.max()) - S.FIELD_GEOM.bottom_row) <= 1 and 41 <= h <= 46 and w <= 23,
                  f"{name}: bottom {rows.max()}, height {h} (41-46), width {w} (<=23)")


def _figure_cell(bg, size=(256, 256)) -> tuple[Image.Image, np.ndarray]:
    img = Image.new("RGB", size, bg)
    d = ImageDraw.Draw(img)
    d.ellipse([88, 40, 168, 120], fill=(250, 250, 250), outline=(0, 0, 0), width=6)     # white plume/helmet
    d.rectangle([100, 120, 156, 220], fill=(40, 70, 200), outline=(0, 0, 0), width=6)   # blue body
    guide = np.zeros((size[1], size[0]), bool)
    guide[40:221, 88:169] = True
    return img, guide


def test_crop_bleed_and_keys() -> None:
    print("pixelize")
    img, guide = _figure_cell((255, 255, 255))
    ImageDraw.Draw(img).rectangle([236, 20, 255, 240], fill=(10, 10, 10))   # bleed from the neighbouring cell
    out = np.asarray(PX.pixelize(img, guide, (32, 32), colors=6))
    check(not out[:, 29:, 3].any(), "crop bleed: bar outside the guide is dropped")
    mag, guide = _figure_cell((255, 0, 255))
    check(PX.is_magenta_bg(np.asarray(mag)), "magenta background detected")
    out = np.asarray(PX.pixelize(mag, guide, (32, 32), colors=6))
    whites = (out[..., 3] > 0) & (out[..., :3].min(axis=2) > 200)
    check(whites.sum() >= 8, f"magenta key keeps white parts ({whites.sum()} white px)")
    check(not ((out[..., 0] > 200) & (out[..., 1] < 80) & (out[..., 2] > 200) & (out[..., 3] > 0)).any(),
          "no magenta left in the sprite")
    aligned = np.asarray(PX.pixelize(mag, guide, (32, 32), colors=6, bottom_row=30))
    check(int(np.where(aligned[..., 3].any(1))[0].max()) == 30, "bottom_row alignment")
    dark_blue = np.zeros((64, 64, 3), np.uint8); dark_blue[...] = (30, 40, 120)
    check(not (dark_blue.max(axis=2) < 40).any(), "ink rule: dark saturated blue is not outline")


class _FakeSheet:
    def __init__(self, name):
        self.name = name


def _req(key: str, sheet="battle", fail=False):
    def run():
        if fail:
            raise RuntimeError("no image")
        return Image.new("RGBA", (4, 4))
    return GEN.Request("knight", _FakeSheet(sheet), 1234, "gemini", "m", Image.new("RGB", (4, 4)), key, "p", [], run)


def test_budget_guard() -> None:
    print("budget guard")
    def refused(fn) -> bool:
        try:
            fn()
        except SystemExit:
            return True
        return False
    a, b = _req("selftest-a"), _req("selftest-b")
    check(refused(lambda: GEN.check_budget([a, b], paid=True, max_paid=1, retry=False, ledger=[])), "2 misses > max-paid 1 refused")
    check(refused(lambda: GEN.check_budget([a], paid=False, max_paid=1, retry=False, ledger=[])), "uncached without --paid refused")
    check(GEN.check_budget([a], paid=True, max_paid=1, retry=False, ledger=[]) == [a], "1 miss with --paid allowed")
    with tempfile.TemporaryDirectory() as tmp:
        led = Path(tmp) / "ledger.jsonl"
        try:
            GEN.execute(_req("selftest-fail", fail=True), led)
        except RuntimeError:
            pass
        entries = GEN.read_ledger(led)
        check([e["event"] for e in entries] == ["attempt", "result"] and entries[1]["ok"] is False,
              "failed call is ledgered before and after (counts as spent)")
        edited = _req("selftest-edited-prompt")
        check(refused(lambda: GEN.check_budget([edited], paid=True, max_paid=1, retry=False, ledger=entries)),
              "earlier attempt at the same checkpoint blocks a new key without --retry")
        check(GEN.check_budget([edited], paid=True, max_paid=1, retry=True, ledger=entries) == [edited], "--retry allows it")
        other = _req("selftest-other", sheet="field_down")
        check(GEN.check_budget([other], paid=True, max_paid=1, retry=False, ledger=entries) == [other],
              "a different checkpoint is not blocked")


def test_size_ref() -> None:
    print("size reference")
    if not GEN.SIZE_REF.exists():
        check(False, f"{GEN.SIZE_REF} missing")
        return
    a = np.asarray(Image.open(GEN.SIZE_REF).convert("RGB")).astype(int)
    red = (a[..., 0] > 150) & (a[..., 1] < 70) & (a[..., 2] < 70)
    ys, xs = np.where(red)
    check(red.sum() > 150 and xs.min() > 5 and xs.max() < a.shape[1] - 5 and ys.min() > 5,
          f"warrior (red armour, {red.sum()} px) is inside the crop")


if __name__ == "__main__":
    test_geometry()
    test_crop_bleed_and_keys()
    test_budget_guard()
    test_size_ref()
    print(f"\n{'ALL PASSED' if not FAILS else f'{len(FAILS)} FAILED'}")
    sys.exit(1 if FAILS else 0)

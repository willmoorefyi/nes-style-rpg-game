"""The AR dungeon props in the kits (AR-P2): the approved sheet gen/approved/dungeon/props_ar.{png,json} (cut by
gen/prop_cut.py from the render cache) puts its cells ar_<id>_<r>_<c> into every kit, like the landmark sheets;
gen/prop_spec.py names every prop and its cells, so a code-drawn placeholder stands in while the sheet is missing.

A lit prop whose flame has a tongue (its top quarter drops out column by column, src/scenes/exploration/flame/) is
baked without its tongue pixels: the runtime draws them, so a dropped one shows the wall or floor behind it.
"""
from __future__ import annotations

import json
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw

T = 48
GEN = Path(__file__).resolve().parents[1]
if str(GEN) not in sys.path:
    sys.path.insert(0, str(GEN))
from gen.prop_spec import SPEC  # noqa: E402

SHEET = Path("dungeon") / "props_ar"


def prop_parts(pid: str) -> list[list[str]]:
    """The deco `parts` of prop `pid` (rows of cell names)."""
    w, h = SPEC[pid][3]
    return [[f"ar_{pid}_{r}_{c}" for c in range(w)] for r in range(h)]


CELLS = {n: (pid, r, c) for pid in SPEC for r, row in enumerate(prop_parts(pid)) for c, n in enumerate(row)}


@lru_cache(maxsize=None)
def _placeholder(pid: str) -> Image.Image:
    w, h = SPEC[pid][3]
    im = Image.new("RGBA", (w * T, h * T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([w * T // 5, 6, w * T * 4 // 5, h * T - 3], fill=(120, 110, 100, 255), outline=(40, 36, 34, 255))
    d.text((w * T // 5 + 3, 8), pid[:2].upper(), fill=(250, 250, 250, 255))
    return im


def placeholder(name: str) -> Image.Image:
    pid, r, c = CELLS[name]
    return _placeholder(pid).crop((c * T, r * T, (c + 1) * T, (r + 1) * T))


def tongue_rows(rows: list[str]) -> int:
    """The flame rows (from its top) that may drop out: the top quarter, at least one (the runtime's rule too)."""
    return max(1, (len(rows) - 1) // 4)


@lru_cache(maxsize=None)
def approved(approved_dir: Path) -> dict[str, Image.Image]:
    """The approved prop cells by part name, tongue pixels cleared (a missing sheet adds nothing)."""
    meta_path = (approved_dir / SHEET).with_suffix(".json")
    if not meta_path.is_file():
        return {}
    meta = json.loads(meta_path.read_text())
    img = Image.open(meta_path.with_suffix(".png")).convert("RGBA")
    px = img.load()
    for p in meta["props"].values():
        f = p.get("flame")
        if not f or not f["tongue"]:
            continue
        r0, c0 = p["at"]
        for dy, row in enumerate(f["rows"][:tongue_rows(f["rows"])]):
            for dx, ch in enumerate(row):
                if ch != ".":
                    px[c0 * T + f["x"] + dx, r0 * T + f["y"] + dy] = (0, 0, 0, 0)
    t = meta.get("tile", T)
    return {n: img.crop((c * t, r * t, (c + 1) * t, (r + 1) * t))
            for r, row in enumerate(meta["cells"]) for c, n in enumerate(row) if n in CELLS}


@lru_cache(maxsize=None)
def meta(approved_dir: Path) -> dict:
    """The sheet's per-prop records (cells, place, flame), {} while it is missing."""
    meta_path = (approved_dir / SHEET).with_suffix(".json")
    return json.loads(meta_path.read_text())["props"] if meta_path.is_file() else {}

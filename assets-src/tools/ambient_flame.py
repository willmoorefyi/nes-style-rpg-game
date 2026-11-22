"""The `flame` ambient entries of a map source (AR-P2), checked and resolved for the compiled map; drawn by
src/scenes/exploration/flame/ (FieldAmbient.ts).

Source: {kind: flame, prop: <id>, x, y, style?} lights the AR prop placed with its top-left cell at (x, y): the
flame pixels come from the prop sheet (gen/approved/dungeon/props_ar.json, kit_props), the light's centre is their
box centre, and `foot` (the row characters sort with) is the prop's bottom row. Or {kind: flame, x, y, ox?, oy?,
style, glow?} for a light with no prop (the glow only).
Compiled: {kind: flame, x, y, ox, oy (the centre: cell and art px), style, glow (radius, art px), foot, mask?:
{dx, dy (its top-left from the centre, art px), rows (ramp levels '1'-'4', '.' none), tongue}}.
"""
from __future__ import annotations

from pathlib import Path

import kit_props as KP

STYLES = ("fire", "purple", "green", "cyan", "lamp")
KEYS = {"kind", "x", "y", "ox", "oy", "style", "prop", "glow"}
T = 48
APPROVED = Path(__file__).resolve().parents[1] / "gen" / "approved"


def flame_entry(i: int, e: dict, width: int, height: int, approved_dir: Path = APPROVED) -> dict:
    if set(e) - KEYS:
        raise ValueError(f"ambient[{i}]: unknown flame key(s) {sorted(set(e) - KEYS)}")
    x, y = e.get("x"), e.get("y")
    if not all(isinstance(v, int) for v in (x, y)) or not (0 <= x < width and 0 <= y < height):
        raise ValueError(f"ambient[{i}]: flame cell ({x}, {y}) off the {width}x{height} map")
    if e.get("prop") is None:
        ox, oy, glow = e.get("ox", 24), e.get("oy", 24), e.get("glow", 34)
        if e.get("style") not in STYLES or not all(isinstance(v, int) for v in (ox, oy, glow)) \
                or not (0 <= ox < T and 0 <= oy < T and 8 <= glow <= 64):
            raise ValueError(f"ambient[{i}]: a flame without a prop needs style ({'|'.join(STYLES)}), ox / oy in "
                             f"0-47 and glow in 8-64, got {e!r}")
        return {"kind": "flame", "x": x, "y": y, "ox": ox, "oy": oy, "style": e["style"], "glow": glow, "foot": y}
    props = KP.meta(approved_dir)
    p = props.get(e["prop"])
    if p is None or "flame" not in p:
        raise ValueError(f"ambient[{i}]: {e['prop']!r} is not a lit prop of the AR prop sheet")
    if set(e) & {"ox", "oy", "glow"}:
        raise ValueError(f"ambient[{i}]: a prop flame takes its centre and glow from the prop sheet")
    f = p["flame"]
    style = e.get("style", f["style"])
    if style not in STYLES:
        raise ValueError(f"ambient[{i}]: style {style!r} not in {STYLES}")
    cx = f["x"] + len(f["rows"][0]) // 2
    cy = f["y"] + len(f["rows"]) // 2
    w, h = p["cells"]
    if not (x + w <= width and y + h <= height):
        raise ValueError(f"ambient[{i}]: prop {e['prop']} at ({x}, {y}) runs off the map")
    return {"kind": "flame", "x": x + cx // T, "y": y + cy // T, "ox": cx % T, "oy": cy % T, "style": style,
            "glow": f["glow"], "foot": y + h - 1,
            "mask": {"dx": f["x"] - cx, "dy": f["y"] - cy, "rows": list(f["rows"]), "tongue": f["tongue"]}}

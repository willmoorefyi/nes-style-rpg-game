"""`python3 -I assets-src/tools/kit.py --selftest`: the W1-D kit additions (docs/WORLD_PLAN.md 5.2, QUEST_PLAN 4.3).

One `OK <name>` line per landmark placeholder (kit.LANDMARKS), per material remap preset (kit.REMAPS), per part
recolour (kit.RECOLORS, only those that are not also a preset) and for the `swamp` material. Offline: placeholders
and the approved kit art only, no paid calls.
"""
from __future__ import annotations

import colorsys
import json

import numpy as np

import build_map as B
import kit as K

KITS = ["town", "castle", "temple", "interior", "overworld"]
# preset -> what its mean colour must look like: (hue range in degrees or None, saturation range, value range)
EXPECT = {
    "cave": ((15, 45), (0.25, 1), (0.25, 1)),      # brown
    "ice": ((180, 225), (0.08, 1), (0.6, 1)),      # pale blue
    "lava": ((10, 35), (0.45, 1), (0.35, 1)),      # orange
    "sky": ((190, 240), (0.08, 1), (0.5, 1)),      # slate blue
    "coral": ((150, 190), (0.08, 1), (0.5, 1)),    # teal
    "snow": (None, (0, 0.2), (0.75, 1)),           # near white
    "dune": ((20, 40), (0.4, 1), (0.6, 1)),        # warm sand
    "pale_dune": ((30, 55), (0, 0.25), (0.8, 1)),  # bleached sand
    "elf": ((80, 160), (0.2, 1), (0.2, 1)),        # green roofs (a part recolour of the roof)
}


def hsv(rgb) -> tuple[float, float, float]:
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in rgb))
    return h * 360, s, v


def mean_rgb(a: np.ndarray) -> tuple[float, ...]:
    a = np.asarray(a)
    if a.shape[-1] == 4:
        a = a[a[..., 3] > 0][:, :3]
    return tuple(a.reshape(-1, 3).mean(0))


def check_colour(name: str, rgb) -> str:
    (hr, sr, vr), (h, s, v) = EXPECT[name], hsv(rgb)
    assert hr is None or hr[0] <= h <= hr[1], f"{name}: hue {h:.0f} outside {hr}"
    assert sr[0] <= s <= sr[1], f"{name}: saturation {s:.2f} outside {sr}"
    assert vr[0] <= v <= vr[1], f"{name}: value {v:.2f} outside {vr}"
    return f"hue {h:.0f}, sat {s:.2f}, val {v:.2f}"


def grass_map(mid: str, w: int, h: int, ground: str | None = None, objects: list | None = None) -> dict:
    rows = ground or "\n".join("." * w for _ in range(h))
    return {"id": mid, "ground": rows, "entrances": {"a": [0, 0]}, "objects": objects or []}


def approved_cells() -> set[str]:
    names = set()
    for meta in sorted(K.APPROVED.glob("*/*.json")):
        if meta.with_suffix("") in K.LANDMARK_SHEETS:    # the landmark sheets are the ones meant to fill these cells
            continue
        names |= {c for row in json.loads(meta.read_text()).get("cells", []) for c in row if c}
    return names


def check_landmark(name: str, kit: K.Kit, taken: set[str]) -> str:
    w, h = K.LANDMARKS[name][:2]
    parts = K.landmark_parts(name)
    assert len(parts) == h and all(len(r) == w for r in parts), f"{name}: parts grid is not {w}x{h}"
    cells = [p for row in parts for p in row]
    clash = [p for p in cells if p in taken]
    assert not clash, f"{name}: cell names already used by approved art: {clash}"
    assert all(p in K.PART_NAMES for p in cells), f"{name}: cells missing from PART_NAMES"
    for p in cells:
        im = kit.part(p)
        assert im.mode == "RGBA" and im.size == (K.T, K.T), f"{p}: {im.mode} {im.size}"
    whole = np.asarray(K.placeholder_landmark(name))
    alpha = whole[..., 3] > 0
    assert 0.15 < alpha.mean() < 0.99, f"{name}: covers {alpha.mean():.0%} of its box"
    assert alpha[-6:].any(), f"{name}: does not stand on its bottom row"
    first = np.asarray(K.placeholder_landmark(name)).copy()
    K.placeholder_landmark.cache_clear()
    assert np.array_equal(first, np.asarray(K.placeholder_landmark(name))), f"{name}: not deterministic"
    # it compiles as a deco on a small grass map, drawing over the grass in its footprint
    src = grass_map(f"lm_{name}", w + 4, h + 4)
    plain = B.compile_map(src, kit, check_interiors=False)
    deco = B.compile_map({**src, "objects": [{"type": "deco", "x": 2, "y": 2, "parts": parts}]}, kit,
                         check_interiors=False)
    box = (slice(2 * K.T, (2 + h) * K.T), slice(2 * K.T, (2 + w) * K.T))
    drawn = (np.abs(deco.below[box].astype(int) - plain.below[box]).sum()
             + np.abs(deco.above[box].astype(int) - plain.above[box]).sum())
    assert drawn > 0, f"{name}: the compiled deco draws nothing"
    return f"{w}x{h} cells, {alpha.mean():.0%} opaque"


def check_preset(name: str, kit: K.Kit) -> str:
    entry = K.remap(name)
    assert set(entry) == {"from", "hue", "sat", "shade"}, f"{name}: {entry}"
    out = B.map_kit({"materials": {"remapped": entry}}, kit)        # the compiler's own remap path
    src, tex = kit.material(entry["from"]), out.material("remapped")
    assert tex.shape == src.shape and tex.dtype == np.uint8, f"{name}: {tex.shape} {tex.dtype}"
    assert not np.array_equal(tex, src), f"{name}: the remap changes nothing"
    assert K.remap(name, "floor")["from"] == "floor", f"{name}: the base override is ignored"
    return f"from {entry['from']}: " + check_colour(name, mean_rgb(tex))


def check_recolor(name: str, kit: K.Kit) -> str:
    assert B.RECOLOR.get(name) == K.RECOLORS[name], f"{name}: build_map.RECOLOR has {B.RECOLOR.get(name)}"
    part = B.styled(kit, "roof_mid_m", name)
    assert f"roof_mid_m@{name}" in kit.parts, f"{name}: styled() did not recolour"
    assert not np.array_equal(np.asarray(part), np.asarray(kit.part("roof_mid_m"))), f"{name}: recolours nothing"
    if name in K.REMAPS:                         # its colour is checked on its preset's material
        return "part style"
    return "roof_mid_m@" + name + ": " + check_colour(name, mean_rgb(part))


def check_swamp(kit: K.Kit) -> str:
    assert "swamp" in K.MATERIALS and "swamp" in kit.materials, "swamp: no kit material"
    tex = kit.material("swamp").astype(int)
    inner = np.abs(np.diff(tex, axis=1)).mean() + np.abs(np.diff(tex, axis=0)).mean()
    wrap = np.abs(tex[:, 0] - tex[:, -1]).mean() + np.abs(tex[0] - tex[-1]).mean()
    assert wrap <= 1.5 * inner, f"swamp: seam {wrap:.1f} against {inner:.1f} inside (does not wrap)"
    assert not np.array_equal(B.map_kit({}, kit).material("swamp"), kit.material("grass")), "swamp: is grass"
    ground = "\n".join(["........", "..wwww..", "..wwww..", "........"])
    c = B.compile_map(grass_map("swamp_probe", 8, 4, ground), kit, check_interiors=False)
    assert int(c.collision[1][3]) == B.SWAMP and int(c.collision[0][0]) == B.GRASS, "swamp: wrong TerrainType"
    return f"seam {wrap:.1f} / inside {inner:.1f}, TerrainType {B.SWAMP}"


def main() -> int:
    placeholders = K.load_kit("overworld", placeholders_only=True)
    taken = approved_cells()
    full = K.load_kits(KITS)
    n = 0
    for name in K.LANDMARKS:
        print(f"OK {name} ({check_landmark(name, placeholders, taken)})")
        n += 1
    for name in K.REMAPS:
        print(f"OK {name} ({check_preset(name, full)})")
        n += 1
    for name in K.RECOLORS:
        detail = check_recolor(name, full)
        if name not in K.REMAPS:
            print(f"OK {name} ({detail})")
            n += 1
    print(f"OK swamp ({check_swamp(placeholders)})")
    lm = K.approved_landmarks()
    for kid in ("overworld", "temple", "town", "castle"):      # every kit takes the approved landmark cells
        kit = K.load_kit(kid)
        bad = [p for p in lm if p not in kit.approved or not np.array_equal(np.asarray(kit.part(p)), np.asarray(lm[p]))]
        assert not bad, f"kit {kid}: approved landmark cells not used: {bad[:4]}"
    print(f"OK approved landmarks ({len(lm)} cells in every kit)")
    print(f"kit selftest: {n + 1} names OK")
    return 0

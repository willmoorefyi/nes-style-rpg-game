"""Synthetic terrain checks (build_map.py --selftest calls terrain.selftest())."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

import kit as K
from .base import FOOT_FLOOR, T, _bayer, _core, _luma, _tile
from .metrics import RUN_MAX, _Recorder, boundary_stats, classify, fidelity, foothill_share, peak_stats
from .outline import _PARTITION
from .peaks import foothills, place_peaks, plan_peaks


def _ground(mat_rows: list[str], kit: K.Kit, organic: bool, seed: int = 99) -> tuple[np.ndarray, np.ndarray]:
    import build_map as B  # noqa: PLC0415
    from . import paint_soft  # noqa: PLC0415
    mat = np.array(B.parse_ground("\n".join(mat_rows)))
    below = np.zeros((mat.shape[0] * T, mat.shape[1] * T, 3), np.uint8)
    (paint_soft if organic else B.paint_soft)(below, mat, kit, seed)
    return mat, below


def _boundary_case(rows, kit, organic, ga, gb, window):
    mat, below = _ground(rows, kit, organic)
    mats = ("grass", "sand", "forest", "mountain", "ocean", "water", "dirt")
    cls = classify(below, kit, mats)
    a, b = np.isin(cls, [mats.index(m) for m in ga]), np.isin(cls, [mats.index(m) for m in gb])
    return boundary_stats(a, b, window), mat, below


def selftest() -> int:
    """Synthetic straight boundaries and a mountain block: every check passes on the organic painting and at least
    one check per case fails on the classic painting (build_map.paint_soft / place_peaks)."""
    import build_map as B  # noqa: PLC0415
    kit = K.load_kits(["overworld", "town"])
    ok = 0
    win = (slice(2 * T, 6 * T), slice(T, 11 * T))            # the middle 10 cells of each straight boundary
    for ch, ga, gb in (("o", ("ocean", "water"), ("grass", "sand", "forest", "mountain", "dirt")),
                       ("s", ("sand",), ("grass",)), ("f", ("forest",), ("grass",)), ("m", ("mountain",), ("grass",))):
        rows = [ch * 12] * 4 + ["." * 12] * 4                   # a straight 12-cell boundary between rows 3 and 4
        cols = [ch * 4 + "." * 8] * 12                          # and a vertical one between columns 3 and 4
        for case, w in ((rows, win), (cols, (slice(T, 11 * T), slice(2 * T, 6 * T)))):
            new, mat, below = _boundary_case(case, kit, True, ga, gb, w)
            old, _, _ = _boundary_case(case, kit, False, ga, gb, w)
            assert new["edges"] > 0, f"{ch}: no boundary found"
            assert new["longest_run"] < RUN_MAX, f"{ch}: straight run {new['longest_run']} px >= {RUN_MAX} ({new})"
            assert new["on_cell_line"] <= 0.15, f"{ch}: {new['on_cell_line']:.0%} of the boundary on cell lines"
            assert old["longest_run"] >= RUN_MAX or old["on_cell_line"] > 0.15, f"{ch}: classic passes too ({old})"
            fid = fidelity(below, mat, kit)
            assert fid["cells_below_half"] == 0, f"{ch}: a cell centre does not show its material ({fid})"
            ok += 4
    # a 6x4 mountain block in grass
    block = ["." * 12] * 3 + ["...mmmmmm..."] * 4 + ["." * 12] * 3
    mat, below = _ground(block, kit, True)
    canvas = Image.fromarray(below).convert("RGBA")
    place_peaks(canvas, mat, {}, kit, np.random.default_rng(0))
    full = np.asarray(canvas.convert("RGB"))
    ps = peak_stats(plan_peaks(mat, {}, kit))
    assert ps["variants"] >= 4, f"peaks: {ps['variants']} variants < 4"
    assert ps["anchor_std_mod48"] >= 10, f"peaks: anchor spread {ps['anchor_std_mod48']} px < 10"
    fh = foothill_share(full, mat, kit)
    assert fh >= 0.9, f"foothills in {fh:.0%} of the grass cells next to the block"
    assert fidelity(below, mat, kit)["cells_below_half"] == 0
    ok += 4
    _, old_below = _ground(block, kit, False)
    old_canvas = Image.fromarray(old_below).convert("RGBA")
    rec = _Recorder({id(kit.part("peak")): "peak"})
    B.place_peaks(rec, mat, {}, kit, np.random.default_rng(0))
    B.place_peaks(old_canvas, mat, {}, kit, np.random.default_rng(0))
    old = peak_stats([(n, x + 24, y + 47) for n, (x, y) in rec.pastes])
    assert old["variants"] < 4 and old["anchor_std_mod48"] < 10, f"classic peaks pass ({old})"
    assert foothill_share(np.asarray(old_canvas.convert("RGB")), mat, kit) < 0.9, "classic has foothills"
    ok += 1
    # the lake: no stone rim, a soft natural edge (no rim texture in it), and collision stays water
    lake = {"id": "lk", "terrain": "organic", "kits": ["overworld", "town"],
            "ground": "\n".join(["......", ".≈≈≈..", ".≈≈≈≈.", "..≈≈..", "......"]), "entrances": {"a": [0, 0]}}
    c = B.compile_map(lake, kit, check_interiors=False)
    rim = _tile(kit.material("rim"), *c.below.shape[:2])
    assert not np.all(c.below == rim, axis=2).any() and c.collision[2, 2] == B.LAKE
    ok += 1
    ok += _road_case(B, kit)
    ok += _foothill_dark_case(kit)
    ok += _cold_case(B, kit)
    # determinism: the same pixels again, and under other string-hash seeds (subprocesses, as --check-determinism)
    _PARTITION.clear()
    _, again = _ground(block, kit, True)
    assert np.array_equal(again, below)
    import json  # noqa: PLC0415
    import tempfile  # noqa: PLC0415
    mixed = {"id": "mix", "terrain": "organic", "kits": ["overworld", "town"], "entrances": {"a": [4, 4]},
             "ground": "\n".join(["oooooooooo", "oos..ff.mo", "os...fffmo", "o..r....mo", "o..r.≈≈..o",
                                   "o..r.≈≈..o", "ooorrooooo"])}
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "mix.json"
        f.write_text(json.dumps(mixed))
        runs = [B.hash_run([], str(f), False, seed)["mix"] for seed in ("0", "5")]
    assert runs[0] == runs[1], f"organic terrain depends on PYTHONHASHSEED: {runs}"
    ok += 2
    # the castle and the temple do not use terrain: organic and still compile to their committed chunks
    import yaml  # noqa: PLC0415
    for mid in ("cornelia-castle", "temple-of-fiends"):
        src = yaml.safe_load((B.SRC / f"{mid}.yaml").read_text())
        assert src.get("terrain") != "organic"
        cc, _ = B.compile_source(src)
        for r, col, part in B.chunks(cc.below, cc.height, cc.width):
            ref = np.asarray(Image.open(B.OUT / mid / f"below_{r}_{col}.png").convert("RGB"))
            assert np.array_equal(ref, part), f"{mid}: chunk below_{r}_{col} differs from the committed output"
        ok += 1
    print(f"terrain selftest: {ok} checks passed")
    return ok


def _cold_case(B, kit: K.Kit) -> int:
    """NW 2.6: tundra and snow are organic soft materials (recoloured grass and sand): the straight snow / tundra
    and tundra / grass boundaries read as no straight run, every cell centre shows its own material, and the
    collision is TerrainType 13 / 12 (both walkable)."""
    src = {"id": "cold", "terrain": "organic", "kits": ["overworld", "town"], "entrances": {"a": [0, 8]},
           "ground": "\n".join(["n" * 12] * 3 + ["t" * 12] * 3 + ["." * 12] * 3)}
    c = B.compile_map(src, kit, check_interiors=False)
    assert (int(c.collision[0, 0]), int(c.collision[4, 0]), int(c.collision[8, 0])) == (B.SNOW, B.TUNDRA, B.GRASS)
    mk = B.map_kit(src, kit)
    mats = ("grass", "tundra", "snow")
    cls = classify(c.below, mk, mats)
    for a, b, line in (("snow", "tundra", 3), ("tundra", "grass", 6)):
        st = boundary_stats(cls == mats.index(a), cls == mats.index(b), (slice((line - 2) * T, (line + 2) * T),
                                                                         slice(T, 11 * T)))
        assert st["edges"] > 0 and st["longest_run"] < RUN_MAX and st["on_cell_line"] <= 0.15, f"{a} / {b}: {st}"
    assert fidelity(c.below, c.mat, mk)["cells_below_half"] == 0, "a tundra or snow cell centre shows another material"
    return 3


def _road_case(B, kit: K.Kit) -> int:
    """A diagonal dirt road (a staircase of cells) reads as a smooth track: the outer corner of every step stays
    grass, while the classic painting fills the steps. The collision
    is the same either way."""
    rows = ["." * 9, ".,,......", "..,,.....", "...,,....", "....,,...", ".....,,..", "." * 9]
    mat, below_o = _ground(rows, kit, True)
    _, below_c = _ground(rows, kit, False)
    dirt = _tile(kit.material("dirt"), *below_o.shape[:2])

    def corner_share(below: np.ndarray) -> float:
        """Dirt share of the 12 px outer corner of each step (a turn cell, away from both of its neighbours)."""
        shares = []
        for y in range(1, 6):
            for x in range(1, 8):
                if mat[y, x] != "dirt":
                    continue
                n = [(dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if mat[y + dy, x + dx] == "dirt"]
                if len(n) != 2 or n[0][0] == -n[1][0]:
                    continue
                ox, oy = -(n[0][0] + n[1][0]), -(n[0][1] + n[1][1])          # the corner away from both
                px = x * T + (T - 12 if ox > 0 else 0)
                py = y * T + (T - 12 if oy > 0 else 0)
                sl = (slice(py, py + 12), slice(px, px + 12))
                shares.append(float(np.all(below[sl] == dirt[sl], axis=2).mean()))
        return max(shares)

    new, old = corner_share(below_o), corner_share(below_c)
    assert new < 0.1, f"road: the outer corners of the steps show dirt ({new:.0%})"
    assert old > 0.5, f"road: the classic steps are not filled ({old:.0%})"
    src ={"id": "rd", "kits": ["overworld", "town"], "ground": "\n".join(rows), "entrances": {"a": [0, 0]}}
    coll = [B.compile_map({**src, "terrain": t}, kit, check_interiors=False).collision for t in ("organic", "classic")]
    assert np.array_equal(*coll), "organic roads change the collision"
    return 2


def _foothill_dark_case(kit: K.Kit) -> int:
    """W14: on a grass strip beside a mountain strip, at most 1 % of the foothill px are darker than FOOT_FLOOR (0.8)
    of the grass texture's 5th percentile (the raw copy dropped the rock's crevice px, luma 34 on grass of 120, as
    black dots). The plan's bound, the 5th percentile itself, can't be met by a 0.8 floor: the grass is nearly flat."""
    H, W = 4 * T, 8 * T
    grass_tex, mtex = _tile(kit.material("grass"), H, W), _tile(kit.material("mountain"), H, W)
    mountain = np.zeros((H, W), bool)
    mountain[:, :3 * T] = True
    below = grass_tex.copy()
    foothills(below, mountain, ~mountain, np.zeros((H, W), bool), _core(H, W), _bayer(H, W), mtex, 5)
    foot = np.any(below != grass_tex, axis=2) & ~mountain
    assert foot.sum() > 0.02 * (~mountain).sum(), f"foothills: only {int(foot.sum())} px"
    dark = _luma(below[foot]) < FOOT_FLOOR * np.percentile(_luma(grass_tex), 5) - 0.5
    assert dark.mean() <= 0.01, f"foothills: {dark.mean():.1%} of the foothill px are darker than the grass"
    return 1

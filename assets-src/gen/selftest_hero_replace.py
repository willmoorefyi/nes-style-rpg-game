"""Pass CD-K (docs/CLASS_DARKFIGHTER_PLAN.md 2, 6): selftests of the pose replacement (hero_user_replace.py),
`row_geometry` (hero_user_grid.py), `puppet.is_rigid` and the rigid frames of a class without a prop."""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image

from gen.selftest_hero_user import refused, render, tree


def run_hero_replace(check: Callable[[bool, str], None]) -> None:
    from gen import hero_user as HU
    from gen import hero_user_replace as HR
    from gen import puppet as PU
    from gen import puppet_lance as PL
    pal = np.array([(24, 19, 27), (80, 53, 46), (164, 167, 182)])
    fig = np.zeros((10, 6, 4), np.uint8)
    fig[..., :3], fig[..., 3] = pal[1], 255
    fig[0, :, :3], fig[:, 0, :3] = pal[0], pal[0]
    fig[4, 3, :3] = pal[2]
    big = np.kron(fig, np.ones((8, 8, 1), np.uint8)).astype(int)        # an 8x upscale, soft alpha and colour noise
    big = np.pad(big, ((5, 5), (7, 7), (0, 0)))
    noise = (np.arange(big.shape[0] * big.shape[1]).reshape(big.shape[:2]) % 3)[..., None]
    big[..., :3] = np.clip(big[..., :3] + noise, 0, 255)
    big[6:9, 8:10, 3] = 90                                                # a soft edge, under half of a cell
    back = HR.convert(big, 10, pal)
    check(back.shape == (10, 6, 4) and np.array_equal(back[..., :3], fig[..., :3])
          and set(np.unique(back[..., 3]).tolist()) <= {0, 255},
          "CD-K: an 8x soft-alpha render comes back to its native figure (height rule, majority colour, binary alpha)")
    with tempfile.TemporaryDirectory() as t:
        td = Path(t)
        a = render()
        rec = tree(td, a, {"palette": "per_row", "row_geometry": {
            "syn_plus": {"cell": [160, 80], "body_box": [52, 0, 131, 79], "place": [52, 0]}}})
        cells, info = HU.cut(rec, td / "gen")
        r = np.asarray(cells["syn_plus"]["ready"])
        src = cells["syn_base"]["ready"]
        check(cells["syn_plus"]["ready"].size == (160, 80) and src.size == (80, 80) and not r[:, :52, 3].any()
              and (r[:, 52:132, 3] > 0).sum() == (a[80:160, 0:80, 3] > 0).sum() and info["geometries"]["syn_plus"]["cw"] == 160,
              "CD-K: row_geometry places that row's cells in the body box of a bigger cell, the other row as before")
        p = td / "gen" / "user_art" / "syn" / "thrust.png"
        Image.fromarray(big.astype(np.uint8)).save(p)
        why = refused(lambda: HR.load(td / "gen", {"file": "user_art/syn/thrust.png", "sha256": "0" * 64}))
        check("sha256" in why, f"CD-K: a changed replacement render is refused ({why[:60]})")
    check(PU.is_rigid("landsknecht") and PU.is_rigid("dark_fighter_hero") and not PU.is_rigid("warrior"),
          "CD-K: is_rigid: a lance prop or `inbetweens: rigid`, not a plain class")
    fr = PL.frames_of("death_knight_hero")
    att = np.asarray(PU.battle_sheet_frames("death_knight_hero")["attack"])
    mid = np.asarray(fr["atk_mid"]["img"])
    check(fr["atk_mid"]["lance"] is None and np.array_equal(mid[1:76], att[0:75]),
          "CD-K: a rigid class without a prop bobs its key whole (the thrust 1 px down above the feet row)")

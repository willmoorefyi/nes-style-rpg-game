"""F2 "Chaos, the Orrery": cut the four orbs off the approved master so they can travel along the two gold rings
(pass EF-E, docs/ENEMY_FEEDBACK_PLAN.md; offline, numpy / Pillow only, no model call, no pixelize or quantize).

  python3 -I assets-src/gen/colossus/chaos_orrery_orbs.py SRC_DIR OUTDIR

SRC_DIR holds the approved master.png and glow.png (approved/chaos_forms/chaos_orrery/, or its _retired copy). Writes
into OUTDIR the layer files of gen/colossus/chaos_orrery.yaml: master.png (the body, the orbs cut out and their spots
filled), ring_back.png (the far ring segments over the sky, drawn under the far orbs), orb_<c>.png and
orb_<c>_glow.png (each orb and its additive halo at its painted spot), glow.png (the crown halo, orb halos removed) and
orbits.json (the fitted rings and each orb's ring and phase). Steps:
  1. both rings' ellipses are fitted to the gold pixels (seeded by hand points, refined on the pixels within 10 px);
  2. a "clean" body estimate: every band pixel and orb spot is filled by push-pull from its neighbours (the band's
     surroundings tell sky from armour: a band pixel whose estimate is under half opaque lies over the sky);
  3. each orb's spot (its disc, its gold end caps and its halo rim, feathered FEATHER px) is refilled with the body
     mirror-cloned from the symmetric opposite side (axis and row shift searched on the ring round the spot), and the
     ring band through it is redrawn along the fitted ellipse from the band's own profile on both sides (cross-faded,
     band centre and width interpolated; orrery_fill.py); each orb keeps its disc and glassy rim, its halo is redrawn
     whole from glow.png's radial profile;
  4. the band pixels over the sky on the far half (and at the two ends, |sin t| < END) move to ring_back.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import orrery_geom as G  # noqa: E402
from orrery_fill import SpotFill  # noqa: E402
from orrery_spec import END, FEATHER, GLOW_R, ORBS, SEEDS, TS, armour_gold, fill_gaps, over, premul, straight  # noqa: E402



class Orrery(SpotFill):
    def __init__(self, master: np.ndarray, glow: np.ndarray):
        self.M, self.Gl = master.astype(float), glow.astype(float)
        self.h, self.w = master.shape[:2]
        self.yy, self.xx = np.mgrid[:self.h, :self.w].astype(float)
        gold = self.gold = G.goldness(self.M)
        ys, xs = np.nonzero(gold > 0.4)
        xs, ys = xs.astype(float), ys.astype(float)
        self.rings = {k: G.fit_ring(xs, ys, s, keep=~armour_gold(xs, ys)) for k, s in SEEDS.items()}
        self.phase = {o: float(G.locate(self.rings[R], np.array([c[0]]), np.array([c[1]]))[0][0])
                      for o, (c, _, _, R) in ORBS.items()}
        self.spot = np.zeros((self.h, self.w))
        for (cx, cy), _, rs, _ in ORBS.values():
            self.spot = np.maximum(self.spot, np.clip((rs - np.hypot(self.xx - cx, self.yy - cy)) / FEATHER, 0, 1))
        # the sky: outside the body opened by a 31 px square (thin bands and wisps fall away); a far band's dark back
        # face over the sky is any opaque pixel there
        self.sky = ~G.opened(self.M[..., 3] > 127, 15)
        band_w = np.maximum(gold, (self.M[..., 3] > 96) & self.sky & (self.spot == 0))
        self.prof = {}
        for k, e in self.rings.items():
            c, hw = G.band_profile(e, band_w, TS)
            px, py = G.point(e, TS)
            cm, hm = c.copy(), hw.copy()
            for (cx, cy), _, rs, _ in ORBS.values():      # the orbs and their caps are no band measure for the redraw
                cm[np.hypot(px - cx, py - cy) < rs + 6] = np.nan
            hm[np.isnan(cm)] = np.nan
            self.prof[k] = (c, hw, fill_gaps(cm, 500), fill_gaps(hm, 500))
        self.P = premul(self.M)
        self.valid = ~(self.band_mask(raw=True, pad=3) | (self.spot > 0))
        self.clean = G.push_pull(self.P, self.valid)

    def band_coords(self, k: str):
        t, off = G.locate(self.rings[k], self.xx, self.yy)
        i = np.round((t + np.pi) / (2 * np.pi) * len(TS)).astype(int) % len(TS)
        return t, off, i

    def band_mask(self, raw: bool = False, pad: float = 1.5, rings=("A", "B")) -> np.ndarray:
        m = np.zeros((self.h, self.w), bool)
        for k in rings:
            t, off, i = self.band_coords(k)
            c, hw, ci, hwi = self.prof[k]
            cc, ww = (c, hw) if raw else (ci, hwi)
            m |= ~np.isnan(cc[i]) & (np.abs(off - np.nan_to_num(cc[i])) <= np.nan_to_num(ww[i]) + pad)
        return m

    def build(self) -> tuple[dict[str, np.ndarray], dict]:
        """{file name: uint8 RGBA canvas} and the orbits / fill report."""
        body = self.P.copy()
        back = np.zeros_like(body)
        report = {"rings": {k: {q: round(v, 3) for q, v in e.items()} for k, e in self.rings.items()}, "orbs": {}}
        # 4. the band over the sky on the far half and at the ends moves to ring_back
        move = np.zeros((self.h, self.w), bool)
        for k in self.rings:
            t, off, i = self.band_coords(k)
            c, hw, _, _ = self.prof[k]
            geo = ~np.isnan(c[i]) & (np.abs(off - np.nan_to_num(c[i])) <= np.nan_to_num(hw[i]) + 3)
            move |= geo & ((np.sin(t) < 0) | (np.abs(np.sin(t)) < END)) & self.sky
        back[move] = body[move]
        body[move] = 0
        files = {}
        for orb, ((cx, cy), rd, rs, R) in ORBS.items():
            r = np.hypot(self.xx - cx, self.yy - cy)
            draws = {k: got for k in self.rings if (got := self.ring_through(orb, k)) is not None}
            near = {k: (np.sin(tt) > 0) & (np.abs(np.sin(tt)) >= END) for k, (_, tt, _) in draws.items()}
            cover = np.zeros((self.h, self.w), bool)
            part = np.zeros((self.h, self.w), int)
            for k, (img, _, up) in draws.items():
                cover |= near[k] & (img[..., 3] > 250)
                if near[k].any():               # each side of a near band through the spot is mirror-filled alone
                    part = part * 2 + up
            sp = self.spot * (r < rs + 1)
            patch = np.zeros_like(body)
            rep = {"fill": []}
            for p in np.unique(part[sp > 0]):
                f, rp = self.mirror_fill(orb, cover, part == p)
                patch = np.where((part == p)[..., None], f, patch)
                rep["fill"].append(rp)
            patch_back = np.zeros_like(back)
            for k, (img, tt, _) in draws.items():
                patch = np.where(near[k][..., None], over(img, patch), patch)
                patch_back = np.where((~near[k] & ~np.isnan(tt))[..., None], over(img, patch_back), patch_back)
            body = body * (1 - sp[..., None]) + patch * sp[..., None]
            back = back * (1 - sp[..., None]) + patch_back * sp[..., None]
            rep["rings_redrawn"] = sorted(draws)
            files[f"orb_{orb}.png"] = straight(self.orb_layer(orb, over(patch, patch_back) * sp[..., None]))
            files[f"orb_{orb}_glow.png"] = straight(self.halo(orb))
            rep.update(ring=R, phase0=round(self.phase[orb], 4), centre=[cx, cy], disc_r=rd, spot_r=rs)
            report["orbs"][orb] = rep
        files["master.png"] = straight(body)
        files["ring_back.png"] = straight(back)
        gl = premul(self.Gl)
        for (cx, cy), _, _, _ in ORBS.values():
            gl *= np.clip((np.hypot(self.xx - cx, self.yy - cy) - (GLOW_R - 8)) / 8, 0, 1)[..., None]
        files["glow.png"] = straight(gl)
        return files, report

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=(__doc__ or "").split("\n")[0])
    ap.add_argument("src", type=Path)
    ap.add_argument("out", type=Path)
    a = ap.parse_args(argv)
    load = lambda n: np.asarray(Image.open(a.src / n).convert("RGBA"))   # noqa: E731
    o = Orrery(load("master.png"), load("glow.png"))
    files, report = o.build()
    a.out.mkdir(parents=True, exist_ok=True)
    for name, img in sorted(files.items()):
        Image.fromarray(img, "RGBA").save(a.out / name, optimize=False, compress_level=9)
    (a.out / "orbits.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps(report, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())

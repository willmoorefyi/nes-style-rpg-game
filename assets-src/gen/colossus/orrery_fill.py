"""The orb-spot fills of chaos_orrery_orbs.py (pass EF-E; numpy only, no model call): the body mirror-cloned from the
opposite side, the ring band redrawn along the fitted ellipse, an orb's disc with its glassy rim, and its halo. A mixin
of chaos_orrery_orbs.Orrery (which holds the master, the rings, their band profiles and the spots)."""
from __future__ import annotations

import numpy as np

import orrery_geom as G
from orrery_spec import CLONE_BIAS, GLOW_R, INVENTED, ON, ORBS, RIM, TS, WIN, END, premul


class SpotFill:
    def mirror_fill(self, orb: str, cover: np.ndarray, part: np.ndarray):
        """The spot filled from the clean body mirrored about x = X and shifted by dy rows (or, when it matches clearly
        better, cloned from the same side shifted by (dx, dy)), searched on: the mismatch on
        the ring round the spot, plus INVENTED per share of the spot's uncovered pixels whose source is a filled band
        or spot pixel; `cover`: the spot pixels a near ring redraw hides; `part`: the side of the near band filled)."""
        (cx, cy), _, rs, _ = ORBS[orb]
        r = np.hypot(self.xx - cx, self.yy - cy)
        ann = (r >= rs) & (r < rs + 16) & self.valid & part
        ys, xs = np.nonzero(ann)
        tgt = self.P[ys, xs]
        hy, hx = np.nonzero((self.spot > 0) & (r < rs + 1) & ~cover & part)
        cands = [(-1, 2 * X, dy) for X in range(620, 701, 2) for dy in range(-72, 73, 3)]
        cands += [(1, dx, dy) for dx in range(-60, 61, 4) for dy in range(-96, 97, 4) if abs(dx) + abs(dy) >= 40]
        best = {}
        for m, ox, dy in cands:
            src = self.clean[np.clip(ys + dy, 0, self.h - 1), np.clip(m * xs + ox, 0, self.w - 1)]
            hsy, hsx = np.clip(hy + dy, 0, self.h - 1), np.clip(m * hx + ox, 0, self.w - 1)
            invented = ~self.valid[hsy, hsx] & (self.clean[hsy, hsx, 3] > 0)
            cost = float(np.abs(src - tgt).mean()) + INVENTED * float(invented.mean())
            if m not in best or cost < best[m][0]:
                best[m] = (cost, ox, dy)
        m = -1 if best[-1][0] <= best[1][0] * CLONE_BIAS else 1
        cost, ox, dy = best[m]
        sx = np.clip(m * self.xx + ox, 0, self.w - 1).astype(int)
        sy = np.clip(self.yy + dy, 0, self.h - 1).astype(int)
        rep = {"mode": "mirror" if m < 0 else "clone", "cost": round(cost, 2), "dy": dy,
               "mirror_cost": round(best[-1][0], 2), "clone_cost": round(best[1][0], 2)}
        rep.update({"axis_x": ox / 2} if m < 0 else {"dx": ox})
        return self.clean[sy, sx], rep

    def ring_through(self, orb: str, k: str):
        """The band of ring k redrawn through the orb's spot: (premultiplied rgba, the t of each pixel) or None. The
        band's texture is reflected across the spot from both sides and cross-faded, its centre and width interpolated
        between the sides; a side where the band runs behind the body (a far band, not over the sky) is not copied, and
        the other side's band runs on alone (its centre and width held)."""
        (cx, cy), _, rs, _ = ORBS[orb]
        e = self.rings[k]
        c_raw, hw_raw, ci, hwi = self.prof[k]
        px, py = G.point(e, TS)
        nx, ny = G.normal(e, TS)
        bx, by = px + ci * nx, py + ci * ny
        inside = np.hypot(bx - cx, by - cy) < rs + np.nan_to_num(hwi) + 1
        if not inside.any():
            return None
        t0c = self.phase[orb] if ORBS[orb][3] == k else float(TS[np.argmin(np.hypot(bx - cx, by - cy))])
        rel = (TS - t0c + np.pi) % (2 * np.pi) - np.pi
        lo, hi = rel[inside].min(), rel[inside].max()
        speed = lambda t: np.hypot(e["a"] * np.sin(t), e["b"] * np.cos(t))   # noqa: E731  art px per radian
        sky = self.sky.astype(float)
        side = []
        for edge, sgn in ((lo, -1), (hi, 1)):
            ta = t0c + edge + sgn * np.arange(2, 7, 1.0) / speed(t0c + edge)
            j = np.round((ta + np.pi) / (2 * np.pi) * len(TS)).astype(int) % len(TS)
            sx, sy = G.point(e, ta)
            snx, sny = G.normal(e, ta)
            cc = np.nan_to_num(c_raw[j])
            seen = ((np.sin(ta) > 0) & (np.abs(np.sin(ta)) >= END)) | (G.bilinear(sky, sx + cc * snx, sy + cc * sny) > 0.5)
            ok = seen & ~np.isnan(c_raw[j]) & (G.bilinear(self.spot, sx + cc * snx, sy + cc * sny) == 0)
            side.append((ok.mean() > 0.5, float(np.median(c_raw[j][ok])) if ok.any() else 0.0,
                         float(np.median(hw_raw[j][ok])) if ok.any() else 0.0))
        if not (side[0][0] or side[1][0]):
            return None
        t, off, _ = self.band_coords(k)
        tr_ = (t - t0c + np.pi) % (2 * np.pi) - np.pi
        u_all = np.clip((tr_ - lo) / max(hi - lo, 1e-6), 0, 1)
        both = side[0][0] and side[1][0]
        pick = side[0] if side[0][0] else side[1]
        c_all = side[0][1] * (1 - u_all) + side[1][1] * u_all if both else np.full_like(u_all, pick[1])
        w_all = side[0][2] * (1 - u_all) + side[1][2] * u_all if both else np.full_like(u_all, pick[2])
        sel = (self.spot > 0) & (tr_ >= lo) & (tr_ <= hi) & (np.abs(off - c_all) <= w_all + 2)
        if not sel.any():
            return None
        ys, xs = np.nonzero(sel)
        tt, oo, u, c_here, w_here = tr_[sel], off[sel], u_all[sel], c_all[sel], w_all[sel]
        # each side's band profile across the normal (offsets normalised to its centre and half width), averaged
        # along the first WIN px past the spot: the brushed streaks run on along the band, cross-faded side to side
        on = np.clip((oo - c_here) / np.maximum(w_here, 1), -1, 1)
        cols = []
        for (good, cs, ws), edge, sgn in ((side[0], lo, -1), (side[1], hi, 1)):
            if not good:
                continue
            ta = t0c + edge + sgn * np.arange(2, WIN, 1.0) / speed(t0c + edge)
            j = np.round((ta + np.pi) / (2 * np.pi) * len(TS)).astype(int) % len(TS)
            cj = np.where(np.isnan(c_raw[j]), cs, c_raw[j])[:, None]
            wj = np.where(np.isnan(hw_raw[j]), ws, hw_raw[j])[:, None]
            sx, sy = G.point(e, ta)
            snx, sny = G.normal(e, ta)
            o = cj + ON[None] * wj
            prof = G.bilinear(self.P, sx[:, None] + o * snx[:, None], sy[:, None] + o * sny[:, None]).mean(0)
            cols.append(np.stack([np.interp(on, ON, prof[:, ch]) for ch in range(4)], 1))
        s_u = (u * u * (3 - 2 * u))[:, None]
        out = cols[0] * (1 - s_u) + cols[1] * s_u if len(cols) == 2 else cols[0]
        band = np.clip(w_here + 0.75 - np.abs(oo - c_here), 0, 1)
        img = np.zeros((self.h, self.w, 4))
        img[ys, xs] = out * band[:, None]
        tfull = np.full((self.h, self.w), np.nan)
        tfull[ys, xs] = tt + t0c
        return img, tfull, off > c_all

    def orb_layer(self, orb: str, behind: np.ndarray) -> np.ndarray:
        """The disc (antialiased at its radius) plus its glassy rim out to RIM px: each rim pixel unmixed from what now
        lies behind it (`behind`, premultiplied) as a share of the rim's light colour (the 80th percentile by luminance of
        the rim pixels of the orb's own hue)."""
        (cx, cy), rd, _, _ = ORBS[orb]
        r = np.hypot(self.xx - cx, self.yy - cy)
        core = np.clip(rd + 0.75 - r, 0, 1)[..., None]
        ann = (r > rd - 1) & (r < rd + RIM)
        P, B = self.P, behind
        lum = (P[..., :3] / np.maximum(P[..., 3:], 1) * 255) @ np.array([0.299, 0.587, 0.114])
        st = P[..., :3] / np.maximum(P[..., 3:], 1) * 255
        hue = np.degrees(np.arctan2(np.sqrt(3) * (st[..., 1] - st[..., 2]), 2 * st[..., 0] - st[..., 1] - st[..., 2]))
        h0 = np.median(hue[r < rd * 0.6])
        near_hue = np.abs((hue - h0 + 180) % 360 - 180) < 40
        pick = ann & (P[..., 3] > 200) & (self.gold < 0.1) & near_hue     # the orb's own hue, off the bands and caps
        k = np.argsort(lum[pick])[int(0.8 * pick.sum())]
        C = np.append(P[pick][k, :3] / P[pick][k, 3] * 255, 255.0)
        d = C - B
        alpha = np.clip(((P - B) * d).sum(-1) / np.maximum((d * d).sum(-1), 1e-6), 0, 1)
        alpha *= np.clip((rd + RIM - r) / 3, 0, 1) * ann
        return core * P + (1 - core) * alpha[..., None] * C        # the rim's own colour: the end caps stay behind

    def halo(self, orb: str) -> np.ndarray:
        """The orb's halo as a full ring: glow.png's radial profile (the mean premultiplied colour per 1 px radius over
        the pixels the glow mask kept, i.e. off the bands and the body), drawn round the painted centre."""
        (cx, cy), rd, _, _ = ORBS[orb]
        r = np.hypot(self.xx - cx, self.yy - cy)
        gl = premul(self.Gl)
        ok = (gl[..., 3] > 0) & (r < GLOW_R)
        prof = np.zeros((GLOW_R + 1, 4))
        for q in range(int(rd) - 6, GLOW_R):
            m = ok & (r >= q) & (r < q + 1)
            if m.sum() >= 8:
                prof[q] = gl[m].mean(0)
        rr = np.clip(r, 0, GLOW_R - 1.001)
        q0 = np.floor(rr).astype(int)
        f = (rr - q0)[..., None]
        out = prof[q0] * (1 - f) + prof[q0 + 1] * f
        return out * (r < GLOW_R)[..., None]

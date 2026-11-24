"""EF-A self-tests (docs/ENEMY_FEEDBACK_PLAN.md A7), run from selftest.py (test_monster_anim, also --anim): the
Scale2x / nearest upscaler (a known 3x3 case, palette, binary alpha, the feet row, determinism), despur on a fixed
fixture, the table validation (bad S / T refused), the hi-res packer (rects on whole art px with a 1-px gutter) and a
one-sheet atlas round trip on the goblin / ogre fixture (texScale, the linear page, the frame bytes, ogre unchanged)."""
from __future__ import annotations

import contextlib
import io
import json
import math
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image

from gen import monster_hires as MH
from gen import monster_hires_crop as MHC
from gen import monster_hires_pages as MHP

R, G, K, O = (200, 40, 40, 255), (40, 200, 40, 255), (6, 4, 10, 255), (0, 0, 0, 0)


def _raises(fn: Callable[[], object]) -> str:
    try:
        fn()
    except SystemExit as e:
        return str(e) or "exit"
    return ""


def _figure(h: int = 40, w: int = 32, seed: int = 7) -> np.ndarray:
    """A blob figure on a transparent cell: two colours, an outline, its feet on row h - 4."""
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    yy, xx = np.mgrid[0:h, 0:w]
    body = ((yy - h / 2) ** 2 / (h / 2.6) ** 2 + (xx - w / 2) ** 2 / (w / 3) ** 2 <= 1) & (yy <= h - 4)
    a[body] = R
    a[body & (rng.random((h, w)) < 0.3)] = G
    pad = np.pad(body, 1)
    edge = body & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    a[edge] = K
    return a


def run_hires(check: Callable[[bool, str], None]) -> None:
    # Scale2x on a known 3x3 case: a diagonal of R on O; the centre's corners take the agreeing neighbours
    a = np.array([[R, O, O], [O, R, O], [O, O, R]], np.uint8)
    b = MH.epx(a)
    isr = (lambda y, x: tuple(int(v) for v in b[y, x]) == R)
    check(b.shape == (6, 6, 4) and all(isr(y, x) for y in (2, 3) for x in (2, 3)) and isr(1, 2) and isr(2, 1)
          and not b[0, 3].any() and not b[2, 0].any(), "EF-A2: Scale2x on a 3x3 diagonal (the steps fill, exact RGBA)")
    c = np.array([[O, R, O], [R, O, O], [O, O, O]], np.uint8)        # E transparent, B = D = R: the top-left corner fills
    check((MH.epx(c)[2, 2] == R).all() and (MH.epx(c)[3, 3] == O).all(), "EF-A2: Scale2x fills a corner where B = D")
    fig = _figure()
    cols = {tuple(int(v) for v in px) for px in fig[fig[..., 3] > 0][:, :3]}
    for t in (2, 2.5, 2.7, 2.8, 3, 3.25, 3.3, 3.5):     # int-ef2: the 0.05 grid's scales too
        up = MH.upscale(fig, t)
        got = {tuple(int(v) for v in px) for px in up[up[..., 3] > 0][:, :3]}
        check(up.shape[:2] == (MH.ceil_mul(40, t), MH.ceil_mul(32, t)), f"EF-A2: T {t}: size ceil(cell * T) {up.shape[:2]}")
        check(got <= cols and set(np.unique(up[..., 3]).tolist()) <= {0, 255}, f"EF-A2: T {t}: no new colour, binary alpha")
        check(not MH.feet_row(fig, up, t) and MH.lowest_row(up) == MH.ceil_mul(MH.lowest_row(fig) + 1, t) - 1,
              f"EF-A2: T {t}: lowest texture row ceil((footRow + 1) T) - 1 = {MH.lowest_row(up)}")
        check(np.array_equal(up, MH.upscale(fig.copy(), t)), f"EF-A2: T {t}: deterministic")
        check(not (up[:math.ceil(t)].any() or up[:, :math.ceil(t)].any()), f"EF-A2: T {t}: the cell border stays clear")
    check(np.array_equal(MH.upscale(fig, 1), fig), "EF-A2: T 1 returns the frame")
    full, edge, near = MH.upscale(fig, 3), MH.upscale(fig, 3, edges=True), np.repeat(np.repeat(MH._clean(fig), 3, 0), 3, 1)
    inside = np.zeros(fig.shape[:2], bool)
    inside[1:-1, 1:-1] = (fig[..., 3] > 0)[1:-1, 1:-1] & (fig[:-2, 1:-1, 3] > 0) & (fig[2:, 1:-1, 3] > 0) & \
        (fig[1:-1, :-2, 3] > 0) & (fig[1:-1, 2:, 3] > 0) & (fig[:-2, :-2, 3] > 0) & (fig[2:, 2:, 3] > 0) & \
        (fig[:-2, 2:, 3] > 0) & (fig[2:, :-2, 3] > 0)
    deep = np.repeat(np.repeat(inside, 3, 0), 3, 1)
    check(np.array_equal(edge[deep], near[deep]) and not np.array_equal(full[deep], near[deep])
          and np.array_equal(edge[..., 3] > 0, full[..., 3] > 0) and not MH.feet_row(fig, edge, 3),
          "int-ef2: `edges` Scale2x keeps the inside nearest and the full Scale2x silhouette, feet row kept")
    tip = np.zeros((8, 8, 4), np.uint8)                 # a foot px whose 8x sub-rows Scale2x rounds away at 2.5
    for y, x in ((3, 2), (3, 4), (3, 5), (4, 5)):
        tip[y, x] = R
    big = MH.epx(MH.epx(MH.epx(tip)))
    raw = big[MH._samples(20, 64, 2.5, 8)][:, MH._samples(20, 64, 2.5, 8)]
    check(bool(MH.feet_row(tip, raw, 2.5)) and not MH.feet_row(tip, MH.upscale(tip, 2.5), 2.5),
          "EF-A2: the feet guard re-samples an emptied foot row (plain sampling would lift the feet)")
    check(bool(MH.feet_row(fig, np.pad(MH.upscale(fig, 2), ((0, 2), (0, 0), (0, 0)))[2:], 2)),
          "EF-A2: feet_row flags a texture whose feet moved")
    _despur(check)
    _table(check)
    _pack(check)
    _round_trip(check)


def _despur(check: Callable[[bool, str], None]) -> None:
    """A 12x12 fixture: a 6x6 block (rows 3-8) with a 1-px spur on its right, a notch on its top edge, a stray px and
    a 1-px foot below it on the feet row (kept)."""
    a = np.zeros((12, 12, 4), np.uint8)
    a[3:9, 3:9] = R
    a[3:9, 3] = K
    a[5, 9] = R                         # spur: 1 opaque 4-neighbour
    a[3, 5] = O                         # notch: 3 opaque 4-neighbours (left, right, below)
    a[1, 10] = G                        # stray: no neighbour
    a[9, 4] = R                         # foot px on the lowest row: 1 neighbour, kept
    post, d, f = MH.despur(a, (6, 4, 10))
    check(d == 2 and f == 1, f"EF-A3: despur drops the spur and the stray, fills the notch ({d} dropped, {f} filled)")
    check(not post[5, 9].any() and not post[1, 10].any() and tuple(post[3, 5]) == K and tuple(post[9, 4]) == R,
          "EF-A3: the notch takes the outline colour, the foot-row px is kept")
    check(MH.outline_colour(_figure()) == (6, 4, 10), "EF-A3: the outline colour is the idle edge ring's darkest")
    frames = {"idle": Image.fromarray(a, "RGBA"), "attack": Image.fromarray(a, "RGBA")}
    out, rep = MH.despur_sheet("fix", frames)
    check(rep["dropped"] == 4 and rep["filled"] == 2 and set(out) == {"idle", "attack"},
          f"EF-A3: despur_sheet reports the sheet's counts ({rep})")
    big = np.zeros((12, 12, 4), np.uint8)
    big[4:8, 4:8] = R
    big[2, 2] = big[2, 9] = big[9, 2] = R
    msg = _raises(lambda: MH.despur_sheet("fix", {"idle": Image.fromarray(big, "RGBA")}))
    check("fix idle" in msg and "3 %" in msg, f"EF-A3: an opaque-area change over 3 % is refused ({msg[:80]})")


def _table(check: Callable[[bool, str], None]) -> None:
    ok = [(3, {"scale": 3, "tex": 1, "smooth": []}), ({"scale": 2.5, "tex": 2.5}, {"scale": 2.5, "tex": 2.5, "smooth": []}),
          ({"scale": 3, "tex": 1, "smooth": ["despur"]}, {"scale": 3, "tex": 1, "smooth": ["despur"]}),
          ({"scale": 2, "tex": 2, "smooth": ["despur"]}, {"scale": 2, "tex": 2, "smooth": ["despur"]})]
    check(all(MH.entry("x", v) == want for v, want in ok), "EF-A1: plain and dict entries parse to {scale, tex, smooth}")
    ok2 = [({"scale": 2.8, "tex": 2.8}, 2.8), ({"scale": 3.3, "tex": 3.3}, 3.3), ({"scale": 3.5, "tex": 3.5}, 3.5),
           ({"scale": 2.05, "tex": 2.05}, 2.05)]
    check(all(MH.entry("x", v)["scale"] == want == MH.entry("x", v)["tex"] for v, want in ok2),
          "int-ef2: any multiple of 0.05 in [2, 3.5] with tex = scale parses")
    bad = [4, 2.5, True, {"scale": 2.5}, {"scale": 2.5, "tex": 1}, {"scale": 2.5, "tex": 3}, {"scale": 3, "tex": 2},
           {"scale": 1.5, "tex": 1.5}, {"scale": 2, "tex": 2, "smooth": ["blur"]}, {"tex": 2}, {"scale": 2, "x": 1},
           {"scale": 2.73, "tex": 2.73}, {"scale": 3.55, "tex": 3.55}, {"scale": 1.95, "tex": 1.95}, 2.8,
           {"scale": 2.8, "tex": 1}, {"scale": 2.8, "tex": 2.85}, {"scale": float("nan"), "tex": 2}]
    msgs = [_raises(lambda v=v: MH.entry("bat", v)) for v in bad]
    check(all("bat" in m for m in msgs), f"EF-A1: {len(bad)} bad entries refused, each naming the sprite")
    check(MH.entry("x", {"scale": 3.3, "tex": 3.3, "crop": True}) == {"scale": 3.3, "tex": 3.3, "smooth": [], "crop": True}
          and all(_raises(lambda v=v: MH.entry("bat", v)) for v in ({"scale": 3, "tex": 1, "crop": True},
                                                                    {"scale": 2.8, "tex": 2.8, "crop": "yes"})),
          "int-ef2: crop: true parses on a hi-res entry; on a tex-1 entry or as a non-bool it is refused")
    fig = np.pad(_figure(), ((10, 0), (6, 9), (0, 0)))              # 50 x 47, art x 6.., y 10.., feet row 46
    ys, xs = np.nonzero(fig[..., 3] > 0)
    hurt = np.roll(fig, 2, axis=1)                                   # the union reaches 2 px further right
    cut, (dx, dy) = MHC.crop_sheet("fix", {"idle": Image.fromarray(fig, "RGBA"), "hurt": Image.fromarray(hurt, "RGBA")})
    c = np.asarray(cut["idle"])
    check((dx, dy) == (int(xs.min()) - 1, int(ys.min()) - 1) and c.shape[0] == 50 - dy
          and c.shape[1] == int(xs.max()) + 2 + 2 - dx and np.array_equal(c, fig[dy:, dx:dx + c.shape[1]])
          and not (c[0].any() or c[:, 0].any() or c[:, -1].any()) and MH.lowest_row(c) == MH.lowest_row(fig) - dy,
          f"int-ef2: crop_sheet cuts to the union box + 1 px, keeps the bottom rows and every px (cut {dx}, {dy})")
    check([MH.unit(t) for t in (1, 2, 2.5, 3, 2.7, 2.8, 3.3)] == [1, 2, 5, 3, 27, 14, 33],
          "EF-A4: texture units 1, 2, 5, 3 (int-ef2: 2.7 -> 27, 2.8 -> 14, 3.3 -> 33)")
    check(MH.ceil_mul(10, 2.7) == 27 and MH.ceil_mul(90, 2.7) == 243 and MH.ceil_mul(128, 3.3) == 423,
          "int-ef2: products with a scale are exact (10 x 2.7 = 27, not 28)")


def _pack(check: Callable[[bool, str], None]) -> None:
    items = [("a", [(200, 200)] * 17, 2.5), ("b", [(384, 384)] * 17, 3), ("c", [(256, 160)] * 15, 2),
             ("d", [(359, 359)] * 9, 2.8), ("e", [(423, 423)] * 9, 3.3)]      # int-ef2: units 14, 33 in one group
    sizes, placed = MHP.pack_group(items)
    rects = [(x, y, w, h, t) for sid, sz, t in items for (w, h), (x, y) in zip(sz, placed[sid][1])]
    whole = all((x / MH.frac(t)).denominator == 1 and (y / MH.frac(t)).denominator == 1 for x, y, _, _, t in rects)
    gap = all(not (x0 - 1 < x1 + w1 and x1 - 1 < x0 + w0 and y0 - 1 < y1 + h1 and y1 - 1 < y0 + h0)
              for i, (x0, y0, w0, h0, _) in enumerate(rects) for (x1, y1, w1, h1, _) in rects[i + 1:]
              if placed_page(placed, items, x0, y0) == placed_page(placed, items, x1, y1))
    check(whole and all(x >= 1 and y >= 1 for x, y, *_ in rects), "EF-A4: hi-res rects sit on whole art px, off the edge")
    check(gap and all(max(s) <= 2048 for s in sizes), f"EF-A4: >= 1 px between rects, pages <= 2048 ({sizes})")


def placed_page(placed: dict, items: list, x: int, y: int) -> int:
    for sid, sz, _ in items:
        if (x, y) in placed[sid][1]:
            return placed[sid][0]
    return -1


def _round_trip(check: Callable[[bool, str], None]) -> None:
    import tempfile
    from gen import monster_atlas as MAT
    from gen import retire as RT
    with tempfile.TemporaryDirectory() as tmp, RT.fixture_tree(("goblin", "ogre")):
        t = Path(tmp)

        def build(name: str, text: str) -> Path:
            (t / f"{name}.yaml").write_text(text)
            with contextlib.redirect_stdout(io.StringIO()):
                MAT.build(t / name, t / f"{name}.yaml")
            return t / name
        base, hi = build("base", "{}\n"), build("hi", "goblin: {scale: 2.5, tex: 2.5, smooth: [despur]}\n")
        mb, mh = (json.loads((d / "monsters-ai.json").read_text()) for d in (base, hi))
        g, gb = mh["sheets"]["goblin"], mb["sheets"]["goblin"]
        check(g["scale"] == 2.5 and g["texScale"] == 2.5 and mh["pages"][g["page"]].get("filter") == "linear"
              and "filter" not in mh["pages"][mh["sheets"]["ogre"]["page"]],
              "EF-A4: the hi-res sheet has scale 2.5, texScale 2.5 and a linear page of its own")
        check(all(isinstance(v, int) for xy in g["frames"].values() for v in xy) and
              {k: g[k] for k in ("footRow", "cell")} == {k: gb[k] for k in ("footRow", "cell")},
              "EF-A4: frames stay whole art px; footRow and cell stay native")
        page = Image.open(hi / mh["pages"][g["page"]]["file"]).convert("RGBA")
        pb = Image.open(base / mb["pages"][gb["page"]]["file"]).convert("RGBA")
        cw, ch = g["cell"]
        x, y = gb["frames"]["idle"]
        native = np.asarray(pb.crop((x, y, x + cw, y + ch)))
        want = MH.upscale(MH.despur(native, MH.outline_colour(native))[0], 2.5)
        x, y = g["frames"]["idle"]
        rect = (round(x * 2.5), round(y * 2.5), math.ceil(cw * 2.5), math.ceil(ch * 2.5))
        got = np.asarray(page.crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3])))
        check(np.array_equal(got, want) and MHP.gutter_ok(page, rect), "EF-A4: the idle rect is despur + upscale, with a gutter")

        def cells(d: Path, m: dict, sid: str) -> list[bytes]:
            v, pages = m["sheets"][sid], [Image.open(d / p["file"]).convert("RGBA") for p in m["pages"]]
            return [pages[v["page"]].crop((x, y, x + v["cell"][0], y + v["cell"][1])).tobytes() for x, y in v["frames"].values()]
        check(cells(base, mb, "ogre") == cells(hi, mh, "ogre"), "EF-A8: the sheet outside the table is byte-equal by rect")

"""Pass PT (docs/PLAYTEST_ART_PLAN.md 4.2): import the user-rendered ship end views (the user's own render in ChatGPT)
as approved vehicle frames. One render, two views side by side: left the back 3/4 view (sailing up, the bow leaning
right), right the front 3/4 view (sailing down, the bow leaning right). The import cuts them faithfully: the thin wake
line under each hull dropped, the two 8-connected pieces (specks < 24 px dropped, a pennant or jib tip overlapping a
piece joined to it), scaled only when the drawn height is outside 104-118 (to 112), every colour snapped to ship.png's
own colour set, a 1 px outline in ship.png's darkest colour, binary alpha, and the anchor by the centroid rule of
vehicle_view_cut (the whole-mask x centroid as far ahead of the foot point as ship.png's is), so the ship's visual
centre stays put when it turns. Recipe: gen/vehicle_user.yaml; the render: gen/user_art/ship_views/.

  python3 -I assets-src/gen/vehicle_user.py write    # write approved/vehicles/ship_{back,front}.{png,json} (refuses to
                                                      # replace a different approved frame without retire.py's archive)
  python3 -I assets-src/gen/vehicle_user.py check    # the approved files re-import identically; the gates pass
"""
from __future__ import annotations

import hashlib
import io
import json
import sys
from pathlib import Path

if str(Path(__file__).resolve().parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import yaml
from PIL import Image

from gen.field_user_split import figure_mask, resample
from gen.vehicle_view_edit import anchor_of, centroid_x, d7, drawn, edge, outline

HERE = Path(__file__).resolve().parent
RECIPES = HERE / "vehicle_user.yaml"
SHIP = HERE / "approved" / "vehicles" / "ship.png"
FRAMES = ("ship_back", "ship_front")
SPECK, JOIN = 24, 0.5
BAND, TARGET = (104, 118), 112
WAKE_ROWS = 0.1                                  # the wake is looked for in the bottom tenth of each view
VIEWS = {"ship_back": "back 3/4 (from above and behind, sailing away, up the screen), the bow to the upper right",
         "ship_front": "front 3/4 (from above and in front, sailing toward the viewer, down the screen), the bow to the "
                       "lower right"}


def recipe(sid: str = "ship_views", path: Path | None = None) -> dict:
    rec = (yaml.safe_load((path or RECIPES).read_text()) or {}).get(sid)
    if not rec:
        raise SystemExit(f"{sid}: no recipe in {(path or RECIPES).name}")
    return rec


def source(rec: dict, gen: Path = HERE) -> Image.Image:
    data = (gen / rec["file"]).read_bytes()
    if hashlib.sha256(data).hexdigest() != rec["sha256"]:
        raise SystemExit(f"{rec['file']}: sha256 does not match the recipe")
    return Image.open(gen / rec["file"]).convert("RGBA")


def palette(ship: np.ndarray) -> np.ndarray:
    return np.unique(ship[ship[..., 3] > 128][:, :3], axis=0).astype(np.float32)


def drop_wake(rgb: np.ndarray, m: np.ndarray) -> tuple[np.ndarray, int]:
    """Per half of the render: the light px (min channel >= 150, or blue over red by 40 and value >= 150) below the
    lowest row holding a dark px (luma < 60), inside the bottom WAKE_ROWS of the figure, are dropped."""
    m = m.copy()
    dropped = 0
    w = m.shape[1]
    for x0, x1 in ((0, w // 2), (w // 2, w)):
        sub = m[:, x0:x1]
        ys = np.where(sub.any(1))[0]
        if not len(ys):
            continue
        c = rgb[:, x0:x1].astype(int)
        luma = (c @ np.array([299, 587, 114])) // 1000
        dark_rows = np.where((sub & (luma < 60)).any(1))[0]
        floor = max(int(dark_rows.max()) if len(dark_rows) else ys.max(), int(ys.max() - WAKE_ROWS * (ys.max() - ys.min())))
        light = (c.min(-1) >= 150) | ((c[..., 2] - c[..., 0] >= 40) & (c.max(-1) >= 150))
        cut = sub & light
        cut[:floor + 1] = False
        dropped += int(cut.sum())
        m[:, x0:x1] &= ~cut
    return m, dropped


def pieces2(m: np.ndarray) -> list[np.ndarray]:
    """The two views left to right as masks: 8-connected pieces >= SPECK px, smaller ones joined to the piece their
    x-range overlaps by >= JOIN of their own width (dropped otherwise). Exactly two or refused."""
    from gen.anim_efix import pieces8
    ps = pieces8(m)
    big = sorted([p for p in ps if len(p) >= SPECK], key=lambda p: min(x for _, x in p))
    if len(big) != 2:
        raise SystemExit(f"user ship sheet: {len(big)} pieces of >= {SPECK} px, need 2 (back, front)")
    masks = []
    for p in big:
        mm = np.zeros_like(m)
        mm[tuple(np.array(p).T)] = True
        masks.append(mm)
    for p in ps:
        if len(p) >= SPECK:
            continue
        xs = np.array([x for _, x in p])
        for mm in masks:
            fx = np.where(mm.any(0))[0]
            if min(xs.max(), fx.max()) - max(xs.min(), fx.min()) + 1 >= JOIN * (xs.max() - xs.min() + 1):
                mm[tuple(np.array(p).T)] = True
                break
    return masks


def view(rgb: np.ndarray, mm: np.ndarray, pal: np.ndarray) -> tuple[np.ndarray, dict]:
    """One view: cropped, scaled when out of band, snapped to the ship's colours, outlined, in a 1 px clear margin."""
    ys, xs = np.where(mm)
    y0, x0 = ys.min(), xs.min()
    crop_m = mm[y0:ys.max() + 1, x0:xs.max() + 1]
    crop = np.where(crop_m[..., None], rgb[y0:ys.max() + 1, x0:xs.max() + 1], 0).astype(np.uint8)
    h = crop_m.shape[0]
    s = 1.0 if BAND[0] <= h <= BAND[1] else round(TARGET / h, 4)
    pad_rgb, pad_m = resample(np.pad(crop, ((2, 2), (2, 2), (0, 0))), np.pad(crop_m, 2), s)
    q = pal[((pad_rgb[..., None, :].astype(np.float32) - pal[None, None]) ** 2).sum(-1).argmin(-1)]
    a = np.zeros((*pad_m.shape, 4), np.uint8)
    a[pad_m, :3] = q[pad_m]
    a[pad_m, 3] = 255
    f = np.pad(drawn(outline(a, pal)), ((1, 1), (1, 1), (0, 0)))
    return f, {"source_px": [int(xs.max() - x0 + 1), int(h)], "scale": s}


def gates(name: str, f: np.ndarray, anchor: float, dist: float, pal: np.ndarray) -> list[str]:
    """The centroid rule at both facings (1 px), the height band, binary alpha, ship.png's colours, a closed outline."""
    bad, g = [], drawn(f)
    w = g.shape[1]
    cx, foot = centroid_x(g), anchor * w
    for facing, off, want in (("right", cx - foot, dist), ("left", (w - cx) - (w - foot), -dist)):
        if abs(off - want) > 1:
            bad.append(f"{name}: visual centre {off:.2f} px from the foot facing {facing}, want {want:.2f} +- 1")
    if not BAND[0] <= g.shape[0] <= BAND[1]:
        bad.append(f"{name}: drawn height {g.shape[0]} outside {BAND[0]}-{BAND[1]}")
    if not set(np.unique(f[..., 3])) <= {0, 255}:
        bad.append(f"{name}: alpha is not binary")
    m = g[..., 3] > 0
    if not {tuple(c) for c in g[m][:, :3].tolist()} <= {tuple(c) for c in pal.astype(int).tolist()}:
        bad.append(f"{name}: colours outside ship.png's set")
    if not np.all(g[edge(m), :3] == pal[np.argmin(pal.sum(1))]):
        bad.append(f"{name}: the outline is not closed in ship.png's darkest colour")
    return bad


def build(rec: dict | None = None, gen: Path = HERE, ship: Path | None = None) -> tuple[dict[str, tuple[np.ndarray, str]], list[str]]:
    """{frame: (frame image, json text)} and the failed gates."""
    rec = rec or recipe(path=gen / "vehicle_user.yaml")
    ref = np.asarray(Image.open(ship or SHIP).convert("RGBA"))
    pal, dist = palette(ref), d7(ref)
    img = source(rec, gen)
    rgb, m, bg = figure_mask(img)
    m, wake = drop_wake(rgb, m)
    out, bad = {}, []
    for name, mm in zip(FRAMES, pieces2(m)):
        f, info = view(rgb, mm, pal)
        anchor = anchor_of(drawn(f), dist)
        bad += gates(name, f, anchor, dist, pal)
        meta = {"vehicle": "ship", "frame": name, "pass": "PT", "backend": "user", "view": VIEWS[name],
                "source": {"file": rec["file"], "sha256": rec["sha256"]}, "recipe": "vehicle_user.yaml#ship_views",
                "rendered_in": rec.get("tool"), "rendered": str(rec.get("rendered")), "author": rec.get("author", "user"),
                "tool": "assets-src/gen/vehicle_user.py",
                "cut_settings": {"background": bg, "wake_px_dropped": wake, **info, "band": list(BAND),
                                 "snap": "ship.png colour set, argmin", "outline": "1 px, ship.png's darkest colour"},
                "native_size": [int(f.shape[1]), int(f.shape[0])], "anchor": [anchor, 1.0], "d7": round(dist, 4),
                "faces": "right", "mirrored": False, "approved": rec.get("approved"),
                "user_review": rec.get("user_review")}
        out[name] = (f, json.dumps(meta, indent=2) + "\n")
    return out, bad


def png_bytes(a: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(a).save(buf, "PNG", optimize=False)
    return buf.getvalue()


def check(meta: dict, gen: Path | None = None) -> str | None:
    """A `backend: user` ship frame json: re-imported, its png and json are the committed ones. None when it holds."""
    gen = gen or HERE
    try:
        out, bad = build(gen=gen, ship=gen / "approved" / "vehicles" / "ship.png")
    except SystemExit as e:
        return str(e)
    name = meta.get("frame")
    if name not in out:
        return f"{name}: not a frame of the ship render"
    a, text = out[name]
    d = gen / "approved" / "vehicles"
    same = (d / f"{name}.json").read_text() == text and np.array_equal(
        np.asarray(Image.open(d / f"{name}.png").convert("RGBA")), a)
    return "; ".join(bad) or (None if same else f"approved/vehicles/{name} differs from the re-import")


def main(argv: list[str]) -> int:
    import argparse
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["write", "check"])
    a = ap.parse_args(argv)
    out, bad = build()
    for msg in bad:
        print("vehicle_user: GATE", msg)
    if bad and a.cmd == "write":
        raise SystemExit("vehicle_user: a gate failed; nothing written")
    d = HERE / "approved" / "vehicles"
    for name, (img, text) in out.items():
        if a.cmd == "check":
            why = check(json.loads(text))
            print(f"vehicle_user: {name} " + (why or "OK (re-import identical)"))
            bad += [why] if why else []
            continue
        old, new = d / f"{name}.png", png_bytes(img)
        if old.exists() and not np.array_equal(np.asarray(Image.open(old).convert("RGBA")), img):
            from gen import retire as RT
            if not RT.has_archived_copy(RT.Tree(HERE), "vehicles", old.name, old.read_bytes()):
                raise SystemExit(f"vehicle_user: approved/vehicles/{name}.png differs and has no byte-identical archive "
                                 "(retire.py first)")
        old.write_bytes(new)
        (d / f"{name}.json").write_text(text)
        print(f"vehicle_user: wrote {name}.png {img.shape[1]}x{img.shape[0]} anchor {json.loads(text)['anchor'][0]}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

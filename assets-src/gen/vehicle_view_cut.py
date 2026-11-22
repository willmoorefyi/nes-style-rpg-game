"""Re-cut the airship's end and turn views (pass AR, docs/AIRSHIP_VIEWS_PLAN.md 4.1) from the Bedrock render cache.

    python3 -I assets-src/gen/vehicle_view_cut.py               # write approved/vehicles/airship_{back,front,back_turn,front_turn}.{png,json}
    python3 -I assets-src/gen/vehicle_view_cut.py --check       # rebuild in memory; exit 1 if a committed file differs or a gate fails
    python3 -I assets-src/gen/vehicle_view_cut.py --review DIR  # x4 strips, the top-down lineup, the Mode 7 mock-ups

No Bedrock or Gemini call: each render is read from the content-addressed cache assets-src/gen/cache/<key>.png (a
missing file is an error: copy it from the main checkout) and must be a `result ok` row of purpose `ar_airship` in the
tracked BR ledger. The renders are Stability style_transfer restylings (style = LM2 b_7's raw render) of a pseudo-3D
proxy of b_7. The cut (ported from PA's pixtool.py / pixmock2.py): flood the white background, keep the big pieces and
drop enclosed white pockets, match the colour mean and spread to b_7, premultiplied BOX downsample, unsharp mask, snap
to b_7's exact colour set (argmin: a tie takes the first `np.unique` index), binary alpha, a 1 px outline in b_7's
darkest colour. Then the offline cleanup edits (`patch`, `seam_boost`, `highlight`, `recolor`) and the anchor rule:
every frame's whole-mask x centroid sits D7 (b_7's centroid minus its keel anchor) ahead of its foot point, so the
ship's visual centre stays put when it turns. Deterministic: no k-means, no hash order.
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import numpy as np  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

from gen import bedrock as B  # noqa: E402
from gen.pixelize import components, flood_bg  # noqa: E402
from gen.vehicle_view_edit import SIZES, anchor_of, d7, drawn, edit, gates, keel_x, outline  # noqa: E402

OUT = HERE / "approved" / "vehicles"
B7_PATH = OUT / "airship.png"
TOL, MIN_PIECE, POCKET, ALPHA, UNSHARP = 30, 0.03, 150, 110, (1, 72, 2)
APPROVED = "2026-11-22"
REVIEW = ("self-approved by the AV-1 implementer under the integrator's R6 ruling (2026-11-22); review sheet "
          "airship_views/av1/; the user may veto (T-2 reopens)")
SAIL = {"#ad8c63": "#debd94", "#cead84": "#efd6ad", "#7b5a52": "#ad8c63", "#6b4229": "#9c6b42", "#523939": "#7b5a52"}
# frame: the render (PA's tag, cache key), the canvas width, the proxy view, the cleanup edits (plan 2 (a)-(c), (e))
SPEC: dict[str, dict] = {
    "airship_back": {"tag": "back25y30_st0.6_5", "key": "e03e5bc87c625a567d09ace8", "width": 89,
                     "proxy": {"yaw": 30, "elevation": 25, "guide_sha256": "9726f1102a3fcf84"},
                     "edits": {"recolor": [{"box": [12, 22, 24, 46], "map": SAIL}], "seam_boost": 60,
                               "highlight": True},
                     "view": "back 3/4 (from above and behind, flying away), nose to the upper right"},
    "airship_front": {"tag": "front25y30_st0.6_3", "key": "efeb5e6230239d65a2999489", "width": 89,
                      "proxy": {"yaw": 150, "elevation": 25, "guide_sha256": "6506120813c6e59d"},
                      "edits": {"recolor": [{"box": [48, 40, 82, 74], "map": {"#ad8c63": "#cead84"}}],
                                "seam_boost": 60, "highlight": True,
                                "patch": {"trim_plumb": True, "pixels": [[60, y, None] for y in range(104, 111)]}},
                      "view": "front 3/4 (from above and in front, flying toward the viewer), nose to the lower right"},
    "airship_back_turn": {"tag": "back30y55_st0.6_7", "key": "7bb4c02c37860344add12272", "width": 128,
                          "proxy": {"yaw": 55, "elevation": 30, "guide_sha256": "9cbe44a0e40dfe5e"},
                          "edits": {"seam_boost": 60, "highlight": True},
                          "view": "turn in-between, side -> back (yaw 55)"},
    "airship_front_turn": {"tag": "front30y125_st0.6_7", "key": "8a1a3e1e1ae4fb54e81e6f14", "width": 128,
                           "proxy": {"yaw": 125, "elevation": 30, "guide_sha256": "b410a58a3e11a981"},
                           "edits": {"seam_boost": 60, "highlight": True, "patch": {"trim_plumb": True, "pixels": (
                               [[95, y, None] for y in range(94, 103)] + [[96, y, None] for y in range(100, 103)]
                               + [[97, 101, None], [97, 102, None]])}},
                           "view": "turn in-between, side -> front (yaw 125)"},
}


def b7() -> np.ndarray:
    return np.asarray(Image.open(B7_PATH).convert("RGBA"))


def palette(ref: np.ndarray) -> np.ndarray:
    return np.unique(ref[ref[..., 3] > 128][:, :3], axis=0).astype(np.float32)


def cut_white(rgb: np.ndarray) -> np.ndarray:
    fg = ~flood_bg(rgb, TOL)
    lab, n = components(fg)
    if n:
        sizes = np.bincount(lab.ravel())[1:]
        fg = np.isin(lab, np.where(sizes >= MIN_PIECE * sizes.max())[0] + 1)
    white = fg & (rgb.min(axis=2) > 236) & (rgb.max(axis=2).astype(int) - rgb.min(axis=2) < 14)
    lab, n = components(white)
    if n:
        sizes = np.bincount(lab.ravel())
        fg &= ~(np.isin(lab, np.where(sizes >= POCKET)[0]) & (lab > 0))
    return np.dstack([rgb, fg * 255]).astype(np.uint8)


def match(rgba: np.ndarray, ref: np.ndarray) -> np.ndarray:
    a = rgba[..., 3] > 128
    px = rgba[..., :3].astype(np.float32)
    rs = ref[ref[..., 3] > 128][:, :3].astype(np.float32)
    out = rgba.copy()
    out[..., :3] = np.clip((px - px[a].mean(0)) / px[a].std(0) * rs.std(0) + rs.mean(0), 0, 255).astype(np.uint8)
    return out


def to_native(rgba: np.ndarray, width: int, pal: np.ndarray) -> np.ndarray:
    """The cropped figure at `width` - 2 native px, palette-snapped, outlined, inside a 1 px clear margin."""
    a = rgba[..., 3] > 128
    ys, xs = np.where(a)
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = rgba.shape[:2]
    tw = width - 2
    th = max(1, round(h * tw / w))
    pm = rgba.astype(np.float32)
    pm[..., :3] *= pm[..., 3:4] / 255
    sm = np.asarray(Image.fromarray(pm.astype(np.uint8)).resize((tw, th), Image.Resampling.BOX)).astype(np.float32)
    al = sm[..., 3]
    col = np.where(al[..., None] > 0, sm[..., :3] * 255 / np.maximum(al[..., None], 1), 0)
    col = np.asarray(Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).filter(
        ImageFilter.UnsharpMask(*UNSHARP))).astype(np.float32)
    q = pal[((col[..., None, :] - pal[None, None]) ** 2).sum(-1).argmin(-1)]
    out = np.zeros((th + 2, tw + 2, 4), np.uint8)
    out[1:-1, 1:-1, :3] = q
    out[1:-1, 1:-1, 3] = (al > ALPHA) * 255
    return outline(out, pal)


def _ledger_ok() -> dict[str, dict]:
    rows = B.read_br_ledger()
    ok = {r["key"] for r in rows if r.get("event") == "result" and r.get("ok")}
    return {r["key"]: r for r in rows if r.get("event") == "request" and r.get("purpose") == "ar_airship"
            and r.get("key") in ok}


def render(key: str) -> np.ndarray:
    path = B.CACHE / f"{key}.png"
    if not path.is_file():
        raise SystemExit(f"vehicle_view_cut: cache miss {key} (copy it from the main checkout's assets-src/gen/cache; "
                         "this tool never calls Bedrock)")
    return np.asarray(Image.open(path).convert("RGB"))


def frame(name: str, ref: np.ndarray, pal: np.ndarray, rgb: np.ndarray | None = None) -> tuple[np.ndarray, dict]:
    """One frame's approved canvas (the drawn box inside a 1 px clear margin) and its edit log."""
    sp = SPEC[name]
    a = to_native(match(cut_white(render(sp["key"]) if rgb is None else rgb), ref), sp["width"], pal)
    a, log = edit(a, sp["edits"], pal)
    return np.pad(drawn(a), ((1, 1), (1, 1), (0, 0))), log


def build() -> tuple[dict[str, tuple[np.ndarray, str]], list[str]]:
    """{frame: (canvas, json text)} and the failed gates."""
    ref = b7()
    pal = palette(ref)
    dist = d7(ref)
    led = _ledger_ok()
    bad = gates("airship", drawn(ref), keel_x(drawn(ref)), dist, pal)
    out = {}
    for name, sp in SPEC.items():
        if sp["key"] not in led:
            raise SystemExit(f"vehicle_view_cut: {sp['key']} is not a result-ok ar_airship row of the BR ledger")
        a, log = frame(name, ref, pal)
        f = drawn(a)
        anchor = anchor_of(f, dist)
        bad += gates(name, f, anchor, dist, pal)
        row = led[sp["key"]]
        meta = {"vehicle": "airship", "frame": name, "pass": "AR", "view": sp["view"], "tag": sp["tag"],
                "cache_key": sp["key"], "model": row.get("model"), "seed": row.get("seed"), "purpose": "ar_airship",
                "proxy": sp["proxy"], "tool": "assets-src/gen/vehicle_view_cut.py",
                "cut_settings": {"flood_tol": TOL, "min_piece": MIN_PIECE, "pocket_px": POCKET,
                                 "match": "b_7 mean / std per channel", "resample": "box", "width": sp["width"],
                                 "unsharp": list(UNSHARP), "snap": "b_7 colour set, argmin", "alpha": ALPHA,
                                 "outline": "1 px, b_7's darkest colour"},
                "edits": log, "native_size": [int(a.shape[1]), int(a.shape[0])],
                "anchor": [anchor, 1.0], "d7": round(dist, 4), "faces": "right", "mirrored": False,
                "approved": APPROVED, "review": REVIEW}
        out[name] = (a, json.dumps(meta, indent=2) + "\n")
    return out, bad


def _png(a: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(a).save(buf, "PNG", optimize=False)
    return buf.getvalue()


def main(argv: list[str]) -> int:
    out, bad = build()
    for msg in bad:
        print("vehicle_view_cut: GATE", msg)
    if "--review" in argv:
        from gen.vehicle_view_review import review
        review(Path(argv[argv.index("--review") + 1]), {k: v[0] for k, v in out.items()}, b7())
    for name, (a, text) in out.items():
        png, js = OUT / f"{name}.png", OUT / f"{name}.json"
        if "--check" in argv:
            same = (png.is_file() and js.is_file() and js.read_text() == text
                    and np.array_equal(np.asarray(Image.open(png).convert("RGBA")), a))
            print(f"vehicle_view_cut: {name} " + ("OK (the committed file rebuilds)" if same else "DIFFERS"))
            bad += [] if same else [name]
            continue
        png.write_bytes(_png(a))
        js.write_text(text)
        print(f"vehicle_view_cut: wrote {png.name} {a.shape[1]}x{a.shape[0]} anchor {json.loads(text)['anchor'][0]}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

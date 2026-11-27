"""The party battle atlas's pages (pass CL, docs/CLASS_LANCE_PLAN.md 3, 3.1): the main file (one row per 80 x 80
class, the top-level `cell` / `footRow`) and extra pages for oversize classes (a sheet with `page` > 0 has its own
`cell`, `footRow`, `body` and `grid` [cols, rows]: its `row` is its block index, pose p at cell
(p % cols, row * rows + p // cols)). Pass CB A5 (docs/CLASS_BARBARIAN_PLAN.md 15): an overflow page of 80 x 80 classes
(gen/battle_pages.yaml) has the main layout; its entries carry only `row`, `page`, `inbetweens`. Every reader of
assets/sprites/battle-characters-ai.json goes through these.
"""
from __future__ import annotations

PAGE_COLS, PAGE_ROWS = 6, 3            # 18 poses per oversize class block (a 5760 px row would exceed WebGL1's 4096)


def sheet_page(meta: dict, cid: str) -> int:
    return int(meta["sheets"][cid].get("page", 0))


def main_sheets(meta: dict) -> dict:
    """The sheets on the main file (page 0), {cid: entry}."""
    return {c: s for c, s in meta["sheets"].items() if not s.get("page")}


def page_file(meta: dict, page: int) -> str:
    if page == 0:
        return (meta.get("pages") or [{"file": "battle-characters-ai.png"}])[0]["file"]
    return meta["pages"][page]["file"]


def cell_of(meta: dict, cid: str) -> tuple[int, int]:
    """An oversize page entry's own `cell`; the top-level cell for a main-file or (A5) overflow-page entry."""
    s = meta["sheets"][cid]
    return tuple(s.get("cell") or meta["cell"]) if s.get("page") else tuple(meta["cell"])


def foot_of(meta: dict, cid: str) -> int:
    s = meta["sheets"][cid]
    return int(s.get("footRow", meta["footRow"])) if s.get("page") else int(meta["footRow"])


def cell_box(meta: dict, cid: str, pose: str, scaled: bool = True) -> tuple[int, int, int, int]:
    """(x0, y0, x1, y1), half-open, of `pose` of `cid` on its page: atlas png px (native x scale) by default, native px
    with `scaled=False` (for a caller that reads the png downsampled by [::scale])."""
    s = meta["sheets"][cid]
    gw, gh = cell_of(meta, cid)
    i = meta["poses"].index(pose)
    if s.get("page"):
        cols, rows = s.get("grid") or [len(meta["poses"]), 1]   # A5: an overflow page has the main layout
        cx, cy = i % cols, s["row"] * rows + i // cols
    else:
        cx, cy = i, s["row"]
    k = int(meta["scale"]) if scaled else 1
    return cx * gw * k, cy * gh * k, (cx + 1) * gw * k, (cy + 1) * gh * k


def class_frames(cid: str) -> tuple[dict, dict]:
    """({pose: RGBA image}, {pose: lance mask}) of an oversize lance class's atlas poses: the user's keys, the
    puppet_lance in-betweens, the lance kneel (gen/kneel_lance.py)."""
    import numpy as np
    from gen import puppet as PU, puppet_kneel as PK, puppet_lance as PL
    meta = PL.meta_of(cid)
    keys = PU.battle_sheet_frames(cid)
    frames, masks = {}, {}
    lines = (meta.get("prop") or {}).get("lines") or {}
    for p, img in keys.items():
        frames[p] = img
        masks[p] = PL.lance_mask(meta, np.asarray(img.convert("RGBA")), lines[p]) if p in lines else None
    for n, f in PU.battle_inbetweens(cid).items():     # pass CD-K: the rigid frames of any oversize class
        frames[n] = f
    if lines:
        for n, f in PL.frames_of(cid).items():
            masks[n] = f["lance"]["mask"] if f["lance"] else None
    cfg = PU.load_cfg(cid)
    if cfg and cfg.get("kneel"):
        made = PK.make(cfg, keys, int(meta["bottom_row"]), cid)
        frames.update({n: made[n][0] for n in PK.KNEEL_POSES})
        if "_key" in made:                             # a lance kneel (gen/kneel_lance.py); else pass CB's bridge
            masks["kneel"] = made["_key"]["mask"]
            for n, (lance, _) in made["_lances"].items():
                masks[n] = lance["mask"]
    return frames, masks


MAX_PAGE_PX = 4096                     # WebGL1's texture limit, either side


def page_fits(img, what: str) -> None:
    """Refuse a page png over MAX_PAGE_PX on either side (pass CB A5)."""
    if img.width > MAX_PAGE_PX or img.height > MAX_PAGE_PX:
        raise SystemExit(f"battle_ai: {what} is {img.width} x {img.height}, over {MAX_PAGE_PX}")


def overflow_lists(approved, oversize: list, path=None) -> list:
    """Pass CB A5 (docs/CLASS_BARBARIAN_PLAN.md 15): the overflow pages of gen/battle_pages.yaml ([] without the file),
    each a list of 80 x 80 class ids; refused: an id without approved/<id>/battle.json, an oversize id, a repeat."""
    import yaml
    from pathlib import Path
    p = Path(path) if path else Path(__file__).resolve().parent / "battle_pages.yaml"
    pages = ((yaml.safe_load(p.read_text()) or {}).get("overflow") or []) if p.exists() else []
    seen = set()
    for page in pages:
        if not isinstance(page, list) or not page:
            raise SystemExit(f"battle_ai: {p.name}: each overflow page must be a non-empty list of class ids")
        for cid in page:
            if cid in seen:
                raise SystemExit(f"battle_ai: {p.name}: {cid} is listed twice")
            if not (Path(approved) / str(cid) / "battle.json").is_file():
                raise SystemExit(f"battle_ai: {p.name}: {cid} has no approved battle.json")
            if cid in oversize:
                raise SystemExit(f"battle_ai: {p.name}: {cid} is an oversize class (it has its own page)")
            seen.add(cid)
    return [list(page) for page in pages]


def build_pages(big: list, poses: list, scale: int) -> tuple[list, dict]:
    """The extra pages of the oversize sheets, one page per grid (classes in sorted order, a 6 x 3 block each), and
    their `sheets` entries (page, row, cell, footRow, body, grid, reach, heads, inbetweens). A pose without a frame
    (an alias_frames fallback) takes its source keyframe, as on the main file."""
    import numpy as np
    from PIL import Image
    from gen import hero_user_lance as HL
    from gen import puppet as PU
    from pixel import scaled
    groups: dict[tuple, list] = {}
    for meta, _ in big:
        if "body" not in meta:
            raise SystemExit(f"battle_ai: {meta['character']} has an oversize grid {meta['grid']} but no body box")
        groups.setdefault(tuple(meta["grid"]), []).append(meta)
    pages, sheets = [], {}
    order = sorted(groups.items(), key=lambda kv: (-kv[0][1], -kv[0][0]))   # height, then width, descending:
    for page, (grid, metas) in enumerate(order, start=1):                    # the lance page stays page 1
        gw, gh = grid
        if len({(m["bottom_row"], tuple(m["body"])) for m in metas}) != 1:
            raise SystemExit(f"battle_ai: the {gw} x {gh} sheets disagree on bottom_row / body")
        body = metas[0]["body"]
        if body[1] + 76 != metas[0]["bottom_row"] or body[2:] != [80, 80]:
            raise SystemExit(f"battle_ai: body {body} must be 80 x 80 with the feet 76 below its top")
        img = Image.new("RGBA", (gw * PAGE_COLS, gh * PAGE_ROWS * len(metas)), (0, 0, 0, 0))
        for row, meta in enumerate(sorted(metas, key=lambda m: m["character"])):
            cid = meta["character"]
            frames, masks = class_frames(cid)
            heads, tops = [], []
            for i, pose in enumerate(poses):
                src = pose if pose in frames else PU.SOURCE.get(pose, "ready")
                f = frames[src]
                img.paste(f, ((i % PAGE_COLS) * gw, (row * PAGE_ROWS + i // PAGE_COLS) * gh))
                h = HL.head_of(np.asarray(f.convert("RGBA")), masks.get(src))
                heads.append([h[0], h[1]] if h else None)
                tops.append(int(np.nonzero((np.asarray(f.convert("RGBA"))[..., 3] > 0).any(1))[0].min()))
            att = np.asarray(frames["attack"].convert("RGBA"))[..., 3] > 0
            sheets[cid] = {"row": row, "page": page, "inbetweens": True, "cell": [gw, gh],
                           "footRow": meta["bottom_row"], "body": body, "grid": [PAGE_COLS, PAGE_ROWS],
                           "reach": int(np.nonzero(att.any(0))[0].min()), "top": min(tops), "heads": heads}
        pages.append((scaled(img, scale), [m["character"] for m in metas]))
    return pages, sheets

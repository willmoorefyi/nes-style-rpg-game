"""Hi-res atlas pages and the GPU budget gate (docs/ENEMY_FEEDBACK_PLAN.md EF-A4).

- **Pages.** A group's hi-res sheets (texScale T > 1) pack onto their own pages inside the group, after its native
  pages (monster_atlas.build), each <= MAX_PAGE a side, a sheet never straddling pages. Positions are texture px:
  every frame's x and y are multiples of its sheet's `unit` (so x / T and y / T are whole art px, the index stays in
  art px), and every rect keeps a 1-px transparent gutter on all sides (the packer leaves >= 1 px between rects and
  from the page's top-left edge). A page of hi-res sheets only gets `filter: linear` in the index: drawn 1:1 at whole
  px it is byte-exact, under a shrink pass it down-samples smoothly (MonsterPages adds mipmaps).
- **Budget.** `budget(pages, sheets, preload)`: the extra pages (over the BASE_PAGES before EF; the hi-res pages
  alone are capped too) and the GPU bytes of the pinned preload pages
  plus the largest real formation's pages (from the encounter tables of every map, legacy and compiled); a linear page
  counts its mip chain (x 4/3). Over MAX_EXTRA_PAGES or MAX_GPU_BYTES the build fails (EF-A4: the B2 scale-3 sheets
  then fall back to `smooth: [despur]` at tex 1 first).
"""
from __future__ import annotations

from pathlib import Path

import yaml

from gen import monster_pages as MP
from gen.anim_rules import MAX_PAGE
from gen.monster_hires import unit

GUTTER = 1
MAX_EXTRA_PAGES = 18               # EF-A/B 14 + EF-D chaos spill 1 + int-ef2 2 (blue / green_dragon at tex 3, user ruling 2026-11-24) + ef-horse 1 (crazy_horse tex 2, the EF smoothing rule)
BASE_PAGES = 12                    # the atlas pages before EF (3ba8aa91): `extra` = pages - BASE_PAGES
PAGE_BYTES = 2048 * 2048 * 4
MAX_GPU_BYTES = 8 * PAGE_BYTES
ROOT = Path(__file__).resolve().parent.parent.parent


def _align(v: int, u: int) -> int:
    return -(-v // u) * u


class HiresPage:
    """A shelf packer whose positions are multiples of each sheet's unit: x on the shelf, and y from the shelf's top
    aligned up to the sheet's own unit (int-ef2: one unit per page, the lcm of a group's units, would be 20790 texture
    px once 2.5, 2.7, 2.8 and 3.3 share a group)."""

    def __init__(self) -> None:
        self.x, self.y, self.shelf_h, self.width = 0, GUTTER, 0, 0
        self.empty = True

    def place(self, sizes: list[tuple[int, int]], u: int, cap: int) -> list[tuple[int, int]] | None:
        x, y, shelf_h, width = self.x, self.y, self.shelf_h, self.width
        pos = []
        for w, h in sizes:
            px = _align(x + GUTTER, u)
            if px + w > cap:
                y, shelf_h = y + shelf_h + GUTTER, 0
                px = _align(GUTTER, u)
            if px + w > cap:
                return None
            py = _align(y, u)
            pos.append((px, py))
            x = px + w
            shelf_h = max(shelf_h, py - y + h)
            width = max(width, x)
        if y + shelf_h > cap:
            return None
        self.x, self.y, self.shelf_h, self.width, self.empty = x, y, shelf_h, width, False
        return pos

    @property
    def size(self) -> tuple[int, int]:
        return self.width, self.y + self.shelf_h


def pack_group(items: list[tuple[str, list[tuple[int, int]], float]], cap: int = MAX_PAGE
               ) -> tuple[list[tuple[int, int]], dict[str, tuple[int, list[tuple[int, int]]]]]:
    """One group's hi-res sheets (id, texture frame sizes, texScale) -> (page sizes, {id: (page in group, positions)}).
    First fit: a sheet continues the first of the group's hi-res pages with room for it, else opens a new page (with
    the tallest sheets first, pack_all, the short sheets fill the earlier pages' last shelves)."""
    if not items:
        return [], {}
    pages: list[HiresPage] = []
    out = {}
    for sid, sizes, t in items:
        for i, page in enumerate(pages):
            pos = page.place(sizes, unit(t), cap)
            if pos is not None:
                out[sid] = (i, pos)
                break
        else:
            pages.append(HiresPage())
            pos = pages[-1].place(sizes, unit(t), cap)
            if pos is None:
                raise SystemExit(f"monsters_ai: hi-res {sid} does not fit on an empty {cap}x{cap} page")
            out[sid] = (len(pages) - 1, pos)
    return [p.size for p in pages], out


def gutter_ok(page, rect: tuple[int, int, int, int]) -> bool:
    """The 1-px ring just outside a rect (clipped to the page) and the rect's own outer ring are transparent."""
    import numpy as np
    a = np.asarray(page)[..., 3]
    x, y, w, h = rect
    H, W = a.shape
    x0, y0, x1, y1 = max(x - 1, 0), max(y - 1, 0), min(x + w + 1, W), min(y + h + 1, H)
    box = a[y0:y1, x0:x1].copy()
    box[y + 1 - y0:y + h - 1 - y0, x + 1 - x0:x + w - 1 - x0] = 0     # the rect's interior is free
    return not box.any()


def encounter_formations() -> list[list[str]]:
    """Every encounter entry's maximum roll (enemy ids), over the legacy and compiled maps' tables and zones."""
    loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
    out = []
    files = sorted((ROOT / "assets" / "maps").glob("*.yaml")) + sorted((ROOT / "assets" / "maps" / "ai").glob("*.yaml"))
    for f in files:
        if f.name == "index.yaml":
            continue
        m = yaml.load(f.read_text(), Loader=loader) or {}
        tables = list(m.get("encounters") or []) + [e for z in m.get("encounterZones") or [] for e in z.get("encounters") or []]
        for enc in tables:
            if enc.get("groups"):
                out.append([g["id"] for g in enc["groups"] for _ in range(g.get("max", g.get("min", 1)))])
            else:
                out.append(list(enc.get("enemies") or []))
    return out


def page_bytes(p: dict) -> int:
    """GPU bytes of one page: RGBA8, plus a third for the mip chain of a linear page."""
    b = p["w"] * p["h"] * 4
    return b * 4 // 3 if p.get("filter") == "linear" else b


def budget(pages: list[dict], sheets: dict[str, dict], preload: list[int]) -> dict:
    """{extra, gpu, worst, formation}: hi-res pages, and the largest preload + formation GPU bytes (EF-A4)."""
    loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
    enemies = yaml.load((ROOT / "assets" / "data" / "enemies.yaml").read_text(), Loader=loader) or []
    sprite = {e["id"]: str(e.get("sprite") or e["id"]).removesuffix(".png") for e in enemies}
    best, worst = sum(page_bytes(pages[p]) for p in preload), []
    for ids in encounter_formations():
        used = set(preload) | {sheets[sprite[i]]["page"] for i in ids if sprite.get(i) in sheets}
        b = sum(page_bytes(pages[p]) for p in used)
        if b > best:
            best, worst = b, ids
    hires = sum(1 for p in pages if p.get("filter") == "linear")
    return {"extra": len(pages) - BASE_PAGES, "hires": hires, "pages": len(pages), "gpu": best, "formation": worst}


def check_budget(rep: dict) -> list[str]:
    out = [f"{rep['extra']} extra pages > {MAX_EXTRA_PAGES}"] if rep["extra"] > MAX_EXTRA_PAGES else []
    if rep["gpu"] > MAX_GPU_BYTES:
        out.append(f"GPU {rep['gpu'] / 2 ** 20:.1f} MB > {MAX_GPU_BYTES / 2 ** 20:.0f} MB ({rep['formation']})")
    return out


def pack_all(groups: list[tuple[str, list[str]]], frame_sizes: dict[str, list[tuple[int, int]]], hi: dict[str, float]
             ) -> tuple[list[tuple[int, int]], dict[str, tuple[int, list[tuple[int, int]]]], set[int], set[int]]:
    """(page sizes, {id: (page, positions)}, the linear pages, the act-1 pages): per group in page order its native
    pages (monster_pages.pack_pages, unchanged) then its hi-res pages (pack_group)."""
    sizes, placed, linear, act1 = [], {}, set(), set()
    for g, ids in groups:
        low = [i for i in ids if i not in hi]
        # the hi-res shelves pack tallest frames first (ties by id): far less shelf waste than the listed order
        top = sorted((i for i in ids if i in hi), key=lambda i: (-max(h for _, h in frame_sizes[i]), i))
        ls, lp = MP.pack_pages([[(sid, frame_sizes[sid]) for sid in low]])
        hs, hp = pack_group([(sid, frame_sizes[sid], hi[sid]) for sid in top])
        for part, pp, lin in ((ls, lp, False), (hs, hp, True)):
            new = set(range(len(sizes), len(sizes) + len(part)))
            placed.update({sid: (len(sizes) + pg, pos) for sid, (pg, pos) in pp.items()})
            act1 |= new if g == "act1" else set()
            linear |= new if lin else set()
            sizes += part
    return sizes, placed, linear, act1


def report(meta_json: dict, smooth: dict, hi: dict) -> None:
    """EF-A3 / A4 build report: the despur counts per sheet, the hi-res pages and the GPU budget gate (fails the build
    when over)."""
    for sid, r in sorted(smooth.items()):
        print(f"monsters_ai: despur {sid}: {r['dropped']} px dropped, {r['filled']} filled over {r['frames']} frames")
    if not hi:
        return
    rep = budget(meta_json["pages"], meta_json["sheets"], meta_json["preload"])
    print(f"monsters_ai: {len(hi)} hi-res sheets on {rep['hires']} hi-res pages, {rep['pages']} pages in all "
          f"({rep['extra']} extra over {BASE_PAGES}, max {MAX_EXTRA_PAGES}); GPU preload + "
          f"largest formation {rep['gpu'] / 2 ** 20:.1f} MB (max {MAX_GPU_BYTES / 2 ** 20:.0f}; {rep['formation']})")
    bad = check_budget(rep)
    if bad:
        raise SystemExit("monsters_ai: budget gate failed: " + "; ".join(bad))

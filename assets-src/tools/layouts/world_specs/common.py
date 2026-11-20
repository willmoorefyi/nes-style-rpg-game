"""Helpers the region specs share: the site anchors of `assets-src/maps-nw/world-anchors.yaml` (4.2) and the
today -> NW mapping of the spots (5.2).

A site's cell is its anchor's `target` (CORNELIA_NW + s* x ref, or an act-1 pin) plus the region's nudge inside the
anchors' +-2 window; a site without an anchor is given as a Cornelia-relative point by its region.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

from worldgen import spec as S

ANCHORS = Path(__file__).resolve().parents[3] / "maps-nw" / "world-anchors.yaml"


@lru_cache(maxsize=1)
def anchors() -> dict:
    """entrance -> its anchor record."""
    return {a["entrance"]: a for a in yaml.safe_load(ANCHORS.read_text())["anchors"]}


def site(entrance: str, nudge: tuple[int, int] = (0, 0)) -> tuple[int, int]:
    """An anchored site's world cell: its target plus a nudge (inside the anchors' tolerance)."""
    tx, ty = anchors()[entrance]["target"]
    return (tx + nudge[0], ty + nudge[1])


def sites(region: str, nudges: dict | None = None, extra: dict | None = None) -> dict[str, tuple[int, int]]:
    """Every anchored site of a region (anchor order), plus its extra entrances (Cornelia-relative points)."""
    nudges = nudges or {}
    out = {e: site(e, nudges.get(e, (0, 0))) for e, a in anchors().items() if a["region"] == region}
    for e, rel in (extra or {}).items():
        out[e] = S.world(rel)
    return out

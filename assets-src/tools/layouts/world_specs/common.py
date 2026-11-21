"""Helpers the region specs share: the site anchors of `assets/data/world-anchors.yaml` (4.2) and the
today -> NW mapping of the spots (5.2).

A site's cell is its anchor's `target` (CORNELIA_NW + s* x ref, or an act-1 pin) plus the region's nudge inside the
anchors' +-2 window; a site without an anchor is given as a Cornelia-relative point by its region.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

from worldgen import spec as S

ANCHORS = Path(__file__).resolve().parents[4] / "assets" / "data" / "world-anchors.yaml"


@lru_cache(maxsize=1)
def anchors() -> dict:
    """entrance -> its anchor record."""
    return {a["entrance"]: a for a in yaml.safe_load(ANCHORS.read_text())["anchors"]}


HIKE_MODES = ("walking", "canoe")


@lru_cache(maxsize=1)
def hike() -> dict:
    """The hike bounds of `world-anchors.yaml` (D-NW2-12): {"floor": K, "cap": U, "sites": {entrance: mode}}; the one
    source the verifier reads too. A missing or malformed block is an error, never a code default."""
    h = yaml.safe_load(ANCHORS.read_text()).get("hike")
    if not isinstance(h, dict) or not all(isinstance(h.get(k), int) for k in ("floor", "cap")) \
            or not isinstance(h.get("sites"), dict) or any(m not in HIKE_MODES for m in h["sites"].values()):
        raise SystemExit(f"world-anchors.yaml: no valid hike block (floor, cap, sites in {HIKE_MODES}): {h!r}")
    return {"floor": h["floor"], "cap": h["cap"], "sites": dict(h["sites"])}


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

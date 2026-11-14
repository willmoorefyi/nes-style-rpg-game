"""Store a reviewed sheet as approved (offline, no paid calls).

  python3 -I assets-src/gen/approve.py <character> <sheet> [--flip left] [--note "..."]

Re-plans the request to get its cache key (it must already be cached), copies the cut native sheet from
out/gemini/<id>/<seed>/ into approved/<id>/, writes <sheet>.json, and un-ignores the cache entry (the raw render).
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE.parent))

from gen import generate as GEN  # noqa: E402
from gen import spec as S  # noqa: E402


# hand-made fixes stored in an approved sheet's .json that a re-approval must not drop
FIELD_HAND_FIXES = ("head_from", "row_from")
KIT_HAND_FIXES = ("paint",)                  # copy-rect art fixes applied by assets-src/tools/kit.py at load


def keep_hand_fixes(old: Path, meta: dict, keys: tuple[str, ...]) -> dict:
    """Copy the listed keys from the previously approved .json (if any) into the new metadata."""
    if old.exists():
        prev = json.loads(old.read_text())
        for key in keys:
            if key in prev:
                meta[key] = prev[key]
    return meta


def _monster_cell(png: Path, geom) -> tuple[int, int]:
    """Monster cells can be widened by the cut: read the real cell size from the stored sheet."""
    from PIL import Image
    w, h = Image.open(png).size
    return (w // geom.layout[0], h // geom.layout[1])


def approve(cid: str, sheet_name: str, flip: list[str], note: str = "",
            flip_frames: dict[str, list[int]] | None = None) -> Path:
    char = GEN.load_character(cid)
    if sheet_name == "monster":
        sheet_name = GEN.allowed_sheets(char)[0]
    sheet = GEN.SHEETS[sheet_name]
    seed = GEN.seed_for(char, sheet_name)
    req = GEN.plan_request(char, sheet, seed, "gemini", None)
    if not req.cached:
        raise SystemExit(f"{cid}/{sheet_name}: request {req.key} is not cached; generate and review it first")
    src = GEN.OUT / "gemini" / cid / str(seed)
    dst = HERE / "approved" / cid
    dst.mkdir(parents=True, exist_ok=True)
    if GEN.is_kit(char):
        # kit sheet: the cut 48 px tiles plus the cell table the map compiler slices by (assets-src/tools/kit.py)
        part = sheet_name.removeprefix("kit_")
        shutil.copy2(src / f"{sheet_name}.png", dst / f"{part}.png")
        report = json.loads((src / f"{sheet_name}_report.json").read_text())
        meta = {"kit": cid, "sheet": sheet_name, "backend": "gemini", "model": req.model, "seed": seed,
                "cache_key": req.key, "approved": time.strftime("%Y-%m-%d"), "tile": 48,
                "cells": report.pop("cells", []), "materials": report.pop("materials", {}), "metrics": report}
        if note:
            meta["note"] = note
        keep_hand_fixes(dst / f"{part}.json", meta, KIT_HAND_FIXES)
        (dst / f"{part}.json").write_text(json.dumps(meta, indent=2) + "\n")
        _unignore(req.key)
        return dst / f"{part}.json"
    # only the cut sheet: the raw render is the committed cache entry (cache/<key>.png) and the prompt is
    # reproducible with --dry-run
    shutil.copy2(src / f"{sheet_name}.png", dst / f"{sheet_name}.png")
    g = sheet.geom
    meta = {"character": cid, "sheet": sheet_name, "backend": "gemini", "model": req.model, "seed": seed,
            "cache_key": req.key, "approved": time.strftime("%Y-%m-%d"),
            "grid": list(_monster_cell(dst / f"{sheet_name}.png", g) if sheet_name.startswith(("monster_", "boss_"))
                         else GEN.frame_size(g)),
            "bottom_row": g.bottom_row, "layout": list(g.layout)}
    if sheet_name == "battle":
        meta["poses"] = list(sheet.order)
    elif sheet_name.startswith("boss_"):
        # one pose of a per-pose boss; monsters_ai combines idle / attack / hurt once all three are approved
        meta.update({"poses": [sheet_name.removeprefix("boss_")], "size": char.get("size", "boss"),
                     "floating": bool(char.get("floating")), "flip_frames": (flip_frames or {}).get("row", [])})
    elif sheet_name.startswith("monster_"):
        # monster sheet: idle | attack | hurt in one row; per-frame mirroring is applied by the monsters_ai build stage
        meta.update({"poses": list(S.MONSTER_POSES), "size": char.get("size", "small"),
                     "floating": bool(char.get("floating")), "flip_frames": (flip_frames or {}).get("row", [])})
    else:
        meta["rows"] = list(S.FIELD_ROWS)
        meta["frames"] = ["stand", "step_left", "step_right"]
        meta["flip_rows"] = flip
        if flip_frames:
            meta["flip_frames"] = flip_frames
        # keep hand-reviewed per-frame fixes (head_from) when a sheet is re-approved
        keep_hand_fixes(dst / f"{sheet_name}.json", meta, FIELD_HAND_FIXES)
    if note:
        meta["note"] = note
    (dst / f"{sheet_name}.json").write_text(json.dumps(meta, indent=2) + "\n")
    _unignore(req.key)
    return dst / f"{sheet_name}.json"


def _unignore(key: str) -> None:
    gi = ROOT / ".gitignore"
    lines = gi.read_text().splitlines()
    for ext in ("png", "json"):
        line = f"!assets-src/gen/cache/{key}.{ext}"
        if line not in lines:
            lines.append(line)
    gi.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("character")
    ap.add_argument("sheet", choices=list(GEN.SHEETS) + ["monster"])
    ap.add_argument("--flip", default="", help="comma-separated field rows drawn facing the wrong way (mirrored)")
    ap.add_argument("--note", default="")
    ap.add_argument("--flip-frames", default="", metavar="ROW:I,I",
                    help="mirror single frames that face the other way from their row, e.g. left:0 (monsters: row:1)")
    a = ap.parse_args()
    ff = {}
    for part in filter(None, a.flip_frames.split(";")):
        row, idx = part.split(":")
        ff[row] = [int(i) for i in idx.split(",")]
    print("approved:", approve(a.character, a.sheet, [r for r in a.flip.split(",") if r], a.note, ff))

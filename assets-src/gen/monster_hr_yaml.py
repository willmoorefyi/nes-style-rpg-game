"""EF-G: line-based writes into gen/monster_hr.yaml that keep its comments (PyYAML would drop them): a sprite's
flat key (`master_sha256`, `attack_sha256`, ...) is replaced in place or inserted right under the sprite's line."""
from __future__ import annotations

import re
from pathlib import Path

SPEC = Path(__file__).resolve().parent / "monster_hr.yaml"


def record(sid: str, key: str, value: str, path: Path | None = None) -> None:
    path = path or SPEC
    lines = path.read_text().split("\n")
    start = next(i for i, ln in enumerate(lines) if ln == f"  {sid}:")
    end = next((i for i in range(start + 1, len(lines)) if re.match(r"^  \S", lines[i]) or re.match(r"^\S", lines[i])),
               len(lines))
    row = f"    {key}: {value}"
    for i in range(start + 1, end):
        if lines[i].startswith(f"    {key}:"):
            lines[i] = row
            break
    else:
        lines.insert(start + 1, row)
    path.write_text("\n".join(lines))


def record_row(sid: str, pose: str, n: int, key: str, value: str, path: Path | None = None) -> None:
    """Set `key: value` in the flow-style variation row `- {n: N, ...}` under `<sid>.variations.<pose>`."""
    path = path or SPEC
    lines = path.read_text().split("\n")
    start = next(i for i, ln in enumerate(lines) if ln == f"  {sid}:")
    sec = next(i for i in range(start + 1, len(lines)) if lines[i].strip() == f"{pose}:" and
               any(lines[j].strip().startswith("variations:") for j in range(start, i)))
    for i in range(sec + 1, len(lines)):
        ln = lines[i]
        if not ln.strip().startswith("- {"):
            break
        if re.match(rf"^\s*- \{{n: {n},", ln):
            body = re.sub(rf",\s*{key}: [^,}}]+", "", ln.rstrip()[:-1])
            lines[i] = f"{body}, {key}: {value}}}"
            path.write_text("\n".join(lines))
            return
    raise SystemExit(f"{sid} {pose}: no variation row n: {n}")


def record_prep(sid: str, key: str, value: str, path: Path | None = None) -> None:
    """Set `key: value` right under the sprite's `prep:` line (replaced in place when present): `prep.nobg_key`."""
    path = path or SPEC
    lines = path.read_text().split("\n")
    start = next(i for i, ln in enumerate(lines) if ln == f"  {sid}:")
    prep = next(i for i in range(start + 1, len(lines)) if lines[i] == "    prep:")
    row = f"      {key}: {value}"
    for i in range(prep + 1, len(lines)):
        if not lines[i].startswith("      "):
            lines.insert(prep + 1, row)
            break
        if lines[i].startswith(f"      {key}:"):
            lines[i] = row
            break
    else:
        lines.insert(prep + 1, row)
    path.write_text("\n".join(lines))

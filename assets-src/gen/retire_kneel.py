"""Archive a derived kneel or a failed AI kneel key before it is replaced (docs/KNEEL_AI_PLAN.md 5, D-KA5; offline).

  python3 -I assets-src/gen/retire_kneel.py <id>                 # the derived kneel, before `source: ai`
  python3 -I assets-src/gen/retire_kneel.py --key <id> --try N   # a J1-failed approved AI key

`<id>`: the rig and lock -> anim/monsters/_retired/<id>_kneel_v1.{yaml,lock.json} (heroes: anim/_retired/<class>_kneel_v1.*),
byte copies of the 4 derived frames (kneel_in1, kneel_in2, kneel, kneel_b, rendered from this checkout) ->
approved/_retired/<id>_kneel_v1/, and a row in docs/RETIRED_SPRITES.md ("Kneel archives"). `--key`: approved/<id>/
kneel.png + .json (heroes battle_kneel.*) -> approved/_retired/<id>_kneel_try<N>/, then the live key is removed (the
copy also satisfies approve.py's overwrite gate). Both refuse when a target exists with different bytes; a re-run with
identical bytes is a no-op. Nothing is deleted except the live failed key after its byte-identical copy exists.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
if __name__ == "__main__":
    sys.path.insert(0, str(HERE.parent))

from gen.monster_recipes import KNEEL_FRAMES  # noqa: E402

INDEX = ROOT / "docs" / "RETIRED_SPRITES.md"
SECTION = "## Kneel archives (pass KA)"


def _refuse(msg: str) -> None:
    raise SystemExit(f"refused: {msg}")


def _copy(data: bytes, dst: Path, plan: list) -> None:
    if dst.exists() and dst.read_bytes() != data:
        _refuse(f"{dst} exists with different bytes")
    plan.append((data, dst))


def derived_frames(sid: str, gen: Path) -> dict:
    """The 4 derived kneel frames of `sid` as PNG bytes ({} when it has no kneel)."""
    import io
    if (gen / "anim" / "monsters" / f"{sid}.yaml").exists():
        from gen import kneel as KN
        from gen import kneel_ai_data as D
        from gen import monster_anim as MA
        meta, kfs = KN.add_key(sid, MA.load_rig(sid), *D._monster_entry(sid))
        fr = {n: im for n, im in MA.monster_frames(sid, kfs, meta).items() if n in KNEEL_FRAMES}
        fr["kneel"] = kfs.get("kneel")
    else:
        from gen import puppet_kneel as PK
        fr = PK.kneel_frames(sid)
    out = {}
    for n, im in fr.items():
        if im is not None:
            buf = io.BytesIO()
            im.save(buf, "PNG")
            out[n] = buf.getvalue()
    return out


def retire(sid: str, gen: Path = HERE, index: Path = INDEX, frames: dict | None = None) -> str:
    hero = not (gen / "anim" / "monsters" / f"{sid}.yaml").exists()
    rigs = gen / "anim" if hero else gen / "anim" / "monsters"
    rid = f"{sid}_kneel_v1"
    plan: list = []
    for ext in ("yaml", "lock.json"):
        src = rigs / f"{sid}.{ext}"
        if src.exists():
            _copy(src.read_bytes(), rigs / "_retired" / f"{rid}.{ext}", plan)
    frames = derived_frames(sid, gen) if frames is None else frames
    if not frames:
        _refuse(f"{sid} has no derived kneel frames to archive")
    for n, data in sorted(frames.items()):
        _copy(data, gen / "approved" / "_retired" / rid / f"{n}.png", plan)
    _write(plan)
    return _index(index, rid, sid, f"derived kneel ({', '.join(sorted(frames))}), rig + lock")


def retire_key(sid: str, n_try: int, gen: Path = HERE, index: Path = INDEX) -> str:
    hero = not (gen / "anim" / "monsters" / f"{sid}.yaml").exists()
    name = "battle_kneel" if hero else "kneel"
    live = [gen / "approved" / sid / f"{name}.{e}" for e in ("png", "json")]
    if not live[0].exists():
        _refuse(f"approved/{sid}/{name}.png does not exist")
    rid, plan = f"{sid}_kneel_try{int(n_try)}", []
    for src in live:
        if src.exists():
            _copy(src.read_bytes(), gen / "approved" / "_retired" / rid / src.name, plan)
    _write(plan)
    for src in live:
        dst = gen / "approved" / "_retired" / rid / src.name
        if src.exists() and dst.exists() and dst.read_bytes() == src.read_bytes():
            src.unlink()
    return _index(index, rid, sid, f"AI kneel key try {n_try} (J1 fail)")


def _write(plan: list) -> None:
    for data, dst in plan:
        dst.parent.mkdir(parents=True, exist_ok=True)
        if not dst.exists():
            dst.write_bytes(data)


def _index(index: Path, rid: str, sid: str, what: str) -> str:
    row = f"| `{rid}` | `{sid}` | {what} |"
    text = index.read_text() if index.exists() else ""
    if row in text:
        return row
    if SECTION not in text:
        text = text.rstrip("\n") + f"\n\n{SECTION}\n\n`retire_kneel.py` (docs/KNEEL_AI_PLAN.md 5); never built or " \
                                   "checked.\n\n| Archive | Id | Content |\n|---|---|---|\n"
    index.write_text(text.rstrip("\n") + "\n" + row + "\n")
    return row


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("id")
    ap.add_argument("--key", action="store_true", help="archive the failed approved AI key (J1)")
    ap.add_argument("--try", dest="n_try", type=int, help="the try number of the failed key (--key)")
    a = ap.parse_args(argv)
    if a.key and not a.n_try:
        _refuse("--key needs --try N")
    print(retire_key(a.id, a.n_try) if a.key else retire(a.id))
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Pass K gate tools (docs/KNEEL_PLAN.md 10: G2, G3, G5, G6).

  python3 -I assets-src/gen/kneel_tools.py coverage                         # rigs / classes with a kneel: block
  python3 -I assets-src/gen/kneel_tools.py lockdiff --base REV [--relock id ...]   # K-lock: locks only gain entries
  python3 -I assets-src/gen/kneel_tools.py pages --base REV [--atlas DIR]   # pages, preload, K-anchor fields vs REV
  python3 -I assets-src/gen/kneel_tools.py party-diff --base REV [--atlas DIR]     # 14 old hero columns vs REV

`--atlas DIR` reads a scratch build (default: the committed assets/sprites). Each command exits 1 on a failure.
"""
from __future__ import annotations

import io
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
if str(HERE.parent) not in sys.path:
    sys.path.insert(0, str(HERE.parent))
from gen import kneel_checks as KC  # noqa: E402
from gen import monster_pages as MP  # noqa: E402
from gen.monster_recipes import KNEEL_FRAMES  # noqa: E402

ANIM, RIGS, SPRITES = HERE / "anim", HERE / "anim" / "monsters", ROOT / "assets" / "sprites"
KNEEL_LOCK = {"kf:kneel", *[n for n in KNEEL_FRAMES if n != "kneel"]}
HERO_KNEEL_LOCK = set(KNEEL_FRAMES)  # hero locks (puppet_kneel.py) hash the four frames; no derived kf: key
ANCHOR_KEYS = ("homeX", "idleBox", "travelTop", "lungeRight", "head", "lungePx", "opaqueRight")
MAX_PAGES, MAX_PRELOAD = 12, 2


def git_show(rev: str, path: Path) -> bytes | None:
    """The file at `rev` (None when it did not exist there)."""
    r = subprocess.run(["git", "-C", str(ROOT), "show", f"{rev}:{path.relative_to(ROOT).as_posix()}"],
                       capture_output=True)
    return r.stdout if r.returncode == 0 else None


def _yaml(p: Path) -> dict:
    import yaml
    return yaml.safe_load(p.read_text()) or {}


def coverage() -> int:
    rigs = sorted(RIGS.glob("*.yaml"))
    heroes = sorted(p for p in ANIM.glob("*.yaml"))
    for label, files in (("monsters", rigs), ("heroes", heroes)):      # KA G3: ai (`kneel.source: ai`), derived, alias
        b = {p.stem: _yaml(p).get("kneel") for p in files}
        ai = [s for s, v in b.items() if isinstance(v, dict) and v.get("source") == "ai"]
        der = [s for s, v in b.items() if v is not None and s not in ai]
        print(f"{label} {len(files)}/{len(files)} (ai {len(ai)}, derived {len(der)}, alias {len(files) - len(ai) - len(der)})")
        print(f"  ai: {' '.join(ai) or '-'}\n  derived: {' '.join(der) or '-'}")
    return 0


def lockdiff(base: str, relock: list[str]) -> int:
    added = changed = removed = 0
    bad = []
    for p in sorted(RIGS.glob("*.lock.json")) + sorted(ANIM.glob("*.lock.json")):
        old = json.loads(git_show(base, p) or b"{}")
        a, c, r = KC.lock_delta(old, json.loads(p.read_text()))
        sid = p.name.removesuffix(".lock.json")
        allowed = HERO_KNEEL_LOCK if p.parent == ANIM else KNEEL_LOCK
        ok_c = [n for n in c if sid in relock and n in allowed]          # D-K18 step 6: a listed re-lock
        c = [n for n in c if n not in ok_c]
        added, changed, removed = added + len(a), changed + len(c), removed + len(r)
        if a or c or r or ok_c:
            print(f"{sid}: +{len(a)} {a}" + (f" changed {c}" if c else "") + (f" removed {r}" if r else "")
                  + (f" relocked {ok_c}" if ok_c else ""))
        bad += [f"{sid}: {n}" for n in c + r] + [f"{sid}: {n} is not a kneel entry" for n in a if n not in allowed]
    print(f"{added} added, {changed} changed, {removed} removed")
    for b in bad:
        print(f"  FAIL {b}")
    return 1 if bad else 0


def _atlas(rev: str | None, d: Path, name: str):
    from PIL import Image
    raw = git_show(rev, SPRITES / name) if rev else (d / name).read_bytes()
    return None if raw is None else (json.loads(raw) if name.endswith(".json") else Image.open(io.BytesIO(raw)))


def pages(base: str, d: Path) -> int:
    new, old = _atlas(None, d, "monsters-ai.json"), _atlas(base, d, "monsters-ai.json")
    fails = [f"{len(new['pages'])} pages > {MAX_PAGES}"] if len(new["pages"]) > MAX_PAGES else []
    fails += [f"page {p['file']} {p['w']}x{p['h']} > 2048" for p in new["pages"] if max(p["w"], p["h"]) > 2048]
    act1 = sorted({new["sheets"][s]["page"] for s in dict(MP.PAGE_GROUPS)["act1"] if s in new["sheets"]})
    pre = new.get("preload")
    fails += [] if pre == act1 and len(pre) <= MAX_PRELOAD else [f"preload {pre} != act-1 pages {act1} (<= 2)"]
    moved = [f"{s} {k}: {old['sheets'][s].get(k)} -> {v.get(k)}" for s, v in sorted(new["sheets"].items())
             if s in old["sheets"] for k in ANCHOR_KEYS if v.get(k) != old["sheets"][s].get(k)]
    fails += [f"K-anchor {m}" for m in moved]
    print(f"{len(new['pages'])} pages: " + ", ".join(f"{p['w']}x{p['h']}" for p in new["pages"])
          + f" (base {len(old['pages'])}); preload {pre}; K-anchor fields identical for "
            f"{sum(1 for s in new['sheets'] if s in old['sheets'])} sheets" + ("" if not moved else " EXCEPT below"))
    kneel = sorted(s for s, v in new["sheets"].items() if v["frames"].get("kneel") != v["frames"].get("daze"))
    print(f"sheets with own kneel cells: {' '.join(kneel) or '-'}")
    for f in fails:
        print(f"  FAIL {f}")
    return 1 if fails else 0


def party_diff(base: str, d: Path) -> int:
    import numpy as np
    nj, oj = _atlas(None, d, "battle-characters-ai.json"), _atlas(base, d, "battle-characters-ai.json")
    npng, opng = _atlas(None, d, "battle-characters-ai.png"), _atlas(base, d, "battle-characters-ai.png")
    na, oa = np.asarray(npng.convert("RGBA")), np.asarray(opng.convert("RGBA"))
    ow, oh = opng.size[0] // len(oj["poses"]), opng.size[1] // len(oj["sheets"])
    nw, nh = npng.size[0] // len(nj["poses"]), npng.size[1] // len(nj["sheets"])
    bad, rows = [], 0
    for sid, s in sorted(oj["sheets"].items()):
        t = nj["sheets"].get(sid)
        if t is None:
            bad.append(f"{sid}: row missing")
            continue
        rows += 1
        for i, pose in enumerate(oj["poses"]):
            j = nj["poses"].index(pose) if pose in nj["poses"] else -1
            a = oa[s["row"] * oh:(s["row"] + 1) * oh, i * ow:(i + 1) * ow]
            b = na[t["row"] * nh:(t["row"] + 1) * nh, j * nw:(j + 1) * nw] if j >= 0 else None
            if b is None or a.shape != b.shape or not np.array_equal(a, b):
                bad.append(f"{sid} {pose}")
    print(f"{rows} rows x {len(oj['poses'])} old columns " + ("identical" if not bad else f"{len(bad)} differ")
          + f"; width {npng.size[0]}")
    for b in bad[:20]:
        print(f"  FAIL {b}")
    return 1 if bad else 0


def _opt(args: list[str], name: str, default=None):
    return args[args.index(name) + 1] if name in args and args.index(name) + 1 < len(args) else default


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in ("coverage", "lockdiff", "pages", "party-diff"):
        print(__doc__)
        return 2
    cmd, args = argv[0], argv[1:]
    if cmd == "coverage":
        return coverage()
    base = _opt(args, "--base")
    if not base:
        print(f"{cmd}: --base REV is required")
        return 2
    if cmd == "lockdiff":
        rel = args[args.index("--relock") + 1:] if "--relock" in args else []
        return lockdiff(base, [r for r in rel if not r.startswith("--")])
    d = Path(_opt(args, "--atlas", str(SPRITES)))
    return pages(base, d) if cmd == "pages" else party_diff(base, d)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

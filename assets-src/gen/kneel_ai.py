"""Pass KA: AI kneel keyframes (docs/KNEEL_AI_PLAN.md rev 4; rev 7: arm g = Gemini gemini-nano-banana-2.1, pass KA-G).
Bedrock arms a-d go through bedrock.invoke (pass KA is closed, so it refuses them); arm g goes through
generate.check_budget (pass KA-G, main checkout only; kneel_ai_gem.py). One try per `gen` command: run each in the
background and wait with Monitor. Arm g files are named by try (raw_g_<try>.png, key_g_<try>.png; seed 1234 + try - 1).

  python3 -I assets-src/gen/kneel_ai.py guide <id ...> [--derived-root DIR]   # D-KA1 / D-KA2 -> out/kneel_ai/<id>/
  python3 -I assets-src/gen/kneel_ai.py gen <id> --arm a|b|b2|c|d --seed N [--purpose ka_probe] [--compact] [--paid]
  python3 -I assets-src/gen/kneel_ai.py gen <id> --arm g --try N [--purpose ka_g_pilot|ka_g_reserve] [--paid]
  python3 -I assets-src/gen/kneel_ai.py cut <id> --arm A --seed N              # D-KA6 -> key_<arm>_<seed>.png
  python3 -I assets-src/gen/kneel_ai.py gate <id> --arm A --seed N [--j1 [--joints F]]   # J0 (and J1) verdicts
  python3 -I assets-src/gen/kneel_ai.py joints <id> --arm A --seed N           # D-KA7 first guess (+ fit time)
  python3 -I assets-src/gen/kneel_ai.py review <id> | --probe [ids]          # out/kneel_ai/review/*.png
  python3 -I assets-src/gen/kneel_ai.py review --pilot [ids] --old-root DIR [--old-root-for id=DIR]   # KA-G1 sheet
  python3 -I assets-src/gen/kneel_ai.py approve <id> --arm A --seed N --try N  # approved/<id>/kneel.* (J0 PASS only)
  python3 -I assets-src/gen/kneel_ai.py converted [--check-archive] | bodies [--write] | calibrate [--write]
  python3 -I assets-src/gen/kneel_ai.py budget --check                         # KG1: closed Bedrock passes, pass KA-G
  python3 -I assets-src/gen/kneel_ai.py plan [--pilot]                         # the KA1-P probe / KA-G1 pilot commands

Without --paid, `gen` writes req_<arm>_<seed>.json (bodies with image hashes, cache keys, prices) and sends nothing.
Selftests: selftest_kneel_ai.py (run from selftest.py).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402
import yaml  # noqa: E402
from PIL import Image  # noqa: E402

from gen import kneel_ai_data as D  # noqa: E402

ARMS = ("a", "b", "b2", "c", "d", "g")
DERIVED_BASE = "24c4236"            # G14: the mainline commit the plan's derived kneels are counted at


def _dir(sid: str) -> Path:
    return D.OUT / sid


def _tag(a) -> str:
    """The file suffix: `<arm>_<seed>`, for arm g `g_<try>`."""
    if a.arm == "g":
        return f"g_{a.n_try}"
    if a.seed is None:
        raise SystemExit(f"--seed is required for arm {a.arm}")
    return f"{a.arm}_{a.seed}"


def cmd_guide(a) -> int:
    from gen import kneel_ai_guide as G
    for sid in a.ids:
        sp = D.load(sid)
        der = G.derived(sid) if not a.derived_root else G.derived(sid, Path(a.derived_root))
        g = G.build(sp, _dir(sid), der)
        print(f"{sid}: k {g['window']['k']} window {g['window']} key {g['key']} {sp.category} band {g['band_px']} "
              f"derived {'yes' if der is not None else 'none'} -> {_dir(sid)}")
    return 0


def cmd_gen(a) -> int:
    if a.arm == "g":
        from gen import kneel_ai_gem as KG
        out, stop = KG.send(D.load(a.id), a.n_try, a.purpose if a.purpose != "ka_probe" else KG.PILOT, a.paid)
        if out:
            print(f"{a.id} (g) try {a.n_try}: {out}")
        if stop:
            print(f"STOP pilot: {stop}")
            return 3
        return 0
    from gen import kneel_ai_req as RQ
    out = RQ.send(D.load(a.id), a.arm, a.seed, a.purpose, a.paid, a.compact, _dir(a.id))
    if out:
        print(f"{a.id} ({a.arm}) seed {a.seed}: {out}")
    return 0


def cmd_cut(a) -> int:
    from gen import kneel_ai_cut as C
    sp, d = D.load(a.id), _dir(a.id)
    g = json.loads((d / "guide.json").read_text())
    from gen import kneel_ai_pitch as PT
    t, rec = _tag(a), {"arm": a.arm, "seed": a.seed, "try": a.n_try}
    try:
        r = C.cut(Image.open(d / f"raw_{t}.png"), sp, g["window"]["k"], a.arm, PT.sil_height(d))
    except C.CutFail as e:
        (d / f"cut_{t}.json").write_text(json.dumps({**rec, "fail": str(e)}, indent=1) + "\n")
        print(f"{a.id} ({t}): CUT FAIL {e}")
        return 1
    Image.fromarray(r["key"], "RGBA").save(d / f"key_{t}.png")
    Image.fromarray(r["raw"], "RGBA").save(d / f"rawn_{t}.png")
    (d / f"cut_{t}.json").write_text(json.dumps({**rec, **r["info"]}, indent=1) + "\n")
    print(f"{a.id} ({t}): cut {r['info']}")
    return 0


def cmd_gate(a) -> int:
    from gen import kneel_ai_gates as GT
    from gen import kneel_ai_review as RV
    sp, d, t = D.load(a.id), _dir(a.id), _tag(a)
    key = np.asarray(Image.open(d / f"key_{t}.png").convert("RGBA"))
    raw = np.asarray(Image.open(d / f"rawn_{t}.png").convert("RGBA"))
    info = json.loads((d / f"cut_{t}.json").read_text())
    der = np.asarray(Image.open(d / "derived_native.png").convert("RGBA")) if (d / "derived_native.png").exists() \
        else None
    sil = RV._sil(a.id)
    rows = GT.j0(sp, key, raw, info, None, der, sil[..., 3] > 0 if sil is not None else None)
    if a.j1:
        from gen import kneel_ai_j1 as J1
        joints = yaml.safe_load(Path(a.joints).read_text()) if a.joints else (sp.cfg.get("keyframes") or {})["kneel"]
        rows += J1.j1(sp, key, {k: tuple(v) for k, v in joints.items()}, GT.thresholds())
    v = GT.verdict(rows)
    (d / f"gate_{t}.json").write_text(json.dumps({"try": a.n_try, "rows": rows, "verdict": v}, indent=1) + "\n")
    for n, ok, val in rows:
        print(f"  {n:22} {'report' if ok is None else 'ok' if ok else 'FAIL':6} {val}")
    print(f"{a.id} try {a.n_try} ({t}): {v}")
    return 0 if v == "PASS" else 1


def cmd_joints(a) -> int:
    from gen import kneel_ai_joints as KJ
    sp, d = D.load(a.id), _dir(a.id)
    src = Path(a.key) if a.key else d / f"key_{_tag(a)}.png"
    g = KJ.guess(sp, np.asarray(Image.open(src).convert("RGBA")))
    (d / f"joints_guess_{_tag(a)}.yaml").write_text(yaml.safe_dump({"kneel": g["joints"]}, sort_keys=True,
                                                                           default_flow_style=None))
    print(f"{a.id}: fit {g['seconds']} s CPU ({g['wall']} s wall), mean IoU {g['mean']}, hand-mark {g['hand'] or '-'}"
          f"{' (whole key by hand)' if g['whole'] else ''}")
    return 0


def cmd_review(a) -> int:
    from gen import kneel_ai_review as RV
    if a.pilot:
        from gen import kneel_ai_pilot as KP
        old_for = dict((k, Path(v)) for k, _, v in (x.partition("=") for x in a.old_root_for))
        print(KP.pilot(a.ids or D.conf()["gemini"]["pilot"], Path(a.old_root) if a.old_root else None, old_for))
        return 0
    print(RV.probe(a.ids or D.conf()["probe"]["sprites"]) if a.probe else "\n".join(RV.review(s) for s in a.ids))
    return 0


def cmd_approve(a) -> int:
    from gen import approve as AP
    from gen import bedrock as B
    sp, d, t = D.load(a.id), _dir(a.id), _tag(a)
    gate = json.loads((d / f"gate_{t}.json").read_text())
    if gate["verdict"] != "PASS":
        raise SystemExit(f"refused: {a.id} ({t}) has no J0 PASS ({gate['verdict']})")
    reqs = json.loads((d / f"req_{t}.json").read_text())
    g = json.loads((d / "guide.json").read_text())
    meta = {"character": a.id, "sheet": "battle_kneel" if sp.hero else "kneel", "arm": a.arm, "seed": a.seed,
            "try": a.n_try, "guide_sha": g["sha"], "grid": list(sp.cell), "bottom_row": sp.bottom,
            "foot_row": sp.foot_row}
    if a.arm == "g":
        meta.update(seed=reqs["seed"], models=[reqs["model"]], gemini_cache_keys=[reqs["key"]], refs=reqs["refs"],
                    settings={k: D.conf()["gemini"][k] for k in ("model", "aspect_ratio", "image_size")})
    else:
        meta.update(models=[B.MODELS[r["model"]] for r in reqs], settings=D.conf()["arms"][a.arm],
                    br_cache_keys=[r["key"] for r in reqs])
    print("approved:", AP.approve_kneel(a.id, meta["sheet"], d / f"key_{t}.png", meta))
    return 0


def converted() -> list[str]:
    out = []
    for p in sorted(D.RIGS.glob("*.yaml")) + sorted(D.HEROES.glob("*.yaml")):
        b = (yaml.safe_load(p.read_text()) or {}).get("kneel")
        if isinstance(b, dict) and b.get("source") == "ai":
            out.append(p.stem)
    return out


def cmd_converted(a) -> int:
    ids = converted()
    if not a.check_archive:
        print(" ".join(ids))
        return 0
    from gen import kneel_tools as KT
    bad = []
    for sid in ids:
        rig = D.RIGS / f"{sid}.yaml" if (D.RIGS / f"{sid}.yaml").exists() else D.HEROES / f"{sid}.yaml"
        old = KT.git_show(DERIVED_BASE, rig)
        if old and "kneel" in (yaml.safe_load(old) or {}) and not (D.APPROVED / "_retired" / f"{sid}_kneel_v1").is_dir():
            bad.append(sid)
    print("OK" if not bad else f"missing _kneel_v1 archives: {' '.join(bad)}")
    return 1 if bad else 0


def cmd_plan(a) -> int:
    """The KA1-P probe commands in order, or (--pilot) the KA-G1 pilot's (kneel_ai_plan.py)."""
    from gen import kneel_ai_plan as KP
    print(KP.pilot_plan() if a.pilot else KP.probe_plan())
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("guide")
    g.add_argument("ids", nargs="+")
    g.add_argument("--derived-root", help="a checkout whose derived kneel arm (a) uses (e.g. /tmp/ka1/k3-0)")
    for name in ("gen", "cut", "gate", "joints", "approve"):
        p = sub.add_parser(name)
        p.add_argument("id")
        p.add_argument("--arm", choices=ARMS, required=True)
        p.add_argument("--seed", type=int, help="arms a-d (arm g: seed 1234 + try - 1)")
        p.add_argument("--try", dest="n_try", type=int, default=1)
    gen = sub.choices["gen"]
    gen.add_argument("--purpose", default="ka_probe")
    gen.add_argument("--compact", action="store_true", help="the 5b compact wording (try 2 after an A-width fail)")
    gen.add_argument("--paid", action="store_true")
    sub.choices["gate"].add_argument("--j1", action="store_true")
    sub.choices["gate"].add_argument("--joints", help="a yaml {joint: [x, y]} (default: the rig's keyframes.kneel)")
    sub.choices["joints"].add_argument("--key", help="a native key png instead of key_<arm>_<seed>.png")
    r = sub.add_parser("review")
    r.add_argument("ids", nargs="*")
    r.add_argument("--probe", action="store_true")
    r.add_argument("--pilot", action="store_true", help="the KA-G1 pilot sheet (kneel_ai_pilot.py)")
    r.add_argument("--old-root", help="a checkout the old derived kneels render from (e.g. a worktree at f7adf73)")
    r.add_argument("--old-root-for", action="append", default=[], metavar="ID=DIR")
    c = sub.add_parser("converted")
    c.add_argument("--check-archive", action="store_true")
    for name in ("bodies", "calibrate"):
        sub.add_parser(name).add_argument("--write", action="store_true")
    sub.add_parser("budget").add_argument("--check", action="store_true")
    sub.add_parser("plan").add_argument("--pilot", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd == "bodies":
        from gen import kneel_ai_bodies as KB
        return KB.bodies(a.write)
    if a.cmd == "calibrate":
        from gen import kneel_ai_calib as KC
        return KC.calibrate(a.write)
    if a.cmd == "budget":
        from gen import kneel_ai_budget as KB
        return KB.check(a.check)
    return {"guide": cmd_guide, "gen": cmd_gen, "cut": cmd_cut, "gate": cmd_gate, "joints": cmd_joints,
            "review": cmd_review, "approve": cmd_approve, "converted": cmd_converted, "plan": cmd_plan}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())

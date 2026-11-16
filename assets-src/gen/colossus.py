"""Chaos colossus forms: art tool (docs/CHAOS_FORMS_PLAN.md 5; FW-C). Separate from generate.py's monster sheets.
Every Bedrock call goes through bedrock.invoke, whose gate (paid, purpose caps, the pass-C cap of 80, the BR ledger,
main checkout only) cannot be bypassed. One call per command (R29): run each in the background, wait with Monitor.

  python3 -I assets-src/gen/colossus.py gen <form> --model core|sd35|ultra --seed N [--purpose P] [--paid]
  python3 -I assets-src/gen/colossus.py nobg <form> <raw.png> [--purpose P] [--paid]       # remove_bg
  python3 -I assets-src/gen/colossus.py outpaint|search_replace|structure <form> <raw.png> --seed N ... [--paid]
                                                                     # edits (colossus_edit.py; V0-e, V0-d, F4)
  python3 -I assets-src/gen/colossus.py upscale <src.png> --model conservative --prompt P --seed N [--creativity C]
                                                    [--out F] [--paid]   # 7.3 rim fix, purpose rim_upscale (cap 2)
  python3 -I assets-src/gen/colossus.py inpaint <src> --mask M --prompt P --seed N [--paid]; inpaint_merge <src> <raw>
                                        --mask M      # F4 masked edit (colossus_inpaint.py; merge is offline)
  python3 -I assets-src/gen/colossus.py upscale <src.png> --model conservative --form F ...  # F3 / F2 (f3_upscale,
                                    f2_upscale): the call, then upfit to the form canvas (refused when narrower)
  python3 -I assets-src/gen/colossus.py upfit <form> <upscaled.png> --raw R      # offline fit + new-blob check
  python3 -I assets-src/gen/colossus.py glow <form> --raw R --cut C [--method diff|lum] [--sky open|fit] ...
                                    # offline: sky_base, despill, glow + the 18.7 checks (colossus_glowcmd.py)
  python3 -I assets-src/gen/colossus.py mock <form> [--body B --glow G --raw ORIG --sky SKY]   # rim mock + side by side
  python3 -I assets-src/gen/colossus.py review|check|lock <form>                 # after the layer yaml
  python3 -I assets-src/gen/colossus.py approve <form> <body.png> [--extra glow=glow.png ...]
                                    # -> approved/chaos_forms/<form>/ (master.png + extras + meta.json)
  python3 -I assets-src/gen/colossus.py budget --check               # pass C <= 80, each purpose <= cap, gem[N_C0:] == 0

Rev 4 (D-U10): the colossus forms are painted art at scale 1 (colossus_paint.py); the rev-3 `pix` step is gone.
Without --paid, gen / nobg only print the request (a cached one is written, it is free). The prompt is
gen/colossus/<form>.prompt.md ("## prompt" and "## negative_prompt" sections, written by the generator). Outputs go to
gen/out/colossus/<form>/ (each with a .json sidecar: model, seed, cache keys, prompt hash) and gen/out/colossus/review/.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image  # noqa: E402

HERE = Path(__file__).resolve().parent
SPECS = HERE / "colossus"
OUT = HERE / "out" / "colossus"
REVIEW = OUT / "review"
GEM_LEDGER = HERE / "cache" / "ledger.jsonl"
GITIGNORE = HERE.parent.parent / ".gitignore"
# the painted forms (rev 4, 18.4): canvas = screen px at scale 1, the rest place, the purposes, and for F3 the halo
# geometry (measured at C3' on the picked render x 1.5: ring centre, radius, band width; the corona disc) the glow
# checks default to. Places: F3 (-527, -60) (user ruling 2026-11-16: lowered so more of the halo shows), F2 (40, 25).
# F4 (chaos_horizon_core) reuses F3's art.
FORMS = {
    "chaos_orrery": {"aspect": "16:9", "canvas": (1320, 900), "place": (40, 25), "sky_dim": 1.0,
                     "gen": "f2_gen", "nobg": "f2_nobg", "upscale": "f2_upscale"},
    "chaos_horizon": {"aspect": "21:9", "canvas": (2700, 1080), "place": (-527, -60), "sky_dim": 0.6,
                      "gen": "f3_gen", "nobg": "f3_nobg", "upscale": "f3_upscale",
                      "ring": (1350.0, 502.0, 525.0, 48.0), "corona": (1347.0, 510.0, 230.0)},
}


def _form(form: str) -> dict:
    if form not in FORMS:
        raise SystemExit(f"unknown form {form} (art forms: {', '.join(FORMS)}; chaos_horizon_core reuses chaos_horizon)")
    return FORMS[form]


def _sidecar(path: Path, meta: dict) -> None:
    path.with_suffix(".json").write_text(json.dumps(meta, indent=2, sort_keys=True) + "\n")


def _read_sidecar(path: Path) -> dict:
    side = path.with_suffix(".json")
    return json.loads(side.read_text()) if side.exists() else {}


def prompt_of(form: str) -> tuple[str, str]:
    path = SPECS / f"{form}.prompt.md"
    if not path.exists():
        raise SystemExit(f"{path} is missing: the generator writes the prompt (5.3a) before the first gen")
    txt = path.read_text()
    pos, neg = txt.split("## prompt", 1)[1].split("## negative_prompt", 1)
    return " ".join(pos.split()), " ".join(neg.split())


def _call(model: str, body: dict, purpose: str, paid: bool, dst: Path, meta: dict) -> int:
    from gen import bedrock as B
    key = B.cache_key(model, body)
    shown = {k: (v if k != "image" else f"<png b64, {len(v)} chars>") for k, v in body.items()}
    print(json.dumps({"model": model, "id": B.MODELS[model], "purpose": purpose, "key": key, "cached": B.is_cached(key),
                      "body": shown}, indent=2))
    if not paid and not B.is_cached(key):
        print("dry run: no request sent (add --paid for the one paid call of this checkpoint)")
        return 0
    img = B.invoke(model, body, paid=paid, purpose=purpose)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst)
    _sidecar(dst, {**meta, "model": model, "purpose": purpose, "cache_keys": [*meta.get("cache_keys", []), key]})
    print(f"wrote {dst} {img.size}")
    return 0


def cmd_gen(a) -> int:
    f = _form(a.form)
    pos, neg = prompt_of(a.form)
    body = {"prompt": pos, "negative_prompt": neg, "aspect_ratio": f["aspect"], "seed": a.seed, "output_format": "png"}
    if a.model == "sd35":
        body["mode"] = "text-to-image"
    meta = {"seed": a.seed, "prompt_sha256": hashlib.sha256((pos + "\n" + neg).encode()).hexdigest()}
    return _call(a.model, body, a.purpose or f["gen"], a.paid, OUT / a.form / f"{a.model}_{a.seed}_raw.png", meta)


def cmd_nobg(a) -> int:
    from gen import bedrock as B
    f, raw = _form(a.form), Path(a.raw)
    body = {"image": B.png_b64(Image.open(raw).convert("RGB")), "output_format": "png"}
    meta = {**_read_sidecar(raw), "source": str(raw)}
    return _call("remove_bg", body, a.purpose or f["nobg"], a.paid, raw.with_name(raw.stem.removesuffix("_raw") + "_nobg.png"),
                 meta)


def approve(form: str, master: Path, meta: dict, tree=None, gitignore: Path = GITIGNORE,
            extras: dict[str, Path] | None = None) -> Path:
    """Copy the body to approved/chaos_forms/<form>/master.png, each extra (name -> file, e.g. glow -> glow.png) to
    <name>.png, write meta.json and un-ignore its cache files. A file that would be replaced or dropped (the rev-3 glow,
    variant_crack*) must have a byte-identical copy in an archive (retire.py --colossus, 5.5), else it refuses before
    writing; archived stale files are removed so the stage only sees the new approval."""
    from gen import retire as RT
    tree = tree or RT.Tree()
    root = tree.approved / "chaos_forms" / form
    new = {"master.png": master.read_bytes(),
           **{(n if n.endswith(".png") else f"{n}.png"): Path(p).read_bytes() for n, p in (extras or {}).items()}}

    def archived(p: Path) -> bool:
        return any((d / p.name).is_file() and (d / p.name).read_bytes() == p.read_bytes()
                   for d in RT.colossus_archives(tree, form))
    live = sorted(p for p in root.iterdir() if p.is_file() and p.name != "meta.json") if root.is_dir() else []
    for p in live:
        if new.get(p.name) != p.read_bytes() and not archived(p):
            raise SystemExit(f"refused: {p} exists with different bytes and has no byte-identical archive copy; run "
                             f"retire.py --colossus {form} first")
    root.mkdir(parents=True, exist_ok=True)
    for p in live:
        if p.name not in new:
            p.unlink()
    for name, data in new.items():
        (root / name).write_bytes(data)
    (root / "meta.json").write_text(json.dumps(meta, indent=2, sort_keys=True) + "\n")
    lines = gitignore.read_text().splitlines() if gitignore.exists() else []
    add = [n for n in (f"!assets-src/gen/cache/{k}.{e}" for k in meta.get("cache_keys", []) for e in ("png", "json"))
           if n not in lines]
    if add:
        gitignore.write_text("\n".join(lines + add) + "\n")
    return root / "master.png"


def cmd_approve(a) -> int:
    _form(a.form)
    body = Path(a.body)
    extras = dict(e.split("=", 1) for e in a.extra or [])
    meta = {**_read_sidecar(body), "body": str(body), **({"extras": extras} if extras else {})}
    print(f"approved {approve(a.form, body, meta, extras=extras)} (+ {', '.join(extras) or 'no extras'})")
    return 0


def budget_breaches(budget: dict, rows: list[dict], gem_count: int) -> list[str]:
    """Every breach of the pass-C budget: the cap, each purpose cap, unknown purposes, caps that do not sum to the cap,
    and Gemini attempts past N_C0 (D-U6: no Gemini fallback)."""
    from gen import bedrock as B
    br = budget.get("bedrock")
    if not isinstance(br, dict):
        return ["budget.json has no bedrock block"]
    caps, out = br.get("per_purpose_caps") or {}, []
    if sum(caps.values()) != br.get("cap"):
        out.append(f"per_purpose_caps sum {sum(caps.values())} != cap {br.get('cap')}")
    run = [r for r in rows if r.get("event") == "request" and r.get("pass") == br.get("pass")]
    if len(run) > br.get("cap", 0):
        out.append(f"pass {br.get('pass')}: {len(run)} Bedrock calls > cap {br.get('cap')}")
    per: dict[str, int] = {}
    for r in run:
        per[B.purpose_key(r.get("purpose", ""))] = per.get(B.purpose_key(r.get("purpose", "")), 0) + 1
    for p, n in sorted(per.items()):
        if p not in caps:
            out.append(f"unknown purpose {p!r} ({n} calls)")
        elif n > caps[p]:
            out.append(f"{p}: {n} calls > cap {caps[p]}")
    for r in run:
        if B.purpose_key(r.get("purpose", "")) == "reserve" and B.reserve_cost_breach(r.get("model", ""), br):
            out.append(f"reserve row {r.get('key')}: {r.get('model')} costs more than ${B.reserve_max(br):.2f} (B7)")
    n0 = br.get("gemini_before")
    if not isinstance(n0, int) or gem_count < n0:
        out.append(f"Gemini ledger inconsistent: {gem_count} attempts < gemini_before (N_C0) {n0}")
    elif gem_count > n0:
        out.append(f"Gemini: {gem_count - n0} attempts after N_C0 = {n0} (pass C allows none, D-U6)")
    return out


def cmd_budget(a, gem_ledger: Path | None = None, gem_count: int | None = None) -> int:
    from gen import bedrock as B
    budget = json.loads(B.BUDGET.read_text())
    rows = B.read_br_ledger()
    if gem_count is None:
        led = gem_ledger or GEM_LEDGER
        lines = [json.loads(x) for x in led.read_text().splitlines() if x.strip()] if led.exists() else []
        gem_count = sum(e.get("event") == "attempt" and e.get("backend") != "bedrock" for e in lines)
    br = budget.get("bedrock") or {}
    used = sum(r.get("event") == "request" and r.get("pass") == br.get("pass") for r in rows)
    print(f"Bedrock calls: {used} of {br.get('cap')} (pass {br.get('pass')}); Gemini attempts {gem_count}, "
          f"N_C0 {br.get('gemini_before')}")
    breaches = budget_breaches(budget, rows, gem_count)
    for b in breaches:
        print(f"  BREACH {b}")
    if not a.check:
        return 0
    print("budget --check: " + ("OK" if not breaches else f"{len(breaches)} breach(es)"))
    return 1 if breaches else 0


def main(argv: list[str] | None = None, gem_ledger: Path | None = None, gem_count: int | None = None) -> int:
    from gen import colossus_edit as CE
    from gen import colossus_glowcmd as CG
    from gen import colossus_inpaint as CI
    from gen import colossus_review as CR
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("gen")
    g.add_argument("form"); g.add_argument("--model", choices=["core", "sd35", "ultra"], required=True)
    g.add_argument("--seed", type=int, required=True)
    n = sub.add_parser("nobg")
    n.add_argument("form"); n.add_argument("raw")
    for p in (g, n):
        p.add_argument("--purpose", help="a budget.json bedrock purpose (default: the form's gen / nobg purpose)")
        p.add_argument("--paid", action="store_true")
    ap_ = sub.add_parser("approve")
    ap_.add_argument("form"); ap_.add_argument("body")
    ap_.add_argument("--extra", action="append", metavar="NAME=FILE", help="another approved layer file (glow=...)")
    CG.add_parsers(sub)
    CR.add_parsers(sub)
    CE.add_parsers(sub)
    CI.add_parsers(sub)
    b = sub.add_parser("budget")
    b.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd == "budget":
        return cmd_budget(a, gem_ledger, gem_count)
    cmds = {"gen": cmd_gen, "nobg": cmd_nobg, "approve": cmd_approve, "glow": CG.cmd_glow, "upfit": CG.cmd_upfit,
            "review": CR.cmd_review, "check": CR.cmd_check, "lock": CR.cmd_lock, "mock": CR.cmd_mock,
            "upscale": CE.cmd_upscale, "inpaint": CI.cmd_inpaint, "inpaint_merge": CI.cmd_merge,
            **{k: CE.cmd_edit for k in CE.PURPOSES}}
    return cmds[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())

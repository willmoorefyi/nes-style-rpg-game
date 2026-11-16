"""Chaos colossus forms: art tool (docs/CHAOS_FORMS_PLAN.md 5; FW-C). Separate from generate.py's monster sheets.
Every Bedrock call goes through bedrock.invoke, whose gate (paid, purpose caps, the pass-C cap of 80, the BR ledger,
main checkout only) cannot be bypassed. One call per command (R29): run each in the background, wait with Monitor.

  python3 -I assets-src/gen/colossus.py gen <form> --model core|sd35|ultra --seed N [--purpose P] [--paid]
  python3 -I assets-src/gen/colossus.py nobg <form> <raw.png> [--purpose P] [--paid]       # remove_bg
  python3 -I assets-src/gen/colossus.py pix <form> <nobg.png> [--scale 2|3] [--colors N] [--canvas WxH] [--out F]
  python3 -I assets-src/gen/colossus.py glow|bake|review|check|lock <form>                  # after the layer yaml
  python3 -I assets-src/gen/colossus.py mock <form> [--image F] [--bg F] [--floor F]       # stage mock on rim
  python3 -I assets-src/gen/colossus.py approve <form> <pix.png>     # -> approved/chaos_forms/<form>/master.png
  python3 -I assets-src/gen/colossus.py budget --check               # pass C <= 80, each purpose <= cap, gem[N_C0:] == 0

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
# the art forms (3.2, 3.3, 4.2 planned geometry at scale 3; scale 2 multiplies the canvas by 3/2). F4 reuses F3's art.
FORMS = {
    "chaos_orrery": {"aspect": "16:9", "canvas": (440, 300), "colors": 20, "place": (-60, 60),
                     "gen": "f2_gen", "nobg": "f2_nobg"},
    "chaos_horizon": {"aspect": "21:9", "canvas": (900, 520), "colors": 24, "place": (-390, -300),
                      "gen": "f3_gen", "nobg": "f3_nobg"},
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


def cmd_pix(a) -> int:
    from gen import colossus_layers as CL
    f, src = _form(a.form), Path(a.nobg)
    canvas = tuple(int(v) for v in a.canvas.split("x")) if a.canvas else \
        tuple(c * 3 // a.scale for c in f["canvas"])
    out = CL.pix(Image.open(src), canvas, a.colors or f["colors"], seed=a.seed)
    dst = Path(a.out) if a.out else src.with_name(f"{src.stem}_pix_s{a.scale}.png")
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst)
    _sidecar(dst, {**_read_sidecar(src), "nobg": str(src), "scale": a.scale, "canvas": list(canvas),
                   "colors": a.colors or f["colors"]})
    probs = CL.palette_problems(out)
    print(f"wrote {dst} {out.size}" + ("" if not probs else f"; {probs}"))
    return 1 if probs else 0


def approve(form: str, pix: Path, meta: dict, tree=None, gitignore: Path = GITIGNORE) -> Path:
    """Copy pix to approved/chaos_forms/<form>/master.png + meta.json and un-ignore its cache files. Refuses to replace
    a different master unless a byte-identical copy is archived (retire.py --colossus, 5.5)."""
    from gen import retire as RT
    tree = tree or RT.Tree()
    dst = tree.approved / "chaos_forms" / form / "master.png"
    data = pix.read_bytes()
    if dst.exists() and dst.read_bytes() != data and not any(
            (d / "master.png").is_file() and (d / "master.png").read_bytes() == dst.read_bytes()
            for d in RT.colossus_archives(tree, form)):
        raise SystemExit(f"refused: {dst} exists with different bytes and has no byte-identical archive copy; run "
                         f"retire.py --colossus {form} first")
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(data)
    (dst.parent / "meta.json").write_text(json.dumps(meta, indent=2, sort_keys=True) + "\n")
    lines = gitignore.read_text().splitlines() if gitignore.exists() else []
    new = [f"!assets-src/gen/cache/{k}.{e}" for k in meta.get("cache_keys", []) for e in ("png", "json")]
    add = [n for n in new if n not in lines]
    if add:
        gitignore.write_text("\n".join(lines + add) + "\n")
    return dst


def cmd_approve(a) -> int:
    _form(a.form)
    pix = Path(a.pix)
    print(f"approved {approve(a.form, pix, {**_read_sidecar(pix), 'pix': str(pix)})}")
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
    x = sub.add_parser("pix")
    x.add_argument("form"); x.add_argument("nobg"); x.add_argument("--scale", type=int, choices=[2, 3], default=3)
    x.add_argument("--colors", type=int); x.add_argument("--canvas", help="WxH override (fixtures)")
    x.add_argument("--seed", type=int, default=0); x.add_argument("--out")
    ap_ = sub.add_parser("approve")
    ap_.add_argument("form"); ap_.add_argument("pix")
    for name in ("glow", "bake", "review", "check", "lock"):
        sub.add_parser(name).add_argument("form")
    m = sub.add_parser("mock")
    m.add_argument("form"); m.add_argument("--image"); m.add_argument("--bg"); m.add_argument("--floor")
    b = sub.add_parser("budget")
    b.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd == "budget":
        return cmd_budget(a, gem_ledger, gem_count)
    cmds = {"gen": cmd_gen, "nobg": cmd_nobg, "pix": cmd_pix, "approve": cmd_approve, "glow": CR.cmd_glow,
            "bake": CR.cmd_bake, "review": CR.cmd_review, "check": CR.cmd_check, "lock": CR.cmd_lock, "mock": CR.cmd_mock}
    return cmds[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())

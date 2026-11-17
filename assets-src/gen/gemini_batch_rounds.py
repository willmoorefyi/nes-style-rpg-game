"""Pass KA-G batch rounds (docs/KNEEL_AI_PLAN.md rev 7 sections 4-6): the round labels, the sprites of each round,
the per-sprite outcome read from the ledger, and `prepare` (the JSONL + its index) with the dry-run validation.

Labels: 1a (tranche T), 1b (the other 115), 1 (1a + 1b, for validation and --check only), 2, 3, reserve (try 4,
seed 1237, purpose ka_g_reserve). `<label>e` is the one re-send of an expired / not-created round (`prepare --round R
--resend`, purpose ka_g_expiry, the same lines). Files: out/kneel_ai/batch/r<label>.jsonl and r<label>.index.json;
verdicts.json holds the review / J0 / J1 verdicts per `<sprite>:<try>` (`gemini_batch.py verdict`).
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

from gen import generate as GEN
from gen import gemini as GM
from gen import kneel_ai_data as D
from gen import kneel_ai_gem as KG

BATCH = D.OUT / "batch"
CLIENT = None                   # the selftests put a fake client here
ROUNDS = {"1a": 1, "1b": 1, "1": 1, "2": 2, "3": 3, "reserve": 4}
RESEND = "e"
SETTLED = ("pass", "fail", "missing")


def client():
    return CLIENT if CLIENT is not None else GM.client()


def ledger_rows() -> list[dict]:
    return GEN.read_ledger(GEN.LEDGER)          # read at call time (the selftests move GEN.LEDGER)


def append(entry: dict) -> None:
    GEN.ledger_append(entry, GEN.LEDGER)


def base(label: str) -> str:
    return label[:-1] if label.endswith(RESEND) and label[:-1] in ROUNDS else label


def is_resend(label: str) -> bool:
    return base(label) != label


def try_of(label: str) -> int:
    if base(label) not in ROUNDS:
        raise SystemExit(f"unknown round {label!r} ({', '.join(ROUNDS)}, or <round>{RESEND} for a re-send)")
    return ROUNDS[base(label)]


def purpose_of(label: str) -> str:
    return KG.EXPIRY if is_resend(label) else KG.RESERVE if try_of(label) == 4 else KG.BATCH


def paths(label: str) -> tuple[Path, Path]:
    return BATCH / f"r{label}.jsonl", BATCH / f"r{label}.index.json"


def load_index(label: str) -> dict:
    p = paths(label)[1]
    if not p.exists():
        raise SystemExit(f"refused: round {label} has no prepared JSONL ({p}); run prepare --round {label} first")
    return json.loads(p.read_text())


def verdicts() -> dict:
    p = BATCH / "verdicts.json"
    return json.loads(p.read_text()) if p.exists() else {}


def set_verdict(ids: list[str], n_try: int, verdict: str, reason: str) -> None:
    v = verdicts()
    for sid in ids:
        v[f"{sid}:{n_try}"] = {"verdict": verdict, "reason": reason}
    BATCH.mkdir(parents=True, exist_ok=True)
    (BATCH / "verdicts.json").write_text(json.dumps(v, indent=1, sort_keys=True) + "\n")


def batch_ids() -> list[str]:
    return sorted(set(D.monsters() + D.heroes()) - set(KG.gconf()["pilot"]))


def outcome(sid: str, n_try: int, ledger: list[dict], vd: dict) -> str:
    """unsent | pending | void | missing (failed or absent response) | unreviewed | pass | fail, for one try."""
    idx = [i for i, e in enumerate(ledger) if e.get("event") == "attempt" and e.get("backend") == "gemini_batch"
           and e.get("req") == f"{sid}:{n_try}" and e.get("reason") != "duplicate"]
    if not idx:
        return "unsent"
    key = ledger[idx[-1]]["key"]
    for e in ledger[idx[-1] + 1:]:
        if e.get("key") == key and e.get("event") == "void":
            return "void"
        if e.get("key") == key and e.get("event") == "result":
            if not e.get("ok"):
                return "missing"
            return (vd.get(f"{sid}:{n_try}") or {}).get("verdict", "unreviewed")
    return "pending"


def ids_for(label: str, ledger: list[dict]) -> list[str]:
    tranche, n = list(KG.gconf()["tranche_t"]), try_of(label)
    if label in ("1a", "1b", "1"):
        rest = [s for s in batch_ids() if s not in tranche]
        return {"1a": tranche, "1b": rest, "1": tranche + rest}[label]
    vd = verdicts()
    cands = batch_ids() if n == 2 else [s for s in batch_ids() if outcome(s, n - 1, ledger, vd) != "unsent"]
    state = {s: outcome(s, n - 1, ledger, vd) for s in cands}
    bad = sorted(f"{s} ({v})" for s, v in state.items() if v not in SETTLED)
    if bad:
        raise SystemExit(f"refused: round {label} needs every try-{n - 1} sprite PASS, FAIL with a reason or missing; "
                         f"not settled: {', '.join(bad[:12])}{' ...' if len(bad) > 12 else ''}")
    return sorted(s for s, v in state.items() if v in ("fail", "missing"))


def _b64(im: Image.Image) -> str:
    return base64.b64encode(GM._png_bytes(im)).decode()


def body(r) -> dict:
    gc = KG.gconf()
    parts = [{"inline_data": {"mime_type": "image/png", "data": _b64(im)}} for im in r.images] + [{"text": r.prompt}]
    return {"contents": [{"role": "user", "parts": parts}],
            "generation_config": {"response_modalities": ["IMAGE"], "seed": r.seed,
                                  "image_config": {"aspect_ratio": gc["aspect_ratio"], "image_size": gc["image_size"]}}}


def _resend_lines(label: str, ledger: list[dict]) -> tuple[list[str], list[dict]]:
    orig = base(label)
    if any(e.get("event") == "batch_submit" and e.get("round") == label for e in ledger):
        raise SystemExit(f"refused: round {orig} was re-sent once already ({label}); a second expiry of the same keys "
                         "stops KA-G for a user ruling (section 8)")
    idx, vd = load_index(orig), verdicts()
    gone = [ln for ln in idx["lines"] if outcome(ln["sid"], ln["try"], ledger, vd) == "void"]
    if not gone:
        raise SystemExit(f"refused: round {orig} has no voided keys to re-send")
    keep = {ln["key"] for ln in gone}
    src = paths(orig)[0].read_text().splitlines()
    return [x for x in src if json.loads(x)["key"] in keep], [{**ln, "purpose": KG.EXPIRY} for ln in gone]


def prepare(label: str, resend: bool = False) -> int:
    ledger = ledger_rows()
    if resend:
        if is_resend(label):
            raise SystemExit("refused: a second expiry of the same keys stops KA-G for a user ruling (section 8)")
        label = label + RESEND
        out, lines = _resend_lines(label, ledger)
    else:
        n, purpose, out, lines = try_of(label), purpose_of(label), [], []
        for sid in ids_for(label, ledger):
            r = KG.request(D.load(sid), n, purpose, label)
            if r.cached:
                raise SystemExit(f"refused: {r.req} is already in the cache ({r.key}): nothing to pay for")
            out.append(json.dumps({"key": r.req, "request": body(r)}))
            lines.append({"key": r.req, "sid": sid, "try": n, "seed": r.seed, "cache_key": r.key, "sheet": r.sheet.name,
                          "purpose": purpose, "refs": list(r.refs), "prompt": r.prompt})
    if not lines:
        print(f"round {label}: no sprite needs this round; nothing written")
        return 0
    BATCH.mkdir(parents=True, exist_ok=True)
    jl, ix = paths(label)
    jl.write_text("\n".join(out) + "\n")
    index = {"round": label, "try": try_of(label), "purpose": purpose_of(label), "model": KG.gconf()["model"],
             "retry": try_of(label) > 1 or is_resend(label), "n": len(lines),
             "sha256": hashlib.sha256(jl.read_bytes()).hexdigest(), "est_usd": round(len(lines) * KG.est_usd(
                 "gemini_batch"), 4), "lines": lines}
    ix.write_text(json.dumps(index, indent=1) + "\n")
    s = validate(label)
    print(f"OK round {label}: {s['n']} requests, {s['unique']} unique keys, {s['images']} images + 1 text each, model "
          f"{index['model']}, 1:1 1K, est ${index['est_usd']:.2f}; 0 sent")
    return 0


def validate(label: str) -> dict:
    """The KG3 checks on the written JSONL; SystemExit naming every problem."""
    gc, idx = KG.gconf(), load_index(label)
    jl = paths(label)[0]
    errs, keys, nimg = [], [], set()
    if hashlib.sha256(jl.read_bytes()).hexdigest() != idx["sha256"]:
        errs.append("the JSONL sha256 differs from its index (re-run prepare)")
    by_key = {ln["key"]: ln for ln in idx["lines"]}
    for i, raw in enumerate(x for x in jl.read_text().splitlines() if x.strip()):
        d = json.loads(raw)
        keys.append(d.get("key"))
        ln, req = by_key.get(d.get("key")), d.get("request") or {}
        parts = ((req.get("contents") or [{}])[0]).get("parts") or []
        ims = [p for p in parts if "inline_data" in p]
        nimg.add(len(ims))
        if ln is None:
            errs.append(f"line {i}: key {d.get('key')} is not in the index")
            continue
        if [p for p in parts if "text" in p] != parts[-1:] or len(ims) != len(parts) - 1 or len(ims) != len(ln["refs"]):
            errs.append(f"{ln['key']}: parts must be {len(ln['refs'])} images then 1 text")
        for p in ims:
            im = Image.open(io.BytesIO(base64.b64decode(p["inline_data"]["data"])))
            if im.size != (D.CANVAS, D.CANVAS) or p["inline_data"].get("mime_type") != "image/png":
                errs.append(f"{ln['key']}: an image is {im.size} {p['inline_data'].get('mime_type')}, not a 1024 png")
        want = {"response_modalities": ["IMAGE"], "seed": ln["seed"],
                "image_config": {"aspect_ratio": gc["aspect_ratio"], "image_size": gc["image_size"]}}
        if req.get("generation_config") != want:
            errs.append(f"{ln['key']}: generation_config {req.get('generation_config')} != {want}")
    if len(set(keys)) != len(keys) or set(keys) != set(by_key):
        errs.append(f"keys: {len(keys)} lines, {len(set(keys))} unique, index has {len(by_key)}")
    if idx["model"] != gc["model"]:
        errs.append(f"model {idx['model']} != {gc['model']}")
    if errs:
        raise SystemExit(f"refused: round {label} JSONL fails validation: " + "; ".join(errs[:8]))
    return {"n": len(keys), "unique": len(set(keys)), "images": "-".join(str(x) for x in sorted(nimg))}

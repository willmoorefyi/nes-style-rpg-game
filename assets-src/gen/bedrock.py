"""Minimal Stability-on-Bedrock client with a content-addressed response cache, a ledger and a budget gate.

Every request body is hashed; the decoded PNG is stored under assets-src/gen/cache/<hash>.png.
Re-running with the same prompt, seed and guide image is free and returns identical pixels,
which is what makes the pipeline repeatable.

The gate lives inside `invoke` itself (docs/CHAOS_FORMS_PLAN.md 5.1, R23, A6), so no caller can bypass it:
  - a cache hit returns before any check and is not logged;
  - otherwise the call is refused unless `paid=True`, from a linked git worktree (paid calls only come from the main
    checkout), without a `bedrock` block in budget.json, for a `purpose` not in its `per_purpose_caps` (`reserve`
    needs a note: `reserve:<reason>`), at the pass cap or at the purpose's cap;
  - one row per logical request, {event: request, ts, tool, model, purpose, seed, key, pass}, is appended to the BR
    ledger cache/bedrock_ledger.jsonl (tracked in git) **before the first try**; a {event: result, key, ok, served |
    error} record follows it (`served` = the model id that answered, with or without the `us.` prefix). A failure
    counts as spent.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
CACHE = HERE / "cache"
BR_LEDGER = CACHE / "bedrock_ledger.jsonl"
BUDGET = HERE / "budget.json"
REGION = "us-west-2"
PROFILE = "bedrock"

MODELS = {
    "structure": "us.stability.stable-image-control-structure-v1:0",
    "ultra": "stability.stable-image-ultra-v1:1",
    "core": "stability.stable-image-core-v1:1",
    "sd35": "stability.sd3-5-large-v1:0",
    "style_guide": "us.stability.stable-image-style-guide-v1:0",
    "remove_bg": "us.stability.stable-image-remove-background-v1:0",
    "search_replace": "us.stability.stable-image-search-replace-v1:0",
}

_client = None


def client():
    global _client
    if _client is None:
        import boto3          # imported lazily: the gate and the selftests never need it
        _client = boto3.Session(profile_name=PROFILE, region_name=REGION).client("bedrock-runtime")
    return _client


def png_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def cache_key(model: str, body: dict) -> str:
    return hashlib.sha256(json.dumps({"model": model, "body": body}, sort_keys=True).encode()).hexdigest()[:24]


def is_cached(key: str) -> bool:
    return (CACHE / f"{key}.png").exists()


# ───────────────────────────── the BR ledger and the gate ─────────────────────────────

def git_dirs() -> tuple[Path, Path]:
    """(git-dir, git-common-dir) of the checkout holding this file; they differ in a linked worktree."""
    out = []
    for flag in ("--git-dir", "--git-common-dir"):
        r = subprocess.run(["git", "-C", str(HERE), "rev-parse", "--path-format=absolute", flag],
                           capture_output=True, text=True)
        if r.returncode != 0:
            raise SystemExit(f"refused: cannot tell whether this is the main checkout (git rev-parse {flag}: "
                             f"{r.stderr.strip()[:120]})")
        out.append(Path(r.stdout.strip()).resolve())
    return out[0], out[1]


def read_br_ledger(path: Path | None = None) -> list[dict]:
    path = path or BR_LEDGER
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def _append(entry: dict) -> None:
    BR_LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with BR_LEDGER.open("a") as f:
        f.write(json.dumps(entry) + "\n")


def bedrock_block(budget: dict | None = None) -> dict:
    """budget.json's `bedrock` block {pass, cap, per_purpose_caps, gemini_before}; refuses (fail-closed) without it."""
    if budget is None:
        budget = json.loads(BUDGET.read_text()) if BUDGET.exists() else {}
    br = budget.get("bedrock")
    if not isinstance(br, dict) or not {"pass", "cap", "per_purpose_caps"} <= set(br):
        raise SystemExit("refused: budget.json has no bedrock block (pass, cap, per_purpose_caps); every paid Bedrock "
                         "call needs one")
    return br


def purpose_key(purpose: str) -> str:
    """`reserve:<reason>` -> `reserve`; any other purpose is its own key."""
    return purpose.split(":", 1)[0]


def gate(model: str, body: dict, key: str, *, paid: bool, purpose: str) -> dict:
    """Refuse (SystemExit 'refused: ...') or return the ledger row for one uncached logical request."""
    if not paid:
        raise SystemExit(f"refused: an uncached Bedrock request ({model}, {purpose}) needs paid=True (--paid)")
    gd, cd = git_dirs()
    if gd != cd:
        raise SystemExit(f"refused: paid Bedrock calls only come from the main checkout, not a linked worktree ({gd})")
    br = bedrock_block()
    caps, pkey = br["per_purpose_caps"], purpose_key(purpose)
    if pkey not in caps:
        raise SystemExit(f"refused: purpose {purpose!r} is not in pass {br['pass']}'s per_purpose_caps "
                         f"({', '.join(caps)})")
    if pkey == "reserve" and not purpose.partition(":")[2].strip():
        raise SystemExit("refused: the reserve purpose needs an orchestrator note: reserve:<reason>")
    rows = [r for r in read_br_ledger() if r.get("event") == "request" and r.get("pass") == br["pass"]]
    if len(rows) >= br["cap"]:
        raise SystemExit(f"refused: pass {br['pass']} reached its cap of {br['cap']} Bedrock calls ({len(rows)} used); "
                         "only the user may approve more")
    used = sum(purpose_key(r.get("purpose", "")) == pkey for r in rows)
    if used >= caps[pkey]:
        raise SystemExit(f"refused: purpose {pkey} reached its cap of {caps[pkey]} calls in pass {br['pass']} "
                         f"({used} used)")
    return {"event": "request", "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "tool": Path(sys.argv[0]).name or "python",
            "model": model, "purpose": purpose, "seed": body.get("seed"), "key": key, "pass": br["pass"]}


def invoke(model: str, body: dict, *, paid: bool, purpose: str,
           model_ids: tuple[str, ...] | None = None) -> Image.Image:
    CACHE.mkdir(exist_ok=True)
    key = cache_key(model, body)
    path = CACHE / f"{key}.png"
    if path.exists():
        return Image.open(path).convert("RGBA")
    _append(gate(model, body, key, paid=paid, purpose=purpose))       # before the first try: a failure is spent
    ids = model_ids or (MODELS[model], MODELS[model].removeprefix("us."))
    last: Exception | None = None
    try:
        for mid in ids:
            try:
                resp = client().invoke_model(modelId=mid, body=json.dumps(body), accept="application/json",
                                             contentType="application/json")
                break
            except client().exceptions.ValidationException as err:   # e.g. inference-profile id not accepted
                last = err
        else:
            raise RuntimeError(f"Bedrock rejected every model id for {model}: {last}")
        out = json.loads(resp["body"].read())
        reasons = out.get("finish_reasons") or [None]
        if reasons[0] not in (None, "SUCCESS"):
            raise RuntimeError(f"{model} finished with {reasons[0]} (content filter or error)")
        img = Image.open(io.BytesIO(base64.b64decode(out["images"][0]))).convert("RGBA")
    except BaseException as err:
        _append({"event": "result", "key": key, "ok": False, "error": str(err)[:300]})
        raise
    img.save(path)
    (CACHE / f"{key}.json").write_text(json.dumps({"model": model, "seed": body.get("seed"), "prompt": body.get("prompt")}, indent=2))
    _append({"event": "result", "key": key, "ok": True, "served": mid})
    return img

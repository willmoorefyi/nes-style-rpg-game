"""Pass KA-G batch jobs (docs/KNEEL_AI_PLAN.md rev 7 sections 5, 6): submit (--check / --paid / --recover /
--recreate), poll and fetch. Creation is not idempotent, so the ledger rows (`attempt` per line, then `batch_submit`)
are written before `create`, a second submit of a round is refused, and `--recover` lists every `ka-g-r<R>-*` job.
"""
from __future__ import annotations

import base64
import io
import json
import time

from PIL import Image

from gen import bedrock as B
from gen import generate as GEN
from gen import gemini_batch_rounds as R
from gen import kneel_ai_gem as KG
from gen.kneel_ai_req import KneelRequest

ACTIVE = ("JOB_STATE_QUEUED", "JOB_STATE_PENDING", "JOB_STATE_RUNNING", "JOB_STATE_SUCCEEDED")
DONE_OK = ("JOB_STATE_SUCCEEDED", "JOB_STATE_PARTIALLY_SUCCEEDED")


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def state(job) -> str:
    s = getattr(job, "state", None)
    return str(getattr(s, "name", None) or s).replace("JobState.", "")


def stats(job) -> tuple[int | None, int | None]:
    """(ok, failed) from the job's completion stats, else the raw batchStats; (None, None) when unreadable."""
    cs = getattr(job, "completion_stats", None)
    if cs is not None:
        return int(cs.successful_count or 0), int(cs.failed_count or 0)
    try:
        raw = json.loads(R.client()._api_client.request("get", job.name, {}).body or "{}")
        bs = (raw.get("metadata") or {}).get("batchStats") or {}
        return int(bs.get("successfulRequestCount", 0)), int(bs.get("failedRequestCount", 0))
    except Exception as e:  # noqa: BLE001 - reported, the counts stay unknown
        print(f"  note: batchStats of {job.name} unreadable ({type(e).__name__}: {str(e)[:80]})")
        return None, None


def display(label: str, sha: str) -> str:
    return f"ka-g-r{label}-{sha[:8]}"


def rows_of(ledger: list[dict], event: str, label: str) -> list[dict]:
    return [e for e in ledger if e.get("event") == event and e.get("round") == label]


def job_of(ledger: list[dict], label: str) -> str | None:
    rows = rows_of(ledger, "batch_created", label)
    return rows[-1]["job"] if rows else None


def kag(budget: dict) -> dict:
    return next(p for p in budget["passes"] if p.get("name") == KG.PASS)


def requests(idx: dict, purpose: str | None = None) -> list[KneelRequest]:
    from types import SimpleNamespace
    return [KneelRequest(ln["sid"], SimpleNamespace(name=ln["sheet"]), ln["seed"], ln["cache_key"],
                         purpose or ln["purpose"], ln["try"], idx["round"], refs=tuple(ln["refs"]))
            for ln in idx["lines"]]


def guard(idx: dict, ledger: list[dict], budget: dict, purpose: str | None = None) -> list[KneelRequest]:
    """`generate.check_budget` with max_paid = n, refused when n exceeds the purpose's remaining images (n5)."""
    from gen import budget_kag as BK
    reqs, purpose = requests(idx, purpose), purpose or idx["purpose"]
    cap = kag(budget)
    gem = [e for e in ledger if e.get("event") == "attempt" and e.get("backend") != "bedrock"][cap["gemini_before"]:]
    left = BK.remaining(cap, BK.counted(gem, ledger, cap.get("void_ok", False)), purpose)
    if len(reqs) > left:
        raise SystemExit(f"refused: round {idx['round']} needs {len(reqs)} requests, {purpose} has {left} remaining")
    GEN.check_budget(reqs, paid=True, max_paid=len(reqs), retry=idx["retry"] or purpose == KG.EXPIRY, ledger=ledger,
                     budget=budget)
    KG.usage_gate(ledger, budget)
    return reqs


def _refusal(label: str, ledger: list[dict]) -> str | None:
    labels = ("1a", "1b", "1") if label == "1" else (label,)
    for lab in labels:
        if rows_of(ledger, "batch_submit", lab):
            job = job_of(ledger, lab)
            st = state(R.client().batches.get(name=job)) if job else "unknown (no batch_created row)"
            name = job or rows_of(ledger, "batch_submit", lab)[-1].get("display_name")
            return f"refused: round {lab} already submitted (job {name}, state {st}); use --recover"
    return None


def _create(label: str, idx: dict, reqs: list[KneelRequest], reason: str | None = None) -> str:
    gd, cd = B.git_dirs()
    if gd != cd:
        raise SystemExit(f"refused: paid batch submits only come from the main checkout, not a linked worktree ({gd})")
    jl, _ = R.paths(label)
    name = display(label, idx["sha256"])
    for r in reqs:
        R.append(KG.attempt_row(r, "gemini_batch", **({"reason": reason} if reason else {})))
    R.append({"event": "batch_submit", "ts": _now(), "round": label, "n": len(reqs), "sha256": idx["sha256"],
              "display_name": name})
    c = R.client()
    up = c.files.upload(file=str(jl), config={"display_name": name, "mime_type": "jsonl"})
    job = c.batches.create(model=idx["model"], src=up.name, config={"display_name": name})
    R.append({"event": "batch_created", "ts": _now(), "round": label, "job": job.name})
    return job.name


def submit(label: str, check: bool, paid: bool, recover: bool, recreate: bool) -> int:
    idx = R.load_index(label)
    R.validate(label)
    ledger, budget = R.ledger_rows(), json.loads(GEN.BUDGET.read_text())
    if recover or recreate:
        return _recover(label, idx, ledger, budget, recreate)
    why = _refusal(label, ledger)
    if why:
        print(why)
        return 1
    reqs = guard(idx, ledger, budget)
    est = len(reqs) * KG.est_usd("gemini_batch")
    if check:
        print(f"would submit {len(reqs)} requests, est ${est:.2f}")
        return 0
    if not paid:
        raise SystemExit("refused: submit needs --check (no call) or --paid")
    if label == "1":
        raise SystemExit("refused: round 1 is sent as 1a (tranche T) then 1b; --round 1 is for --check only")
    job = _create(label, idx, reqs)
    print(f"submitted round {label}: {len(reqs)} requests, est ${est:.2f}, job {job}")
    return 0


def _recover(label: str, idx: dict, ledger: list[dict], budget: dict, recreate: bool) -> int:
    if not rows_of(ledger, "batch_submit", label):
        raise SystemExit(f"refused: round {label} has no batch_submit row; nothing to recover (use submit --paid)")
    jobs = sorted((j for j in R.client().batches.list() if (j.display_name or "").startswith(f"ka-g-r{label}-")),
                  key=lambda j: str(j.create_time))
    for j in jobs:
        print(f"  {j.name} {j.display_name} {state(j)} created {j.create_time}")
    active = [j for j in jobs if state(j) in ACTIVE]
    keep = (active or jobs)[:1]
    if keep and keep[0].name not in {e["job"] for e in rows_of(ledger, "batch_created", label)}:
        R.append({"event": "batch_created", "ts": _now(), "round": label, "job": keep[0].name, "recovered": True})
    for j in active[1:]:
        R.client().batches.cancel(name=j.name)
        ok, failed = stats(R.client().batches.get(name=j.name))
        processed = (ok or 0) + (failed or 0)
        R.append({"event": "batch_cancel", "ts": _now(), "round": label, "job": j.name, "processed": processed})
        for r in requests(idx, KG.EXPIRY)[:processed]:
            R.append(KG.attempt_row(r, "gemini_batch", reason="duplicate", job=j.name))
        print(f"  cancelled duplicate {j.name} (processed {processed}: {processed} ka_g_expiry rows)")
    if jobs:
        print(f"round {label}: job {keep[0].name} ({state(keep[0])}) recorded; nothing created"
              + (f"; {len(active) - 1} duplicate(s) cancelled" if len(active) > 1 else ""))
        return 0
    vd = R.verdicts()
    for ln in idx["lines"]:
        if R.outcome(ln["sid"], ln["try"], ledger, vd) != "void":
            R.append({"event": "void", "ts": _now(), "key": ln["cache_key"], "req": ln["key"], "job": None,
                               "round": label, "reason": "not_created"})
    if not recreate:
        print(f"NOT FOUND round {label}")
        return 1
    if len(rows_of(ledger, "batch_submit", label)) > 1:
        raise SystemExit(f"refused: round {label} was re-created once already; a second needs a user ruling")
    ledger = R.ledger_rows()
    job = _create(label, idx, guard(idx, ledger, budget, KG.EXPIRY), reason="recreate")
    print(f"NOT FOUND round {label}; re-created as {job} ({idx['n']} ka_g_expiry rows)")
    return 0


def poll(label: str) -> int:
    job = job_of(R.ledger_rows(), label)
    if not job:
        raise SystemExit(f"refused: round {label} has no batch_created row (submit, or submit --recover)")
    j = R.client().batches.get(name=job)
    ok, failed = stats(j)
    print(f"{job} {state(j)} ok={ok if ok is not None else '?'} failed={failed if failed is not None else '?'}")
    return 0


def _image(resp: dict) -> tuple[Image.Image | None, str]:
    notes = []
    for cand in resp.get("candidates") or []:
        for p in (cand.get("content") or {}).get("parts") or []:
            data = (p.get("inlineData") or p.get("inline_data") or {}).get("data")
            if data:
                return Image.open(io.BytesIO(base64.b64decode(data))).convert("RGBA"), ""
            if p.get("text"):
                notes.append(p["text"][:80])
        if cand.get("finishReason") or cand.get("finish_reason"):
            notes.append(f"finish_reason={cand.get('finishReason') or cand.get('finish_reason')}")
    return None, " | ".join(notes) or "no image in the response"


def _usage(resp: dict) -> dict:
    u = resp.get("usageMetadata") or resp.get("usage_metadata") or {}
    snake = {"promptTokenCount": "prompt_token_count", "candidatesTokenCount": "candidates_token_count",
             "thoughtsTokenCount": "thoughts_token_count", "totalTokenCount": "total_token_count"}
    return {snake.get(k, k): v for k, v in u.items() if isinstance(v, (int, float))}

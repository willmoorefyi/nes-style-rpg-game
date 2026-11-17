"""Pass KA-G batch fetch (docs/KNEEL_AI_PLAN.md rev 7 section 6): download a finished round's results JSONL, decode
each `inline_data` image into the Gemini cache and out/kneel_ai/<id>/raw_g_<try>.png, write one `result` row per key
(failed and missing keys too, so they go to the next round), then cut + J0 per sprite. A job that ended
`JOB_STATE_EXPIRED`, or `JOB_STATE_FAILED` with 0 responses, gets one `void` row per key instead; its keys are re-sent
once with `prepare --round R --resend` (purpose ka_g_expiry).
"""
from __future__ import annotations

import contextlib
import io
import json

from gen import gemini as GM
from gen import gemini_batch_jobs as J
from gen import gemini_batch_rounds as R
from gen import kneel_ai_data as D
from gen import kneel_ai_gem as KG


def _results(job) -> list[dict]:
    dest = getattr(job, "dest", None)
    if dest is not None and getattr(dest, "file_name", None):
        data = R.client().files.download(file=dest.file_name)
        return [json.loads(x) for x in data.decode().splitlines() if x.strip()]
    out = []
    for i, r in enumerate(getattr(dest, "inlined_responses", None) or []):
        resp = getattr(r, "response", None)
        out.append({"key": str(i), "response": resp.model_dump(mode="json", by_alias=True) if resp else None,
                    "error": getattr(r, "error", None)})
    return out


def _void(label: str, idx: dict, job: str, reason: str) -> int:
    for ln in idx["lines"]:
        R.append({"event": "void", "ts": J._now(), "key": ln["cache_key"], "req": ln["key"], "job": job,
                           "round": label, "reason": reason})
    print(f"round {label}: job {job} {reason}, 0 responses: {len(idx['lines'])} void rows; the keys are queued for "
          f"prepare --round {R.base(label)} --resend")
    return 2


def _cut_gate(sid: str, n_try: int) -> str:
    from gen import kneel_ai as KA
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        try:
            c = KA.main(["cut", sid, "--arm", "g", "--try", str(n_try)])
            g = KA.main(["gate", sid, "--arm", "g", "--try", str(n_try)]) if c == 0 else None
        except (Exception, SystemExit) as e:  # noqa: BLE001 - reported per sprite, the fetch goes on
            return f"{sid}: cut/J0 error {type(e).__name__}: {str(e)[:120]}"
    last = [x for x in buf.getvalue().splitlines() if x.strip()][-1:] or [""]
    return f"{sid}: {last[0].strip()}" if g is not None else f"{sid}: {last[0].strip()} (no J0)"


def fetch(label: str, cut: bool = True) -> int:
    ledger, idx = R.ledger_rows(), R.load_index(label)
    job_name = J.job_of(ledger, label)
    if not job_name:
        raise SystemExit(f"refused: round {label} has no batch_created row (submit, or submit --recover)")
    if any(e.get("event") in ("result", "void") and e.get("job") == job_name for e in ledger):
        print(f"round {label}: job {job_name} was fetched already; nothing written")
        return 0
    job = R.client().batches.get(name=job_name)
    st, (_, s_failed) = J.state(job), J.stats(job)
    if st == "JOB_STATE_EXPIRED":
        return _void(label, idx, job_name, "expired")
    if st not in J.DONE_OK and st != "JOB_STATE_FAILED":
        print(f"round {label}: job {job_name} is {st}; not finished")
        return 1
    lines = _results(job)
    if st == "JOB_STATE_FAILED" and not lines:
        return _void(label, idx, job_name, "failed_no_response")
    by_key, seen, ok, failed, done = {ln["key"]: ln for ln in idx["lines"]}, set(), 0, 0, []
    for d in lines:
        ln = by_key.get(str(d.get("key")))
        if ln is None or ln["key"] in seen:
            print(f"  note: result key {d.get('key')!r} is not a line of round {label} (or repeated); ignored")
            continue
        seen.add(ln["key"])
        row = {"event": "result", "key": ln["cache_key"], "req": ln["key"], "pass": "KA-G", "job": job_name,
               "round": label}
        resp = d.get("response") or {}
        img, why = J._image(resp) if resp and not d.get("error") else (None, json.dumps(d.get("error"))[:300])
        if img is None:
            failed += 1
            R.append({**row, "ok": False, "error": why})
            continue
        GM.CACHE.mkdir(parents=True, exist_ok=True)
        img.save(GM.CACHE / f"{ln['cache_key']}.png")
        (GM.CACHE / f"{ln['cache_key']}.json").write_text(json.dumps(
            {"backend": "gemini_batch", "model": idx["model"], "seed": ln["seed"], "aspect": KG.gconf()["aspect_ratio"],
             "image_size": KG.gconf()["image_size"], "prompt": ln["prompt"], "job": job_name}, indent=2))
        (D.OUT / ln["sid"]).mkdir(parents=True, exist_ok=True)
        img.save(D.OUT / ln["sid"] / f"raw_g_{ln['try']}.png")
        R.append({**row, "ok": True, "usage": J._usage(resp), "size": list(img.size)})
        ok += 1
        done.append(ln)
    missing = [ln for k, ln in by_key.items() if k not in seen]
    for ln in missing:
        R.append({"event": "result", "key": ln["cache_key"], "req": ln["key"], "pass": "KA-G", "job": job_name,
                           "round": label, "ok": False, "error": "missing from the results file"})
    print(f"fetched {ok} ok, {failed} failed (failedRequestCount {s_failed if s_failed is not None else '?'}), "
          f"missing {len(missing)}")
    for ln in done if cut else []:
        print("  " + _cut_gate(ln["sid"], ln["try"]))
    return 0

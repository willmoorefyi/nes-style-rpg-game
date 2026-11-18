"""`kneel_ai.py budget --check` (KG1; docs/KNEEL_AI_PLAN.md rev 7 sections 5, 7). Expected, then exit 0:

  closed pass C 25/80, closed pass KA 54/91, closed pass KA-FIX 2/60
  OK pass KA-G pilot <p>/30, batch <b>/375, reserve <r>/135, total <t>/540, expiry <e>/125, est $<x.xx>

Breaches: a live `bedrock` block (pass KA-G makes no Bedrock call); a closed Bedrock pass whose ledger rows differ from
its `used`, or a Bedrock row of any other pass; a Gemini attempt after KA-G's gemini_before that is not a KA-G row;
an unknown purpose or one over its cap; the total over 540 or `max_new`; a sheet outside `only_sheet_names`, another
model, more than 4 counted attempts at a sheet, or a 4th without ka_g_reserve (ka_g_expiry rows are not counted per
sheet; voided attempts leave the counts only with void_ok).
"""
from __future__ import annotations

import json
from pathlib import Path

from gen import budget_kag as BK

PASS, CLOSED = "pass KA-G", ("C", "KA", "KA-FIX")   # KA-FIX closed by KT3 (2026-11-18) at 2 / 60


def breaches(budget: dict, br_rows: list[dict], ledger: list[dict]) -> tuple[list[str], dict]:
    out: list[str] = []
    if budget.get("bedrock"):
        out.append(f"a live bedrock block (pass {budget['bedrock'].get('pass')}) exists; pass KA-G makes no Bedrock "
                   "call")
    hist = {h.get("pass"): h for h in budget.get("bedrock_history") or []}
    used = {}
    for name in CLOSED:
        h, n = hist.get(name) or {}, sum(r.get("event") == "request" and r.get("pass") == name for r in br_rows)
        used[name] = (n, h.get("cap"))
        if not h.get("closed") or h.get("used") != n:
            out.append(f"bedrock_history pass {name}: closed {bool(h.get('closed'))}, used {h.get('used')} != {n} rows")
    stray = sorted({str(r.get("pass")) for r in br_rows if r.get("event") == "request" and r.get("pass") not in hist})
    out += [f"Bedrock rows of pass {p}, which is not a closed pass" for p in stray]
    cap = next((p for p in budget.get("passes", []) if p.get("name") == PASS), None)
    stats = {"used": used, "purposes": {}, "total": 0, "est": 0.0, "caps": {}}
    if cap is None:
        return out + ["budget.json has no pass KA-G entry"], stats
    gem = [e for e in ledger if e.get("event") == "attempt" and e.get("backend") != "bedrock"]
    new = gem[cap["gemini_before"]:]
    out += [f"Gemini attempt {e.get('character')}/{e.get('sheet')} after {cap['gemini_before']} is not a KA-G row"
            for e in new if e.get("pass") != "KA-G"]
    rows = BK.counted(new, ledger, cap.get("void_ok", False))
    caps = cap["purpose_caps"]
    per = {p: sum(e.get("purpose") == p for e in rows) for p in caps}
    out += [f"unknown purpose {p!r}" for p in sorted({str(e.get("purpose")) for e in rows} - set(caps))]
    out += [f"{p}: {n} > cap {caps[p]}" for p, n in per.items() if n > caps[p]]
    total = sum(n for p, n in per.items() if p != BK.EXPIRY)
    main = sum(n for p, n in caps.items() if p != BK.EXPIRY)
    if total > main or len(rows) > cap["max_new"]:
        out.append(f"total {total} > {main} or {len(rows)} > max_new {cap['max_new']}")
    sheets, seen = cap.get("only_sheet_names") or [], {}
    for e in rows:
        if e.get("sheet") not in sheets or e.get("model") != cap.get("model"):
            out.append(f"{e.get('character')}/{e.get('sheet')} ({e.get('model')}): not a {'/'.join(sheets)} sheet "
                       f"on {cap.get('model')}")
        if e.get("purpose") == BK.EXPIRY:
            continue
        k = (e.get("character"), e.get("sheet"))
        seen[k] = seen.get(k, 0) + 1
        if seen[k] > cap["max_per_sheet"] or (seen[k] == cap["max_per_sheet"] and e.get("purpose") != BK.RESERVE):
            out.append(f"{k[0]}/{k[1]}: attempt {seen[k]} ({e.get('purpose')}) breaks the 4-per-sheet / reserve rule")
    stats.update(purposes=per, total=total, est=sum(float(e.get("est_usd") or 0) for e in new), caps=caps, main=main)
    return out, stats


def check(strict: bool = True, ledger_path: Path | None = None) -> int:
    from gen import bedrock as B
    from gen import generate as GEN
    budget = json.loads(B.BUDGET.read_text())
    bad, s = breaches(budget, B.read_br_ledger(), GEN.read_ledger(ledger_path or GEN.LEDGER))
    print(", ".join(f"closed pass {n} {u}/{c}" for n, (u, c) in s["used"].items()))
    for b in bad:
        print(f"  BREACH {b}")
    p, c = s["purposes"], s["caps"]
    line = (f"pass KA-G pilot {p.get('ka_g_pilot', 0)}/{c.get('ka_g_pilot')}, batch {p.get('ka_g_batch', 0)}/"
            f"{c.get('ka_g_batch')}, reserve {p.get('ka_g_reserve', 0)}/{c.get('ka_g_reserve')}, total {s['total']}/"
            f"{s.get('main')}, expiry {p.get('ka_g_expiry', 0)}/{c.get('ka_g_expiry')}, est ${s['est']:.2f}")
    print(f"OK {line}" if not bad else f"budget --check: {len(bad)} breach(es), {line}")
    print(f"generate.check_budget: {guard_probe(budget, GEN.read_ledger(ledger_path or GEN.LEDGER))}")
    return 1 if bad and strict else 0


def guard_probe(budget: dict, ledger: list[dict]) -> str:
    """The Gemini guard on the real budget and ledger for one fresh kneel request (nothing is sent or written)."""
    from types import SimpleNamespace
    from gen import generate as GEN
    from gen.kneel_ai_req import KneelRequest
    r = KneelRequest("_probe_", SimpleNamespace(name="kneel"), 1234, "_probe_", "ka_g_pilot")
    try:
        GEN.check_budget([r], paid=True, max_paid=1, retry=False, ledger=ledger, budget=budget)
    except SystemExit as e:
        return str(e)
    return "OK (a fresh kneel ka_g_pilot request passes)"

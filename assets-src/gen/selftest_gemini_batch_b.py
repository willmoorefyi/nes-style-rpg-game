"""Pass KA-G batch cases (run by selftest_gemini_batch.py: the fake client, the sandbox and the helpers live there)."""
from __future__ import annotations

import copy
import json
import re

from gen.selftest_gemini_batch import S, finish, kag_rows, per_sheet, real_budget, rows, run, sandbox


def submit_rules(check) -> None:
    from gen import gemini_batch_rounds as R
    with sandbox(ids=("goblin", "ochu")) as sb:
        code, out = run(["prepare", "--round", "1a", "--dry-run"])
        check(code == 0 and re.search(r"OK round 1a: 2 requests, 2 unique keys, 2 images \+ 1 text each, model "
                                      r"gemini-nano-banana-2\.1, 1:1 1K, est \$0\.04; 0 sent", out) is not None
              and not kag_rows(), f"KG3: prepare --dry-run validates and sends nothing ({out.strip()[-120:]!r})")
        line = json.loads(R.paths("1a")[0].read_text().splitlines()[0])
        gc = line["request"]["generation_config"]
        parts = line["request"]["contents"][0]["parts"]
        check(line["key"] == "goblin:1" and gc == {"response_modalities": ["IMAGE"], "seed": 1234,
                                                   "image_config": {"aspect_ratio": "1:1", "image_size": "1K"}}
              and [list(p) for p in parts] == [["inline_data"], ["inline_data"], ["text"]],
              f"JSONL schema: key <sprite>:<try>, [idle, pose] images then the text, IMAGE / 1:1 / 1K / seed 1234 ({gc})")
        code, out = run(["submit", "--round", "1a", "--check"])
        check(code == 0 and "would submit 2 requests, est $0.04" in out and sb.fake.batches.creates == 0
              and not kag_rows(), f"KG8: --check prints would submit, 0 creates, 0 rows ({out.strip()!r})")
        code, out = run(["submit", "--round", "1a", "--paid"])
        ev = sb.fake.batches.rows_at_create[0] if sb.fake.batches.rows_at_create else []
        check(code == 0 and sb.fake.batches.creates == 1 and ev[-3:] == ["attempt", "attempt", "batch_submit"]
              and [e["event"] for e in rows()][-1] == "batch_created" and sb.fake.batches.jobs[0].display_name
              .startswith("ka-g-r1a-"), f"submit --paid: 2 attempt rows and batch_submit written before create, "
                                        f"then batch_created ({ev[-3:]}, {out.strip()[-60:]!r})")
        a = kag_rows()
        check({(e["backend"], e["purpose"], e["round"], e["pass"], e["model"]) for e in a}
              == {("gemini_batch", "ka_g_batch", "1a", "KA-G", "gemini-nano-banana-2.1")}
              and [e["req"] for e in a] == ["goblin:1", "ochu:1"] and all(e["est_usd"] == 0.0176 for e in a),
              "attempt rows: backend gemini_batch, purpose ka_g_batch, round, pass, model, req, est_usd")
        code, out = run(["submit", "--round", "1a", "--paid"])
        code2, out2 = run(["submit", "--round", "1a", "--check"])
        want = "refused: round 1a already submitted (job batches/j1, state JOB_STATE_PENDING); use --recover"
        check(code == 1 and sb.fake.batches.creates == 1 and want in out and code2 == 1 and want in out2,
              f"KG6: a 2nd submit --paid is refused with 0 creates, and --check prints the same refusal ({out2.strip()!r})")
        run(["prepare", "--round", "1"])
        code, out = run(["submit", "--round", "1", "--check"])
        check(code == 1 and "round 1a already submitted" in out, f"--round 1 --check refuses once 1a is sent ({out!r})")
        code, out = run(["poll", "--round", "1a"])
        check(code == 0 and out.strip() == "batches/j1 JOB_STATE_PENDING ok=0 failed=0", f"poll line ({out.strip()!r})")
    with sandbox(linked=True) as sb:
        run(["prepare", "--round", "1a"])
        code, out = run(["submit", "--round", "1a", "--paid"])
        check(code == 1 and "main checkout" in out and sb.fake.batches.creates == 0 and not kag_rows(),
              f"submit --paid from a linked worktree is refused, nothing written ({out.strip()[-70:]!r})")


def recover_cases(check) -> None:
    with sandbox() as sb:
        run(["prepare", "--round", "1a"])
        sb.fake.batches.fail_after_create = True
        try:
            run(["submit", "--round", "1a", "--paid"])
        except ConnectionError:                     # the dropped connection: batch_submit written, no batch_created
            pass
        sb.fake.batches.fail_after_create = False
        sb.fake.batches.jobs[0].state = S("JOB_STATE_SUCCEEDED")
        n_sub = len(rows("batch_submit"))
        code, out = run(["submit", "--round", "1a", "--recover"])
        bc = rows("batch_created")
        check(code == 0 and sb.fake.batches.creates == 1 and len(bc) == 1 and bc[0]["job"] == "batches/j1"
              and bc[0].get("recovered") and n_sub == 1 and len(rows("batch_submit")) == 1,
              f"--recover with 1 SUCCEEDED job records it, 0 creates ({out.strip()[-80:]!r})")
    with sandbox() as sb:
        run(["prepare", "--round", "1a"])
        run(["submit", "--round", "1a", "--paid"])
        b = sb.fake.batches
        b.create(model="m", src="files/u1", config={"display_name": b.jobs[0].display_name})
        b.jobs[1].state, b.jobs[1].completion_stats.successful_count = S("JOB_STATE_RUNNING"), 3
        before = b.creates
        code, out = run(["submit", "--round", "1a", "--recover"])
        dup = [e for e in kag_rows() if e.get("reason") == "duplicate"]
        cancel = rows("batch_cancel")
        check(code == 0 and b.cancels == ["batches/j2"] and b.creates == before and len(cancel) == 1
              and cancel[0]["processed"] == 3 and len(dup) == 1 and all(e["purpose"] == "ka_g_expiry" for e in dup),
              f"--recover with 2 active jobs cancels the later one (batch_cancel processed 3; its rows cut to the "
              f"round's {len(dup)} key) and creates nothing ({out.strip()[-80:]!r})")
    with sandbox(ids=("goblin", "ochu", "cobra")) as sb:
        run(["prepare", "--round", "1a"])
        run(["submit", "--round", "1a", "--paid"])
        b = sb.fake.batches
        b.create(model="m", src="files/u1", config={"display_name": b.jobs[0].display_name})
        b.jobs[1].completion_stats.successful_count, b.jobs[1].completion_stats.failed_count = 2, 1
        run(["submit", "--round", "1a", "--recover"])
        dup = [e for e in kag_rows() if e.get("reason") == "duplicate"]
        check(len(dup) == 3 and [e["req"] for e in dup] == ["goblin:1", "ochu:1", "cobra:1"]
              and per_sheet("goblin") == 1,
              f"n3: a cancelled duplicate with processed 3 writes 3 ka_g_expiry reason-duplicate rows in JSONL order; "
              f"the per-sheet count stays 1 ({[e['req'] for e in dup]})")
    with sandbox() as sb:
        run(["prepare", "--round", "1a"])
        run(["submit", "--round", "1a", "--paid"])
        sb.fake.batches.jobs.clear()
        code, out = run(["submit", "--round", "1a", "--recover"])
        voids = rows("void")
        check(code == 1 and "NOT FOUND round 1a" in out and len(voids) == 1 and voids[0]["reason"] == "not_created"
              and sb.fake.batches.creates == 1, f"--recover with no job prints NOT FOUND, exits 1, writes not_created "
                                                f"void rows, creates nothing ({out.strip()[-40:]!r})")
        code, out = run(["submit", "--round", "1a", "--recover", "--recreate"])
        subs = rows("batch_submit")
        check(code == 0 and len(subs) == 2 and sb.fake.batches.creates == 2 and len(rows("void")) == 1
              and [e["purpose"] for e in kag_rows()] == ["ka_g_batch", "ka_g_expiry"] and per_sheet("goblin") == 1,
              f"--recreate after NOT FOUND writes a new batch_submit and creates once (ka_g_expiry rows) ({out.strip()[-70:]!r})")


def expiry_and_walk(check) -> None:
    from gen import budget_kag as BK
    from gen import generate as GEN
    for void_ok in (False, True):
        b = real_budget()
        next(p for p in b["passes"] if p["name"] == "pass KA-G")["void_ok"] = void_ok
        with sandbox(budget=b) as sb:
            run(["prepare", "--round", "1a"])
            run(["submit", "--round", "1a", "--paid"])
            finish(sb.fake, {}, "JOB_STATE_EXPIRED")
            code, out = run(["fetch", "--round", "1a", "--no-cut"])
            voids = rows("void")
            led = GEN.read_ledger(GEN.LEDGER)
            gem = [e for e in led if e.get("event") == "attempt" and e.get("backend") != "bedrock"][405:]
            n = len(BK.counted(gem, led, void_ok))
            if not void_ok:
                check(code == 2 and len(voids) == 1 and voids[0]["reason"] == "expired" and n == 1
                      and per_sheet("goblin") == 1, f"EXPIRED, 0 responses: a void row per key; with void_ok false "
                                                    f"the counts are unchanged ({n}) ({out.strip()[-80:]!r})")
                walk(check, sb)
            else:
                check(n == 0, f"EXPIRED with void_ok true: the voided attempt leaves the counts ({n})")


def walk(check, sb) -> None:
    code, out = run(["prepare", "--round", "1a", "--resend"])
    check(code == 0 and "OK round 1ae: 1 requests" in out, f"the expired key is re-queued: prepare --resend ({out.strip()[-70:]!r})")
    steps = []
    for label, fetch_label in (("1ae", "1ae"), ("2", "2"), ("3", "3"), ("reserve", "reserve")):
        if label != "1ae":
            code, out = run(["prepare", "--round", label])
            if code != 0:
                steps.append(f"prepare {label}: {out.strip()[-90:]}")
                break
        code, out = run(["submit", "--round", label, "--paid"])
        steps.append(f"{label}: {'ok' if code == 0 else out.strip()[-90:]} count {per_sheet('goblin')}")
        finish(sb.fake, {"goblin:" + str({"1ae": 1, "2": 2, "3": 3, "reserve": 4}[label]): False})
        run(["fetch", "--round", fetch_label, "--no-cut"])
    purposes = [e["purpose"] for e in kag_rows()]
    check(steps == ["1ae: ok count 1", "2: ok count 2", "3: ok count 3", "reserve: ok count 4"]
          and purposes == ["ka_g_batch", "ka_g_expiry", "ka_g_batch", "ka_g_batch", "ka_g_reserve"]
          and [e["seed"] for e in kag_rows()] == [1234, 1234, 1235, 1236, 1237],
          f"n2 walk: expired -> re-send -> round 2 -> round 3 -> reserve, all accepted; per-sheet count 1, 2, 3, then "
          f"the reserve 4th ({steps})")
    code, out = run(["prepare", "--round", "1a", "--resend"])
    check(code == 1 and ("no voided keys" in out or "second" in out), f"a 2nd re-send is refused ({out.strip()[-80:]!r})")


def partial_and_caps(check) -> None:
    with sandbox(ids=("goblin", "ochu")) as sb:
        run(["prepare", "--round", "1a"])
        run(["submit", "--round", "1a", "--paid"])
        finish(sb.fake, {"goblin:1": True, "ochu:1": False})
        code, out = run(["fetch", "--round", "1a", "--no-cut"])
        res = rows("result")[-2:]
        check(code == 0 and "fetched 1 ok, 1 failed (failedRequestCount 1), missing 0" in out
              and [r["ok"] for r in res] == [True, False] and (sb.tmp / "out" / "goblin" / "raw_g_1.png").exists(),
              f"KG4: fetch writes the image, raw_g_1.png and a result row per key ({out.strip()[-70:]!r})")
        code, out = run(["prepare", "--round", "2"])
        check(code == 1 and "goblin (unreviewed)" in out, f"round 2 waits for every try-1 verdict ({out.strip()[-80:]!r})")
        run(["verdict", "goblin", "--try", "1", "--pass"])
        code, out = run(["prepare", "--round", "2"])
        idx = json.loads((sb.tmp / "out" / "batch" / "r2.index.json").read_text())
        check(code == 0 and [ln["sid"] for ln in idx["lines"]] == ["ochu"] and idx["retry"] is True,
              f"a partial failure goes to round 2 (seed 1235, retry=True): {[ln['sid'] for ln in idx['lines']]}")
        code, out = run(["fetch", "--round", "1a", "--no-cut"])
        check("fetched already" in out, f"a 2nd fetch writes nothing ({out.strip()!r})")
    b = real_budget()
    next(p for p in b["passes"] if p["name"] == "pass KA-G")["purpose_caps"]["ka_g_batch"] = 1
    with sandbox(budget=copy.deepcopy(b), ids=("goblin", "ochu")) as sb:
        run(["prepare", "--round", "1a"])
        code, out = run(["submit", "--round", "1a", "--check"])
        check(code == 1 and "needs 2 requests, ka_g_batch has 1 remaining" in out and sb.fake.batches.creates == 0,
              f"n5: submit refuses when n exceeds the purpose's remaining cap ({out.strip()[-80:]!r})")
    with sandbox(ids=("goblin",)) as sb:
        run(["prepare", "--round", "1a"])
        from gen import gemini_batch_rounds as R
        p = R.paths("1a")[0]
        p.write_text(p.read_text().replace('"seed": 1234', '"seed": 999'))
        code, out = run(["submit", "--round", "1a", "--check"])
        check(code == 1 and "fails validation" in out, f"an edited JSONL fails validation ({out.strip()[-80:]!r})")

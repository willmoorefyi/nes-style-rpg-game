"""Pass KA-G kneel keys through the Gemini Batch API (docs/KNEEL_AI_PLAN.md rev 7 sections 4-6). Main checkout only
for anything paid; one command at a time, in the background, waited on with Monitor.

  python3 -I assets-src/gen/gemini_batch.py prepare --round R [--dry-run] [--resend]   # R = 1a 1b 1 2 3 reserve
  python3 -I assets-src/gen/gemini_batch.py submit --round R --check          # never calls create (KG6 / KG8)
  python3 -I assets-src/gen/gemini_batch.py submit --round R --paid           # rows, upload, create
  python3 -I assets-src/gen/gemini_batch.py submit --round R --recover [--recreate]
  python3 -I assets-src/gen/gemini_batch.py poll --round R                    # "<job> <state> ok=<n> failed=<n>"
  python3 -I assets-src/gen/gemini_batch.py fetch --round R [--no-cut]        # results, cache, raw_g_<try>, cut + J0
  python3 -I assets-src/gen/gemini_batch.py verdict <id ...> --try N (--pass | --fail REASON)
  python3 -I assets-src/gen/gemini_batch.py status --round R                  # per sprite: the try's outcome

`prepare` never sends anything (--dry-run is accepted and changes nothing: prepare always only writes and validates).
Round 1 is sent as 1a (tranche T) then 1b; `--round 1` (both) is for prepare and --check only. A round's sprites
come from the previous try's outcomes (verdicts.json and the ledger's result / void rows). `--resend` re-sends the
voided keys of an expired / not-created round once (`<R>e`, purpose ka_g_expiry). Selftests:
selftest_gemini_batch.py (a fake client; run from selftest.py).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from gen import gemini_batch_rounds as R  # noqa: E402


def cmd_status(label: str) -> int:
    ledger, vd, n = R.ledger_rows(), R.verdicts(), R.try_of(label)
    idx = R.load_index(label)
    counts: dict[str, int] = {}
    for ln in idx["lines"]:
        o = R.outcome(ln["sid"], n, ledger, vd)
        counts[o] = counts.get(o, 0) + 1
        print(f"  {ln['sid']:20} try {n} {o}")
    print(f"round {label}: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("prepare", "submit", "poll", "fetch", "status"):
        sub.add_parser(name).add_argument("--round", dest="label", required=True)
    sub.choices["prepare"].add_argument("--dry-run", action="store_true")
    sub.choices["prepare"].add_argument("--resend", action="store_true")
    s = sub.choices["submit"]
    for flag in ("--check", "--paid", "--recover", "--recreate"):
        s.add_argument(flag, action="store_true")
    sub.choices["fetch"].add_argument("--no-cut", action="store_true")
    v = sub.add_parser("verdict")
    v.add_argument("ids", nargs="+")
    v.add_argument("--try", dest="n_try", type=int, required=True)
    g = v.add_mutually_exclusive_group(required=True)
    g.add_argument("--pass", dest="ok", action="store_true")
    g.add_argument("--fail", dest="reason")
    a = ap.parse_args(argv)
    if a.cmd == "prepare":
        return R.prepare(a.label, a.resend)
    if a.cmd == "submit":
        from gen import gemini_batch_jobs as J
        if sum((a.check, a.paid, a.recover or a.recreate)) != 1:
            raise SystemExit("submit takes exactly one of --check, --paid, --recover [--recreate]")
        return J.submit(a.label, a.check, a.paid, a.recover, a.recreate)
    if a.cmd == "poll":
        from gen import gemini_batch_jobs as J
        return J.poll(a.label)
    if a.cmd == "fetch":
        from gen import gemini_batch_fetch as F
        return F.fetch(a.label, not a.no_cut)
    if a.cmd == "status":
        return cmd_status(a.label)
    R.set_verdict(a.ids, a.n_try, "pass" if a.ok else "fail", "" if a.ok else a.reason)
    print(f"verdict try {a.n_try}: {'pass' if a.ok else 'fail (' + a.reason + ')'}: {' '.join(a.ids)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

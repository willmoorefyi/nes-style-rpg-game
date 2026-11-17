"""`kneel_ai.py plan [--pilot]`: the command lists, in order, for the main checkout (docs/KNEEL_AI_PLAN.md).

- probe (rev 4, KA1-P, closed): guides, the 55 Stability calls with cut + gate after each, the probe sheet.
- pilot (rev 7, KA-G1): the guides of the 10 pilot sprites, try 1 dry-runs (no call: the guard's verdict), the paid
  try 1 per sprite with cut + J0 + budget after each (the first call's usage is checked: exit 3 = stop and recount),
  the templates of tries 2-3 / the reserve try, and the review sheet against an old-root checkout.
"""
from __future__ import annotations

from gen import kneel_ai_data as D

PY = "python3 -I assets-src/gen/kneel_ai.py"
K3 = "/tmp/ka1/k3-0"                 # the archive/kneel-k3-0 checkout (cobra, green_slime derived kneels)
OLD = "/tmp/ka-g1/old"               # a detached worktree at the pre-pilot mainline (the old derived kneels)


def probe_plan() -> str:
    c = D.conf()["probe"]
    out = [f"{PY} budget --check",
           f"{PY} guide {' '.join(s for s in c['sprites'] if s not in ('cobra', 'green_slime'))}",
           f"{PY} guide cobra green_slime --derived-root {K3}"]
    for sid in c["sprites"]:
        for arm, seed in c["calls"]:
            out.append(f"{PY} gen {sid} --arm {arm} --seed {seed} --purpose ka_probe --paid && {PY} cut {sid} --arm "
                       f"{arm} --seed {seed}; {PY} gate {sid} --arm {arm} --seed {seed} --try 1; {PY} budget --check")
    out.append(f"{PY} review --probe {' '.join(c['sprites'])}")
    return "\n".join(out)


def pilot_plan() -> str:
    ids = list(D.conf()["gemini"]["pilot"])
    k3 = [s for s in ids if s in ("cobra", "green_slime")]
    out = ["export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1",
           f"{PY} budget --check",
           f"{PY} guide {' '.join(s for s in ids if s not in k3)}",
           f"{PY} guide {' '.join(k3)} --derived-root {K3}",
           "# try 1 dry-runs: no call, prints the cache key and 'guard OK'"]
    out += [f"{PY} gen {sid} --arm g --try 1" for sid in ids]
    out.append("# try 1, one paid call per command (background + Monitor); after the FIRST call check its usage line "
               "(exit 3 = STOP: recount section 5)")
    out += [f"{PY} gen {sid} --arm g --try 1 --paid && {PY} cut {sid} --arm g --try 1; {PY} gate {sid} --arm g --try 1;"
            f" {PY} budget --check" for sid in ids]
    out += ["# after each try: review agent (R1 counts, R2, R2b, R3, R5); on PASS: approve, mark joints, J1, check, "
            "lock",
            f"#   {PY} approve <id> --arm g --try <N>",
            f"#   {PY} gate <id> --arm g --try <N> --j1",
            "# tries 2-3 (only after a FAIL with a reason, written as kneel_ai.yaml sprites.<id>.g_lines.<N> extra / "
            "avoid; refs: [idle, hurt] only for an R1 identity flag):",
            f"#   {PY} gen <id> --arm g --try <N> --paid && {PY} cut <id> --arm g --try <N>; {PY} gate <id> --arm g "
            f"--try <N>; {PY} budget --check",
            "# Q3 (iii) reserve, at most 1 per sprite after 3 failed tries:",
            f"#   {PY} gen <id> --arm g --try 4 --purpose ka_g_reserve --paid && {PY} cut <id> --arm g --try 4; "
            f"{PY} gate <id> --arm g --try 4",
            f"# review sheet: first `git worktree add --detach {OLD} <pre-pilot mainline sha>`",
            f"{PY} review --pilot --old-root {OLD} " + " ".join(f"--old-root-for {s}={K3}" for s in k3),
            f"{PY} budget --check"]
    return "\n".join(out)

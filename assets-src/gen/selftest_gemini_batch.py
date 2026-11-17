"""Pass KA-G batch self-tests (docs/KNEEL_AI_PLAN.md rev 7 section 6), run from selftest.py; 0 calls: a fake client
(files upload / download, batches create / get / list / cancel, models.generate_content) in a sandbox (ledger, budget,
cache, out/ in a temp dir; the ledger seeded with the real one's first 405 Gemini attempts).

Here: rows before create, the refused 2nd submit (0 creates; --check prints the same refusal), --recover (1 job, 2
active jobs, NOT FOUND, --recreate), expired -> void rows and re-queued keys (void_ok false / true), the n2 walk
(expired -> re-send -> round 2 -> round 3 -> reserve), the n3 duplicate rows, the n5 remaining-cap refusal, a partial
failure routed to round 2, the JSONL schema and KG3 / KG4 / KG6 / KG8 lines. selftest_kneel_ai_gem.py: the interactive
arm g, the guard on the real budget.json, the cap refusals, KG1 / KG2, the cache key and the pitch.

  python3 -I assets-src/gen/selftest_gemini_batch.py
"""
from __future__ import annotations

import base64
import contextlib
import copy
import io
import json
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from typing import Callable

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image  # noqa: E402

HERE = Path(__file__).resolve().parent
N0 = 405                        # pass KA-G gemini_before (pass V closed there)


def S(name: str) -> SimpleNamespace:
    return SimpleNamespace(name=name)


class FakeBatches:
    def __init__(self, ledger_path: Callable[[], Path]):
        self.jobs, self.creates, self.cancels, self.rows_at_create, self._led = [], 0, [], [], ledger_path
        self.fail_after_create = False

    def create(self, *, model, src, config):
        self.creates += 1
        self.rows_at_create.append([json.loads(x)["event"] for x in self._led().read_text().splitlines() if x.strip()])
        j = SimpleNamespace(name=f"batches/j{len(self.jobs) + 1}", display_name=config["display_name"], model=model,
                            state=S("JOB_STATE_PENDING"), create_time=f"t{len(self.jobs):03d}", src=src,
                            dest=None, completion_stats=SimpleNamespace(successful_count=0, failed_count=0))
        self.jobs.append(j)
        if self.fail_after_create:
            raise ConnectionError("fake: connection dropped after create")
        return j

    def get(self, *, name):
        return next(j for j in self.jobs if j.name == name)

    def list(self, config=None):
        return list(self.jobs)

    def cancel(self, *, name):
        self.cancels.append(name)
        self.get(name=name).state = S("JOB_STATE_CANCELLED")


class FakeFiles:
    def __init__(self):
        self.uploads, self.results = [], {}

    def upload(self, *, file, config=None):
        self.uploads.append(file)
        return SimpleNamespace(name=f"files/u{len(self.uploads)}")

    def download(self, *, file, config=None):
        return self.results[file]


class FakeModels:
    def __init__(self):
        self.calls, self.usage = 0, {"prompt_token_count": 1026, "candidates_token_count": 1290,
                                     "thoughts_token_count": 0, "total_token_count": 2316}

    def generate_content(self, *, model, contents, config):
        self.calls += 1
        self.last = (model, contents, config)
        part = SimpleNamespace(inline_data=SimpleNamespace(data=png(), mime_type="image/png"), text=None)
        cand = SimpleNamespace(content=SimpleNamespace(parts=[part]), finish_reason=None)
        return SimpleNamespace(candidates=[cand], usage_metadata=SimpleNamespace(**self.usage), prompt_feedback=None)


def png(size=(1024, 1024)) -> bytes:
    im = Image.new("RGB", size, (255, 0, 255))
    im.paste((40, 90, 40), (400, 500, 600, 800))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def finish(fake, outcomes: dict[str, bool], state: str = "JOB_STATE_SUCCEEDED") -> None:
    """End the latest job: one results line per key (True = an image, False = an error line)."""
    j = fake.batches.jobs[-1]
    j.state = S(state)
    lines = []
    for k, ok in outcomes.items():
        if ok:
            resp = {"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "image/png",
                                                                          "data": base64.b64encode(png()).decode()}}]}}],
                    "usageMetadata": {"promptTokenCount": 1026, "candidatesTokenCount": 1290}}
            lines.append({"key": k, "response": resp})
        else:
            lines.append({"key": k, "error": {"code": 13, "message": "fake internal error"}})
    j.completion_stats = SimpleNamespace(successful_count=sum(outcomes.values()),
                                         failed_count=len(outcomes) - sum(outcomes.values()))
    if lines:
        j.dest = SimpleNamespace(file_name=f"files/res-{j.name}", inlined_responses=None)
        fake.files.results[j.dest.file_name] = "".join(json.dumps(x) + "\n" for x in lines).encode()


def seed_ledger(n: int = N0) -> str:
    """The real ledger up to (not including) its (n + 1)th Gemini attempt."""
    out, seen = [], 0
    for line in (HERE / "cache" / "ledger.jsonl").read_text().splitlines():
        if not line.strip():
            continue
        e = json.loads(line)
        if e.get("event") == "attempt" and e.get("backend") != "bedrock":
            if seen == n:
                break
            seen += 1
        out.append(line)
    return "\n".join(out) + "\n"


def real_budget() -> dict:
    return json.loads((HERE / "budget.json").read_text())


@contextlib.contextmanager
def sandbox(budget: dict | None = None, ids: tuple[str, ...] = ("goblin",), linked: bool = False):
    from gen import bedrock as B
    from gen import gemini as GM
    from gen import gemini_batch_rounds as R
    from gen import generate as GEN
    from gen import kneel_ai_data as D
    from gen import kneel_ai_gem as KG
    saved = (GEN.LEDGER, GEN.BUDGET, GM.CACHE, GM._client, D.OUT, R.BATCH, R.CLIENT, B.git_dirs, KG.gconf, R.batch_ids)
    conf = copy.deepcopy(KG.gconf())
    conf["tranche_t"] = list(ids)
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        try:
            GEN.LEDGER, GEN.BUDGET, GM.CACHE = tmp / "ledger.jsonl", tmp / "budget.json", tmp / "cache"
            GEN.LEDGER.write_text(seed_ledger())
            GEN.BUDGET.write_text(json.dumps(budget if budget is not None else real_budget()))
            D.OUT = tmp / "out"
            R.BATCH = D.OUT / "batch"
            fake = SimpleNamespace(batches=FakeBatches(lambda: GEN.LEDGER), files=FakeFiles(), models=FakeModels())
            R.CLIENT = GM._client = fake
            B.git_dirs = (lambda: (tmp / ".git" / "worktrees" / "x", tmp / ".git")) if linked else \
                (lambda: (tmp / ".git", tmp / ".git"))
            KG.gconf = lambda: conf
            R.batch_ids = lambda: list(ids)
            yield SimpleNamespace(tmp=tmp, fake=fake, conf=conf)
        finally:
            (GEN.LEDGER, GEN.BUDGET, GM.CACHE, GM._client, D.OUT, R.BATCH, R.CLIENT, B.git_dirs, KG.gconf,
             R.batch_ids) = saved


def run(argv: list[str]) -> tuple[int, str]:
    """gemini_batch.main(argv): (exit code, stdout + any SystemExit text)."""
    from gen import gemini_batch as GB
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        try:
            code = GB.main(argv)
        except SystemExit as e:
            code = 1 if e.code is None or isinstance(e.code, str) else e.code
            buf.write(f"{e.code if isinstance(e.code, str) else ''}\n")
    return code, buf.getvalue()


def rows(event: str | None = None) -> list[dict]:
    from gen import generate as GEN
    led = GEN.read_ledger(GEN.LEDGER)
    return [e for e in led if event is None or e.get("event") == event]


def kag_rows() -> list[dict]:
    gem = [e for e in rows("attempt") if e.get("backend") != "bedrock"]
    return gem[N0:]


def per_sheet(sid: str, sheet: str = "kneel") -> int:
    from gen import budget_kag as BK
    return sum(e.get("character") == sid and e.get("sheet") == sheet for e in BK.sheet_rows(kag_rows()))


def run_gemini_batch(check: Callable[[bool, str], None]) -> None:
    from gen import selftest_gemini_batch_b as SB
    from gen import selftest_kneel_ai_gem as SG
    from gen.selftest_colossus import sections
    sections(check, SB.submit_rules, SB.recover_cases, SB.expiry_and_walk, SB.partial_and_caps)
    SG.run_gem(check)


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_gemini_batch(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)

"""Pass KA-G rules of the Gemini guard (docs/KNEEL_AI_PLAN.md rev 7 section 5), called by `generate.check_budget`.

- `only_sheet_names`: the pass refuses every other sheet.
- `purpose_caps`: the pass's attempt rows are counted per `purpose`; a request without a listed purpose is refused.
- Per sheet: `max_per_sheet` (4), and the 4th attempt must carry `ka_g_reserve`.
- `ka_g_expiry` rows (a re-sent expired job, and the `reason: duplicate` rows of a cancelled duplicate) are left out of
  every per-sheet count and of the reserve-4th rule; they count against `ka_g_expiry`, `max_new` and the run cap.
- Voided attempts (an `attempt` row followed by a `void` row with its key) leave every count only when the pass has
  `void_ok: true`; until the section 10 billing check sets it, a void row changes no count.
"""
from __future__ import annotations

EXPIRY, RESERVE = "ka_g_expiry", "ka_g_reserve"


def voided(ledger: list[dict]) -> set[int]:
    """ids (id(row)) of the attempt rows cancelled by a later `void` row: each void cancels the latest earlier attempt
    with its key that no other void has cancelled."""
    open_: dict[str, list[dict]] = {}
    out: set[int] = set()
    for e in ledger:
        ev = e.get("event")
        if ev == "attempt" and e.get("backend") != "bedrock":
            open_.setdefault(str(e.get("key")), []).append(e)
        elif ev == "void" and open_.get(str(e.get("key"))):
            out.add(id(open_[str(e.get("key"))].pop()))
    return out


def counted(rows: list[dict], ledger: list[dict], void_ok: bool) -> list[dict]:
    """`rows` without the voided attempts (only when void_ok)."""
    if not void_ok:
        return rows
    gone = voided(ledger)
    return [e for e in rows if id(e) not in gone]


def sheet_rows(rows: list[dict]) -> list[dict]:
    """The rows that count per sheet: every attempt but ka_g_expiry."""
    return [e for e in rows if e.get("purpose") != EXPIRY]


def per_sheet(misses: list) -> list:
    """The requests the per-sheet rules check: every one but a ka_g_expiry re-send."""
    return [r for r in misses if getattr(r, "purpose", None) != EXPIRY]


def is_kag(cap: dict) -> bool:
    return "purpose_caps" in cap


def check_pass(cap: dict, new: list[dict], misses: list) -> None:
    """Refuse (SystemExit) a request batch that breaks pass KA-G's own rules. `new` = the pass's counted attempts."""
    name, caps = cap["name"], cap["purpose_caps"]
    sheets = cap.get("only_sheet_names")
    per_purpose: dict[str, int] = {}
    for r in misses:
        purpose = getattr(r, "purpose", None)
        if sheets is not None and r.sheet.name not in sheets:
            raise SystemExit(f"refused: {name} only generates the sheets {', '.join(sheets)}; "
                             f"{r.character}/{r.sheet.name} is not one (only_sheet_names)")
        if purpose not in caps:
            raise SystemExit(f"refused: {name} needs a purpose from {', '.join(caps)} ({r.character}/{r.sheet.name} "
                             f"has {purpose!r})")
        per_purpose[purpose] = per_purpose.get(purpose, 0) + 1
    for purpose, n in per_purpose.items():
        used = sum(1 for e in new if e.get("purpose") == purpose)
        if used + n > caps[purpose]:
            raise SystemExit(f"refused: {name} purpose {purpose} allows {caps[purpose]} images ({used} used, "
                             f"{n} requested)")
    rows = sheet_rows(new)
    for r in misses:
        if getattr(r, "purpose", None) == EXPIRY:
            continue
        n = sum(1 for e in rows if e.get("character") == r.character and e.get("sheet") == r.sheet.name)
        if n >= cap["max_per_sheet"]:
            raise SystemExit(f"refused: {name}: {r.character}/{r.sheet.name} already used {n} attempts "
                             f"(max {cap['max_per_sheet']}, ka_g_expiry rows not counted)")
        if n == cap["max_per_sheet"] - 1 and getattr(r, "purpose", None) != RESERVE:
            raise SystemExit(f"refused: {name}: attempt {n + 1} at {r.character}/{r.sheet.name} must carry "
                             f"purpose {RESERVE} (it has {getattr(r, 'purpose', None)!r})")


def remaining(cap: dict, new: list[dict], purpose: str) -> int:
    """The purpose's images left in the pass (`new` = the counted attempts)."""
    return cap["purpose_caps"].get(purpose, 0) - sum(1 for e in new if e.get("purpose") == purpose)

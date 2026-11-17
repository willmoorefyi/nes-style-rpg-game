"""Pass KA-G Gemini kneel request, arm `g` (docs/KNEEL_AI_PLAN.md rev 7 section 2; settings in kneel_ai.yaml `gemini`).

One sprite, one try, one image: `[image 1 = the idle on the guide canvas, image 2 = G-sil (+ image 3 = the hurt cell,
only on a try > 1 whose sprite lists refs: [idle, hurt]), the text]`; model `gemini-nano-banana-2.1` passed
explicitly; `response_modalities=["IMAGE"]`, 1:1, 1K; try N uses seed 1234 + N - 1 (the reserve, try 4, is 1237).
Tries 2-3 change the text only through `sprites.<id>.g_lines.<try>` {extra, avoid} (cumulative; the reserve uses the
try-3 lines). `request()` is shared by `kneel_ai.py gen --arm g` (interactive, `send`) and `gemini_batch.py prepare`.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from types import SimpleNamespace

from PIL import Image

from gen import gemini as GM
from gen import kneel_ai_data as D
from gen.kneel_ai_req import KneelRequest

PILOT, BATCH, RESERVE, EXPIRY = "ka_g_pilot", "ka_g_batch", "ka_g_reserve", "ka_g_expiry"
PASS = "pass KA-G"


def gconf() -> dict:
    return D.conf()["gemini"]


def seed_of(n_try: int) -> int:
    return int(gconf()["seed_base"]) + n_try - 1


def _entry(sp: D.Sprite) -> dict:
    return (D.conf().get("sprites") or {}).get(sp.sid) or {}


def refs_of(sp: D.Sprite, n_try: int) -> tuple[str, ...]:
    """('idle', 'pose') on try 1 (m8: the hurt may pull the pose); later tries add 'hurt' when the sprite lists it."""
    return ("idle", "pose", "hurt") if n_try > 1 and "hurt" in (_entry(sp).get("refs") or []) else ("idle", "pose")


def lines_of(sp: D.Sprite, n_try: int) -> tuple[list[str], list[str]]:
    """(extra, avoid) for try N: every `g_lines` entry for tries 2..min(N, 3)."""
    g = _entry(sp).get("g_lines") or {}
    extra, avoid = [], []
    for t in range(2, min(n_try, 3) + 1):
        e = g.get(t) or g.get(str(t)) or {}
        extra += [e["extra"]] if e.get("extra") else []
        avoid += [e["avoid"]] if e.get("avoid") else []
    return extra, avoid


def phrases(sp: D.Sprite) -> tuple[str, str]:
    """(weapon phrase, heads phrase) from the sprite's weapons / heads lists (r3-3)."""
    e = _entry(sp)
    weapons, heads = list(e.get("weapons") or []), list(e.get("heads") or [])
    if not weapons:
        w = "empty hands"
    else:
        noun = "weapon" if weapons == ["weapon"] else " and ".join(x.split("_")[0] for x in weapons)
        w = f"holding exactly 1 {noun}" if len(weapons) == 1 else f"holding exactly {len(weapons)} weapons ({noun})"
    h = "the face on the body and no separate head" if "heads_none" in e else \
        f"exactly {len(heads)} head{'s' if len(heads) != 1 else ''}"
    return w, h


def pose_text(sp: D.Sprite) -> str:
    """The body's pose text: a `gemini.poses` revision (round 1b, section 4) or the rev-4 5b text."""
    over = (gconf().get("poses") or {}).get(sp.category)
    return " ".join((over or D.conf()["poses"][sp.category][0]).split())


def prompt(sp: D.Sprite, n_try: int) -> str:
    c, gc = D.conf(), gconf()
    facing, opposite = ("facing left", "facing right") if sp.hero else ("facing right", "facing left")
    bg, other = sp.key_name, "white" if sp.key_name == "magenta" else "magenta"
    fill = {"facing": facing, "opposite": opposite, "bg": f"{bg} {gc['key_hex'][bg]}",
            "not_bg": f"{other} background, background gradient"}
    weapon, heads = phrases(sp)
    hurt = "hurt" in refs_of(sp, n_try)
    extra, avoid = lines_of(sp, n_try)
    neg = [c["negative"].format(**fill), c["poses"][sp.category][1], *([c["white_negative"]] if bg == "white" else []),
           *([_entry(sp)["negative_extra"]] if _entry(sp).get("negative_extra") else []), *avoid]
    text = gc["template"].format(ident=gc["ident_hurt" if hurt else "ident"], pose=pose_text(sp), weapon=weapon,
                                 heads=heads, **fill)
    text = " ".join([text, *extra, gc["negatives"].format(negatives=", ".join(" ".join(n.split()) for n in neg))])
    return " ".join(text.split())


def images(sp: D.Sprite, refs: tuple[str, ...], gdir: Path | None = None) -> list[Image.Image]:
    """The reference images in order: the idle and G-sil from the guide (built if missing), then the hurt cell."""
    from gen import kneel_ai_guide as G
    gdir = gdir or D.OUT / sp.sid
    if not (gdir / "guide.json").exists():
        G.build(sp, gdir, None)
    g = json.loads((gdir / "guide.json").read_text())
    out = {"idle": Image.open(gdir / "reference.png").convert("RGB"),
           "pose": Image.open(gdir / "guide_sil.png").convert("RGB")}
    if "hurt" in refs:
        out["hurt"] = G.place(sp, sp.keys["hurt"], g["window"])
    return [out[r] for r in refs]


def sheet_name(sp: D.Sprite) -> str:
    return "battle_kneel" if sp.hero else "kneel"


def request(sp: D.Sprite, n_try: int, purpose: str, round_: str = "pilot", gdir: Path | None = None) -> KneelRequest:
    gc, refs = gconf(), refs_of(sp, n_try)
    text, ims, seed = prompt(sp, n_try), images(sp, refs, gdir), seed_of(n_try)
    key = GM.cache_key(text, ims, aspect_ratio=gc["aspect_ratio"], seed=seed, model=gc["model"],
                       image_size=gc["image_size"])
    return KneelRequest(sp.sid, SimpleNamespace(name=sheet_name(sp)), seed, key, purpose, n_try, round_, text,
                        tuple(ims), refs)


def est_usd(backend: str) -> float:
    return float(gconf()["usd"]["batch" if backend == "gemini_batch" else "interactive"])


def attempt_row(r: KneelRequest, backend: str, **extra) -> dict:
    return {"event": "attempt", "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "backend": backend,
            "model": gconf()["model"], "character": r.character, "sheet": r.sheet.name, "seed": r.seed, "key": r.key,
            "req": r.req, "pass": "KA-G", "purpose": r.purpose, "round": r.round, "refs": list(r.refs),
            "est_usd": est_usd(backend), **extra}


def usage_breach(usage: dict | None) -> str | None:
    """Section 2: thinking tokens billed, or a prompt count above the recount limit, stop the pilot."""
    if not usage:
        return None
    lim = int(gconf()["usage_prompt_max"])
    if (usage.get("thoughts_token_count") or 0) > 0 or (usage.get("prompt_token_count") or 0) > lim:
        return f"usage {usage}: thoughts > 0 or prompt > {lim} tokens; recount section 5 before the next call"
    return None


def usage_gate(ledger: list[dict], budget: dict) -> None:
    """Refuse every KA-G call after a usage breach until the pass records `usage_recounted: true`."""
    kag = next((p for p in budget.get("passes", []) if p.get("name") == PASS), {})
    if kag.get("usage_recounted"):
        return
    for e in ledger:
        if e.get("event") == "result" and e.get("pass") == "KA-G" and usage_breach(e.get("usage")):
            raise SystemExit(f"refused: {usage_breach(e['usage'])} (then set usage_recounted: true in pass KA-G)")


def summary(r: KneelRequest) -> dict:
    from gen import kneel_ai_guide as G
    return {"req": r.req, "model": gconf()["model"], "key": r.key, "cached": r.cached, "seed": r.seed,
            "purpose": r.purpose, "refs": list(r.refs), "images": [G.sha(im) for im in r.images], "prompt": r.prompt,
            "usd": est_usd("gemini")}


def send(sp: D.Sprite, n_try: int, purpose: str, paid: bool, gdir: Path | None = None, budget: dict | None = None,
         ledger_path: Path | None = None) -> tuple[Path | None, str | None]:
    """One interactive try (`kneel_ai.py gen <id> --arm g --try N`): (raw path or None, usage-stop note or None).
    Without paid: writes req_g_<try>.json, prints the guard's verdict and sends nothing. Paid: the main checkout only,
    `generate.check_budget` (retry=True from try 2 on), the usage gate, the attempt row, the call, the result row."""
    from gen import bedrock as B
    from gen import generate as GEN
    if not 1 <= n_try <= 4 or (n_try == 4) != (purpose == RESERVE):
        raise SystemExit(f"refused: try {n_try} with purpose {purpose}: tries 1-3 take {PILOT}, try 4 (seed "
                         f"{seed_of(4)}) is the Q3 (iii) reserve try and takes {RESERVE}")
    gdir = gdir or D.OUT / sp.sid
    gdir.mkdir(parents=True, exist_ok=True)
    gc, r = gconf(), request(sp, n_try, purpose, "pilot", gdir)
    (gdir / f"req_g_{n_try}.json").write_text(json.dumps(summary(r), indent=1) + "\n")
    out = gdir / f"raw_g_{n_try}.png"
    if r.cached:
        Image.open(GM.CACHE / f"{r.key}.png").save(out)
        print(f"{sp.sid} (g) try {n_try}: cached {r.key}, nothing sent")
        return out, None
    led = ledger_path or GEN.LEDGER
    ledger = GEN.read_ledger(led)
    b = budget if budget is not None else json.loads(GEN.BUDGET.read_text())
    retry = n_try > 1 or purpose == EXPIRY

    def guard() -> None:
        GEN.check_budget([r], paid=True, max_paid=1, retry=retry, ledger=ledger, budget=b)
        usage_gate(ledger, b)
    if not paid:
        try:
            guard()
            v = "guard OK"
        except SystemExit as e:
            v = f"guard: {e}"
        print(f"dry-run {sp.sid} (g) try {n_try} seed {r.seed}: {gc['model']} key {r.key} uncached "
              f"${est_usd('gemini'):.4f} refs {list(r.refs)}; {v}")
        return None, None
    gd, cd = B.git_dirs()
    if gd != cd:
        raise SystemExit(f"refused: paid Gemini kneel calls only come from the main checkout, not a linked worktree "
                         f"({gd})")
    guard()
    GEN.ledger_append(attempt_row(r, "gemini"), led)
    res = {"event": "result", "key": r.key, "req": r.req, "pass": "KA-G"}
    try:
        img = GM.generate(r.prompt, list(r.images), aspect_ratio=gc["aspect_ratio"], seed=r.seed, model=gc["model"],
                          image_size=gc["image_size"])
    except BaseException as err:
        GEN.ledger_append({**res, "ok": False, "error": str(err)[:300], "usage": GM.LAST_USAGE or None}, led)
        raise
    usage = dict(GM.LAST_USAGE or {})
    GEN.ledger_append({**res, "ok": True, "usage": usage, "size": list(img.size)}, led)
    img.save(out)
    return out, usage_breach(usage)

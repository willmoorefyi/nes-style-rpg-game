"""Pass KA prompts (5b), request bodies per arm (D-KA4) and the paid path (docs/KNEEL_AI_PLAN.md 3, 7).

`build(sp, arm, seed)` returns the (model, body) list of one try without sending anything: (a) sd35 image-to-image
on the derived kneel, (b) / (b2) style_transfer from G-sil, (c) control_sketch on G-skel then style_transfer of its
output (c2 needs c1's image, so only c1 is built until c1 exists), (d) style_guide on the reference. `send` makes the
calls through bedrock.invoke (its gate: paid, purpose caps, the main checkout, the BR ledger) after the price rule: an
arm whose model has no confirmed price (bedrock.PRICE_CONFIRMED) or costs more than $0.10 is refused (section 7).
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from types import SimpleNamespace

from PIL import Image

from gen import bedrock as B
from gen import kneel_ai_data as D
from gen import kneel_ai_j1 as J1

MAX_USD = 0.10                 # section 7: a used model above this sends the budget back to the user
SEEDS = (1234, 1235, 1236)


def counts(sp: D.Sprite) -> str:
    weapons, heads, _ = J1.lists(sp)
    e = (D.conf().get("sprites") or {}).get(sp.sid) or {}
    if weapons:
        noun = "weapon" if weapons == ["weapon"] else " and ".join(w.split("_")[0] for w in weapons)
        w = f"holding exactly {len(weapons)} {noun}" if len(weapons) == 1 else f"holding exactly {len(weapons)} " \
                                                                                f"weapons ({noun})"
    else:
        w = "empty-handed"
    h = "" if "heads_none" in e else f", exactly {len(heads)} head{'s' if len(heads) != 1 else ''}"
    return w + h


def subject(sp: D.Sprite) -> str:
    """monsters.yaml prompt; heroes: characters.yaml prompt (+ battle_gear only when the ready key holds a weapon)."""
    if sp.hero and not J1.lists(sp)[0]:
        import yaml
        c = next(e for e in yaml.safe_load((D.HERE / "characters.yaml").read_text()) if e["id"] == sp.sid)
        return " ".join(c["prompt"].split())
    return " ".join(sp.subject.split())


def prompts(sp: D.Sprite, compact: bool = False) -> tuple[str, str]:
    c = D.conf()
    e = (c.get("sprites") or {}).get(sp.sid) or {}
    pose, neg_pose = c["poses"][sp.category]
    facing, opposite = ("facing left", "facing right") if sp.hero else ("facing right", "facing left")
    bg, other = sp.key_name, "white" if sp.key_name == "magenta" else "magenta"
    fill = {"facing": facing, "opposite": opposite, "bg": bg, "not_bg": f"{other} background, background gradient"}
    parts = [subject(sp), pose, *([c["compact"]] if compact else []), counts(sp), *([e["extra"]] if e.get("extra")
                                                                                  else []), c["style"].format(**fill)]
    neg = [c["negative"].format(**fill), neg_pose, *([c["white_negative"]] if bg == "white" else []),
           *([c["compact_negative"]] if compact else []), *([e["negative_extra"]] if e.get("negative_extra") else [])]
    return ", ".join(" ".join(p.split()) for p in parts), ", ".join(" ".join(n.split()) for n in neg)


def _img(path: Path) -> str:
    return B.png_b64(Image.open(path).convert("RGB"))


def build(sp: D.Sprite, arm: str, seed: int, gdir: Path | None = None, compact: bool = False,
          c1: Image.Image | None = None) -> list[tuple[str, dict]]:
    gdir = gdir or D.OUT / sp.sid
    a = D.conf()["arms"][arm]
    prompt, neg = prompts(sp, compact)
    base = {"prompt": prompt, "negative_prompt": neg, "seed": int(seed), "output_format": "png"}
    if arm == "a":
        if not (gdir / "derived.png").exists():
            raise SystemExit(f"{sp.sid}: arm (a) needs the derived kneel guide ({gdir / 'derived.png'}); run guide "
                             f"--derived-root first")
        return [("sd35", {**base, "mode": "image-to-image", "image": _img(gdir / "derived.png"),
                          "strength": a["strength"]})]
    if arm in ("b", "b2"):
        return [("style_transfer", {**base, "init_image": _img(gdir / "guide_sil.png"),
                                    "style_image": _img(gdir / "reference.png"), "change_strength": a["change_strength"],
                                    "style_strength": a["style_strength"],
                                    "composition_fidelity": a["composition_fidelity"]})]
    if arm == "c":
        out = [("control_sketch", {**base, "image": _img(gdir / "guide_skel.png"),
                                   "control_strength": a["control_strength"], "style_preset": a["style_preset"]})]
        if c1 is not None:
            t = a["then"]
            out.append(("style_transfer", {**base, "init_image": B.png_b64(c1.convert("RGB")),
                                           "style_image": _img(gdir / "reference.png"),
                                           "change_strength": t["change_strength"],
                                           "composition_fidelity": t["composition_fidelity"]}))
        return out
    if arm == "d":
        return [("style_guide", {**base, "image": _img(gdir / "reference.png"), "fidelity": a["fidelity"],
                                 "style_preset": a["style_preset"]})]
    raise SystemExit(f"unknown arm {arm!r} (a, b, b2, c, d)")


def price_refusal(arm: str) -> str | None:
    models = [D.conf()["arms"][arm]["model"]] + ([D.conf()["arms"][arm]["then"]["model"]] if arm == "c" else [])
    for m in models:
        if m not in B.PRICE_CONFIRMED or m not in B.COST_USD:
            return f"refused: arm ({arm}) uses {m}, whose price is not confirmed (bedrock.PRICE_CONFIRMED, KA0b)"
        if B.COST_USD[m] > MAX_USD:
            return f"refused: arm ({arm}) uses {m} at ${B.COST_USD[m]:.2f} > ${MAX_USD:.2f}: the budget goes back to the user"
    return None


def summary(model: str, body: dict) -> dict:
    """The body with every image replaced by its sha256 (the record written next to the raw)."""
    out = {k: (f"sha256:{hashlib.sha256(v.encode()).hexdigest()[:16]}" if k in ("image", "init_image", "style_image")
               else v) for k, v in body.items()}
    return {"model": model, "model_id": B.MODELS[model], "key": B.cache_key(model, body),
            "cached": B.is_cached(B.cache_key(model, body)), "usd": B.COST_USD.get(model), "body": out}


def send(sp: D.Sprite, arm: str, seed: int, purpose: str, paid: bool, compact: bool = False,
         gdir: Path | None = None) -> Path | None:
    """One try (2 calls for (c)). Without paid: writes req_<arm>_<seed>.json and sends nothing."""
    gdir = gdir or D.OUT / sp.sid
    r = price_refusal(arm)
    if r:
        raise SystemExit(r)
    reqs = build(sp, arm, seed, gdir, compact)
    rec = gdir / f"req_{arm}_{seed}.json"
    if not paid:
        rec.write_text(json.dumps([summary(m, b) for m, b in reqs], indent=1) + "\n")
        for m, b in reqs:
            s = summary(m, b)
            print(f"dry-run {sp.sid} ({arm}) seed {seed}: {m} key {s['key']} {'cached' if s['cached'] else 'uncached'}"
                  f" ${s['usd']:.2f}{' (+ c2 style_transfer after c1)' if arm == 'c' else ''}")
        return None
    img = B.invoke(reqs[0][0], reqs[0][1], paid=True, purpose=purpose)
    recs = [summary(*reqs[0])]
    if arm == "c":
        img.save(gdir / f"raw_c1_{seed}.png")
        m2, b2 = build(sp, arm, seed, gdir, compact, c1=img)[1]
        img = B.invoke(m2, b2, paid=True, purpose=purpose)
        recs.append(summary(m2, b2))
    out = gdir / f"raw_{arm}_{seed}.png"
    img.save(out)
    rec.write_text(json.dumps(recs, indent=1) + "\n")
    return out


# ───────── pass KA-G request adapter (docs/KNEEL_AI_PLAN.md rev 7 section 5) ─────────
@dataclass(frozen=True)
class KneelRequest:
    """One Gemini kneel request as `generate.check_budget` reads it (.cached, .character, .sheet.name), plus .seed,
    .key (the Gemini cache key), .purpose (a pass KA-G purpose), the try and round; kneel_ai_gem.request builds it.
    Pass KA's Bedrock budget check (closed into bedrock_history) moved to kneel_ai_budget.py."""
    character: str
    sheet: SimpleNamespace = field(compare=False)
    seed: int
    key: str
    purpose: str
    n_try: int = 1
    round: str = "pilot"
    prompt: str = field(default="", compare=False, repr=False)
    images: tuple = field(default=(), compare=False, repr=False)
    refs: tuple = ("idle", "pose")

    @property
    def cached(self) -> bool:
        from gen import gemini as GM
        return GM.is_cached(self.key)

    @property
    def req(self) -> str:
        return f"{self.character}:{self.n_try}"

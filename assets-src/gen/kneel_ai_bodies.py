"""`kneel_ai.py bodies [--write]` (docs/KNEEL_AI_PLAN.md r3-3, 5b): per sprite the `weapons` and `heads` part lists
(the prompt counts and the J1 A-prop / A-headdup parts), `robed`, and the idle's width fill (r3-4, re-measured here).

- weapons: the present idle parts with `kind: prop` or a weapon name (kneel_ai_guide.WEAPON_RE); heroes: `weapon`.
- heads: the present rigid parts on a rig head joint (the head / beak / snout bone, FW-5 extra heads), plus REVIEWED.
  A rig with none gets `heads: []`, a `heads_none` reason and `scale_part` (its largest part, for J1 A-scale).
- robed: a monster rig with a `cloth` part or "robe" in its monsters.yaml prompt; heroes: `robed: true`. Only a
  biped takes the robed pose text (Sprite.category); a robed floater (specter, wraith) keeps the floating one.
REVIEWED holds the reviewed corrections (KA0b review), applied on top so `--write` stays reproducible.
"""
from __future__ import annotations

import re

import numpy as np
import yaml

from gen import kneel_ai_data as D
from gen import kneel_ai_guide as G

HEAD_RE = re.compile(r"^(head\d*|skull|face|beak)$")
# reviewed at KA0b (orchestrator review of the generated lists): heads drawn as their own rigid parts with other names
REVIEWED: dict[str, dict] = {
    "rhyos": {"heads": ["head", "ram_n", "ram_f", "lizard"]},     # lion (head), two rams, the lizard (ACT1_LOG R271)
    "neochu": {"heads": [], "heads_none": "rooted: no head, the root mass is the body", "scale_part": "mass"},
    "ochu": {"heads": [], "heads_none": "rooted: no head, the root mass is the body", "scale_part": "mass"},
    "garland": {"robed": False},                 # plate armour with a cape (the cloth part): the biped pose text
    "lich": {"robed": False},                    # plate armour knight-king with a cape
}
# heroes: every `ready` key is empty-handed except white_mage / white_wizard (staff); the weapon of the others shows
# in `attack` only, so J1 checks that no attack-weapon colours appear on their kneel (kneel_ai_j1, A-prop weapon@attack)
# the 5b counts' noun per weapon part name (default: the part name with _ as space)
NOUN = {"weapon": "weapon", "tip": "weapon"}


def _area(sp: D.Sprite) -> dict[str, int]:
    from gen import rig as R
    lab, names = R.segment(sp.rig, "idle", sp.idle)
    return {n: int((lab == i).sum()) for i, n in enumerate(names)}


def entry(sp: D.Sprite) -> dict:
    rig = sp.rig
    present = [n for n in rig.parts if rig.present(n, "idle") and rig.parts[n].get("kind") != "fx"]
    if sp.hero:
        weapons = ["weapon"] if "weapon" in present else []
    else:
        weapons = [n for n in present if rig.parts[n].get("kind") == "prop" or G.WEAPON_RE.search(n)]
    hj = set(rig.head) | {"crown"}
    heads = [n for n in present if n not in weapons and (HEAD_RE.match(n) or (
        rig.parts[n].get("kind", "rigid") == "rigid" and set(rig.joints_of(n, "idle")[1:]) & hj))]
    e = {"weapons": weapons, "heads": heads}
    e.update(REVIEWED.get(sp.sid, {}))
    if not e["heads"] and "heads_none" not in e:
        area = _area(sp)
        e["heads_none"] = f"no head part in the {rig.body} rig (the face is drawn on the body)"
        e["scale_part"] = max((n for n in present if n not in weapons), key=lambda n: area.get(n, 0))
    if sp.hero:
        robed = bool(sp.cfg.get("robed"))
    else:
        robed = any(rig.parts[n].get("kind") == "cloth" for n in present) or "robe" in sp.subject.lower()
    e["robed"] = robed
    e.update(REVIEWED.get(sp.sid, {}))
    if not e["robed"]:
        e.pop("robed")
    xs = np.nonzero((sp.idle[..., 3] > 0).any(0))[0]
    e["fill"] = round(float((xs.max() - xs.min() + 1) / sp.cell[0]), 3)
    return e


def bodies(write: bool) -> int:
    rows = {}
    for sid in D.monsters() + D.heroes():
        sp = D.load(sid)
        rows[sid] = entry(sp)
        e = rows[sid]
        print(f"{sid:18} {sp.category:10} weapons {e['weapons'] or '-'} heads {e['heads'] or '-'}"
              f"{' (' + e['heads_none'] + '; scale ' + e['scale_part'] + ')' if 'heads_none' in e else ''}"
              f"{' robed' if e.get('robed') else ''} fill {e['fill']:.2f}")
    wide = sorted(s for s, e in rows.items() if e["fill"] > 0.9)
    print(f"{len(rows)} sprites; fill > 0.90 (width-limited candidates, r3-4): {' '.join(wide) or '-'}")
    if write:
        c = D.conf()
        keep = ("extra", "negative_extra")                       # hand-written prompt keys survive a re-write
        old = c.get("sprites") or {}
        c["sprites"] = {**old, **{s: {**{k: v for k, v in (old.get(s) or {}).items() if k in keep}, **e}
                                  for s, e in rows.items()}}
        head, _, _ = D.CONF.read_text().partition("\nsprites:") if D.CONF.exists() else ("", "", "")
        body = yaml.safe_dump({"sprites": c["sprites"]}, sort_keys=True, width=120, default_flow_style=None)
        D.CONF.write_text(head.rstrip("\n") + "\n" + body)
        print(f"wrote sprites.<id> for {len(rows)} sprites to {D.CONF.name}")
    return 0

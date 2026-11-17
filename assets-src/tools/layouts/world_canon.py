"""The canon of pass W map ids (docs/WORLD_PLAN.md 4.1-4.8, 5.4, D-W8): every map a pass W tranche builds, with its
owner tranche, its kind, its entrances (name: purpose), its exit and its links (stairs between floors, doors into
rooms, by entrance name).

Read only for every tranche (W1-0b owns it; a needed change goes to the integrator). `stubs.py` writes a stub source
for every id here until its owner builds it, so transitions may point at maps that don't exist yet; a tranche keeps
every canon entrance name and link of its maps (5.3) and may add more.

Conventions:
- The first entrance is where the walking way in arrives: a town's `gate`, a room's `door`, a floor's `arrival`.
- `exit` is (map, entrance). For a floor it is `MapData.exit` (the EXIT spell); `exit_walk` says whether the map
  also has a walking way out by its first entrance (first floors, towns, rooms, sites).
- Floor entrances: `arrival` (from the floor before, beside this floor's stair back), `up` / `down` (beside this
  floor's stair on, the return point from the next floor), `boss` (the boss approach), plus `inner` for `mirage-1f`.
- A link (here, map, entrance) is a stair or door beside the entrance `here` that leads to `map`'s `entrance`. Both
  ends of a canon-to-canon link are listed. `overworld` and `temple-of-fiends` are not canon (EXTERNAL).
"""
from __future__ import annotations

from dataclasses import dataclass

KINDS = ("town", "house", "shop", "inn", "castle", "site", "floor")
EXTERNAL = ("overworld", "temple-of-fiends")
SHOPS = (("weapon_shop", "weapon-shop", "Weapon Shop"), ("armor_shop", "armor-shop", "Armor Shop"),
         ("item_shop", "item-shop", "Item Shop"), ("white_magic", "white-magic", "White Magic"),
         ("black_magic", "black-magic", "Black Magic"))
Link = tuple[str, str, str]                  # (entrance here, target map, target entrance)


@dataclass(frozen=True)
class MapRow:
    id: str
    owner: str
    kind: str
    name: str                                # the HUD label (MapData.name)
    entrances: tuple[tuple[str, str], ...]   # (name, purpose), first = the walking way in
    exit: tuple[str, str]
    exit_walk: bool = True
    links: tuple[Link, ...] = ()


ROWS: list[MapRow] = []


def _add(row: MapRow) -> None:
    ROWS.append(row)


def town(tid: str, owner: str, title: str, anchor: str, houses: tuple[str, ...], shops=SHOPS,
         extra: tuple[tuple[str, str, str, str], ...] = ()) -> None:
    """A town, its houses `<tid>-house-<slug>`, its shops and its inn; `extra` adds (entrance, purpose, map, map
    entrance) links from the town to rooms listed separately (a castle, a circle, a spring, a dry dock)."""
    rooms = [(f"house_{slug}", f"{tid}-house-{slug}", "house", f"{title} {slug.title()} House") for slug in houses]
    rooms += [(ent, f"{tid}-{part}", "shop", f"{title} {label}") for ent, part, label in shops]
    rooms.append(("inn", f"{tid}-inn", "inn", f"{title} Inn"))
    ents = [("gate", f"land gate, arrival from the overworld ({anchor})")]
    ents += [(ent, f"in front of {mid}'s door") for ent, mid, _, _ in rooms] + [(e, p) for e, p, _, _ in extra]
    links = [(ent, mid, "door") for ent, mid, _, _ in rooms] + [(e, m, me) for e, _, m, me in extra]
    _add(MapRow(tid, owner, "town", title, tuple(ents), ("overworld", anchor), True, tuple(links)))
    for ent, mid, kind, label in rooms:
        _add(MapRow(mid, owner, kind, label, (("door", f"arrival from {tid}"),), (tid, ent)))


def room(mid: str, owner: str, kind: str, name: str, entrances: tuple[tuple[str, str], ...], exit: tuple[str, str],
         links: tuple[Link, ...] = (), exit_walk: bool = True) -> None:
    _add(MapRow(mid, owner, kind, name, entrances, exit, exit_walk, links))


def floors(ids: list[str], owner: str, name: str, anchor: str, way: str = "down", bosses: tuple[int, ...] = (),
           labels: list[str] | None = None) -> None:
    """A chain of floors: floor k's `way` stair (down or up) leads to floor k+1's `arrival`, and back. `bosses` are
    the 1-based floors with a `boss` entrance. The first floor is entered on foot from the overworld anchor."""
    n = len(ids)
    for k, mid in enumerate(ids):
        ents = [("arrival", "from the overworld" if k == 0 else f"from {ids[k - 1]}")]
        links: list[Link] = [] if k == 0 else [("arrival", ids[k - 1], way)]
        if k < n - 1:
            ents.append((way, f"beside the stair {way} to {ids[k + 1]}; the return point from it"))
            links.append((way, ids[k + 1], "arrival"))
        if k + 1 in bosses:
            ents.append(("boss", "the boss approach"))
        label = labels[k] if labels else f"{name} {mid.rsplit('-', 1)[1].upper()}"
        room(mid, owner, "floor", label, tuple(ents), ("overworld", anchor), tuple(links), exit_walk=k == 0)


# ── A1 (4.1) ──
room("matoya-cave", "A1-O", "site", "Matoya's Cave", (("arrival", "from the overworld"),), ("overworld", "a1_matoya"))
town("pravoka", "A1-T", "Pravoka", "a1_pravoka",
     ("lighthouse", "warehouse", "netmaker", "chandler", "cooper", "harbormaster"))

# ── ELF (4.2) ──
floors(["western-keep-1f", "western-keep-2f"], "ELF-O", "Western Keep", "elf_keep", way="up", bosses=(2,))
town("elfheim", "ELF-T", "Elfheim", "elf_elfheim", ("herbalist", "bowyer", "scribe", "healer", "bard", "warden"),
     extra=(("north_gate", "the north gate, the way up to the castle", "elfheim-castle", "gate"),))
room("elfheim-castle", "ELF-T", "castle", "Elfheim Castle",
     (("gate", "arrival from elfheim's north gate"), ("chamber", "in front of the prince's chamber"),
      ("vault", "in front of the vault door")), ("elfheim", "north_gate"),
     (("chamber", "elfheim-castle-chamber", "door"), ("vault", "elfheim-vault", "door")))
room("elfheim-castle-chamber", "ELF-T", "castle", "The Prince's Chamber", (("door", "arrival from the castle"),),
     ("elfheim-castle", "chamber"))
room("elfheim-vault", "ELF-T", "castle", "Elfheim Vault", (("door", "arrival from the castle"),),
     ("elfheim-castle", "vault"))
floors([f"marsh-cave-b{i}" for i in (1, 2, 3)], "ELF-D", "Marsh Cave", "elf_marsh", bosses=(3,))

# ── EARTH (4.3) ──
room("dwarf-hall", "ERT-O", "site", "Dwarf Hall", (("arrival", "from the overworld"),), ("overworld", "ert_dwarf"))
room("giant-tunnel", "ERT-O", "site", "Giant's Tunnel",
     (("arrival", "the east mouth, from the overworld"), ("west", "the west mouth, toward Sarda's coast")),
     ("overworld", "ert_giant"), (("west", "overworld", "ert_giant_west"),))
room("sage-cave", "ERT-O", "site", "Sarda's Cave", (("arrival", "from the overworld"),), ("overworld", "ert_sarda"))
town("melmond", "ERT-T", "Melmond", "ert_melmond", ("unne", "miller", "vintner", "ploughman", "healer"))
floors([f"cavern-earth-b{i}" for i in range(1, 6)], "ERT-D", "Cavern of Earth", "ert_earth_cave", bosses=(3, 5))

# ── FIRE (4.4) ──
town("crescent", "FIR-T", "Crescent Lake", "fir_crescent",
     ("astronomer", "boatwright", "archivist", "healer", "potter", "tutor"),
     extra=(("circle", "the causeway's end, the way to the Circle of Sages", "crescent-circle", "arrival"),))
room("crescent-circle", "FIR-T", "site", "Circle of Sages", (("arrival", "from crescent's causeway"),),
     ("crescent", "circle"))
floors([f"gurgu-b{i}" for i in range(1, 6)], "FIR-D1", "Gurgu Volcano", "fir_volcano", bosses=(5,))
floors([f"ice-cavern-b{i}" for i in (1, 2, 3)], "FIR-D2", "Ice Cavern", "fir_ice", bosses=(3,))

# ── ORDEAL (4.5) ──
floors([f"citadel-{i}f" for i in (1, 2, 3)], "ORD-O", "Citadel of Trials", "ord_citadel", way="up", bosses=(3,))
floors(["bahamut-cave", "bahamut-lair"], "ORD-O", "Bahamut", "ord_bahamut", labels=["Bahamut's Cave",
                                                                                   "Bahamut's Lair"])

# ── WATER (4.6) ──
room("waterfall-cave", "WAT-O", "site", "Waterfall Cave", (("arrival", "from the overworld"),),
     ("overworld", "wat_waterfall"))
room("caravan-camp", "WAT-O", "site", "Caravan Camp", (("arrival", "from the overworld"),),
     ("overworld", "wat_caravan"))
town("onrac", "WAT-T", "Onrac", "wat_onrac", ("bellringer", "netmender", "smoker", "shipwright", "healer", "tanner"),
     extra=(("dry_dock", "the submarine's dry dock (the oxyale gate)", "sea-shrine-b3", "nave"),))
_SEA = "Sea Shrine"
room("sea-shrine-b3", "WAT-D", "floor", f"{_SEA} B3",
     (("nave", "the submarine's arrival from onrac's dry dock"), ("up", "beside the stair up to sea-shrine-b2"),
      ("down", "beside the stair down to sea-shrine-b4")), ("overworld", "wat_onrac"),
     (("nave", "onrac", "dry_dock"), ("up", "sea-shrine-b2", "down"), ("down", "sea-shrine-b4", "arrival")), False)
room("sea-shrine-b2", "WAT-D", "floor", f"{_SEA} B2",
     (("down", "beside the stair down to sea-shrine-b3; arrival from it"), ("up", "beside the stair up to b1")),
     ("overworld", "wat_onrac"), (("down", "sea-shrine-b3", "up"), ("up", "sea-shrine-b1", "down")), False)
room("sea-shrine-b1", "WAT-D", "floor", f"{_SEA} B1", (("down", "beside the stair down to b2; arrival from it"),),
     ("overworld", "wat_onrac"), (("down", "sea-shrine-b2", "up"),), False)
room("sea-shrine-b4", "WAT-D", "floor", f"{_SEA} B4",
     (("arrival", "from sea-shrine-b3"), ("down", "beside the stair down to sea-shrine-b5")), ("overworld", "wat_onrac"),
     (("arrival", "sea-shrine-b3", "down"), ("down", "sea-shrine-b5", "arrival")), False)
room("sea-shrine-b5", "WAT-D", "floor", f"{_SEA} B5", (("arrival", "from sea-shrine-b4"), ("boss", "the boss approach")),
     ("overworld", "wat_onrac"), (("arrival", "sea-shrine-b4", "down"),), False)

# ── WIND (4.7) ──
town("lufenia", "WND-O", "Lufenia", "wnd_lufenia", ("stargazer", "elder", "healer"), shops=SHOPS[3:])
town("gaia", "WND-T", "Gaia", "wnd_gaia", ("windmiller", "ropemaker", "spinner", "healer", "beekeeper", "shepherd"),
     extra=(("spring", "the top terrace, the way to the dry spring", "gaia-spring", "arrival"),))
room("gaia-spring", "WND-T", "site", "Gaia Spring", (("arrival", "from gaia's top terrace"),), ("gaia", "spring"))
floors([f"mirage-{i}f" for i in (1, 2, 3)], "WND-D1", "Mirage Tower", "wnd_mirage", way="up")
floors([f"sky-castle-{i}f" for i in range(1, 6)], "WND-D2", "Sky Castle", "wnd_mirage", way="up", bosses=(5,))

# ── PAST (4.8) ──
floors([f"past-temple-{i}" for i in range(1, 6)] + ["past-chaos"], "PST", "Temple of the Past", "temple",
       bosses=(1, 2, 3, 4, 5, 6), labels=[f"Temple of the Past {i}" for i in range(1, 6)] + ["Chaos's Shrine"])


def _patch(mid: str, **kw) -> None:
    i = next(i for i, r in enumerate(ROWS) if r.id == mid)
    ROWS[i] = MapRow(**{**ROWS[i].__dict__, **kw})


_m1 = next(r for r in ROWS if r.id == "mirage-1f")
_patch("mirage-1f", entrances=_m1.entrances[:1] + (("inner", "beyond the vestibule's chime door"),) + _m1.entrances[1:])
_sky = next(r for r in ROWS if r.id == "sky-castle-1f")
_patch("sky-castle-1f", exit_walk=False, entrances=(("arrival", "mirage_ascent's warp from mirage-3f"),) + _sky.entrances[1:])
_pt = next(r for r in ROWS if r.id == "past-temple-1")
_patch("past-temple-1", exit_walk=False, links=(("arrival", "temple-of-fiends", "time_gate"),) + _pt.links,
       entrances=(("arrival", "the time gate's stair from temple-of-fiends"),) + _pt.entrances[1:])

CANON: dict[str, MapRow] = {r.id: r for r in ROWS}
TRANCHES: tuple[str, ...] = tuple(sorted({r.owner for r in ROWS}))
assert len(CANON) == len(ROWS), "duplicate canon id"


def owned(tranche: str) -> list[str]:
    """The canon ids a tranche owns (`all` for every id), in canon order."""
    return [r.id for r in ROWS if tranche == "all" or r.owner == tranche]


def check() -> list[str]:
    """The canon's own consistency: kinds, entrance names, link ends and exits resolve."""
    errs = []
    for r in ROWS:
        names = [n for n, _ in r.entrances]
        if r.kind not in KINDS:
            errs.append(f"{r.id}: unknown kind {r.kind}")
        if len(set(names)) != len(names):
            errs.append(f"{r.id}: duplicate entrance")
        for here, mid, ent in r.links + ((names[0], *r.exit),) * r.exit_walk:
            if here not in names:
                errs.append(f"{r.id}: link from unknown entrance {here}")
            if mid in CANON and ent not in [n for n, _ in CANON[mid].entrances]:
                errs.append(f"{r.id}: {mid} has no entrance {ent}")
            elif mid not in CANON and mid not in EXTERNAL:
                errs.append(f"{r.id}: link to unknown map {mid}")
            elif mid in CANON and r.kind == "floor" and CANON[mid].kind == "floor" and \
                    (ent, r.id, here) not in CANON[mid].links:
                errs.append(f"{r.id}: link {here} -> {mid}:{ent} has no way back")
    return errs

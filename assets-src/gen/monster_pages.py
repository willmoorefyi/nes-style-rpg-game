"""Monster atlas page groups and the paged shelf packer (docs/ROSTER_PLAN.md 8, FW-8).

The monster atlas is split into pages of at most anim_rules.MAX_PAGE (2048) px on each side, so a battle or a bestiary
entry loads only the pages its sprites live on (src/rendering/MonsterPages.ts). Sprites are packed in a stable order:

- **Groups** (`PAGE_GROUPS`, in order): page 0 holds the act-1 sheets of the R0 commit (in their R0 order, so page 0 is
  the R0 atlas cell for cell), then the fiends and bosses (G1 + G2), then roster batches A-D (docs/ROSTER_PLAN.md 3.2),
  then any approved sprite no group lists (sorted by id). Within a group sprites keep the listed order.
- **Every group starts on a new page** and spills onto further pages when full, so adding a sprite to a later group
  never moves a cell on an earlier group's pages.
- **A sheet never straddles pages**: when its frames would cross the page's bottom edge it starts the next page.
- Inside a page the packer is the R0 shelf packer: left to right, a new shelf when the row is full (width MAX_PAGE).
"""
from __future__ import annotations

from gen.anim_rules import MAX_PAGE

# docs/ROSTER_PLAN.md 3.2 batches, in roster-table order. Append new ids at the end of their group: an insert moves
# every later cell of that group (only that group's pages).
PAGE_GROUPS: list[tuple[str, list[str]]] = [
    ("act1", ["cockatrice", "dragon", "garland", "goblin", "gr_imp", "gr_wolf", "lich", "mummy", "ogre", "pirate",
              "skeleton", "troll", "vampire", "wolf"]),
    ("bosses", ["ashen_queen", "drowned_sovereign", "hollow_seraph",
                "piscodemon", "astos", "evil_eye", "dragon_zombie", "warmech", "death_eye", "chaos"]),
    ("A", ["crazy_horse", "black_widow", "gigas_worm", "werewolf", "zombie", "ghoul", "cobra", "ogre_chief", "lizard",
           "sahagin", "sahagin_chief", "buccaneer", "shark", "bigeyes", "tarantula", "ghast", "scorpion", "shadow",
           "green_slime", "crawler", "gray_ooze", "gargoyle", "bloodbones"]),
    ("B", ["wraith", "anaconda", "hyenadon", "lesser_tiger", "minotaur", "hill_gigas", "earth_elemental", "wight",
           "ochre_jelly", "ogre_mage", "sphinx", "ankheg", "piranha", "red_piranha", "crocodile", "white_crocodile",
           "ochu", "neochu", "hydra", "horned_devil", "pyrolisk", "fire_elemental", "fire_hydra", "lava_worm",
           "hellhound", "fire_lizard", "fire_gigas"]),
    ("C", ["white_dragon", "winter_wolf", "mindflayer", "ice_gigas", "specter", "remorazz", "dark_wizard",
           "desert_baretta", "sabertooth", "wyvern", "wyrm", "manticore", "baretta", "basilisk", "allosaurus",
           "weretiger", "sand_worm", "minotaur_zombie", "king_mummy", "medusa", "rakshasa", "clay_golem", "nightmare",
           "sahagin_prince", "white_shark", "deepeyes", "sea_snake", "sea_scorpion", "sea_troll", "ghost",
           "water_elemental", "water_naga"]),
    ("D", ["tyrannosaur", "black_knight", "chimera", "guardian", "blue_dragon", "green_dragon", "stone_golem",
           "air_elemental", "spirit_naga", "death_knight", "earth_medusa", "black_flan", "soldier", "vampire_lord",
           "dark_fighter", "rhyos", "purple_worm", "iron_golem"]),
]


def group_order(sprites: list[str]) -> list[tuple[str, list[str]]]:
    """The present sprites as (group, ids) in page order; unlisted ids go to a last group `other`, sorted."""
    have = set(sprites)
    listed = [i for _, ids in PAGE_GROUPS for i in ids]
    dup = sorted({i for i in listed if listed.count(i) > 1})
    if dup:
        raise SystemExit(f"monsters_ai: sprites listed in more than one page group: {dup}")
    out = [(name, [i for i in ids if i in have]) for name, ids in PAGE_GROUPS]
    out.append(("other", sorted(have - set(listed))))
    return [(name, ids) for name, ids in out if ids]


class _Page:
    def __init__(self) -> None:
        self.x = self.y = self.shelf_h = self.width = 0
        self.empty = True

    def place(self, sizes: list[tuple[int, int]], cap: int) -> list[tuple[int, int]] | None:
        """Positions of `sizes` continuing this page's shelves, or None when they would cross the page's edge."""
        x, y, shelf_h, width = self.x, self.y, self.shelf_h, self.width
        pos = []
        for w, h in sizes:
            if w > cap:
                return None
            if x and x + w > cap:
                y, x, shelf_h = y + shelf_h, 0, 0
            pos.append((x, y))
            x += w
            shelf_h = max(shelf_h, h)
            width = max(width, x)
        if y + shelf_h > cap:
            return None
        self.x, self.y, self.shelf_h, self.width, self.empty = x, y, shelf_h, width, False
        return pos

    @property
    def size(self) -> tuple[int, int]:
        return self.width, self.y + self.shelf_h


def pack_pages(groups: list[list[tuple[str, list[tuple[int, int]]]]], cap: int = MAX_PAGE
               ) -> tuple[list[tuple[int, int]], dict[str, tuple[int, list[tuple[int, int]]]]]:
    """Pack each group's sprites (id, frame sizes) onto pages: (page sizes, {id: (page, frame positions)})."""
    pages: list[_Page] = []
    out: dict[str, tuple[int, list[tuple[int, int]]]] = {}
    for group in groups:
        if not group:
            continue
        pages.append(_Page())                       # every group starts a new page
        for sid, sizes in group:
            pos = pages[-1].place(sizes, cap)
            if pos is None and not pages[-1].empty:
                pages.append(_Page())               # the sheet does not fit: spill onto a new page
                pos = pages[-1].place(sizes, cap)
            if pos is None:
                raise SystemExit(f"monsters_ai: {sid} does not fit on an empty {cap}x{cap} page")
            out[sid] = (len(pages) - 1, pos)
    return [p.size for p in pages], out

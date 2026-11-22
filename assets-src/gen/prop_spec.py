"""The picks of the AR dungeon props (art pass AR, AR-P / AR-P2; user rulings 2026-11-21), cut by prop_cut.py.

SPEC: every approved prop, its render (tag and cache key), the object picked from the render's 2x2 variants, its
cells, where it is placed (floor, or wall: a wall face) and its cut options. FLAME: the lit props.
"""
from __future__ import annotations

WALL = "wall"
G = {"clean": {"green_y": 0.0}}
# id: (render tag, render cache key, object #, (cells w, h), place, cut options)   place: floor | wall (a wall face)
# options: fill (pix), clean (extra LP.clean kw), web (keep only the pale threads)
SPEC = {
    # light sources (each has a FLAME entry)
    "wall_torch": ("torch_ultra_11", "2dcc06d2c7db940c92082e5f", 0, (1, 1), WALL, {}),
    "standing_torch": ("wall_torch2_ultra_2", "14237c1b59c9149369d267f0", 0, (1, 2), "floor", {}),
    "brazier_tall": ("brazier_tall2_ultra_2", "ccbc137f3ffb3769db36f61a", 1, (1, 2), "floor", {}),
    "candelabra": ("candelabra_ultra_1", "a9797047fa588a2533505b72", 0, (1, 2), "floor", {}),
    "cauldron_brew": ("wall_torch_cauldron_ultra_1", "8d61b82e6d07294deff3f1f0", 3, (1, 1), "floor", {"fill": 0.85}),
    "cauldron_fire": ("wall_torch_cauldron_ultra_1", "8d61b82e6d07294deff3f1f0", 1, (1, 1), "floor", {"fill": 0.85}),
    "fiend_brazier": ("fiend_brazier_ultra_1", "96af8232203b9b629b8c2c63", 1, (1, 1), "floor", {"fill": 0.85}),
    "sun_brazier": ("sun_brazier_ultra_1", "8e6d00cec0e6b278e8a812f7", 2, (1, 1), "floor", {"fill": 0.85}),
    "bog_lantern": ("bog_lantern_ultra_1", "8d1858cb280ed25386a41943", 3, (1, 1), "floor", {"fill": 0.95}),
    "fire_idol": ("fire_idol_ultra_1", "7ddd3af3d85c64a7b6d26cf8", 0, (1, 2), "floor", {"fill": 0.7}),
    "lava_vent": ("lava_vent_ultra_1", "77035343fd8f73f1d4ee7fb6", 2, (1, 1), "floor", {}),
    "magma_mound": ("lava_vent_ultra_1", "77035343fd8f73f1d4ee7fb6", 3, (2, 1), "floor", {}),
    "mushrooms_glow": ("mushrooms_glow_ultra_1", "74946855990ce6e3e2cfaa78", 0, (1, 1), "floor", {}),
    "console": ("console_light_pillar_ultra_1", "b341dc07a71e654739fcd46a", 0, (1, 1), "floor", {}),
    "light_pylon": ("console_light_pillar_ultra_1", "b341dc07a71e654739fcd46a", 2, (1, 2), "floor", {"fill": 0.85}),
    # gates and iron (dressing only: no flag swaps their art)
    "portcullis_closed": ("portcullis_closed2_ultra_2", "c3dc513e17a1ad5a67a7696a", 0, (2, 2), WALL, {}),
    "portcullis_open": ("portcullis_open2_ultra_2", "6de2b4b8ac73f81d051d1c63", 1, (2, 2), WALL, {}),
    "iron_door": ("iron_ultra_1", "ff1ae9b19d2bdd9f1c586389", 0, (2, 2), WALL, G),
    "bar_gate": ("iron_ultra_1", "ff1ae9b19d2bdd9f1c586389", 2, (2, 2), WALL, G),
    "cage_floor": ("cage_floor_ultra_1", "4ea6214822494e8d6e81088f", 3, (1, 1), "floor", {"fill": 0.85}),
    "cage_hanging": ("cage_hanging_ultra_1", "ed9c33b340d186a35fa566e5", 2, (1, 2), "floor", {}),
    "wall_chains": ("wall_chains_ultra_1", "d7eafeffd4bb6085333cf1f8", 0, (1, 2), WALL, {}),
    "cobweb": ("web_ultra_23_k", "98c3bdab1be9abe4f0c5e51f", 0, (1, 1), WALL, {"fill": 0.95, "web": True}),
    # bones and clutter
    "bone_pile": ("bone_pile2_ultra_2", "2e53150bbfe87182a66c2902", 0, (1, 1), "floor", {"fill": 0.9}),
    "skull": ("bone_pile_rubble_ultra_1", "6e7f8e5ea8ff7dfad0919147", 0, (1, 1), "floor", {"fill": 0.5}),
    "skeleton_slumped": ("skeleton_slumped_ultra_1", "e988c951e234896ed561573b", 0, (1, 1), "floor", {"fill": 0.9}),
    "barrels": ("barrels_crates_ultra_1", "22626eadcade4aa342ca4f91", 0, (1, 1), "floor", {}),
    "barrel_tipped": ("barrels_crates_ultra_1", "22626eadcade4aa342ca4f91", 2, (1, 1), "floor", {"fill": 0.85}),
    "bookshelf_ruined": ("bookshelf_ruined_ultra_1", "864ef7001356b7c4ef3babd2", 1, (2, 2), "floor", {"fill": 0.7}),
    # caves
    "crystal_cluster": ("crystal_cluster_crystal_tall_ultra_1", "d7f1cb4fdabc0788a70babe2", 0, (1, 1), "floor", {}),
    "crystal_tall": ("crystal_cluster_crystal_tall_ultra_1", "d7f1cb4fdabc0788a70babe2", 1, (1, 2), "floor",
                     {"fill": 0.8}),
    "mine_cart_gold": ("mine_cart_ultra_1", "4b2635a7c2e9f50c11773779", 3, (1, 1), "floor", {}),
    "mine_cart_ore": ("mine_cart_ultra_1", "4b2635a7c2e9f50c11773779", 0, (1, 1), "floor", {}),
    "stalagmite": ("stalagmite_ultra_1", "76b54f1e675922604d1dc877", 1, (1, 2), "floor", {"fill": 0.8}),
    "obsidian_spire": ("obsidian_spire_ultra_1", "09431249dfa53dd7b599b990", 3, (1, 2), "floor", {"fill": 0.8}),
    # ice
    "ice_pillar": ("ice_pillar_ice_crystals_ultra_1", "891ac99d2f5558b9ce38be46", 0, (1, 2), "floor", {}),
    "ice_spire": ("ice_pillar_ice_crystals_ultra_1", "891ac99d2f5558b9ce38be46", 5, (1, 2), "floor", {"fill": 0.85}),
    "ice_shards": ("ice_pillar_ice_crystals_ultra_1", "891ac99d2f5558b9ce38be46", 6, (1, 1), "floor", {}),
    "frozen_knight": ("frozen_statue_ultra_1", "feb5e27da15dbc964dde8244", 0, (1, 2), "floor", {"fill": 0.75}),
    "ice_block": ("frozen_statue2_ultra_2", "d319cc64e87a060853961761", 0, (1, 1), "floor", {}),
    # sea
    "coral_pink": ("coral_kelp_ultra_1", "9c65b1238c9e896ec4ce7094", 0, (1, 1), "floor", {}),
    "kelp": ("coral_kelp_ultra_1", "9c65b1238c9e896ec4ce7094", 3, (1, 2), "floor", {"fill": 0.8}),
    "clam_altar": ("clam_altar_ultra_1", "d883d8fb2d4415bd1ee82355", 1, (2, 2), "floor", {"fill": 0.8}),
    # sky
    "pipes": ("pipes_ultra_1", "5773c5bbfb900f5c9fa3b9fb", 0, (1, 2), "floor", {}),
    "robot_husk": ("robot_husk_ultra_1", "719f5929b4ade006c8bd3343", 0, (1, 1), "floor", {"fill": 0.85}),
    # sand, the past
    "sand_urn": ("sand_urn_obelisk_ultra_1", "caed11b6d747bab814732d45", 0, (1, 1), "floor", {"fill": 0.85}),
    "obelisk": ("sand_urn_obelisk_ultra_1", "caed11b6d747bab814732d45", 4, (1, 2), "floor", {}),
    "ruin_column_rune": ("ruin_column_ultra_1", "8ccf729752df4c01b2117f5c", 3, (1, 2), "floor", {}),
    "sealed_coffin": ("sealed_coffin2_ultra_2", "0e622ba74f560cea86368e0b", 3, (1, 2), "floor", {"fill": 0.8}),
    "stone_coffin": ("sealed_coffin2_ultra_2", "0e622ba74f560cea86368e0b", 0, (1, 2), "floor", {"fill": 0.8}),
}
SPLIT = {"ruin_column_ultra_1": 4}          # four columns side by side: cut into vertical quarters
# lit props: style, the flame rect (fractions of the figure's box [x0, y0, x1, y1]), tongue (the top quarter drops out),
# glow radius (art px)
FLAME = {
    "wall_torch": ("fire", [0, 0, 1, 0.5], True, 40), "standing_torch": ("fire", [0, 0, 1, 0.4], True, 40),
    "brazier_tall": ("fire", [0, 0, 1, 0.35], True, 40), "candelabra": ("fire", [0, 0, 1, 0.3], True, 26),
    "cauldron_fire": ("fire", [0, 0, 1, 1], False, 34), "sun_brazier": ("fire", [0.15, 0, 0.85, 0.42], True, 34),
    "fire_idol": ("fire", [0, 0, 1, 0.28], True, 34), "lava_vent": ("fire", [0, 0, 1, 1], False, 34),
    "magma_mound": ("fire", [0, 0, 1, 1], False, 40), "fiend_brazier": ("purple", [0, 0, 1, 0.55], True, 34),
    "cauldron_brew": ("green", [0, 0, 1, 0.6], False, 26), "mushrooms_glow": ("green", [0, 0, 1, 1], False, 26),
    "console": ("cyan", [0, 0, 1, 1], False, 26), "light_pylon": ("cyan", [0, 0, 1, 1], False, 34),
    "bog_lantern": ("lamp", [0, 0.2, 0.55, 0.62], False, 26),
}
HUES = {"fire": (0, 58), "purple": (255, 320), "green": (75, 150), "cyan": (175, 205), "lamp": (40, 75)}

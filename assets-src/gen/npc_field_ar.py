"""SPEC entries of the pass-AR NPC field sheets (AR-N renders, the user's picks and edit rulings of 2026-11-21), merged
into `npc_field_cut.SPEC`. Data only: the format is `npc_field_edit`'s docstring. Every render is a Stability
control-structure render in the content-addressed cache (keys below; model, seed and pass in the BR ledger); the
review sheets, guides and prompts are in ~/temp/ff-game/ar/npcs/ (README.md)."""
from __future__ import annotations

APPROVED_AR = "2026-11-21"


def S(alias: str, row: int = 0, cols=(0, 1, 2), mir=(0, 0, 0)) -> list:
    """One sheet row: cells `cols` of render row `row`, each mirrored where `mir` is 1."""
    return [[alias, row * 3 + c, bool(m)] for c, m in zip(cols, mir)]


H20 = {"holes": 20}            # enclosed background holes (between legs, under tails): colour distance 20
GB = [125, 35, 215, 1.0, 1.0]  # the dragon guard's green tabard -> the front's blue

AR_SPEC = {
    "luf_citizen_m": {
        "renders": {"s45_1": ["luf_citizen_m_s45_1", "46e38ffec5b8574939ba3cf8", 3],
                    "b45_1": ["luf_citizen_m_b45_1_old_man_up", "fce7e199b7f31c34e8e087ff", 1]},
        "cells": [S("s45_1"), S("b45_1", 0, (0, 2, 2), (0, 0, 1)), S("s45_1", 2)],
        "shifts": {1: [[212, 30, 190, 1.5, 1.3]]},
        "note": "AR-N luf_citizen_m A: s45_1 down + side (old_man guide, 0.45, seed 1); back = strip b45_1 cells 0, 2 "
                "+ 2 mirrored, its blue shifted to the teal (hue 212 -> 190, sat x1.5, val x1.3)"},
    "luf_citizen_f": {
        "renders": {"s55_2": ["luf_citizen_f_s55_2", "1023cccbd396c0fbef339aa2", 3],
                    "s55_1": ["luf_citizen_f_s55_1", "68ceacc844eded51c93b4858", 3]},
        "cells": [S("s55_2"), S("s55_2", 1, (1, 2, 2), (0, 0, 1)), S("s55_1", 2)],
        "edits": [],
        "note": "AR-N luf_citizen_f: A's down and up rows (s55_2, villager_f guide, 0.55, seed 2; its own back cells "
                "r1c2, r1c3) with B's side row (s55_1, seed 1), one shared palette (user ruling 2026-11-21: A's side "
                "walk misplaced the feet and dress and lost the hands)"},
    "luf_senator": {
        "renders": {"s50_2": ["luf_senator_s50_2", "f1f8db07e1ba17227c5ed12e", 3],
                    "b50_4": ["luf_senator_b50_4_old_man_up", "8cfc56a2fb9c527806dc703d", 1]},
        "cells": [S("s50_2"), S("b50_4", 0, (0, 2, 2), (0, 0, 1)), S("s50_2", 2)],
        "note": "AR-N luf_senator A: s50_2 down + side (old_man guide, 0.5, seed 2, round goggles); back strip b50_4 "
                "cells 0, 2 + 2 mirrored"},
    "dragon_guard": {
        "renders": {"s35_1": ["dragon_guard_s35_1", "8aef8873da1f0a63eff089fb", 3],
                    "b45_1": ["dragon_guard_b45_1_dragon_guard_up", "feff114e1e39424579adab34", 1],
                    "d45_1": ["dragon_guard_d45_1_dragon_guard_side", "ddc31fb309f0bbff5ad3ab58", 1]},
        "cut": {"s35_1": H20, "b45_1": H20, "d45_1": H20},
        "cells": [S("s35_1"), S("b45_1"), S("d45_1")],
        "shifts": {1: [GB], 2: [GB]},
        "note": "AR-N dragon_guard A: front s35_1 row 0 (dragon_guard guide, 0.35, seed 1); back strip b45_1; side "
                "strip d45_1; the back / side green tabard shifted to the front's blue (hue 125 -> 215)"},
    "dragon_elder": {
        "renders": {"s42_2": ["dragon_elder_s42_2", "1e3944160debcff5efd1e35f", 3],
                    "b45_2": ["dragon_elder_b45_2_dragon_elder_up", "005b069e56419c510b4ff3c8", 1],
                    "d45_1": ["dragon_elder_robed_d45_1_dragon_elder_side", "8fcf6115c55edcd81c2eb755", 1]},
        "cut": {"s42_2": {"tol": 30, "holes": 36}, "b45_2": H20, "d45_1": H20},
        "cells": [S("s42_2"), S("b45_2"), S("d45_1")],
        "note": "AR-N dragon_elder A: front s42_2 row 0 (dragon_elder guide, 0.42, seed 2); back strip b45_2; side "
                "strip robed d45_1"},
    "dragon_youth": {
        "renders": {"s42_2": ["dragon_youth_s42_2", "e4c758ec67328ad98e089363", 3],
                    "b45_1": ["dragon_youth_b45_1_dragon_youth_up", "42c8498b1ff417709f9279ea", 1],
                    "d45_1": ["dragon_youth_d45_1_dragon_youth_side", "9e425e394d1ebd53d4f396e6", 1]},
        "cut": {"s42_2": H20, "b45_1": H20, "d45_1": H20},
        "cells": [S("s42_2"), S("b45_1", 0, (1, 2, 2), (0, 0, 1)), S("d45_1", 0, (0, 1, 2), (0, 1, 1))],
        "shifts": {1: [[110, 30, 195, 1.0, 1.0]]},
        "edits": [{"op": "erase", "cell": [2, 0], "rects": [[32, 66, 48, 80]],
                   "why": "the tail segment sticking forward in the side stand frame"}],
        "note": "AR-N dragon_youth B: front s42_2 row 0 (dragon_youth guide, 0.42, seed 2); back b45_1 cells 1, 2 + 2 "
                "mirrored (green back panel shifted blue, hue 110 -> 195); side strip d45_1. User ruling 2026-11-21: the side row's frames 2 and 3 faced left, so they are "
                "mirrored (all three face right, the sheet's side direction); the side stand's forward tail segment "
                "is erased"},
    "robot_sentry": {
        "renders": {"s50_2": ["robot_sentry_s50_2", "eaa73b7562f60329b1e25c82", 3],
                    "b50_1": ["robot_sentry_b50_1_robot_knight_up", "ba60797eb87733d2865ad531", 1]},
        "cut": {"s50_2": H20, "b50_1": H20},
        "cells": [S("s50_2"), S("b50_1", 0, (0, 2, 2), (0, 0, 1)), S("s50_2", 2)],
        "edits": [{"op": "ramp", "cells": [[1, 0], [1, 1], [1, 2]], "match": {"hue": [330, 30], "smin": 0.45},
                   "to": {"cells": [[1, 0], [1, 1], [1, 2]], "smax": 0.32, "vmin": 0.12}, "mode": "nearest",
                   "why": "the back row's red visor and vents -> the figure's own grey ramp"},
                  {"op": "fill", "cell": [1, 0], "rect": [10, 14, 38, 26], "color": "#737b8c",
                   "why": "the see-through eye slots of the back stand's visor -> robot grey"}],
        "note": "AR-N robot_sentry B: s50_2 down + side (knight + antenna guide, 0.5, seed 2); back strip b50_1 cells "
                "0, 2 + 2 mirrored. User ruling 2026-11-21: B instead of A; the back row's red visor recoloured to "
                "the figure's own grey"},
    "robot_ancient": {
        "renders": {"s50_1": ["robot_ancient2_s50_1", "b17a82a4b94a637b57ca16de", 3],
                    "b50_2": ["robot_ancient2_b50_2_knight_up", "5495bcf0e9c6bde34f0d68bd", 1],
                    "d65_3": ["robot_ancient3_v1_d65_3_knight_side", "a2164dec4999f32b063f64e0", 1]},
        "cut": {"s50_1": H20, "b50_2": H20, "d65_3": {"tol": 34, "holes": 40}},
        "cells": [S("s50_1"), S("b50_2"), S("d65_3")],
        "shifts": {1: [[120, 30, 165, 0.85, 1.0]], 2: [[32, 14, 24, 0.95, 0.62, 0.3]]},
        "approved": "2026-11-22",
        "note": "AR-N2 robot_ancient C2: A's down row (robot_ancient2 s50_1, knight guide, 0.5, seed 1) and back strip "
                "b50_2 (seed 2; its green shifted to verdigris, hue 120 -> 165, sat x0.85), with a true-profile "
                "walking side strip d65_3 (knight_side guide, 0.65, seed 3; flood tol 34, holes 40) whose orange "
                "accents are shifted to rusty bronze (hue 32 -> 24, sat x0.95, val x0.62). User ruling 2026-11-22: "
                "integrate C2"},
    "sage_star": {
        "renders": {"s50_1": ["sage_star_s50_1", "851bb2f371b5dfe10764fae2", 3],
                    "b50_1": ["sage_star_b50_1_mage_up", "7e6b4d5c4a91a1a81fd5d95a", 1]},
        "cells": [S("s50_1"), S("b50_1", 0, (0, 2, 2), (0, 0, 1)), S("s50_1", 2)],
        "note": "AR-N sage_star A: s50_1 (mage guide, 0.5, seed 1; blue cone hat, gold stars); back strip b50_1 cells "
                "0, 2 + 2 mirrored. Its side frames turn the head but do not walk: fine while the Crescent sages "
                "stand still; do not give it `wander` unless the side row is regenerated"},
    "sage_earth": {
        "renders": {"s50_1": ["sage_earth_s50_1", "30ae4a9d7bb4c096751bdf01", 3],
                    "b50_1": ["sage_earth_b50_1_white_wizard_up", "d3056cadd65400cd40f1a595", 1]},
        "cells": [S("s50_1"), S("b50_1"), S("s50_1", 2)],
        "note": "AR-N sage_earth B: s50_1 (white_wizard guide, 0.5, seed 1; green hood); back strip b50_1"},
    "sage_flame": {
        "renders": {"s50_2": ["sage_flame_s50_2", "48a87a00a3151d10ee9e8cd0", 3]},
        "cells": [S("s50_2"), S("s50_2", 1, (1, 2, 2), (0, 0, 1)), S("s50_2", 2)],
        "note": "AR-N sage_flame A: s50_2 (old_man guide, 0.5, seed 2; bald, wide robe); its own back cells r1c2, r1c3"},
    "dr_unne": {
        "renders": {"s50_1": ["dr_unne_s50_1", "29dc17e130a89fac826a5b43", 3],
                    "b50_3": ["dr_unne_b50_3_burgher_up", "7cc6dfe78dd000fcb4bd078c", 1]},
        "cells": [S("s50_1", 0, (0, 2, 2), (0, 0, 1)), S("b50_3"), S("s50_1", 2)],
        "edits": [{"op": "ramp", "cells": [[2, 1], [2, 2]], "rect": [15, 34, 46, 68],
                   "match": {"hue": [5, 40], "smin": 0.6, "vmin": 0.2, "vmax": 0.6},
                   "to": {"cells": [[0, 0], [0, 1], [0, 2]], "hue": [100, 140], "smin": 0.4, "vmin": 0.15, "vmax": 0.42},
                   "mode": "rank", "why": "the side steps' brown waistcoat -> the coat's green ramp"},
                  {"op": "ramp", "cells": [[1, 0]], "rect": [17, 46, 31, 78],
                   "match": {"hue": [90, 160], "smin": 0.4},
                   "to": {"cells": [[1, 1], [1, 2]], "smax": 0.28, "vmin": 0.6, "vmax": 0.95},
                   "mode": "rank", "why": "the green stripe down the back stand's white coat -> the coat's white ramp"}],
        "note": "AR-N dr_unne B: s50_1 down cells 0, 2 + 2 mirrored (burgher guide, 0.5, seed 1; green coat), side "
                "row 2; back strip b50_3. User ruling 2026-11-21: B, not A; one green jacket in every frame (the "
                "side steps' brown waistcoat recoloured), no green stripe on the back stand"},
}

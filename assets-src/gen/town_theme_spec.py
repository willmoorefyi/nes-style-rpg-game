"""The approved town-theme cuts (pass AR: AR-W's renders, AR-W2's re-renders; user rulings 2026-11-21, see
docs/TOWN_THEMES.md). One entry per sheet `approved/town/theme_<town>`; every render is read from the cache by key.

  house:  (render id, key, strength, {crops, plain_band, tint_ref, flat_roof}) a 5x5 2-storey module render ->
          <part>@<theme>; flat_roof: a roof style of the eave's cornice only (a dome cannot repeat across a width)
  tints:  {style: (hue, sat, val) | ('abs', hue, sat, val)} wall-colour variants of the theme's wall cells
  patch:  {part: (render id, key, w, h, col, row)} a cell taken from another module render (Melmond's boarded window)
  grids:  [(name, render id, key, strength, (w, h), one_storey?[, opt])] i2i renders on the grid cut whole into
          <name>_<r>_<c> (the inn prefab inn_<theme>, whole-house prefabs, the market hall); one_storey adds <name>4
          (5x4); opt {clean: {...}} repaints hairline cracks (town_theme_clean.py; also a house option)
  derived:[(name, grid name, (x0, y0, x1, y1) native px of its cut, (w, h))] a piece of a grid cut shrunk to w x h cells
          (town_theme_clean.shrink; its colours only), cells <name>_<r>_<c>
  sprites:[(name, render id, key, (w, h), cut, pix)] Ultra sprites -> <name>_<r>_<c>; name 'chimney@<s>' is one cell
  props:  [(render id, key, [(name, (w, h)), ...], cut)] a sheet split into its figures, left to right
  mats:   [(name, render id, key, kind, settings)] materials: 'swatch' (a seamless crop, box fractions) or 'deck'
"""
INN = (4, 5)
H5 = (5, 5)
TOWNS = {
    "cornelia": dict(
        theme="cor_timber", house=("cor_house", "82bce45522034f727a9c3feb", 0.76, {}),
        tints={"cor_timber_ochre": (-14, 1.6, 0.95), "cor_timber_rose": (-30, 1.3, 0.97)},
        grids=[("inn_cor_timber", "cor_inn", "6ec4d5d8f350daf0e7163051", 0.78, INN, False),
               ("cor_hall", "cor_hall4", "bd6a3f8bf1f65e65383dea8b", 0.74, (4, 4), False)],
        props=[("cor_props", "aaa733a7b25009a328824f8c",
                [("cor_haycart", (2, 2)), ("cor_well", (2, 2)), ("cor_shed", (2, 2)), ("cor_board", (2, 1))], {})]),
    "pravoka": dict(
        theme="pra_tar", house=("pra_house4", "a934d294777dd1482caff3de", 0.74,
                                {"crops": {"wall_up_window": [40, 124], "wall_up_l": [0, 96], "wall_up_r": [192, 96]},
                                 "plain_band": [48, 100, 18], "tint_ref": "wall_up_plain"}),
        tints={"pra_tar_drift": (0, 0.6, 1.6), "pra_tar_red": (-10, 1.4, 1.25)},
        grids=[("inn_pra_tar", "pra_inn", "1a8425ba2e882d9bec1da57e", 0.78, INN, False),
               ("pra_house_a", "pra_house2", "efb603c875775a9dcec23357", 0.82, H5, True)],
        sprites=[("pra_tavern", "pra_tavern", "42a474c49cb2bd30613debc3", (5, 4), {}, {})],
        props=[("pra_stalls", "db8fde8bf8a3f7a5bbdab1ad",
                [("pra_stall", (2, 2)), ("pra_cargo", (2, 1))], {})]),
    "elfheim": dict(
        theme="elf_moon", house=("elf_house", "90c2e7c3239765262748966f", 0.76, {}),
        tints={"elf_moon_jade": ("abs", 150, 0.16, 0.97), "elf_moon_lilac": ("abs", 270, 0.13, 1.0)},
        grids=[("inn_elf_moon", "elf_inn", "d57f913959ce729bb9bdb5c9", 0.78, INN, False)],
        sprites=[("elf_tree", "elf_tree", "a772d824cfbfcab933554783", (3, 4), {}, {})],
        props=[("elf_props", "03f2b4cf72682cd59bb7889a", [("elf_lamp", (1, 2)), ("elf_pool", (2, 1))], {}),
               ("elf_props2", "bce0fa0a0adb066797f02942", [("elf_moongate", (2, 2))], {})]),
    "melmond": dict(
        theme="mel_siege", house=("mel_house2", "a1a42d031c0532730733a57a", 0.8, {}),
        patch={"wall_up_window": ("mel_inn", "2ae53aa0b7681fd45918e013", 4, 5, 2, 2),
               "wall_up2_window": ("mel_inn", "2ae53aa0b7681fd45918e013", 4, 5, 2, 2)},
        tints={"mel_siege_ash": (0, 0.3, 1.2), "mel_siege_rot": (10, 1.1, 0.8)},
        grids=[("inn_mel_siege", "mel_inn", "2ae53aa0b7681fd45918e013", 0.78, INN, False)],
        sprites=[("mel_barricade", "mel_barricade", "88e21abd54a51749aeb6147d", (3, 2), {"pocket": 5}, {})],
        props=[("mel_props", "1dfac1c274994669efab59a7",
                [("mel_cross", (1, 1)), ("mel_stone", (1, 1)), ("mel_brazier", (1, 1))], {})]),
    "crescent": dict(
        theme="cre_venice", house=("cre_house_i2", "273291777c6b0f5ff8e95f53", 0.76, {}),
        tints={"cre_venice_ochre": (25, 1.6, 1.05), "cre_venice_sienna": (8, 1.4, 0.9)},
        grids=[("inn_cre_venice", "cre_inn", "e19d2a12f5b8caabe2dbb717", 0.78, INN, False)],
        props=[("cre_gondola", "8a19fdb5208b4174626c9fd9",
                [("cre_gondola", (2, 2)), ("cre_gondola2", (1, 2)), ("cre_wellhead", (1, 2))], {}),
               ("cre_chimney", "54e83509b6680c7749c0397b", [("chimney@cre_venice", (1, 1))], {"base_y": 0.5})],
        mats=[("cre_bridge_v", "cre_bridge3", "b13a4ddd1a4fac7c901dcbcd", "deck", {"strength": 0.7, "cells": (2, 4)})]),
    "dwarf": dict(
        theme=None,
        sprites=[("dwf_king", "dwf_statue", "488956422acaa44362bceb4d", (1, 2), {}, {}),
                 ("dwf_cart", "dwf_cart", "c31373434ff2481933c7f320", (2, 2), {}, {})],
        props=[("dwf_props", "c821f9c8fda048a11e782ac7",
                [("dwf_forge", (2, 2)), ("dwf_pillar", (1, 2)), ("dwf_pillar_slim", (1, 2)), ("dwf_anvil", (1, 1))], {})],
        mats=[("dwf_wall", "dwf_wall", "afa167b6666cfb6335c96fb8", "swatch", {"box": (0, 0.30, 1, 1)})]),
    "lufenia": dict(       # AR-W3 (user ruling 2026-11-22): stucco townhouse modules under a terracotta roof that
        # repeats across any width (the elder's 8-wide hall), two gold-ribbed domed villas, the ribbed rotunda inn
        theme="luf_roman", house=("luf3_modular2", "0b283fbef7ea5a55b178b953", 0.55, {"clean": {}}),
        tints={"luf_roman_azure": (200, 0.4, 0.97)},
        grids=[("inn_luf_roman", "luf3_rotunda2", "dada28b923fc100f95415064", 0.6, INN, False, {"clean": {}}),
               ("luf_villa_t", "luf3_villa_t2", "2f1ffbb1e7bb82a9b3e975fd", 0.6, H5, True, {"clean": {}}),
               ("luf_villa_m", "luf3_villa_m2", "8baff5d3e408492c3154af34", 0.6, H5, True, {"clean": {}})],
        derived=[("luf_cupola", "luf_villa_t", (14, 0, 226, 92), (2, 1))],     # the elder hall's dome cap
        sprites=[("luf_forum", "luf_forum", "00b694d65b48f5307191d8ad", (2, 3), {}, {})],
        props=[("luf_props", "9e1acb27791b2c61b7d2c724", [("luf_pylon", (1, 2))], {}),
               ("luf_props2", "15994cab6612f245f65a8c4b", [("luf_legionary", (1, 2)), ("luf_aqueduct", (3, 2))], {})]),
    "onrac": dict(
        theme="onr_coral", house=("onr_house", "dec92ebee967a9ac4bf73822", 0.76, {}),
        tints={"onr_coral_pink": ("abs", 10, 0.2, 0.98), "onr_coral_sea": ("abs", 170, 0.22, 0.95)},
        grids=[("inn_onr_coral", "onr_inn", "be36fb4eac6ac51d1cbfb7ea", 0.78, INN, False)],
        props=[("onr_props", "23bbf4b1138c30300d18d63e",
                [("onr_netrack", (1, 2)), ("onr_shells", (1, 1)), ("onr_lantern", (1, 2))], {})]),
    "gaia": dict(
        theme="gai_turf", house=("gai_house", "150c6d2834d38223a4b79b77", 0.76, {}),
        tints={"gai_turf_slate": (200, 0.6, 0.9), "gai_turf_sand": (25, 1.4, 1.1)},
        grids=[("inn_gai_turf", "gai_inn", "860b7cf705c92c4b8b211362", 0.78, INN, False)],
        sprites=[("gai_kite", "gai_kite2", "5f5664c49bd24ee655a5dcef", (2, 3), {"green_y": 0.72}, {})],
        props=[("gai_props", "b8e5c1ea89447b8ed57eca08",
                [("gai_flagpole", (1, 3)), ("gai_glass", (1, 2)), ("gai_shrine", (1, 2))], {})]),
}

"""The doors of the regions outside act 1, frozen from pass W's 192x192 world source at the NW cutover
(docs/NATURAL_WORLD_PLAN.md 3.3, 7; NW-5). Generated once by NW-5 from `assets-src/maps/overworld.yaml` as it stood at
`mainline` bf8afef9 (pass W's world); the file is the source now (that world source is the NW world since NW-5).

`ENTRANCES`: each entrance outside act 1 at its pass-W cell; `TRANSITIONS`: each overworld transition whose nearest
entrance (within 1 step) lies outside act 1, in pass W's order, with that entrance as `_entrance`. Only the offset of a
transition from its entrance is used: the composer moves each transition with its entrance (`world_source.py`).
"""

ENTRANCES = {'elf_keep': [60, 125],
 'elf_marsh': [53, 162],
 'elf_elfheim': [82, 150],
 'ert_dwarf': [55, 104],
 'ert_melmond': [42, 112],
 'ert_earth_cave': [30, 126],
 'ert_giant': [28, 112],
 'ert_giant_west': [23, 112],
 'ert_sarda': [19, 109],
 'fir_crescent': [148, 124],
 'fir_volcano': [120, 151],
 'fir_ice': [136, 149],
 'fir_desert': [143, 160],
 'ord_citadel': [75, 28],
 'ord_bahamut': [106, 53],
 'ord_meadow': [75, 32],
 'ord_isle_hermit': [118, 41],
 'ord_isle_north': [103, 39],
 'ord_isle_east': [121, 54],
 'ord_isle_stack': [110, 43],
 'ord_isle_west': [95, 56],
 'wat_onrac': [28, 39],
 'wat_waterfall': [30, 11],
 'wat_caravan': [8, 28],
 'wnd_gaia': [150, 14],
 'wnd_mirage': [132, 37],
 'wnd_lufenia': [152, 46]}

TRANSITIONS = [{'x': 60, 'y': 124, 'targetMap': 'western-keep-1f', 'targetEntrance': 'arrival', '_entrance': 'elf_keep'},
 {'x': 53, 'y': 161, 'targetMap': 'marsh-cave-b1', 'targetEntrance': 'arrival', '_entrance': 'elf_marsh'},
 {'x': 82, 'y': 151, 'targetMap': 'elfheim', 'targetEntrance': 'gate', '_entrance': 'elf_elfheim'},
 {'x': 55, 'y': 103, 'targetMap': 'dwarf-hall', 'targetEntrance': 'arrival', '_entrance': 'ert_dwarf'},
 {'x': 41, 'y': 112, 'targetMap': 'melmond', 'targetEntrance': 'gate', '_entrance': 'ert_melmond'},
 {'x': 30, 'y': 125, 'targetMap': 'cavern-earth-b1', 'targetEntrance': 'arrival', '_entrance': 'ert_earth_cave'},
 {'x': 28, 'y': 111, 'targetMap': 'giant-tunnel', 'targetEntrance': 'arrival', '_entrance': 'ert_giant'},
 {'x': 23, 'y': 111, 'targetMap': 'giant-tunnel', 'targetEntrance': 'west', '_entrance': 'ert_giant_west'},
 {'x': 19, 'y': 108, 'targetMap': 'sage-cave', 'targetEntrance': 'arrival', '_entrance': 'ert_sarda'},
 {'x': 149, 'y': 124, 'targetMap': 'crescent', 'targetEntrance': 'gate', '_entrance': 'fir_crescent'},
 {'x': 120, 'y': 150, 'targetMap': 'gurgu-b1', 'targetEntrance': 'arrival', '_entrance': 'fir_volcano'},
 {'x': 136, 'y': 148, 'targetMap': 'ice-cavern-b1', 'targetEntrance': 'arrival', '_entrance': 'fir_ice'},
 {'x': 75, 'y': 27, 'targetMap': 'citadel-1f', 'targetEntrance': 'arrival', '_entrance': 'ord_citadel'},
 {'x': 106, 'y': 52, 'targetMap': 'bahamut-cave', 'targetEntrance': 'arrival', '_entrance': 'ord_bahamut'},
 {'x': 28, 'y': 38, 'targetMap': 'onrac', 'targetEntrance': 'gate', '_entrance': 'wat_onrac'},
 {'x': 30, 'y': 10, 'targetMap': 'waterfall-cave', 'targetEntrance': 'arrival', '_entrance': 'wat_waterfall'},
 {'x': 8, 'y': 27, 'targetMap': 'caravan-camp', 'targetEntrance': 'arrival', '_entrance': 'wat_caravan'},
 {'x': 150, 'y': 13, 'targetMap': 'gaia', 'targetEntrance': 'gate', '_entrance': 'wnd_gaia'},
 {'x': 132, 'y': 36, 'targetMap': 'mirage-1f', 'targetEntrance': 'arrival', '_entrance': 'wnd_mirage'},
 {'x': 152, 'y': 45, 'targetMap': 'lufenia', 'targetEntrance': 'gate', '_entrance': 'wnd_lufenia'}]

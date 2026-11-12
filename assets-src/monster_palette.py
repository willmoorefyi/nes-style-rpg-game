"""6-tone, hue-shifted 5-bit ramps for monsters (index 0 darkest -> 5 brightest).

Shadows lean cool (blue/purple), lights lean warm; bases are slightly desaturated so the
few saturated accents (eyes, gems, blood-red cloth) pop. Every key colour is 5-bit.
"""
from mon_engine import ramp6
from snes_palette import c15

GOBLIN = ramp6((3, 5, 9), (9, 16, 8), (22, 27, 13))
SKIN = ramp6((8, 4, 9), (21, 14, 11), (31, 26, 19))
LEATHER = ramp6((3, 2, 5), (13, 8, 6), (25, 18, 11))
IRON = ramp6((2, 3, 8), (13, 15, 20), (28, 29, 28))
BONE = ramp6((6, 5, 10), (20, 18, 16), (31, 30, 25))
FUR = ramp6((3, 3, 7), (11, 10, 12), (24, 22, 20))
FUR_LIGHT = ramp6((7, 7, 11), (17, 16, 17), (29, 28, 26))
OGRE = ramp6((6, 2, 6), (19, 11, 9), (30, 24, 17))
TROLL = ramp6((2, 4, 9), (8, 15, 13), (20, 26, 18))
WRAP = ramp6((7, 5, 9), (20, 17, 14), (31, 29, 23))
RED = ramp6((5, 1, 5), (18, 5, 6), (30, 15, 12))
BLUE = ramp6((2, 2, 8), (7, 10, 18), (17, 21, 28))
PALE = ramp6((8, 6, 13), (22, 20, 23), (31, 30, 29))
PURPLE = ramp6((2, 1, 6), (10, 5, 15), (21, 13, 25))
CRIMSON = ramp6((4, 1, 5), (15, 3, 7), (27, 11, 12))
DRAGON = ramp6((3, 1, 6), (14, 4, 6), (27, 13, 9))
BELLY = ramp6((10, 5, 6), (24, 17, 9), (31, 28, 17))
DARKARMOR = ramp6((0, 0, 3), (4, 4, 10), (14, 14, 23))
GOLD = ramp6((5, 2, 3), (21, 15, 3), (31, 29, 13))
TEAL = ramp6((1, 3, 8), (4, 14, 16), (14, 26, 24))
NECRO = ramp6((1, 4, 5), (4, 16, 9), (19, 31, 20))
ROBE = ramp6((1, 1, 5), (7, 4, 12), (16, 11, 22))
CLOTHDK = ramp6((1, 1, 4), (5, 4, 8), (12, 11, 15))
WOOD = ramp6((3, 2, 3), (14, 8, 5), (26, 19, 11))
LEAF = ramp6((1, 3, 6), (5, 14, 8), (14, 25, 10))

EYE_RED = c15(31, 6, 4)
EYE_YEL = c15(31, 27, 6)
EYE_GRN = c15(20, 31, 12)
EYE_AMB = c15(31, 20, 4)
WHITE = c15(31, 31, 30)
BLACK = c15(1, 1, 3)
SHADOW = c15(2, 2, 5)

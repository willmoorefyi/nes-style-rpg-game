"""SNES-style 15-bit (BGR555) color helpers and shared color ramps.

Every color in the game is defined as 5-bit-per-channel values (0-31), exactly
as the SNES PPU stores them, then expanded to 8-bit RGB for PNG output.
Ramps run darkest -> lightest, with light assumed to come from the top-left.
"""

Color = tuple[int, int, int]


def c15(r: int, g: int, b: int) -> Color:
    """Convert 5-bit channels (0-31) to 8-bit RGB the way hardware-accurate converters do."""
    for v in (r, g, b):
        if not 0 <= v <= 31:
            raise ValueError(f"5-bit channel out of range: {(r, g, b)}")
    return ((r << 3) | (r >> 2), (g << 3) | (g >> 2), (b << 3) | (b >> 2))


def ramp(*triples: tuple[int, int, int]) -> list[Color]:
    return [c15(*t) for t in triples]


# Index 0 = darkest outline shade, last = brightest highlight.
GRASS = ramp((5, 11, 5), (7, 15, 6), (10, 20, 7), (14, 24, 9), (19, 28, 12))
WATER = ramp((3, 8, 18), (4, 12, 23), (6, 16, 27), (11, 22, 30), (21, 29, 31))
SAND = ramp((19, 14, 8), (23, 18, 10), (27, 23, 13), (29, 26, 17), (31, 29, 22))
STONE = ramp((4, 4, 8), (8, 8, 13), (13, 13, 18), (18, 18, 23), (25, 25, 28))
ROCK = ramp((5, 3, 3), (10, 6, 5), (15, 10, 7), (20, 15, 10), (26, 21, 15))
DIRT = ramp((9, 6, 3), (14, 10, 5), (19, 14, 8), (23, 18, 11), (27, 22, 15))
WOOD = ramp((6, 3, 2), (11, 6, 3), (16, 10, 5), (21, 15, 8), (27, 21, 12))
LEAF = ramp((2, 6, 5), (3, 10, 6), (5, 15, 7), (9, 20, 8), (14, 25, 10))
SWAMP = ramp((3, 6, 5), (5, 10, 7), (8, 14, 8), (12, 18, 10), (16, 22, 12))
MURK = ramp((3, 7, 9), (4, 10, 12), (6, 14, 16), (9, 18, 19), (13, 22, 22))
SNOW = ramp((16, 18, 24), (21, 23, 28), (26, 28, 31), (29, 30, 31), (31, 31, 31))

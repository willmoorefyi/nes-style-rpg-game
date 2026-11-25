"""EF-G amendment B0: `monster_hr_br.py nobg <id>`, one Stability Remove Background request on the sprite's prep source
raw (the pirate's EF3 v3 render, whose teal gradient page no colour key can tell from the teal-lit costume), through
bedrock.invoke("remove_bg", ..., purpose="ef6_nobg") (the body of landmark_cut.py's nobg); the returned cache key is
recorded as `<id>.prep.nobg_key` in monster_hr.yaml, read by `prep.key: remove_bg` (gen/monster_hr_prep_nobg.py).
A cache hit is free and needs no --paid; the paid call is made by the orchestrator session only."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

from gen import bedrock as B

PURPOSE = "ef6_nobg"


def body(raw: Image.Image) -> dict:
    return {"image": B.png_b64(raw.convert("RGB")), "output_format": "png"}


def nobg(sid: str, sp: dict, paid: bool, invoke=None, raw: Image.Image | None = None, path: Path | None = None) -> str:
    from gen.monster_hr_yaml import record_prep
    raw = raw or Image.open(B.CACHE / f"{sp['sprites'][sid]['prep']['source']}.png")
    b = body(raw)
    (invoke or B.invoke)("remove_bg", b, paid=paid, purpose=PURPOSE)   # `invoke` looks up MODELS itself
    key = B.cache_key("remove_bg", b)
    record_prep(sid, "nobg_key", key, path)
    return key

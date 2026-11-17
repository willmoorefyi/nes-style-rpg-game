"""Google Gemini image backend ("Nano Banana" family) with the same response cache as bedrock.py.

The API key is read from GEMINI_API_KEY (environment or the repo's git-ignored .env). It is never
printed, logged, or written to the cache metadata.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
CACHE = HERE / "cache"
DEFAULT_MODEL = "gemini-3.1-flash-lite-image"

_client = None
LAST_USAGE: dict = {}           # the usage_metadata token counts of the last uncached call (pass KA-G records them)


def _load_env() -> None:
    env = REPO / ".env"
    if "GEMINI_API_KEY" in os.environ or not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def client():
    global _client
    if _client is None:
        _load_env()
        key = os.environ.get("GEMINI_API_KEY")
        if not key:
            raise SystemExit("GEMINI_API_KEY is not set (add it to .env in the repo root)")
        from google import genai
        _client = genai.Client(api_key=key)
    return _client


def _png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "PNG")
    return buf.getvalue()


def cache_key(prompt: str, images: list[Image.Image], *, aspect_ratio: str, seed: int, model: str = DEFAULT_MODEL,
              image_size: str | None = None) -> str:
    """`image_size` enters the key only when it is set, so every older key is unchanged (pass KA-G)."""
    h = hashlib.sha256()
    h.update(json.dumps({"backend": "gemini", "model": model, "prompt": prompt, "aspect": aspect_ratio, "seed": seed,
                         **({"image_size": image_size} if image_size else {})}).encode())
    for im in images:
        h.update(hashlib.sha256(_png_bytes(im)).digest())
    return h.hexdigest()[:24]


def is_cached(key: str) -> bool:
    return (CACHE / f"{key}.png").exists()


def generate(prompt: str, images: list[Image.Image], *, aspect_ratio: str, seed: int,
             model: str = DEFAULT_MODEL, image_size: str | None = None) -> Image.Image:
    """Text + reference images in, one image out. Cached by a hash of every input."""
    CACHE.mkdir(exist_ok=True)
    LAST_USAGE.clear()
    blobs = [_png_bytes(im) for im in images]
    key = cache_key(prompt, images, aspect_ratio=aspect_ratio, seed=seed, model=model, image_size=image_size)
    path = CACHE / f"{key}.png"
    if path.exists():
        return Image.open(path).convert("RGBA")

    from google.genai import types
    parts = [types.Part.from_bytes(data=b, mime_type="image/png") for b in blobs] + [types.Part.from_text(text=prompt)]
    config = types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio=aspect_ratio,
                                       **({"image_size": image_size} if image_size else {})),
        seed=seed,
    )
    from google.genai import errors
    try:
        resp = client().models.generate_content(model=model, contents=parts, config=config)
    except errors.ClientError as err:
        if err.code == 429 and "free_tier" in str(err) and "limit: 0" in str(err):
            raise SystemExit(f"{model} has no free-tier quota (limit 0). Enable billing on the Google project that owns "
                             "this API key: aistudio.google.com -> API keys -> set up billing. Then rerun.") from None
        if err.code == 429:
            raise SystemExit(f"{model} rate limit hit; wait and rerun (cached sheets are not re-requested). "
                             f"Details: {err.message}") from None
        raise
    um = getattr(resp, "usage_metadata", None)
    for k in ("prompt_token_count", "candidates_token_count", "thoughts_token_count", "total_token_count"):
        if um is not None and getattr(um, k, None) is not None:
            LAST_USAGE[k] = getattr(um, k)
    image = None
    notes = []
    for cand in resp.candidates or []:
        for part in (cand.content.parts if cand.content else []) or []:
            if part.inline_data and part.inline_data.data:
                image = Image.open(io.BytesIO(part.inline_data.data)).convert("RGBA")
            elif part.text:
                notes.append(part.text)
        if cand.finish_reason and image is None:
            notes.append(f"finish_reason={cand.finish_reason}")
    if image is None:
        raise RuntimeError(f"{model} returned no image: {' | '.join(notes) or resp.prompt_feedback}")
    image.save(path)
    (CACHE / f"{key}.json").write_text(json.dumps({"backend": "gemini", "model": model, "seed": seed,
                                                    "aspect": aspect_ratio, "prompt": prompt,
                                                    **({"image_size": image_size} if image_size else {})}, indent=2))
    return image

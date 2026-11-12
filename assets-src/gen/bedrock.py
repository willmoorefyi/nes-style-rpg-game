"""Minimal Stability-on-Bedrock client with a content-addressed response cache.

Every request body is hashed; the decoded PNG is stored under assets-src/gen/cache/<hash>.png.
Re-running with the same prompt, seed and guide image is free and returns identical pixels,
which is what makes the pipeline repeatable.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
from pathlib import Path

import boto3
from PIL import Image

CACHE = Path(__file__).resolve().parent / "cache"
REGION = "us-west-2"
PROFILE = "bedrock"

MODELS = {
    "structure": "us.stability.stable-image-control-structure-v1:0",
    "ultra": "stability.stable-image-ultra-v1:1",
    "core": "stability.stable-image-core-v1:1",
    "sd35": "stability.sd3-5-large-v1:0",
    "style_guide": "us.stability.stable-image-style-guide-v1:0",
    "remove_bg": "us.stability.stable-image-remove-background-v1:0",
    "search_replace": "us.stability.stable-image-search-replace-v1:0",
}

_client = None


def client():
    global _client
    if _client is None:
        _client = boto3.Session(profile_name=PROFILE, region_name=REGION).client("bedrock-runtime")
    return _client


def png_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def cache_key(model: str, body: dict) -> str:
    return hashlib.sha256(json.dumps({"model": model, "body": body}, sort_keys=True).encode()).hexdigest()[:24]


def is_cached(key: str) -> bool:
    return (CACHE / f"{key}.png").exists()


def invoke(model: str, body: dict, *, model_ids: tuple[str, ...] | None = None) -> Image.Image:
    CACHE.mkdir(exist_ok=True)
    key = cache_key(model, body)
    path = CACHE / f"{key}.png"
    if path.exists():
        return Image.open(path).convert("RGBA")
    ids = model_ids or (MODELS[model], MODELS[model].removeprefix("us."))
    last: Exception | None = None
    for mid in ids:
        try:
            resp = client().invoke_model(modelId=mid, body=json.dumps(body), accept="application/json",
                                         contentType="application/json")
            break
        except client().exceptions.ValidationException as err:   # e.g. inference-profile id not accepted
            last = err
    else:
        raise RuntimeError(f"Bedrock rejected every model id for {model}: {last}")
    out = json.loads(resp["body"].read())
    reasons = out.get("finish_reasons") or [None]
    if reasons[0] not in (None, "SUCCESS"):
        raise RuntimeError(f"{model} finished with {reasons[0]} (content filter or error)")
    img = Image.open(io.BytesIO(base64.b64decode(out["images"][0]))).convert("RGBA")
    img.save(path)
    (CACHE / f"{key}.json").write_text(json.dumps({"model": model, "seed": body.get("seed"), "prompt": body.get("prompt")}, indent=2))
    return img

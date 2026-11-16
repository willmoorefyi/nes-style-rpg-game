"""Pass C rev 4 gate self-tests (docs/CHAOS_FORMS_PLAN.md 18.2, 18.9, B7, 5.5; FW-C, 0 paid: mocked client), run by
selftest_colossus.run_colossus: the painted FORMS (F3 2700x1080 at scale 1, F2 1320x900; `pix` gone), `colossus.py
upscale --form` (purposes f3_upscale / f2_upscale, the fit to exactly the canvas after the call, the stop when the
output is narrower, 4 pad rows for a source over 2.5:1), the reserve cost rule in the gate and in budget --check
(reserve calls <= $0.08: no upscale from the reserve), and the archive step: retire.py --colossus as chaos_horizon_v1 /
chaos_orrery_v1, then approve with extras, which drops the archived rev-3 files and refuses unarchived ones.
"""
from __future__ import annotations

import base64
import contextlib
import io
import json
import tempfile
from pathlib import Path

from PIL import Image

from gen.selftest_colossus import (_FakeClient, _budget, _fake_rows, _main, _refused, _rows, sandbox,  # noqa: F401
                                   sections)


class _SizedClient(_FakeClient):
    """Answers with the request image upscaled `k` times (nearest), like a model-sized upscale."""

    def __init__(self, k: float):
        super().__init__()
        self.k = k

    def invoke_model(self, modelId, body, accept, contentType):     # noqa: N803 (boto3 names)
        from gen import bedrock as B
        self.calls.append(modelId)
        self.bodies.append(json.loads(body))
        src = Image.open(io.BytesIO(base64.b64decode(self.bodies[-1]["image"])))
        out = src.resize((round(src.width * self.k), round(src.height * self.k)), Image.Resampling.NEAREST)
        return {"body": io.BytesIO(json.dumps({"images": [B.png_b64(out)], "finish_reasons": ["SUCCESS"]}).encode())}


def run_gate(check) -> None:
    sections(check, _forms, _upscale_form, _reserve_rule, _archive)


def _forms(check) -> None:
    from gen import colossus as C
    f3, f2 = C.FORMS["chaos_horizon"], C.FORMS["chaos_orrery"]
    check(f3["canvas"] == (2700, 1080) and f3["place"] == (-527, -210) and f3["upscale"] == "f3_upscale"
          and f2["canvas"] == (1320, 900) and f2["place"] == (40, -20) and f2["upscale"] == "f2_upscale"
          and f3["sky_dim"] == 0.6 and f2["sky_dim"] == 1.0,
          "FORMS: F3 2700x1080 at (-527, -210), sky dim 0.6; F2 1320x900 at (40, -20); upscale purposes (18.4, 18.2)")
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        code, out = _main(C, ["pix", "chaos_horizon", "x.png"])
    check(code is None and "invalid choice" in err.getvalue(), "colossus.py: the rev-3 pix step is gone (D-U10)")


def _up_argv(src: Path, *extra: str) -> list[str]:
    return ["upscale", str(src), "--model", "conservative", "--prompt", "painted colossus, keep every detail",
            "--seed", "5", "--creativity", "0.2", *extra]


def _upscale_form(check) -> None:
    from gen import colossus as C
    real = _budget()
    with sandbox(real, client=_SizedClient(2.0)) as (B, tmp, cl):
        src = tmp / "s2_raw.png"
        Image.new("RGB", (1800, 720), (40, 30, 60)).save(src)
        code, out = _main(C, _up_argv(src, "--form", "chaos_horizon", "--paid"))
        fit = tmp / "s2_raw_up_conservative_5_fit.png"
        side = json.loads(fit.with_suffix(".json").read_text()) if fit.exists() else {}
        check(code == 0 and _rows(B)[0]["purpose"] == "f3_upscale" and fit.exists()
              and Image.open(fit).size == (2700, 1080) and side.get("upscaled_size") == [3600, 1440]
              and side.get("pad_rows") == 0,
              f"upscale --form chaos_horizon: purpose f3_upscale; the 3600x1440 output Lanczos-fit to exactly 2700x1080 "
              f"(no pad: 2.5:1 passes) ({code}, {out.strip()[-80:]!r})")
    with sandbox(real, client=_SizedClient(1.4)) as (B, tmp, cl):
        src = tmp / "s2_raw.png"
        Image.new("RGB", (1800, 720), (40, 30, 60)).save(src)
        code, out = _main(C, _up_argv(src, "--form", "chaos_horizon", "--paid"))
        check(code is None and "narrower" in out and len(_rows(B)) == 2
              and not (tmp / "s2_raw_up_conservative_5_fit.png").exists(),
              f"upscale --form: a 2520 px output is refused after the call (spent, logged): stop and report "
              f"({out.strip()[-70:]!r})")
    with sandbox(real, client=_SizedClient(2.0)) as (B, tmp, cl):
        src = tmp / "wide_raw.png"
        Image.new("RGB", (1320, 520), (40, 30, 60)).save(src)
        code, out = _main(C, _up_argv(src, "--form", "chaos_orrery", "--paid"))
        sent = Image.open(io.BytesIO(base64.b64decode(cl.bodies[0]["image"]))) if cl.bodies else None
        check(_rows(B)[0]["purpose"] == "f2_upscale" and sent is not None and sent.size == (1320, 528),
              f"upscale --form chaos_orrery: purpose f2_upscale; a 2.54:1 source gets 4 edge rows top and bottom "
              f"({sent.size if sent else None})")
    for purpose in ("f4_inpaint", "f3_nobg"):
        with sandbox(real) as (B, tmp, cl):
            src = tmp / "s.png"
            Image.new("RGB", (1800, 720)).save(src)
            code, out = _main(C, _up_argv(src, "--purpose", purpose, "--paid"))
            check(code is None and "refused" in out and not cl.calls, f"upscale: purpose {purpose} is refused")


def _reserve_rule(check) -> None:
    from gen import colossus as C
    real = _budget()
    body = {"prompt": "selftest", "seed": 7, "output_format": "png"}
    with sandbox(real) as (B, tmp, cl):
        B.invoke("core", body, paid=True, purpose="reserve:F3 first, orchestrator")
        check(len(cl.calls) == 1 and _rows(B)[0]["model"] == "core", "reserve: a $0.04 core call is allowed")
        for model in ("upscale_conservative", "upscale_creative", "upscale_fast", "ultra"):
            r = _refused(lambda m=model: B.invoke(m, {**body, "seed": 8}, paid=True, purpose="reserve:x"), "0.08")
            check(bool(r) and len(cl.calls) == 1, f"reserve: {model} (over $0.08) is refused by the gate ({r[:60]!r})")
        r = _refused(lambda: B.invoke("upscale_conservative", {**body, "seed": 9}, paid=True, purpose="f3_upscale"))
        check(not r and len(cl.calls) == 2, "reserve rule: the same upscale on its own purpose f3_upscale is allowed")
    row = {**_fake_rows("reserve:x", 1)[0], "model": "upscale_conservative"}
    out = C.budget_breaches(real, [row], real["bedrock"]["gemini_before"])
    ok_rows = [{**r, "model": "search_replace"} for r in _fake_rows("reserve:x", 3)]
    check(any("B7" in x for x in out) and C.budget_breaches(real, ok_rows, real["bedrock"]["gemini_before"]) == [],
          f"budget --check: a reserve row with an upscale model breaches (B7); search_replace reserve rows pass ({out})")


def _archive(check) -> None:
    from gen import colossus as C
    from gen import retire as RT
    with tempfile.TemporaryDirectory() as t:
        gen = Path(t) / "gen"
        tree = RT.Tree(gen)
        for form, files in (("chaos_horizon", ("master.png", "glow.png", "variant_crack.png", "variant_crack_mask.png")),
                            ("chaos_orrery", ("master.png",))):
            d = gen / "approved" / "chaos_forms" / form
            d.mkdir(parents=True)
            for i, n in enumerate(files):
                Image.new("RGBA", (9, 4), (i, 9, 9, 255)).save(d / n)
            (d / "meta.json").write_text("{}\n")
        (gen / "colossus").mkdir()
        new = Path(t) / "body.png"
        Image.new("RGBA", (27, 12), (200, 100, 50, 128)).save(new)
        glow = Path(t) / "glow_new.png"
        Image.new("RGBA", (27, 12), (255, 200, 90, 40)).save(glow)
        ign = Path(t) / ".gitignore"
        r = _refused(lambda: C.approve("chaos_horizon", new, {}, tree=tree, gitignore=ign, extras={"glow": glow}),
                     "retire.py --colossus")
        check(bool(r), f"approve: the painted master is refused before the v1 files are archived ({r[:70]!r})")
        ids = [RT.retire_colossus(tree, f, f"{f}_v1") for f in ("chaos_horizon", "chaos_orrery")]
        arch = sorted(p.name for p in (tree.archive / "chaos_horizon_v1").iterdir())
        check(ids == ["chaos_horizon_v1", "chaos_orrery_v1"] and "variant_crack.png" in arch and "glow.png" in arch,
              f"retire.py --colossus <form> --as <form>_v1 archives both pixel masters ({ids}, {arch})")
        dst = C.approve("chaos_horizon", new, {"cache_keys": []}, tree=tree, gitignore=ign, extras={"glow": glow})
        live = sorted(p.name for p in dst.parent.iterdir())
        check(live == ["glow.png", "master.png", "meta.json"] and dst.read_bytes() == new.read_bytes()
              and (dst.parent / "glow.png").read_bytes() == glow.read_bytes(),
              f"approve --extra glow=...: master + glow + meta; the archived rev-3 variant files are dropped ({live})")
        (dst.parent / "stray.png").write_bytes(b"x")
        r = _refused(lambda: C.approve("chaos_horizon", new, {}, tree=tree, gitignore=ign, extras={"glow": glow}),
                     "stray.png")
        check(bool(r) and (dst.parent / "glow.png").exists(),
              f"approve: a live file with no archive copy is never dropped: refused, nothing written ({r[:60]!r})")

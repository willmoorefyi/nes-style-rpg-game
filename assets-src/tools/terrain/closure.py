"""The compiler closure (TS-D, docs/TEST_SPEED_PLAN.md 6.3; used by region.py's `compiler_digest` and by
det_changed.py): every module under assets-src/ that a compile loads, as sorted repository-relative paths.

The modules a compile imports inside functions (some only for some maps: ambient_flame for a map with flames,
map_checks_wrap for a wrapped map) are listed in LAZY_IMPORTS and imported first, so a closure taken before a compile
holds them too. `record_closure` adds what a compile really loaded (so the digest written with a compile covers it),
and `guard_closure` fails a compile that loaded a module the pre-compile closure lacks (the CLI and the --hash child
take that snapshot first), so a digest taken before a compile (`check_base`, `--check-determinism --changed`) cannot
miss one either. Check-harness modules (the selftests, the determinism checker) are not compiler code and never count.
"""
from __future__ import annotations

import importlib
import re
import sys
from pathlib import Path

from .region_chunks import RegionError

ASSETS_SRC = Path(__file__).resolve().parent.parent.parent
REPO = ASSETS_SRC.parent
LAZY_IMPORTS = ("build_map", "build_hooks", "map_checks_region", "mode7_atlas", "waterline", "kit_props",
                "ambient_flame", "map_checks_wrap")
LAZY_OPTIONAL: tuple[str, ...] = ()
NOT_COMPILER = re.compile(r"(^|/)([A-Za-z0-9_]*selftest[A-Za-z0-9_]*|det_changed)\.py$")
_RECORDED: set[str] = set()
_PRE: set[str] | None = None


def loaded_closure() -> set[str]:
    """Repository-relative paths of the compiler modules loaded in this process (see LAZY_IMPORTS)."""
    out = set()
    for m in list(sys.modules.values()):
        f = getattr(m, "__file__", None)
        if not f:
            continue
        p = Path(f).resolve()
        if p.suffix == ".py" and p.is_relative_to(ASSETS_SRC):
            rel = p.relative_to(REPO).as_posix()
            if not NOT_COMPILER.search(rel):
                out.add(rel)
    return out


def compiler_closure() -> list[str]:
    """The compiler closure: the modules loaded once LAZY_IMPORTS are imported, plus every closure recorded at the end
    of a compile in this process (`record_closure`). Sorted repository-relative paths."""
    for name in LAZY_IMPORTS + LAZY_OPTIONAL:
        try:
            importlib.import_module(name)
        except ModuleNotFoundError as e:
            if name not in LAZY_OPTIONAL or e.name != name:
                raise
    return sorted(loaded_closure() | _RECORDED)


def snapshot_closure() -> list[str]:
    """Take the pre-compile closure that `guard_closure` checks against (the CLI does, before it compiles)."""
    global _PRE
    _PRE = set(compiler_closure())
    return sorted(_PRE)


def record_closure() -> list[str]:
    """At the end of a compile: record what it loaded (it joins `compiler_closure`) and check it (`guard_closure`)."""
    post = loaded_closure()
    _RECORDED.update(post)
    guard_closure(post)
    return sorted(post)


def guard_closure(post: set[str]) -> None:
    """Fail when a compile loaded a compiler module the pre-compile closure lacks: a digest taken before a compile
    (`check_base`, `--check-determinism --changed`) would miss it."""
    extra = sorted(post - _PRE) if _PRE is not None else []
    if extra:
        raise RegionError(f"compiler closure: the compile loaded {', '.join(extra)}, not in the pre-compile closure "
                          "(add it to terrain/closure.py LAZY_IMPORTS)")


def runtime_versions() -> dict[str, str]:
    """`build.runtime`: the Python, Pillow and numpy versions the compile ran on."""
    import numpy as np  # noqa: PLC0415
    import PIL  # noqa: PLC0415
    return {"python": sys.version.split()[0], "pillow": PIL.__version__, "numpy": np.__version__}

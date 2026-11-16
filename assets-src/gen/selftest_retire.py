"""FW-RT self-tests (docs/REDESIGN_PLAN.md 5), run from selftest.py (test_monster_anim, also --anim): retire.py on a
fixture tree (foo = a byte copy of the goblin sheet, rig and lock), the exclusion proof (load_entries, `check --all`'s
ids, a monsters_ai build, the rig globs and the approved-key list never see approved/_retired/ or
anim/monsters/_retired/), the approve.py overwrite gate and its scope, --prune / --move-rig refusals, revival
(`--revive foo_v1 --as bar`), the static no-recursive-glob check, and the real tree's archives (git-tracked files and
cache keys).

  python3 -I assets-src/gen/selftest_retire.py
"""
from __future__ import annotations

import contextlib
import io
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from typing import Callable

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
REDESIGNED = ("crazy_horse", "piscodemon", "black_knight", "guardian", "vampire", "hollow_seraph", "chaos")
SEED = "goblin"                          # the fixture sprite foo is a byte copy of it (sheet, rig, lock)


def _refused(fn: Callable[[], object], *words: str) -> bool:
    try:
        fn()
    except SystemExit as e:
        return str(e).startswith("refused") and all(w in str(e) for w in words)
    return False


@contextlib.contextmanager
def patched_tree(gen: Path):
    """Point monster_anim's APPROVED / RIGS (every build and check reads them) and monster_atlas's FW-S SCALE_TABLE at a
    fixture tree (the fixture has no monster_scale.yaml: every sheet at the atlas scale; V4 filled the real table with
    23 sprites the fixture does not have, which load_scale refuses as unknown)."""
    from gen import monster_anim as MA
    from gen import monster_atlas as MAT
    real = MA.APPROVED, MA.RIGS, MAT.SCALE_TABLE
    MA.APPROVED, MA.RIGS, MAT.SCALE_TABLE = gen / "approved", gen / "anim" / "monsters", gen / "monster_scale.yaml"
    try:
        yield
    finally:
        MA.APPROVED, MA.RIGS, MAT.SCALE_TABLE = real


def make_fixture(gen: Path) -> None:
    """approved/foo/monster_small.* (the goblin sheet, `character: foo`), anim/monsters/foo.yaml + lock, monsters.yaml."""
    from gen import retire as RT
    (gen / "approved" / "foo").mkdir(parents=True)
    (gen / "anim" / "monsters").mkdir(parents=True)
    (gen / "cache").mkdir()
    src = HERE / "approved" / SEED
    for p in sorted(src.glob("monster_*.png")):
        shutil.copy2(p, gen / "approved" / "foo" / p.name)
        meta = json.loads(p.with_suffix(".json").read_text())
        (gen / "approved" / "foo" / f"{p.stem}.json").write_text(json.dumps({**meta, "character": "foo"}, indent=2) + "\n")
    rig = (HERE / "anim" / "monsters" / f"{SEED}.yaml").read_text()
    (gen / "anim" / "monsters" / "foo.yaml").write_text(re.sub(r"^sprite: \S+$", "sprite: foo", rig, count=1, flags=re.M))
    shutil.copy2(HERE / "anim" / "monsters" / f"{SEED}.lock.json", gen / "anim" / "monsters" / "foo.lock.json")
    block = RT.entry_block((HERE / "monsters.yaml").read_text(), SEED)
    (gen / "monsters.yaml").write_text("# fixture\n" + block.replace(f"- id: {SEED}", "- id: foo", 1)
                                       + "- id: other\n  size: small\n  prompt: x\n")


def _check_out(sid: str) -> tuple[int, str]:
    from gen import monster_review as MR
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        code = MR.main(["check", sid])
    return code, buf.getvalue()


def run_retire(check: Callable[[bool, str], None]) -> None:
    from gen import retire as RT
    with tempfile.TemporaryDirectory() as tmp:
        gen = Path(tmp) / "gen"
        make_fixture(gen)
        tree = RT.Tree(gen)
        _archive(check, RT, tree)
        _exclusion(check, gen)
        _gate(check, RT, tree)
        _revive(check, RT, tree)
    _static(check)
    _real_tree(check)


def _archive(check, RT, tree) -> None:
    row = RT.retire(tree, "foo")
    arch = tree.archive / "foo_v1"
    live = sorted(p.name for p in (tree.approved / "foo").iterdir())
    same = all((arch / n).read_bytes() == (tree.approved / "foo" / n).read_bytes() for n in live)
    check(sorted(p.name for p in arch.iterdir()) == live and same, f"retire foo: approved/_retired/foo_v1/ holds byte "
                                                                  f"copies of {live}")
    rigs = all((tree.rig_archive / f"foo_v1{e}").read_bytes() == (tree.rigs / f"foo{e}").read_bytes()
               for e in (".yaml", ".lock.json"))
    check(rigs, "retire foo: anim/monsters/_retired/foo_v1.yaml and .lock.json are byte copies of the live rig and lock")
    block = RT.retired_block(tree, "foo_v1")
    entry = RT._parse_one(block) if block else {}
    live_entry = RT._parse_one(RT.entry_block(tree.monsters.read_text(), "foo"))
    check(entry == {**live_entry, "retired_as": "foo_v1"} and (tree.retired / "monsters_v1.yaml").exists(),
          "retire foo: retired/monsters_v1.yaml holds the entry verbatim (id foo) plus retired_as: foo_v1")
    check(row.startswith("| `foo_v1` | `foo` | monster_small |") and "--revive foo_v1" in row,
          f"retire prints the docs/RETIRED_SPRITES.md row ({row[:70]!r})")
    snap = {p: p.read_bytes() for p in sorted(tree.gen.rglob("*")) if p.is_file()}
    RT.retire(tree, "foo")
    again = {p: p.read_bytes() for p in sorted(tree.gen.rglob("*")) if p.is_file()}
    check(snap == again, "retire twice is idempotent (no file changes)")
    png = tree.approved / "foo" / "monster_small.png"
    keep = png.read_bytes()
    png.write_bytes(keep + b"x")
    check(_refused(lambda: RT.retire(tree, "foo"), "different bytes"),
          "retire refuses when the target exists with different bytes (use --as foo_v2)")
    png.write_bytes(keep)
    check(_refused(lambda: RT.retire(tree, "foo", "bar_v1"), "foo_vN"), "retire --as refuses an id that is not foo_vN")
    check(not RT.retired_id_ok("vampire", "vampire_lord_v1") and RT.retired_id_ok("chaos", "chaos_v2_partial"),
          "retired ids: <id>_vN or <id>_vN_partial, never another sprite's (vampire_lord_v1)")


def _exclusion(check, gen: Path) -> None:
    from gen import monster_anim as MA
    from gen import monster_atlas as MAT
    from gen import monster_review as MR
    from gen import selftest_roster as SRo
    with patched_tree(gen):
        ids = [e[0] for e in MA.load_entries()]
        every = MR._ids(["--all"])
        yamls = [p.stem for p in sorted(MA.RIGS.glob("*.yaml"))]
        locks = [p.name for p in sorted(MA.RIGS.glob("*.lock.json"))]
        with tempfile.TemporaryDirectory() as out, contextlib.redirect_stdout(io.StringIO()):
            sheets = sorted(MAT.build(Path(out)).get("sheets", {}))
    metas = [p.parent.name for p in SRo.approved_metas(gen / "approved")]
    check(ids == ["foo"] and every == ["foo"], f"exclusion: load_entries and check --all list only foo ({ids}, {every})")
    check(sheets == ["foo"], f"exclusion: a monsters_ai build has only the foo sheet ({sheets})")
    check(yamls == ["foo"] and locks == ["foo.lock.json"],
          f"exclusion: the rig globs (run_fx_allowlist, run_fwq_allowlist, kf locks) see only foo ({yamls}, {locks})")
    check(metas == ["foo"], f"exclusion: the approved-key list (_approved_keys, test_style_lock) has only foo ({metas})")


def _gate(check, RT, tree) -> None:
    from gen import approve as AP
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        new, other = t / "new.png", t / "other.png"
        old = (tree.approved / "foo" / "monster_small.png").read_bytes()
        new.write_bytes(old[:-1] + bytes([old[-1] ^ 1]))
        other.write_bytes(b"other")

        def gate(cid: str, sheet: str, png: Path) -> str:
            try:
                AP.overwrite_gate(cid, sheet, png, tree.approved)
            except SystemExit as e:
                return str(e)
            return ""
        same = t / "same.png"
        same.write_bytes(old)
        check(gate("foo", "monster_small", same) == "", "gate: a byte-identical rewrite is allowed")
        check(gate("foo", "monster_small", new) == "", "gate: overwriting a sheet with a byte-identical archive copy "
                                                       "(foo_v1) is allowed")
        (tree.approved / "nov1").mkdir()
        shutil.copy2(tree.approved / "foo" / "monster_small.png", tree.approved / "nov1" / "monster_small.png")
        v = gate("nov1", "monster_small", new)
        check(v.startswith("refused") and "_retired" in v and "retire.py nov1" in v,
              f"gate: overwriting a sheet with no archive copy is refused, naming the archive path ({v[:90]!r})")
        (tree.archive / "nov1_v1").mkdir(parents=True)
        (tree.archive / "nov1_v1" / "monster_small.png").write_bytes(b"different")
        check(gate("nov1", "monster_small", new).startswith("refused"), "gate: a different-bytes archive copy is refused")
        check(gate("nov1", "monster_new", new) == "", "gate: a new sheet (no file yet) is allowed")
        for sheet in ("battle", "field", "kit_house"):
            (tree.approved / "nov1" / f"{sheet}.png").write_bytes(b"party")
            check(gate("nov1", sheet, new) == "", f"gate scope: {sheet}.png is not gated")
        # a sheet approved in pass V (not in v1) needs <id>_v2 first; the boss fallback archives <id>_v2_partial
        passv = tree.approved / "foo" / "boss_idle.png"
        (tree.archive / "foo_v1" / "boss_idle.png").write_bytes(b"pre-pass-V idle")
        passv.write_bytes(b"pass-V idle")
        check(gate("foo", "boss_idle", other).startswith("refused"),
              "gate: overwriting a pass-V-approved sheet without foo_v2 is refused")
        RT.retire(tree, "foo", "foo_v2")
        check(gate("foo", "boss_idle", other) == "", "gate: ... and allowed after retire.py foo --as foo_v2")
        passv.write_bytes(b"pass-V idle 2")
        restore = t / "restore.png"
        restore.write_bytes(b"pre-pass-V idle")
        check(gate("foo", "boss_idle", restore).startswith("refused"), "gate: the boss fallback restore is refused "
                                                                       "before <id>_v2_partial")
        RT.retire(tree, "foo", "foo_v2_partial")
        check(gate("foo", "boss_idle", restore) == "" and (tree.retired / "monsters_v2_partial.yaml").exists(),
              "gate: ... and allowed after retire.py foo --as foo_v2_partial")
        _approve_integration(check, AP, tree, t, passv)
        passv.unlink()
        shutil.rmtree(tree.approved / "nov1")
        shutil.rmtree(tree.archive / "nov1_v1")
        for rid in ("foo_v2", "foo_v2_partial"):
            shutil.rmtree(tree.archive / rid)
            for e in (".yaml", ".lock.json"):
                (tree.rig_archive / f"{rid}{e}").unlink(missing_ok=True)
        (tree.archive / "foo_v1" / "boss_idle.png").unlink()
        _prune_move(check, RT, tree)


def _approve_integration(check, AP, tree, t: Path, passv: Path) -> None:
    """approve.approve() itself runs the gate before it copies a monster sheet (the request and cut are faked)."""
    from gen import generate as GEN
    out = t / "out" / "gemini" / "foo" / "1234"
    out.mkdir(parents=True)
    (out / "boss_idle.png").write_bytes((tree.approved / "foo" / "monster_small.png").read_bytes())
    fake = SimpleNamespace(cached=True, key="k" * 24, model="m")
    real = (AP.APPROVED, GEN.OUT, GEN.load_character, GEN.plan_request, AP._unignore)
    AP.APPROVED, GEN.OUT = tree.approved, t / "out"
    GEN.load_character = lambda cid: {"id": cid, "kind": "monster", "size": "boss", "per_pose": True, "seeds": [1234]}
    GEN.plan_request = lambda *a, **k: fake
    AP._unignore = lambda key: None
    try:
        passv.write_bytes(b"pass-V idle 3")                                      # approved in pass V, not archived
        before = passv.read_bytes()
        refused = _refused(lambda: AP.approve("foo", "boss_idle", []), "_retired")
        kept = passv.read_bytes() == before
        shutil.copy2(passv, tree.archive / "foo_v2_partial" / "boss_idle.png")      # archive the live bytes
        AP.approve("foo", "boss_idle", [])
        wrote = passv.read_bytes() == (out / "boss_idle.png").read_bytes()
    finally:
        AP.APPROVED, GEN.OUT, GEN.load_character, GEN.plan_request, AP._unignore = real
    check(refused and kept and wrote, "approve.py runs the gate: refused (file kept) without an archive copy, written "
                                      "once a byte-identical copy is archived")
    (tree.approved / "foo" / "boss_idle.json").unlink()


def _prune_move(check, RT, tree) -> None:
    (tree.approved / "nofoo").mkdir()
    (tree.approved / "nofoo" / "boss_cast.png").write_bytes(b"x")
    (tree.rigs / "nofoo.yaml").write_text("sprite: nofoo\n")
    check(_refused(lambda: RT.prune(tree, "nofoo", ["boss_cast"]), "retire.py nofoo"),
          "--prune without an archive copy is refused")
    check(_refused(lambda: RT.move_rig(tree, "nofoo"), "retire.py nofoo"), "--move-rig without an archive copy is refused")
    check((tree.approved / "nofoo" / "boss_cast.png").exists() and (tree.rigs / "nofoo.yaml").exists(),
          "... and nothing was removed")
    shutil.rmtree(tree.approved / "nofoo")
    (tree.rigs / "nofoo.yaml").unlink()
    extra = tree.approved / "foo" / "boss_cast.png"
    extra.write_bytes(b"old cast")
    (tree.archive / "foo_v1" / "boss_cast.png").write_bytes(b"old cast")
    gone = RT.prune(tree, "foo", ["boss_cast"])
    check(gone == [extra] and not extra.exists(), "--prune removes a pose with a byte-identical archive copy")
    (tree.archive / "foo_v1" / "boss_cast.png").unlink()
    rig = (tree.rigs / "foo.yaml").read_bytes()
    lock = (tree.rigs / "foo.lock.json").read_bytes()
    moved = RT.move_rig(tree, "foo")
    check(len(moved) == 2 and not (tree.rigs / "foo.yaml").exists() and RT.move_rig(tree, "foo") == [],
          "--move-rig removes the live rig and lock (archived), then has nothing to do")
    (tree.rigs / "foo.yaml").write_bytes(rig)
    (tree.rigs / "foo.lock.json").write_bytes(lock)


def _revive(check, RT, tree) -> None:
    from gen import monster_anim as MA
    from gen import selftest_roster as SRo
    steps = RT.revive(tree, "foo_v1", "bar")
    metas = [json.loads(p.read_text()) for p in sorted((tree.approved / "bar").glob("*.json"))]
    check(bool(metas) and all(m["character"] == "bar" and m["revived_from"] == "foo_v1" for m in metas)
          and all((tree.approved / "bar" / f"{m['sheet']}.png").read_bytes()
                  == (tree.archive / "foo_v1" / f"{m['sheet']}.png").read_bytes() for m in metas),
          "--revive foo_v1 --as bar: approved/bar/ with the archived pixels, json character bar, revived_from foo_v1")
    entry = RT._parse_one(RT.entry_block(tree.monsters.read_text(), "bar"))
    check(entry.get("revived_from") == "foo_v1" and "retired_as" not in entry and entry.get("prompt") ==
          RT._parse_one(RT.retired_block(tree, "foo_v1")).get("prompt"),
          "--revive writes a monsters.yaml entry id bar with revived_from (the archived text)")
    check("sprite: bar" in (tree.rigs / "bar.yaml").read_text() and (tree.rigs / "bar.lock.json").read_bytes()
          == (tree.rig_archive / "foo_v1.lock.json").read_bytes() and len(steps) == 3,
          "--revive copies the rig (sprite: bar) and the archived lock, and prints the manual steps")
    with patched_tree(tree.gen):
        ids = [e[0] for e in MA.load_entries()]
        code, out = _check_out("bar")
    check("bar" in ids and not any("_v1" in i or "_retired" in i for i in ids), f"load_entries lists bar, no foo_v1 {ids}")
    check(code == 0 and out.strip().startswith("bar: OK"), f"check bar against the archived lock is OK ({out.strip()[:80]!r})")
    key = metas[0]["cache_key"]
    for ext in ("png", "json"):
        (tree.cache / f"{key}.{ext}").write_bytes(b"cached")
    ok = SRo.revived_ok(metas[0], tree.cache)
    (tree.cache / f"{key}.png").unlink()
    check(ok and not SRo.revived_ok(metas[0], tree.cache),
          "_approved_keys accepts a revived sheet through its committed cache file, and rejects it without it")
    check(_refused(lambda: RT.revive(tree, "foo_v1", "bar"), "already exists"), "a second --revive ... --as bar is refused")
    check(_refused(lambda: RT.revive(tree, "foo_v1", "other"), "already exists"),
          "--revive refuses an id that already has a monsters.yaml entry")


# ───────── static: no recursive glob over the approved or rig trees ─────────
_RECURSE = re.compile(r"rglob\(|glob\(\s*[rbf]?[\"'][^\"']*\*\*")
_TREES = re.compile(r"APPROVED|approved|RIGS|anim/monsters|\"anim\"\s*/\s*\"monsters\"|\bANIM\b")


def recursive_glob_hits(root: Path) -> list[str]:
    hits = []
    for py in sorted(root.rglob("*.py")):
        for n, line in enumerate(py.read_text().splitlines(), 1):
            if _RECURSE.search(line) and _TREES.search(line):
                hits.append(f"{py.relative_to(root)}:{n}")
    return hits


def _static(check) -> None:
    hits = recursive_glob_hits(ROOT / "assets-src")
    check(not hits, f"static: no rglob / ** glob over APPROVED, approved, RIGS, anim/monsters or ANIM in assets-src {hits}")
    rg = "rg" + "lob("                                   # split so this file never matches its own check
    probe = [f'    for p in sorted(APPROVED.{rg}"*.json")):', '    RIGS.glob("*' + '*/*.yaml")']
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "bad.py").write_text("\n".join(probe) + "\n")
        check(len(recursive_glob_hits(Path(tmp))) == 2, "static: the check flags rglob and ** over the approved / rig trees")


# ───────── the real tree ─────────
def _tracked(paths: list[Path]) -> bool:
    r = subprocess.run(["git", "-C", str(ROOT), "ls-files", "--error-unmatch", "--", *map(str, paths)],
                       capture_output=True, text=True)
    return r.returncode == 0


def _real_tree(check) -> None:
    from gen import retire as RT
    tree = RT.Tree()
    keys = [HERE / "cache" / f"{json.loads(j.read_text())['cache_key']}.{e}"
            for i in REDESIGNED for j in sorted((HERE / "approved" / i).glob("*.json")) for e in ("png", "json")]
    check(bool(keys) and _tracked(keys), f"real tree: the cache files of the 7 redesigned ids' approved sheets are "
                                         f"git-tracked ({len(keys)} files)")
    done = []
    for sid in REDESIGNED:
        for arch in RT.archives_of(tree, sid):
            files = sorted(p for p in arch.iterdir() if p.is_file())
            cache = [HERE / "cache" / f"{json.loads(j.read_text())['cache_key']}.{e}"
                     for j in files if j.suffix == ".json" for e in ("png", "json")]
            check(bool(files) and _tracked(files) and _tracked(cache),
                  f"real tree: {arch.name}: every archived file and its cache keys are git-tracked")
            done.append(arch.name)
    print(f"  info archived so far: {done or 'none'}")


if __name__ == "__main__":
    fails: list[str] = []

    def _check(cond: bool, msg: str) -> None:
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)
    run_retire(_check)
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'}")
    sys.exit(1 if fails else 0)

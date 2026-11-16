"""Retired sprites (docs/REDESIGN_PLAN.md 5, FW-RT; index docs/RETIRED_SPRITES.md). No redesigned sprite is thrown away:
before its first paid request its approved sheets, rig + lock and monsters.yaml entry are archived under a retired id
`<id>_vN`, committed, and kept out of every build and gate (every build and check globs one level deep:
approved/<id>/..., anim/monsters/<id>.*; the archive is approved/_retired/<id>_vN/ and anim/monsters/_retired/).

  python3 -I assets-src/gen/retire.py <id> [--as <id>_vN]             # archive (default <id>_v1); idempotent
  python3 -I assets-src/gen/retire.py --move-rig <id>                 # remove the live rig + lock (archived copies needed)
  python3 -I assets-src/gen/retire.py --prune <id> <sheet> [<sheet>]  # remove stale approved/<id>/<sheet>.* (archived)
  python3 -I assets-src/gen/retire.py --revive <id>_vN --as <new_id>  # copy an archive back as a new sprite

Archive layout: approved/_retired/<id>_vN/* (byte copies), anim/monsters/_retired/<id>_vN.yaml + .lock.json, and the
monsters.yaml entry verbatim in retired/monsters_vN.yaml (`id` kept, plus `retired_as: <id>_vN`; never read by the
generator). Every command refuses when a target exists with different bytes; --move-rig and --prune refuse unless a
byte-identical archive copy of each removed file exists. Who runs what and when: docs/REDESIGN_PLAN.md 5 and 9.1 (the
generator, in the main checkout; --move-rig and --prune in the commit that approves the id's first new sheet).
"""
from __future__ import annotations

import argparse
import contextlib
import json
import re
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent


@dataclass(frozen=True)
class Tree:
    """The generator tree the tool works on (injectable for selftest_retire.py)."""
    gen: Path = HERE

    @property
    def approved(self) -> Path:
        return self.gen / "approved"

    @property
    def archive(self) -> Path:
        return self.approved / "_retired"

    @property
    def rigs(self) -> Path:
        return self.gen / "anim" / "monsters"

    @property
    def rig_archive(self) -> Path:
        return self.rigs / "_retired"

    @property
    def retired(self) -> Path:
        return self.gen / "retired"

    @property
    def monsters(self) -> Path:
        return self.gen / "monsters.yaml"

    @property
    def cache(self) -> Path:
        return self.gen / "cache"


def _refuse(msg: str) -> None:
    raise SystemExit(f"refused: {msg}")


def retired_id_ok(sid: str, rid: str) -> bool:
    """`<sid>_vN` or `<sid>_vN_partial` (the boss fallback, docs/REDESIGN_PLAN.md 5)."""
    return re.fullmatch(re.escape(sid) + r"_v[1-9][0-9]*(_partial)?", rid) is not None


def suffix(rid: str) -> str:
    """`chaos_v2_partial` -> `v2_partial` (the retired/monsters_<suffix>.yaml file)."""
    m = re.search(r"_(v[1-9][0-9]*(?:_partial)?)$", rid)
    if not m:
        _refuse(f"{rid} is not a retired id (<id>_vN)")
    return m.group(1)


def archives_of(tree: Tree, sid: str) -> list[Path]:
    """approved/_retired/<sid>_v*/ directories of this sprite (exact ids only, never e.g. vampire_lord_v1)."""
    if not tree.archive.is_dir():
        return []
    return sorted(p for p in tree.archive.iterdir() if p.is_dir() and retired_id_ok(sid, p.name))


def has_archived_copy(tree: Tree, sid: str, name: str, data: bytes, rigs: bool = False) -> bool:
    """A byte-identical copy of approved/<sid>/<name> (or, rigs=True, anim/monsters/<sid><name>) in any archive."""
    if rigs:
        if not tree.rig_archive.is_dir():
            return False
        return any(p.read_bytes() == data for p in sorted(tree.rig_archive.iterdir())
                   if p.is_file() and p.name.endswith(name) and retired_id_ok(sid, p.name[:-len(name)]))
    return any((d / name).is_file() and (d / name).read_bytes() == data for d in archives_of(tree, sid))


# ───────── monsters.yaml entry blocks (text, so comments and anchors stay verbatim) ─────────
def entry_block(text: str, sid: str) -> str | None:
    """The text of the `- id: <sid>` entry: from its line to the next line at column 0."""
    lines = text.splitlines(keepends=True)
    start = next((i for i, ln in enumerate(lines) if re.fullmatch(rf"- id: {re.escape(sid)}\s*(#.*)?", ln.rstrip("\n"))),
                 None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if lines[i].strip() and not lines[i][0].isspace()), len(lines))
    block = "".join(lines[start:end]).rstrip("\n") + "\n"
    return block


def _parse_one(block: str) -> dict:
    data = yaml.safe_load(block)
    if not isinstance(data, list) or len(data) != 1 or not isinstance(data[0], dict):
        _refuse(f"entry block does not parse to one entry:\n{block[:200]}")
    return data[0]


def retired_block(tree: Tree, rid: str) -> str | None:
    """The archived entry block with `retired_as: <rid>` in retired/monsters_<suffix>.yaml."""
    path = tree.retired / f"monsters_{suffix(rid)}.yaml"
    if not path.exists():
        return None
    text = path.read_text()
    for m in re.finditer(r"^- id: (\S+)", text, re.M):
        block = entry_block(text, m.group(1))
        if block and _parse_one(block).get("retired_as") == rid:
            return block
    return None


# ───────── archive ─────────
def _plan_copy(src: Path, dst: Path, plan: list[tuple[Path, Path]]) -> None:
    if dst.exists() and dst.read_bytes() != src.read_bytes():
        _refuse(f"{dst} exists with different bytes than {src}")
    plan.append((src, dst))


def retire(tree: Tree, sid: str, rid: str | None = None) -> str:
    """Archive approved/<sid>/*, its rig + lock and its monsters.yaml entry under `rid` (default <sid>_v1); returns the
    docs/RETIRED_SPRITES.md row. Idempotent; refuses (before writing anything) if a target differs."""
    rid = rid or f"{sid}_v1"
    if not retired_id_ok(sid, rid):
        _refuse(f"--as {rid}: a retired id is {sid}_vN or {sid}_vN_partial")
    src = tree.approved / sid
    files = sorted(p for p in src.iterdir() if p.is_file()) if src.is_dir() else []
    if not files:
        _refuse(f"{src} has no approved files to archive")
    plan: list[tuple[Path, Path]] = []
    for p in files:
        _plan_copy(p, tree.archive / rid / p.name, plan)
    for ext in (".yaml", ".lock.json"):
        live = tree.rigs / f"{sid}{ext}"
        if live.exists():
            _plan_copy(live, tree.rig_archive / f"{rid}{ext}", plan)
    text = tree.monsters.read_text()
    block = entry_block(text, sid)
    if block is None:
        _refuse(f"{tree.monsters.name} has no '- id: {sid}' entry")
    archived = block.rstrip("\n") + f"\n  retired_as: {rid}\n"
    if _parse_one(archived) != {**_parse_one(block), "retired_as": rid}:
        _refuse(f"{sid}: the archived entry does not parse back to the live entry")
    have = retired_block(tree, rid)
    if have is not None and have != archived:
        _refuse(f"retired/monsters_{suffix(rid)}.yaml already holds a different {rid} entry")
    for a, b in plan:                                  # every check passed: write
        b.parent.mkdir(parents=True, exist_ok=True)
        if not b.exists():
            shutil.copy2(a, b)
    if have is None:
        tree.retired.mkdir(parents=True, exist_ok=True)
        path = tree.retired / f"monsters_{suffix(rid)}.yaml"
        head = "" if path.exists() else (f"# Retired monsters.yaml entries ({suffix(rid)}), written by retire.py "
                                         "(docs/REDESIGN_PLAN.md 5). Not read by the generator.\n")
        with path.open("a") as f:
            f.write(head + archived)
    return index_row(tree, sid, rid)


def index_row(tree: Tree, sid: str, rid: str) -> str:
    sheets, keys = [], []
    for j in sorted((tree.archive / rid).glob("*.json")):
        meta = json.loads(j.read_text())
        sheets.append(j.stem)
        keys.append(f"{j.stem} `{meta.get('cache_key')}`")
    rig = (tree.rig_archive / f"{rid}.yaml").exists()
    lock = (tree.rig_archive / f"{rid}.lock.json").exists()
    state = "rig + lock" if rig and lock else "rig, no lock" if rig else "no rig"
    return (f"| `{rid}` | `{sid}` | {', '.join(sheets)} | {'; '.join(keys)} | (reason) | {state} | "
            f"`retire.py --revive {rid} --as <new_id>` |")


# ───────── after the first new approval: move the rig, prune stale poses ─────────
def move_rig(tree: Tree, sid: str) -> list[Path]:
    """Remove anim/monsters/<sid>.yaml and .lock.json, only when byte-identical archive copies exist."""
    live = [tree.rigs / f"{sid}{ext}" for ext in (".yaml", ".lock.json")]
    live = [p for p in live if p.exists()]
    for p in live:
        ext = p.name[len(sid):]
        if not has_archived_copy(tree, sid, ext, p.read_bytes(), rigs=True):
            _refuse(f"{p} has no byte-identical copy under {tree.rig_archive}/{sid}_vN{ext}; run retire.py {sid} first")
    for p in live:
        p.unlink()
    return live


def prune(tree: Tree, sid: str, sheets: list[str]) -> list[Path]:
    """Remove approved/<sid>/<sheet>.png / .json for each sheet, only when byte-identical archive copies exist."""
    gone = []
    for sheet in sheets:
        if not re.fullmatch(r"[a-z0-9_]+", sheet):
            _refuse(f"--prune: {sheet!r} is not a sheet name (e.g. boss_attack)")
        for ext in (".png", ".json"):
            p = tree.approved / sid / f"{sheet}{ext}"
            if p.exists():
                if not has_archived_copy(tree, sid, p.name, p.read_bytes()):
                    _refuse(f"{p} has no byte-identical copy under {tree.archive}/{sid}_vN/; run retire.py {sid} first")
                gone.append(p)
    for p in gone:
        p.unlink()
    return gone


# ───────── revival ─────────
def _exists_anywhere(tree: Tree, new_id: str) -> list[str]:
    found = [str(p) for p in (tree.approved / new_id, tree.rigs / f"{new_id}.yaml", tree.rigs / f"{new_id}.lock.json")
             if p.exists()]
    entries = yaml.safe_load(tree.monsters.read_text()) or []
    ids = {e.get("id") for e in entries} | {v.get("id") for e in entries for v in e.get("variants") or []}
    if new_id in ids:
        found.append(f"{tree.monsters.name}: {new_id}")
    return found


def revive(tree: Tree, rid: str, new_id: str) -> list[str]:
    """Copy archive `rid` back as the new sprite `new_id`: approved/<new_id>/ (json `character` = new_id,
    `revived_from` = rid, `cache_key` kept as provenance), the rig (`sprite: <new_id>`) and lock, and a monsters.yaml
    entry (`id: <new_id>`, `revived_from`). Returns the remaining manual steps."""
    src = tree.archive / rid
    if not src.is_dir():
        _refuse(f"no archive {src}")
    if not re.fullmatch(r"[a-z][a-z0-9_]*", new_id):
        _refuse(f"--as {new_id!r}: not a sprite id")
    taken = _exists_anywhere(tree, new_id)
    if taken:
        _refuse(f"{new_id} already exists: {taken}")
    block = retired_block(tree, rid)
    if block is None:
        _refuse(f"retired/monsters_{suffix(rid)}.yaml has no entry with retired_as: {rid}")
    old = _parse_one(block)
    if old.get("variants"):
        _refuse(f"{rid}'s entry has palette variants {[v.get('id') for v in old['variants']]}; revive it by hand")
    lines = block.splitlines()
    lines[0] = re.sub(r"^- id: \S+", f"- id: {new_id}", lines[0])
    lines = [ln for ln in lines if not re.fullmatch(r"\s+retired_as: \S+", ln)] + [f"  revived_from: {rid}"]
    new_block = "\n".join(lines) + "\n"
    if _parse_one(new_block) != {**{k: v for k, v in old.items() if k != "retired_as"}, "id": new_id,
                                 "revived_from": rid}:
        _refuse(f"{rid}: the revived entry does not parse back to the archived entry")
    dst = tree.approved / new_id
    dst.mkdir(parents=True)
    for p in sorted(src.iterdir()):
        if not p.is_file():
            continue
        if p.suffix == ".json":
            meta = json.loads(p.read_text())
            meta["character"] = new_id
            meta["revived_from"] = rid
            (dst / p.name).write_text(json.dumps(meta, indent=2) + "\n")
        else:
            shutil.copy2(p, dst / p.name)
    rig = tree.rig_archive / f"{rid}.yaml"
    if rig.exists():
        text = rig.read_text()
        text, n = re.subn(r"^sprite: \S+$", f"sprite: {new_id}", text, count=1, flags=re.M)
        (tree.rigs / f"{new_id}.yaml").write_text(text if n else f"sprite: {new_id}\n" + text)
    lock = tree.rig_archive / f"{rid}.lock.json"
    if lock.exists():
        shutil.copy2(lock, tree.rigs / f"{new_id}.lock.json")
    text = tree.monsters.read_text()
    with tree.monsters.open("a") as f:
        f.write(("" if text.endswith("\n") else "\n") + new_block)
    return [f"add {new_id} to a group in gen/monster_pages.py (else it packs in the last group, 'other')",
            f"add the enemy to assets/data/enemies.yaml (sprite: {new_id}) and its bestiary data",
            f"run monster_anim.py check {new_id} (expect OK with the archived lock) and rebuild monsters_ai"]


# ───────── selftest fixtures (docs/REDESIGN_PLAN.md 9.5): the archived sprite when present, else the live one ─────────
def fixture_source(tree: Tree, sid: str) -> tuple[Path, Path | None, Path | None, bool]:
    """(approved dir, rig, lock, archived) of `sid` for the pinned selftests: approved/_retired/<sid>_v1/ and its
    archived rig and lock when the v1 archive exists (byte-identical to the live files until the redesign), else live."""
    arch = tree.archive / f"{sid}_v1"
    if arch.is_dir():
        rig, lock = tree.rig_archive / f"{sid}_v1.yaml", tree.rig_archive / f"{sid}_v1.lock.json"
        return arch, rig if rig.exists() else None, lock if lock.exists() else None, True
    rig, lock = tree.rigs / f"{sid}.yaml", tree.rigs / f"{sid}.lock.json"
    return tree.approved / sid, rig if rig.exists() else None, lock if lock.exists() else None, False


@contextlib.contextmanager
def fixture_tree(sids: tuple[str, ...] | list[str], full: bool = False, tree: Tree | None = None):
    """Point monster_anim's APPROVED / RIGS at a temp tree (symlinks) where each of `sids` is its fixture_source; with
    full=True every other live sprite is there too (unchanged). Yields {sid: archived?}."""
    from gen import monster_anim as MA
    tree = tree or Tree(MA.HERE)
    real = MA.APPROVED, MA.RIGS
    with tempfile.TemporaryDirectory() as tmp:
        appr, rigs = Path(tmp) / "approved", Path(tmp) / "rigs"
        appr.mkdir()
        rigs.mkdir()
        if full:
            for d in sorted(real[0].iterdir()):
                if d.is_dir() and not d.name.startswith("_") and d.name not in sids:
                    (appr / d.name).symlink_to(d)
            for f in sorted(real[1].iterdir()):
                if f.is_file() and f.name.split(".", 1)[0] not in sids:
                    (rigs / f.name).symlink_to(f)
        archived = {}
        for sid in sids:
            src, rig, lock, archived[sid] = fixture_source(tree, sid)
            if src.is_dir():
                (appr / sid).symlink_to(src)
            for p, ext in ((rig, ".yaml"), (lock, ".lock.json")):
                if p is not None:
                    (rigs / f"{sid}{ext}").symlink_to(p)
        MA.APPROVED, MA.RIGS = appr, rigs
        try:
            yield archived
        finally:
            MA.APPROVED, MA.RIGS = real


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="<id> to archive; with --prune: <id> <sheet> [...]")
    ap.add_argument("--as", dest="as_id", help="the retired id (default <id>_v1), or the new id with --revive")
    ap.add_argument("--move-rig", metavar="ID")
    ap.add_argument("--prune", action="store_true")
    ap.add_argument("--revive", metavar="ID_vN")
    a = ap.parse_args(argv)
    tree = Tree()
    if a.revive:
        if not a.as_id:
            _refuse("--revive needs --as <new_id>")
        for step in revive(tree, a.revive, a.as_id):
            print("todo:", step)
        print(f"revived {a.revive} as {a.as_id}")
    elif a.move_rig:
        print("removed:", [str(p.relative_to(tree.gen)) for p in move_rig(tree, a.move_rig)] or "nothing (no live rig)")
    elif a.prune:
        if len(a.ids) < 2:
            _refuse("--prune <id> <sheet> [<sheet> ...]")
        print("removed:", [str(p.relative_to(tree.gen)) for p in prune(tree, a.ids[0], a.ids[1:])] or "nothing")
    elif len(a.ids) == 1:
        print(retire(tree, a.ids[0], a.as_id))
    else:
        ap.print_help()
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())

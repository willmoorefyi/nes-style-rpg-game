# Improvement Plan — 2026-04-27

Project audit conducted April 24–27, 2026. This document captures the current state assessment and prioritized next steps.

---

## Current State

**Engine: Production-quality.** All 18 systems phases complete. 879 tests passing, clean build (`tsc && vite build`), 93 source files (~9,700 lines), zero TODOs/FIXMEs, no circular dependencies. Architecture is well-decoupled with injectable RNG, EventBus, lazy scene loading, and data-driven YAML content.

**Content: ~15–25% of FF1 scope.** The game covers roughly Act 1 of a 5-act story. The data-driven architecture means most remaining work is YAML authoring, not code.

### Content Coverage

| Category | Current | FF1 Target | Coverage |
|----------|---------|------------|----------|
| Enemies | 12 | ~128 | 9% |
| Spells | 34 (levels 1–5) | 64 (levels 1–8) | 53% |
| Weapons | 18 | ~40 | 45% |
| Armor | 14 | ~40 | 35% |
| Key Items | 2 | ~12 | 17% |
| Towns | 1 (Cornelia) | ~8 | 13% |
| Dungeons | 1 (Temple of Fiends) | ~20 | 5% |
| Bosses | 2 (Garland, Lich) | ~10+ | 20% |
| Maps | 9 game + 2 test | ~60+ | 15% |
| Battle Backgrounds | 1 | ~8–10 | 10% |
| Cutscenes | 1 | ~10+ | 10% |
| Audio Files | 0 (manifest exists, files missing) | 16 | 0% |

### Critical Issues

1. **No audio assets** — `audio-manifest.json` references 16 files but `assets/audio/` does not exist.
2. **Single battle background** — Only `grassland-hd.png` for all encounters.
3. **No pixel art** — Colored rectangles used as placeholder sprites.
4. **Front/back row system** — Described in design doc §4 but not implemented.
5. **Spell levels 6–8 missing** — Only levels 1–5 of the 8-level system exist.

### Minor Issues

- README says 42 items; actual count is 44.
- Ether has `stats: {}` with no defined spell-charge restoration effect.
- Body armor lacks a `slot` field (shields and helmets have one).
- 31 of 93 source files (33%) lack dedicated tests — gaps cluster in scenes, battle sub-modules, and movement modes.

---

## Recommended Next Steps

### P0 — Content Expansion (YAML-only, no code changes)

These deliver the most gameplay value with the least engineering effort.

| # | Task | Scope | Effort |
|---|------|-------|--------|
| 1 | **Add 50–80 enemies** across difficulty tiers (forest, cave, ocean, volcano, sky) | `enemies.yaml` | Medium |
| 2 | **Add level 6–8 spells** (~30 spells: FADE, NUKE, LIF2, EXIT, SABR, etc.) | `spells.yaml` | Small |
| 3 | **Add Pravoka** — town, shops, NPCs, Bikke pirate boss encounter | `maps/`, `shops.yaml`, `enemies.yaml` | Medium |
| 4 | **Add Elfheim** — town, shops, NPCs, Astos quest line | `maps/`, `shops.yaml` | Medium |
| 5 | **Add Marsh Cave** — dungeon with encounters, Wizards boss | `maps/`, `enemies.yaml` | Medium |
| 6 | **Add Earth Cave** — dungeon leading to Lich boss (already exists) | `maps/` | Medium |
| 7 | **Expand weapons and armor** to cover mid/late-game tiers | `items.yaml` | Small |
| 8 | **Add key items** — Crown, Crystal Eye, Jolt Tonic, Nitro Powder, Canoe, Floater, etc. | `items.yaml` | Small |
| 9 | **Add Melmond and Crescent Lake** — towns with shops and story NPCs | `maps/`, `shops.yaml` | Medium |
| 10 | **Add encounter tables** to all new maps with appropriate enemy groups | Map YAML files | Small |

### P1 — Audio & Visual Assets

| # | Task | Scope | Effort |
|---|------|-------|--------|
| 11 | **Create or source chiptune audio** for 9 music tracks + 7 SFX defined in manifest | `assets/audio/` | Large |
| 12 | **Add battle backgrounds** — dungeon, cave, ocean, castle, volcano, sky | `assets/backgrounds/` | Medium |
| 13 | **Replace placeholder sprites** with pixel art for characters, enemies, tiles, NPCs | `assets/` | Large |

### P2 — Missing Systems (Code changes required)

| # | Task | Scope | Effort |
|---|------|-------|--------|
| 14 | **Implement front/back row system** per design doc §4 | `src/battle/`, `src/entities/` | Medium |
| 15 | **Verify spell level 6–8 support** in charge system (may need code beyond YAML) | `src/battle/`, `src/entities/` | Small |
| 16 | **Add story flag gates** for Act 2–5 progression (ship, airship, canoe access) | `src/systems/` | Medium |

### P3 — Quality & Polish

| # | Task | Scope | Effort |
|---|------|-------|--------|
| 17 | **Add tests for 31 untested source files** — prioritize scenes and battle sub-modules | `tests/` | Medium |
| 18 | **Fix Ether effect** — implement spell-charge restoration in ItemEffects | `src/systems/`, `items.yaml` | Small |
| 19 | **Fix armor slot inconsistency** — add `slot: body` to body armor entries | `items.yaml` | Trivial |
| 20 | **Update README item count** (42 → 44) | `README.md` | Trivial |
| 21 | **Update PROGRESS.md** to accurately reflect content gaps vs "feature-complete" claim | `docs/PROGRESS.md` | Small |
| 22 | **Add more debug scenarios** for mid/late-game testing | `debug-scenarios.yaml` | Small |

---

## Suggested Execution Order

**Phase A — Core Content Sprint** (Tasks 1, 2, 7, 8, 19, 20)
Add enemies, spells, items, and fix minor data issues. Pure YAML. Immediately makes existing areas more varied.

**Phase B — World Expansion** (Tasks 3, 4, 5, 6, 9, 10)
Add towns and dungeons to extend gameplay from Act 1 into Act 2–3. Map design + YAML.

**Phase C — Audio & Art** (Tasks 11, 12, 13)
Replace placeholders with real assets. Can run in parallel with Phase B.

**Phase D — Systems & Polish** (Tasks 14, 15, 16, 17, 18, 21, 22)
Implement missing mechanics, expand test coverage, sync documentation.

---

## Key Insight

The project's data-driven architecture is its greatest asset for the work ahead. **~70% of remaining tasks are YAML content creation requiring zero TypeScript changes.** The engine is ready — it needs a world to run in.

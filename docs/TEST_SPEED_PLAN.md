# TS: test and gate speed-ups (plan, rev 2; implemented, see "TS result" at the end)

Base: `mainline` d68b755e (QW2 merged). Implementation base: TS-0 and TS-D may start now and rebase over `wr`;
TS-P, TS-C and TS-G start on `mainline` **after `wr` merges** (section 11). The plan's home in the repository, once
implementation starts, is `docs/TEST_SPEED_PLAN.md`.

**Rev 2 (2026-11-22): momus fixes.** Momus rejected rev 1 with 10 required fixes. The integrator ruled R1-R12 at
their defaults, amended by those fixes; R13-R15 are new. Changes:
1. Baseline keys, and the audit's light keys, run on a throwaway context per job built from the recipe. A shared
   base context never runs a check key, because `stateGraph` caches its graph on the context
   (`questProofs.ts:58`, `ctx.graph ??=`). See 5.2.
2. The memory rule: the pool never fails where the serial run passes. An out-of-memory retry runs with the serial
   run's 8 GB heap, and G1 records every job's peak heap. LIMIT is the `maxStates` cap (`questChecks.ts:82`), not
   heap exhaustion, so it does not depend on the heap. See 5.5 and R3.
3. R5: a run whose `--root` is not the bundle's source root neither reads nor writes the cache. See 4.4.
4. Memory across processes: a pool lock shared by all worktrees (`/tmp/ff-game-quest-mutate.lock`), 4 workers by
   default inside vitest, `test:full`'s peak on a cache miss, and a table of what may run beside what on the 48 GB
   machine. See 5.4.
5. The tests: a temporary repository-layout fixture written from the mini world, so the loads go through
   `readInput`, plus a test-only store override. See 8.
6. The T2 guard runs over the bundle's metafile closure. See 12.
7. TS-D's compiler closure: the `__file__` of every module under `assets-src/` that a compile loaded (including
   `layouts/`, which `build_hooks.py:26` and `map_checks_region.py:23` put on `sys.path`), untracked compiler files,
   and the Python, Pillow and numpy versions. R9 uses the same closure. See 6.3.
8. 6.2 step 4: the `R.painted` limit handled (`RegionError` caught, full check at 120 painted chunks or more), the
   existing `region` path in `build_map.py:1303-1335` extended, and the byte-equality selftests cited.
9. The process: an integration branch, `mainline` advancing only after steps 2-5 pass, every merge a batch,
   `test:full` never skipped, and what to do when step 4 fails. See 7.1.
10. CLI output: the variant that `--strict` selects fills `report.mutations` and the printed line. See 5.1.

Also added: the doc updates (7.2), the line ceilings (9), the full-tier timing note (7.2, R14), GT-18's live probe
(5.1), and the optional items (G1 against a pre-TS run, the code fingerprint re-checked before a store, the mtime
touched on a hit, versions read from `node_modules`, the esbuild pin (R15), no absolute paths in failures).
Request: the user, 2026-11-22: (1) reuse the mutation result by a fingerprint of its inputs, (2) run the mutation
suite on several cores, (3) check determinism only on the changed chunks, (4) leave the heavy proofs to the
integrator, once per merge batch. Planning only: no code, data or map changes in this document's commits. The user
wants the work to go straight from momus to implementation, so every open choice is a ruling with a default (13).

Scratch for this plan: `/tmp/pt/` (`probe.ts`, `probe2.ts`, `bundle.mjs` and their outputs; read-only against the
main checkout, nothing written into the repository).

## 0. Summary and success criteria

1. **TS-C, the mutation cache.** The mutation suite's raw check outputs and its verdicts are stored in a
   content-addressed cache, keyed by a fingerprint of every byte the verifier reads, the code it runs and its
   options. `questMutateWorld.test.ts` derives and asserts the verdict from the cache when the fingerprint matches,
   after re-running the cheap part of the suite live; otherwise it runs live and stores the result.
2. **TS-P, the parallel suite.** The suite's checks run in a pool of `worker_threads`, each loading the world once.
   The main thread only plans the jobs and derives the results, so the output is the serial run's, byte for byte.
3. **TS-D, changed-chunk determinism.** `build_map.py --check-determinism --changed overworld` compiles only the
   chunks whose digest differs from the base commit's, plus their ring, under two hash seeds at once. It compares them
   with each other and with the chunk files in the working tree. A change to the compiler's code or kit art falls
   back to the full check.
4. **TS-G, the process.** Agents run `npm run build`, `npm run test:fast`, the tests they touched and, for world,
   quest or verifier changes, `npm run quest -- --strict`. Once per merge batch, the integrator runs `--mutate`
   (parallel; it fills the cache), `--from-reset` and `npm run test:full` (which then hits the cache).

```json
{
  "functional": [
    "a cache hit is taken only when the recomputed fingerprint (every file the loaders open or probe, the bundler's code closure, options, runtime, salt) equals the entry's",
    "on a hit the verdict is re-derived by the current code from the cached raw outputs; every job without proof (c) is re-run live and compared; 1 seeded heavy job is re-run live and compared",
    "any difference, a malformed entry or a missing job fails closed: the test fails on a mismatch, and runs live on a miss",
    "the parallel suite's MutationResult[] (plain and strict) deep-equals the serial run's, on the mini world (fast tier) and once on the real world",
    "a worker that crashes or times out has its job retried once on a fresh worker; a worker out of memory on its 3.5 GB first cap is retried at the serial run's 8 GB heap, so the pool never fails where the serial run passes; a second failure fails the run",
    "baseline keys and audit keys run on throwaway contexts; the shared factory context never runs a check key (no cached graph)",
    "one mutate pool per machine (the cross-worktree lock); 6 workers from the CLI, 4 inside vitest",
    "--changed paints changed + ring chunks under PYTHONHASHSEED 1 and 3, requires equal per-chunk hashes and equality with the working-tree chunk files and collision, and requires every chunk file outside the painted set to equal the base's",
    "--changed falls back to the full check when the base has no chunk digests, the size differs, the compiler digest differs, a compiler file changed since the base, or over FULL_ABOVE painted chunks"
  ],
  "observable": [
    "the CLI prints `mutations: OK (...)` plus `mutate: N jobs on W workers, wall S s, cache <hit|miss|stored> <fp12>`",
    "questMutateWorld.test.ts logs `cache hit <fp12>: audited L light + H heavy jobs` or `cache miss <fp12>: live run`",
    "build_map.py --changed prints `overworld: deterministic (changed C chunks, painted P with the ring, base <rev12>; files match)` or `full check (<reason>)`"
  ],
  "pass_fail": [
    "npm run build OK; npm run test:fast OK and within 10 s of its time before TS (agents)",
    "npm run test:full with a cache hit: OK in at most 12 min (target 10) on this machine, 2 workers",
    "npm run quest -- --strict --mutate --jobs 6: OK in at most 18 min (target 13), peak RSS at most 24 GB",
    "the real-world serial == parallel gate (10, G1) run once: equal"
  ]
}
```

## 1. Baseline (measured at d68b755e, this machine: 14 cores, 48 GB, load about 8 from other work)

| What | Figure | Source |
|---|---|---|
| `npm run quest -- --strict --mutate` | 4,614 s (77 min), max RSS 7.0 GB, `mutations: OK (68 gate rows; 109 elements ...)` | QW2 (`/tmp/qw2/mutate.txt`) |
| `npm run test:full` | 4,348 s (72 min) at NW2-INT, max RSS 6.9 GB; the user's figure today about 79 min | NW2 plan, INT result |
| `npm run test:fast` | 173 s, 414 files, 10,044 tests | `/tmp/qw2/fast2.txt` |
| `npm run quest -- --strict` (a-h) | 116 s, 3.8 GB | `/tmp/qw2/strict.txt` |
| `--from-reset` (with `--strict`) | 653 s, 6.7 GB (195 reset states) | `/tmp/qw2/reset.txt` |
| full world compile | 326 s, 15.6 GB peak | `/tmp/qw2/gates1.txt` |
| `build_map.py --check-determinism overworld` | 400 s, 13.1 GB (two full in-memory compiles, one after the other) | `/tmp/nw2-int/det_build.log` |
| `mode7_atlas.py --check-determinism overworld` | 9.7 s, 0.18 GB | `/tmp/nw2-int/det_m7.log` |
| `--region a1` (49 painted chunks) / `water` (63) | 111 s, 6.0 GB / 94 s, 4.5 GB | NATURAL_WORLD_PLAN NW-4 |

**The suite's shape (probe2, measured).** The 109 results over 68 row labels are: 66 gate-table elements (43 rows; GT-18
is a probe with no element) + 1 probe + **42 generic elements**. `genericElements` lists 95, and 53 of them are skipped
because the table already names their spot. (The request's "68 rows plus 109 generic elements" is 109 in total.) The
keys of the gate-table elements are mostly one stage's (b). 9 non-load-bearing rows add (a), the stages' (b) and (e),
GT-4 adds (c) and GT-25 adds (h). A generic element runs (a), (b) for 32 stages, (c) and (e).

**Where the time goes (probe, one process, measured).**

| Check on one context | Time | Heap after |
|---|---|---|
| load world + late data | 0.8 s | 184 MB |
| baseline (a) / (b) all 32 stages / (c) / (e) / (h) | 1.5 / 6.8 / **84.5** / 0.1 / 0.5 s | 1,853 MB (the (c) graph held) |
| generic G#0 (`cardia-deep npc bahamut hideIf ...`) | 97.7 s, of it (c) 87.8 s | +1.0 GB |
| G#47 (`dock ert_dwarf removed`, named) | 1.6 s, (c) 0.0 s (the goal is gone, the graph is tiny) | +0.1 GB |
| G#94 (`western-keep-2f npc astos hideIf ...`) | 101.2 s, of it (c) 90.7 s | after GC 2.0 GB with two graphs live |

So **proof (c), the exact state graph, is about 90 % of the suite.** There are 45 heavy jobs: 42 generic elements,
GT-4, and the plain and strict baselines. Each takes about 90 s (or under 2 s when the mutation cuts the graph
short). Everything else, 66 light jobs, takes about 1 min in total. 45 x 90 s = 68 min, which matches the 77 min
measured with the proofs and the machine's load. A graph holds 0.9-1.7 GB of heap, and one process with the base
world and one graph stays under 2 GB live.

**The verifier's code closure (bundle.mjs, measured).** esbuild bundles the entry points (`questMutate`,
`questReport`, `questData`, `questLateData`, `questReset`) in **31 ms**. The bundle has 48 source inputs: 29 in
`src/progression`, 7 in `src/core` (`schemaValidation*`, `mapValidators`, `encounterValidation`,
`enemyRosterValidation`), 6 in `src/systems` (`fieldRules`, `fieldRulesNpc`, `fieldRulesVehicles`, `EncounterTable`,
`worldReset`, `worldRevalidate`), 5 in `src/types` and `src/entities/ExperienceTable.ts`. After WR it will also hold
`worldWrap.ts` and `questWrap.ts`.

**A gap found in the compiler digest.** `terrain/region.py`'s `compiler_digest` hashes `CODE = build_map.py,
kit.py, terrain/`, plus the kit art. It leaves out `waterline.py` (`WL.paint` paints pixels in `compile_map`),
`kit_props.py`, `gen/prop_spec.py` and `build_hooks.py`. So today an edit to `waterline.py` does not stop a
`--region` compile over a stale base. TS-D does not rely on that digest alone (6.3), and ruling R9 proposes fixing it.

## 2. Decisions and glossary

- **Job**: one unit of pool work. Either an *element job* (one mutated context, every key the suite asks of it) or a
  *baseline job* (one key, or the light keys together, on the plain or the strict base context).
- **Raw run**: the `ProofFailure[]` of one key on one context, exactly what `RUNS` caches today
  (`questMutateCheck.ts`), keyed by `stage|maxStates|elementId|proof:stage`.
- **Derivation**: today's serial code (`runGateRows`, `runGeneric`, `runMutations`, `Baseline.freshFor` / `has`)
  turning raw runs into `MutationResult[]`. It stays the only code that decides a verdict.
- **RunSource**: where `Baseline` takes raw runs from. `serial` computes them in-process (today's behaviour and the
  `--jobs 1` reference), `recording` returns `[]` and records each request (the planner), and `prefilled` reads a map
  and **throws** on a request it lacks.
- **fp**: the fingerprint (3); `fp12` is its first 12 hex digits.
- D-TS1: the verdict is always derived live by the current code; only raw check outputs are reused.
- D-TS2: every input is recorded where it is read, never listed by hand.
- D-TS3: the pool changes only where raw runs are computed, never the derivation or its order.
- D-TS4: changed-chunk determinism proves at least what it skips: the skipped chunks must be byte-identical to the
  base's.

## 3. The fingerprint

`fp = sha256(canonicalJson(F))`, where F has five parts, all sorted:

1. **`data`**, every file the verifier's loaders open or probe, recorded at the moment of reading by a new
   `src/progression/questInputs.ts`:
   - `readInput(path)` replaces the three private `readYaml`s (`questData.ts`, `questMaps.ts`,
     `questLateData.ts`) and records `[repoRelativePath, sha256(bytes)]`;
   - `probeInput(path)` replaces their `existsSync` calls and records `[path, "absent"]` for a missing file. A legacy
     `assets/maps/<id>.yaml` that a transition names but that does not exist is an input too, because adding it
     changes the world.
   - Today this covers `assets/maps/ai/index.yaml`, every `assets/maps/ai/<id>.yaml` in the index, the legacy
     `assets/maps/<id>.yaml` the compiled set links to (and the probes of the missing ones), and in `assets/data/`:
     `quest.yaml`, `cutscenes.yaml`, `items.yaml`, `enemies.yaml`, `spells.yaml`, `kits.yaml` and
     `world-anchors.yaml` (or the `--anchors` file). Because the list is recorded, a loader that starts reading a new
     file (say `encounters.yaml`) puts it into the fingerprint with no edit to the list.
   - The record hangs on the loaded objects: `QuestWorld.inputs` and `LateData.inputs`, read-only arrays. `editMap`
     and `editQuest` copy them with the spread, so this is harmless.
   - The verifier does not read `assets-src/maps/*.yaml` (the sources) or the chunk PNGs, so they are not in the
     fingerprint. A source edit that was never compiled changes nothing the suite proves. The source-to-compiled
     link is guarded elsewhere: the compile at merge, `mode7Atlas.test.ts`, `worldSource.test.ts`, and TS-D's file
     comparison.
2. **`code`**: `[path, sha256]` for every input in the esbuild metafile of the worker bundle (5.2). Its entries are
   `questMutateWorker.ts` (which imports `questMutate`, `questProofs`, `questProofsLate`, `questReset`,
   `questReport`, `questData`, `questLateData`, `questMutateCache`, `questInputs`, and a context module for the mini
   world, 5.2), so the closure takes in `src/progression/**`, `fieldRules*.ts`, `worldReset.ts`,
   `worldRevalidate.ts`, `worldWrap.ts` (after WR), `schemaValidation*.ts`, `src/types/*` and `ExperienceTable.ts`
   automatically. Type-only imports are dropped by the bundler. That is correct, since they do not run. Added to the
   list: `yaml@<version>` and `esbuild@<version>`, read from the installed `node_modules/<pkg>/package.json`, not from
   the ranges in the repo's `package.json` (today 2.8.3 and 0.21.5). esbuild arrives through vite with no pin, so
   R15 pins it in `devDependencies`.
3. **`options`**: `{stage, maxStates, mapsDir, anchors, worstCanoe, legacy, root: "."}` as the context was built,
   plus the test-only `start` / `worldMap` overrides of the repository-layout fixture (8) when they are set.
   `maxStates` is the context's (`MAX_STATES` = 3,000,000 by default, which is also in `questSearch.ts`'s hash).
   `lateOf` reads `--root`, `--anchors` and `--worst-canoe` from `process.argv`, so the worker and the fingerprint
   take the resolved values, never argv.
4. **`runtime`**: `process.version` in full (ruling R6: conservative; Node changes rarely).
5. **`salt`**: `QUEST_MUTATE_CACHE_VERSION = 'ts-1'` in `questMutateCache.ts`. Bump it when the entry format or the
   meaning of a raw run changes. The file is in the code closure, so any edit to it already changes the
   fingerprint; the salt documents intent.

The test file is deliberately left out. Its assertions run on the derived results every time, hit or miss. The
fingerprint takes about 2 s (load world and late data 0.8 s, bundle 31 ms, hashing about 60 MB of YAML).

## 4. The cache (TS-C)

### 4.1 Where it lives (ruling R1)

| Option | For | Against |
|---|---|---|
| **A. `<git common dir>/ff-cache/quest-mutate/<fp>.json`** (recommended) | untracked, and shared by every worktree of the clone (`git rev-parse --git-common-dir` is the main `.git` for `.claude/worktrees/*` too), so the integrator's merged tree sees every agent's and its own entries; content-addressed (one file per fp), so no merge conflicts and several states kept at once | local to this clone (there is no CI, so nothing is lost); not reviewable in a diff |
| B. tracked `assets/data/quest-mutate.cache.json` | travels with the branch; reviewable | a single file conflicts at every batch merge that has two input-changing branches; churn on every world change; a merged tree hits only when its post-merge fp equals the one the branch committed, i.e. only when no other branch in the batch changed an input and the merge recompile was byte-identical; the integrator's own run would then have to be committed |
| C. untracked `.cache/` in the worktree | simple | lost with the worktree; the integrator's tree never sees an agent's entry, so it gives nothing for request 1 |

With A, the integrator's `test:full` on a merged tree hits whenever any run in any worktree has already proven that
exact fingerprint. In practice that is the integrator's own `npm run quest -- --mutate` on the merged tree (7, step
4), so the suite stops being run twice per batch. It is also an agent's run whose inputs the merge did not change,
for example when a batch has one world-changing branch and the other branches touch no input. Pruning keeps the 32
newest entries by mtime, and a hit touches its entry's mtime, so pruning removes the least recently used. Each write
goes to `<fp>.json.tmp-<pid>` and is renamed: atomic, and two writers of one fp write the same bytes. Before a live
run stores its entry, it recomputes the code and data fingerprint. If either changed during the run (an edit made
mid-run), it refuses to store and logs `cache: inputs changed during the run, not stored`.

### 4.2 The entry

```json
{
  "version": "ts-1", "fingerprint": "<64 hex>",
  "inputs": { "data": [["assets/data/quest.yaml", "<sha>"], ...], "code": [...], "options": {...}, "runtime": "v26.13.0" },
  "raw": { "<scope|elementId|proof:stage>": [ProofFailure, ...], ... },
  "baseline": { "plain|a:": ["message", ...], "strict|c:": [...], ... },
  "results": { "plain": [MutationResult, ...], "strict": [MutationResult, ...] },
  "line": "mutations: OK  (68 gate rows; 109 elements, each removal reported)",
  "produced": { "at": "<iso>", "by": "<cli|test>", "jobs": 6, "wallS": 780, "worktree": "<path>" }
}
```

Its size is to be measured in TS-C: about 0.2-1 MB (failures with their paths for the caught elements; the OK
baseline has none).

### 4.3 How `questMutateWorld.test.ts` uses it

The test keeps its four `it`s. Its collect-time block becomes `const suite = await mutationSuite(repoContext(),
{cache: envMode()})`, which returns `{plain, strict, source: 'hit' | 'miss'}`:

1. Compute fp (3). Look up `<fp>.json`.
2. **Hit**: validate the schema, `entry.version`, `entry.fingerprint === fp` and `entry.inputs` deep-equals the
   recomputed inputs (on a difference, print which inputs differ and treat it as a miss). Then:
   - **derive**: run `runMutations` for the plain and the strict context with a `prefilled` RunSource over
     `entry.raw` and `entry.baseline`. A request the entry lacks throws, so the test fails, never runs short.
   - **check the derived layer**: the derived `{plain, strict}` must deep-equal `entry.results`. Otherwise the test
     fails with `cache entry <fp12> inconsistent`.
   - **audit live** (ruling R2): re-run every light job (no (c) key: 66 element jobs and the light baseline keys,
     about 1 min on one thread), plus `H` heavy jobs picked by a PRNG seeded from fp (default `H = 1`, about 90 s),
     and compare each raw run with `entry.raw` / `entry.baseline` exactly. A difference fails the test (the proofs
     are not deterministic, or the entry was edited). The audit runs in the pool too, on the same rule (5.2): each
     baseline key on a throwaway context, never on the derivation's contexts.
3. **Miss**: run the suite live through the pool (5), write the entry (A), and use its results.
4. The existing assertions run on `suite.plain` and `suite.strict` in both cases.

Env `QUEST_MUTATE_CACHE` = `use` (default), `refresh` (run live, overwrite), `off` (run live, neither read nor
write); `QUEST_MUTATE_AUDIT` = `0 | 1 | <n> | all` heavy jobs (`all` makes a hit a full live run, used for G2);
`QUEST_MUTATE_JOBS` = workers. The CLI takes `--cache use|refresh|off`, `--audit N`, `--jobs N`.

### 4.4 Which runs write (ruling R5)

Only a run of the repository context with the default options: no `--stage`, `--maps`, `--anchors` or
`--worst-canoe`, default `maxStates`, and a `--root` equal to the bundle's source root (the working directory whose
`src/` is bundled). Any `--mutate` CLI run and the test's live run write. A scratch `--maps` run neither reads nor
writes, so a scratch compile can never seed the store. A `--root DIR` run on another root neither reads nor writes
either, because the CLI's `loadModule(root, ...)` loads that root's verifier code while the bundle and the code
fingerprint are cwd's.

The one exception is the test-only store override `QUEST_MUTATE_STORE=<dir>`, set only by `questMutateCache.test.ts`.
It lets a fixture root be cached: the code is still cwd's (bundled and fingerprinted), the fixture's bytes enter
`data` through `readInput`, and the store is the test's temp dir, never the shared one. The override is refused
(it throws) outside vitest (`process.env.VITEST` unset). The CLI with `--mutate` always computes
both variants: the strict run's only extra cost is its baseline (one more heavy job). So a CLI entry serves the
test, which asserts both.

### 4.5 Invalidation, forced re-run, tamper and staleness

- A cache hit needs all five parts of F to be equal. Any byte of any opened file, any probed file appearing or
  vanishing, any file in the code closure, the options, Node, `yaml` / `esbuild` versions or the salt makes a new
  fp, so a miss. Nothing is "invalidated" in place: an old entry is simply never looked up again and is pruned later.
- Forced re-run: `QUEST_MUTATE_CACHE=refresh npm run test:world`, or `npm run quest -- --mutate --cache refresh`.
- Staleness cannot hide a change. The fp is recomputed from the tree on every run, never read from the entry, and
  the entry's stored fp and inputs are only compared against it.
- A hand edit cannot pass unnoticed by accident:
  - an edited verdict (`results`) fails the re-derivation check;
  - an edited raw run of a light job fails the live audit;
  - an edited baseline or heavy raw run is caught with probability `H / 45` per run, and, as the fp changes with
    every world change, a different heavy job each time;
  - an edited fingerprint or inputs list makes a miss.

  What the scheme cannot stop is a deliberate forgery of a consistent heavy raw run. No local scheme can, because
  any key on this machine would sit beside the cache. That residual is accepted (R2). `QUEST_MUTATE_AUDIT=all`
  removes it at the cost of a live run.

### 4.6 Why a hit proves what a live run proves

The suite's verdict is a pure function of the bytes the loaders read, the code that runs, the options and the
runtime. Mutated contexts are built only from the base world, its late data, the stage and `maxStates`
(`mutatedContext`), and the proofs use no clock, randomness or environment (checked: the only `Date.now` is
`questReset`'s log line). Equal fingerprints mean equal inputs to that function, so a live run would compute the same
raw runs. The derivation, the only code that turns raw runs into verdicts, still runs live on every hit. The test's
assertions are unchanged. The two things a hit relies on are tested for, not assumed: that the proofs are
deterministic (the serial == parallel gates; the live audit on every hit) and that every input is recorded (the
invalidation tests, 8).

## 5. The parallel suite (TS-P)

### 5.1 Plan, compute, derive

`mutationSuite(ctxRecipe, opts)` in a new `src/progression/questMutateSuite.ts`:

1. **Plan** (main thread, about 1 s): run `runMutations(plainCtx)` and `runMutations(strictCtx)` with a `recording`
   RunSource. `freshFor` records `(elementId, keys)` and returns `[]`. This is exact, because no `freshFor` or
   `has` call depends on an earlier result. `runRow` and `runGeneric` call `freshFor` exactly once per element with
   keys fixed by the row or the scope, and `has` is only reached through failures, so each requested key `k` adds
   baseline jobs `plain|k` and `strict|k`. The plan dedupes by the raw-run key (the strict variant reuses the plain
   variant's element jobs, as `RUNS` does today), so its result is the job list. Its element ids are today's
   strings (`` `${ri} ${row}#${i} ${key} ${label}` `` and `` `G#${i} ${key} ${label}` ``); a duplicate id throws.
2. **Compute** in the pool (5.2-5.5), or in-process for `jobs: 1`.
3. **Derive** (main thread, seconds): run `runMutations` for both contexts with a `prefilled` RunSource over the
   computed raw runs. The results come out in the serial order whatever order the jobs finished in.
   - **GT-18's `probe()`** (`questMutate.ts`) is not a mutation and does not go through `freshFor`. It calls
     `stageSkips` on the base context directly, so it runs **live during derivation** on every run, hit or miss
     (saturations only: well under 1 s on the real world, no state graph). The planner does not see it, and
     `prefilled` does not cover it; both are correct, since it is computed fresh each time. Its result is part of
     `entry.results`, so the re-derivation check covers it.
   - **The derivation's contexts never run a check key through the RunSource.** Their (a)-(h) runs come from jobs,
     so neither of them builds a state graph on main.
4. **The CLI's report** (`scripts/quest-verify.ts`, `questReport.ts`): both variants are computed, but the variant
   that `--strict` selects (`args.strict ? strict : plain`) fills `report.mutations`, the `mutations:` line and
   `report.ok`. So the `--json` output and the exit code are exactly today's, and the other variant goes only into
   the cache entry. `MutateModule.runMutations(ctx)` keeps its signature for the old contract. The new entry point
   is `runMutationSuite(recipe, opts)`.

`questMutateCheck.ts`: `Baseline` takes a `RunSource` (default `serial`, which keeps `RUNS`), and `freshFor` / `has`
go through it. `questMutate.ts`: `runMutations(ctx, source?)`, plus `elementsById(ctx)` (the planner's enumeration,
exported for the worker). Line budget: both files stay under 250 (157 and 160 lines today).

### 5.2 Workers (ruling R4)

- **Model: `node:worker_threads`.** Its `resourceLimits.maxOldGenerationSizeMb` caps each worker's heap, and an
  out-of-memory worker dies alone (`ERR_WORKER_OUT_OF_MEMORY`) while the main thread lives. Structured clone carries
  `ProofFailure[]` back. Child processes would work too, at the cost of a second TS loader and IPC serialisation;
  they are kept as the fallback if `worker_threads` misbehaves inside vitest's `forks` pool (R4).
- **Loading TS:** at pool start, esbuild bundles `src/progression/questMutateWorker.ts` (plus the context module, see
  below) to `node_modules/.cache/ff-quest/worker-<code fp12>.mjs` (ESM, `platform: node`, `yaml` external, so it
  resolves from `node_modules`). This takes about 31 ms and adds no new dependency: esbuild comes with vite. The same
  metafile is the fingerprint's `code` part. The bundle is the same under `vite-node` (the CLI) and vitest (the
  test).
- **Context recipe.** A worker builds its base contexts from a recipe, never from main's objects:
  - `{kind: 'repo', root, mapsDir, anchors, worstCanoe, stage, maxStates}` goes to `repoContext()` (new,
    `questMutateSuite.ts`), the CLI's and the test's construction;
  - `{kind: 'module', path, export}` is for the mini world (`tests/progression/miniWorld.ts` `miniContext`), bundled
    as a second entry.
- **Worker start:** load the world and the late data once (0.8 s) and build one **factory** base context. Compute
  the data fingerprint and post it to main, which aborts unless it equals its own (files changed during the run).
  Then build `elementsById` from the factory context and pull jobs. A job id the worker cannot find throws
  (fail-closed).
- **The factory context never runs a check key.** `stateGraph` (`questProofs.ts:58`) caches the graph on the
  context it is given (`ctx.graph ??= ...`, 0.9-1.7 GB), and `closure` caches `ctx.sat` the same way. A shared
  context that ran a (c) key would hold that graph for the worker's life, next to every later job's graph. So the
  factory context is used only to enumerate elements and as the source of `el.apply` and `mutatedContext`.
  `mutatedContext` already builds a fresh `createQuestContext` with empty caches.
- **Element job:** `make()` (`mutatedContext(factory, el.apply(factory.world))`), each key with `runCheck`, post
  `{jobId, raw: {key: ProofFailure[]}, ms, peakHeapMb}`, and drop the context.
- **Baseline job:** build a **throwaway** base context of the variant from the shared loaded world:
  `attachLate(createQuestContext(world, {strict, stage, maxStates}), late)`. This is cheap: the world and late
  data are reused, and the catalog is rebuilt in milliseconds. Run the job's keys and drop it. The heavy baseline
  (c) is its own job, so its graph lives only for that job.
- **Peak heap:** each worker samples `process.memoryUsage().heapUsed` every 250 ms and after each key, and reports
  the job's maximum. G1 records it.
- Main merges the raw runs into its `prefilled` map and its `RUNS`, so a later serial use in the same process
  (questMutateWorld's strict half) sees them.

### 5.3 Split and balance

The queue is dynamic (pull: a free worker asks for the next job). Its order: jobs with a (c) key first (45 of them:
the two baseline (c)s, then GT-4 and the generic elements in plan order), then the light ones (66 element jobs and
the light baseline keys). With about 90 s per heavy job, `W = 6` runs 8 rounds (about 12-13 min), and `W = 8` runs
6 rounds (about 9-10 min). The light jobs fill the tail. Nothing from completion order enters the result, so a test
option `shuffleSeed` (tests only) randomises the queue to prove it (8).

### 5.4 Workers and memory (ruling R3)

- Default `W = min(6, availableParallelism() - 2)` for the CLI, and **`W = 4` inside vitest** (`process.env.VITEST`
  set). `--jobs N` / `QUEST_MUTATE_JOBS` override both. `--jobs 1` runs in-process with the `serial` RunSource,
  today's exact code path.
- Each worker's first-try cap is `maxOldGenerationSizeMb: 3584`. The measured live set is under 2 GB (the world 0.2
  GB plus one graph of 0.9-1.7 GB), so the cap gives about 1.8x headroom. The retry rule (5.5) keeps it from ever
  being stricter than the serial run.
- Expected peak at `W = 6` is about 12 GB, with a worst case of 21.5 GB at the caps. At `W = 8` the figures are 16
  and 28.7 GB. Main holds no graph (0.3 GB). The suite's peak today is 7.0 GB.
- The world tier's `NODE_OPTIONS=--max-old-space-size=8192` stays for main and for questGraph.
- **The pool lock** (`questMutatePool.ts`, like `world_lock`): one pool at a time on the machine, across all
  worktrees.
  - It is the lock file `/tmp/ff-game-quest-mutate.lock`, created with `openSync(path, 'wx')` and holding
    `{pid, worktree, started}`. A lock whose pid is no longer alive (`process.kill(pid, 0)` throws ESRCH) is stale
    and is taken over.
  - A pool that finds the lock held waits, polling every 5 s. Once a minute it prints `mutate pool: waiting for
    the pool lock (pid <pid>, <worktree>, since <time>)`.
  - It is released on exit, on error and on signal.
  - `--jobs 1` (in-process) does not take the lock: that is today's single process.
  - `QUEST_MUTATE_LOCK_HELD=1` is the parent-held escape, like `FFG_WORLD_LOCK_HELD`.
- **`test:full` on a cache miss**, measured in TS-C (G2):
  - expected peak about 15 GB: the world tier's mutate main 0.3 GB, 4 workers at 2 GB or less each, and questGraph
    about 4 GB, beside the fast tier's workers (`test:full`'s 6.9 GB max RSS today is one process);
  - worst case about 22 GB at the caps;
  - about 20 min (45 heavy jobs over 4 workers, 12 rounds of about 90 s) instead of about 72.
- **What may run beside what on the 48 GB machine** (each heavy job class is bounded by its own lock):

| Job | Peak | Lock | Beside it |
|---|---|---|---|
| world compile, or the full determinism check | 15.6 GB | world-compile lock | at most one; a mutate pool may run beside it |
| `--check-determinism --changed` (two partials at once) | about 8-10 GB | world-compile lock | as above |
| mutate pool (CLI, `W = 6`) | about 12 GB (cap 21.5) | pool lock | one world-lock job, `test:fast` runs, `--strict` runs |
| `test:full` on a miss (`W = 4` pool inside it) | about 15 GB (cap 22) | pool lock (taken by its pool) | one world-lock job |
| `--from-reset` | 6.7 GB | none | beside the pool only when no world-lock job runs (R10) |
| an agent's `--strict` / `test:fast` | 3.8 GB / about 2-4 GB | none | anything; at most about 3 at once |

  The worst admitted combination: a world compile (15.6), a mutate pool (12), `--from-reset` (6.7) and two
  agents' `--strict` runs (7.6) come to about 42 GB, under 48.

### 5.5 Failure and timeout

- **The rule: the pool never fails where the serial run passes.** The serial run has one 8 GB heap
  (`NODE_OPTIONS=--max-old-space-size=8192`) and holds at most the base context's and one mutated context's
  graphs.
  - (LIMIT, the `maxStates` cap of 3,000,000 states, `questChecks.ts:82`, is a deterministic count, independent of
    the heap. It reports the same in the pool and in the serial run, and counts as a fresh failure, so as caught,
    exactly as today.)
  - A worker OOM (`ERR_WORKER_OUT_OF_MEMORY`) on the 3.5 GB first-try cap is therefore not a failure. The job is
    retried at once on a fresh worker with `maxOldGenerationSizeMb: 8192`, the serial run's heap. Only one 8 GB
    retry runs at a time, and the pool dispatches no new heavy job until it ends, so the machine's bound holds.
  - If the 8 GB retry also runs out of memory, the serial run would have too, since it has the same heap and holds
    more. The run then fails: `mutation pool: job <id> out of memory at 8192 MB (the serial heap)`.
  - `--jobs 1` is the in-process reference.
- Any other worker `error` or nonzero `exit` while it holds a job: a new worker is spawned and the job is requeued
  once. A second failure of the same job terminates the pool and rejects with `mutation pool: job <id> failed
  twice: <first>; <second>` (CLI exit 1, test failure).
- A job past `QUEST_MUTATE_JOB_TIMEOUT_S` (default 1200; about 13x the slowest measured) has its worker terminated,
  and this counts as one failure.
- An exception thrown by a check (a bug, deterministic) fails the run at once, with no retry.
- Main's `SIGINT` / `SIGTERM` and vitest's teardown terminate all workers. No partial result is ever written to the
  cache.
- Progress goes to stderr, one line per job: `mutate 23/111 G#12 ...: 88.2 s (w3)`.

### 5.6 Identical output

The pool changes only where raw runs come from (D-TS3). This is proven on the mini world in the fast tier: `jobs: 1`
deep-equals `jobs: 2`, `jobs: 3` and `jobs: 3` with two `shuffleSeed`s, for both variants; the job count, the raw-run
keys and the mutation line are compared too. On the real world it is proven once (G1).

## 6. Changed-chunk determinism (TS-D)

### 6.1 Command

`python3 -I assets-src/tools/build_map.py --check-determinism --changed [--base REV] [--full] overworld`. It takes
the world-compile lock like today. The new logic lives in `assets-src/tools/det_changed.py`, under 250 lines.
`build_map.py` only parses the flags and adds a per-chunk `--hash` output.

### 6.2 Steps

1. **Base:** `REV` defaults to `git merge-base HEAD mainline`. The integrator passes `--base <the batch's first
   parent>`. Read `build` from `git show REV:assets/maps/ai/overworld.yaml`.
2. **Current digests:** `R.digests(src, kit, ...)` of the working source (the same function `--region` uses).
   `changed = R.changed_chunks(base_build, current)`. Chunk digests cover the chunk's cells plus a ring of
   `CHUNK + RING_PAD` cells, the map-wide paint keys and every object within `OBJ_REACH`, so an object edit marks
   every chunk its art can reach.
3. **Fall back to the full check** (today's `check_determinism`, printed `full check (<reason>)`) when any of these
   holds (6.3):
   - `--full` is given;
   - the base has no `build.chunks`, or the size differs;
   - `build.compiler` differs between the base and now;
   - a file of the compiler closure changed since REV, or is untracked (6.3);
   - the base's `build.runtime` (the Python, Pillow and numpy versions, 6.3) is missing or differs from now;
   - the painted set, ring included, has `FULL_ABOVE` = 120 chunks or more.
4. **Painted:** `paint, rects = R.painted(set(), changed, W, H, limit=FULL_ABOVE - 1)` inside `try`.
   - `R.painted` returns only `(paint, rects)`: the changed chunks and their rects merged by row, as `--region`
     paints them.
   - It counts the 1-chunk ring itself and raises `RegionError` when the ring count is over `limit`. A `limit` of
     `None` would mean `PAINT_LIMIT` (160), not unlimited.
   - So `limit=119` makes 120 painted chunks or more raise. The caught `RegionError` becomes `full check (painted
     <n> >= 120)`.
   - The painted count for the report is computed the way `R.painted` counts it: the changed chunks and their
     neighbours, clamped to the grid.
5. **Two compiles at once** (ruling R8: in parallel by default, `--serial` to run them in turn).
   - This extends the existing region path in `build_map.py:1303-1335`: `check_determinism(ids, seeds, region,
     src_dir)` runs `hash_run(ids, ..., seed, region, src_dir)`, which runs the child `build_map.py --hash
     [--region r]` with a clean env of `PYTHONHASHSEED` and `FFG_WORLD_LOCK_HELD=1`.
   - The new `--rects <json file>` option of `--hash` passes explicit rects instead of a region's raster, through
     the same `compile_map(src, kit, raster=rects)`. With `--per-chunk <json list>`, the child also prints, for
     each listed chunk, the sha256 of its `below` and `above` slices and of its collision cells, next to
     `hashes()`'s whole-array digests.
   - The two seeds are 1 and 3, as today. `check_determinism`'s dict comprehension becomes two `subprocess.Popen`s
     waited together (`--serial`: one after the other).
   - Ring chunks are painted for context only, as in `--region`, and not compared.
   - **That this partial painting is byte-equal to a full compile** is proven by the existing selftests, which
     `build_map.py --selftest` runs:
     - `terrain/region_selftest.py`: "region yaml: OK", "region multi-rect: OK" (multi-rect region compiles equal
       the full compile) and "locality" (editing one region changes only that region's chunk files, byte for
       byte);
     - `terrain/region_chunk_selftest.py`: `--region` over its own full compile equals it, and a repaint of the
       changed digests "equals the full compile".

     TS-D's selftest adds one case: an explicit-rects compile of changed chunks equals the full compile on those
     chunks.
6. **Compare seeds:** each changed chunk's three hashes are equal under both seeds.
7. **Compare files:** each changed chunk's working-tree `below_r_c.png` decoded to RGBA (palette PNGs decode to the
   same RGBA, `save_chunk`'s contract) equals the compile. `above` has a file iff the compile has any alpha, and the
   file equals the compile when it exists. The compiled `overworld.yaml` collision on those cells equals the compile's,
   and its `build.chunks` equals the current digests. This is new: today's check never compares with the files.
8. **Unchanged chunks:** every chunk file outside the changed set is byte-equal to REV's (`git diff --quiet REV --`
   on those paths, plus no untracked chunk files). A chunk whose digest did not change but whose file did fails the
   check and asks for `--full`.
9. **Mode 7:** unchanged. `mode7_atlas.py --check-determinism overworld` stays as it is (9.7 s; it bakes from the
   files, so it covers the new chunks), and `mode7Atlas.test.ts` still catches a stale atlas.

### 6.3 The compiler closure and when the full check runs

**The closure is recorded, not listed.** At the end of every compile, the `--hash` child and `build_map.write()` take
the `__file__` of every `sys.modules` entry that resolves under `assets-src/`. They make the paths repo-relative and
sort them. This is the compiler closure `CC`.
- It includes the lazily imported modules (`build_hooks` imports `build_map`, `map_checks_region` and `mode7_atlas`
  inside functions). Those are loaded by the end of a compile, so the closure is taken at the end, not at import.
- It includes **any `layouts/` module a compile loads**: `build_hooks.py:26` and `map_checks_region.py:23` put
  `assets-src/tools/layouts` on `sys.path`, so a layouts module imported there (for example a `world_api` constant)
  is a compiler dependency and goes into `CC`. Rev 1's "layouts only write the source" held only for the layouts
  that are not imported.
- It includes `gen/prop_spec.py` (through `kit_props`), `waterline.py`, `kit_props.py` and the `terrain/*`
  modules, and after WR `map_checks_wrap.py`. These are exactly the files `compiler_digest` misses today (1).

**`build.runtime`:** `{python: sys.version.split()[0], pillow: PIL.__version__, numpy: np.__version__}`, written into
the compiled map's `build` block next to `compiler` and `chunks`.

**Step 3's checks against REV:**
- Any file of `CC` that differs from REV (`git diff --name-only REV -- <CC>`, which covers both committed and
  uncommitted changes), is missing at REV, or is untracked (`git ls-files --others --exclude-standard -- <CC>`, and
  also over the closure's directories, so that a new untracked module that shadows an import is counted).
- The kit art, through `build.compiler`.
- `build.runtime` differs from the base's, or the base has none. The first TS-D compile writes it, so a full check
  follows once.

**R9 uses the same closure.** `compiler_digest(kit)` hashes `CC`'s files instead of `CODE = build_map.py, kit.py,
terrain/`, plus the kit art as today and `build.runtime`. A digest is needed before a compile (`check_base` for
`--region`, step 3 of `--changed`), so **`compiler_closure()` is the union of a fixed lazy-import list and every
closure recorded at the end of a compile** in the process (momus, final fix). The list (`terrain/closure.py`
`LAZY_IMPORTS`) is imported first: `build_map`, `build_hooks`, `map_checks_region`, `mode7_atlas`, `waterline`,
`kit_props` and the map-dependent ones, `ambient_flame` (`build_hooks.ambient` imports it only for a map with
flames) and, after WR, `map_checks_wrap` (`check_seam` imports it only for a wrapped map). `CC` for step 3 is always
the current tree's `compiler_closure()`, never a list stored in a compiled map. The CLI and the `--hash` child take
the pre-compile closure first, and `record_closure()` at the end of every compile fails the compile when it loaded a
module outside it (`compiler closure: the compile loaded ..., not in the pre-compile closure`). So a module a
compile loads is in the digest written with that compile, and a pre-compile digest misses one only if a compile
would fail on it: a new lazy import is caught at its first compile, not silently left out of the digest. TS-D's gate
asserts on the real `overworld` compile (not only the synthetic one) that the closure before the compile is a
superset of the closure after it; the selftest asserts it on the synthetic world.

**So the full check runs:**
- automatically, on any change in `CC`, the kit art or the runtime versions, and on the other conditions of step 3;
- at the integrator's choice with `--full` (R8: no periodic full check by default).

### 6.4 What it proves and what it no longer proves

- **It proves** (a) every changed chunk compiles to the same pixels and collision under two hash seeds, (b) the files
  in the tree are what the compiler produces for them (staleness, new), and (c) every other chunk file is byte-equal
  to the base commit's.
- **It no longer proves** that the unchanged chunks are seed-independent under this compile. That was proven when they
  were last compiled and checked, and by (c) and the unchanged compiler they are the same bytes. Two conditions keep
  this sound:
  - each merge runs either the full or the changed check, so the base was itself checked;
  - a global nondeterminism (a step whose output depends on the seed and shows only in far chunks) still shows up,
    as a changed file under an unchanged digest at the integrator's full compile, which step 8 fails.
- **WR:** the ring stays clamped at the map's edges. WR-3 passes `wrap` through and checks the seam, but painting
  does not wrap (the edges are Water with `SEAM_MARGIN` 4, "chunks unchanged"). If painting ever wraps, `R.painted`'s
  ring must wrap mod the chunk grid. That is risk T7.

### 6.5 Expected figures

A QW2-sized change (6 changed chunks, about 30 painted with the ring) is two partial compiles of about 80-90 s each,
run in parallel at about 4-5 GB each. With the file comparison, the check takes **about 100-120 s instead of 400 s,
saving about 5 min per world change** (the full compile itself is still needed). This is less than the request's
"about 10 minutes": the 9 min that NW2 quoted for "full compile and determinism" includes the compile, which stays.
To be measured in TS-D (G5).

## 7. The process change (TS-G)

### 7.1 AGENTS.md (Quick Reference, Testing "Who runs what", "The world (pass NW)")

**Agents**, before a handoff:
- `npm run build`, `npm run test:fast` and the tests of what they touched (unchanged);
- after a change to world or quest data, `src/progression/**` or the field rules: `npm run quest -- --strict` (all
  proofs (a)-(h); 116 s, 3.8 GB), and for `--stage` work the stage gate;
- after a world change: `world.py`, the compile, `build_map.py --check-determinism --changed overworld` and
  `mode7_atlas.py --check-determinism overworld`;
- **not** `--mutate`, `--from-reset`, `test:full` or the full determinism check. An agent *may* run `npm run quest --
  --mutate` (parallel, about 13 min) when it edits a gate-table row or `nonLoadBearing`. Its result lands in the
  shared cache, and the integrator's run on an identical tree then hits it.

**The integrator, once per merge batch.** Every merge into `mainline` is a batch: a single branch and a hotfix too.
The batch is assembled on an integration branch `int-<batch>` cut from `mainline`, and **`mainline` advances (a
fast-forward to `int-<batch>`) only after steps 2-5 all pass.** `test:full` (step 5) is never skipped, even when step
4 has just run: on a cache hit it costs about 10 min, and on a miss it is the backstop that runs the suite live.
1. Merge the batch's branches into `int-<batch>`, each rebased per the usual rules. Re-run `world.py` and the layout
   scripts, and full-compile the world under the lock if it changed (never hand-merge chunks or `mode7*.png`).
2. `build_map.py --check-determinism --changed --base <batch base> overworld` (it falls back to full by itself) and
   `mode7_atlas.py --check-determinism overworld`; `git diff --exit-code assets assets-src/maps` after re-running
   the layouts.
3. `npm run build`, `npm run test:fast`.
4. `npm run quest -- --strict --mutate --jobs 6` (about 13 min; writes the cache) and `npm run quest -- --strict --only
   c --from-reset` (11 min). Run them one after the other by default; run them at the same time (about 19 GB) when
   the machine is otherwise idle (R10).
5. `npm run test:full`: a hit on step 4's entry, about 10 min.
6. Fast-forward `mainline` to `int-<batch>`. Record the figures (wall, RSS, `cache hit <fp12>`) in the batch's
   result section.

**When a step fails** (most often step 4: an UNCAUGHT element, a SOFTLOCK, a LIMIT):
1. Find the branch. The failure names its row, element, map and stage, so match them against each branch's diff
   (its maps, its quest stages, its verifier files). When that is not conclusive, re-run step 4 on
   `int-<batch>` without one candidate branch.
2. Drop that branch from the batch: recreate `int-<batch>` from `mainline` without it, and send it back to its agent
   with the failing lines.
3. Re-run the batch from step 1.

`mainline` never holds a failing batch. The entries the failed runs stored stay in the cache under their own
fingerprints, and they are harmless: they are never looked up again and are pruned.

From step 1 to step 5 this is about 40 min per batch, against about 77 + 72 + 11 + 7 min today.

### 7.2 Other text

- `tests/tiers.ts`: the `why` of `questMutateWorld.test.ts` becomes "the real-world mutation suite: a cache hit (4)
  takes about 3 min (the live audit), a miss runs the parallel suite live (about 13 min at 6 workers)". It stays
  heavy (a miss is over the 90 s budget). `questGraph` is unchanged.
- **AGENTS.md**, each section by name:
  - Quick Reference: the times, and the `test:full` line ("with a cache hit about 10 min");
  - Testing, "Who runs what": 7.1's rules;
  - Testing, "Test tiers", "What changed": the `Baseline.freshFor` bullet, rewritten. The `--strict` run reuses
    the plain run's mutated checks inside one run, as before, and now also across runs through the cache
    (fingerprint, store, audit). The pool computes the raw runs, and the derivation stays serial;
  - Testing, "The guard": 7.2's timing note;
  - "Editing a 2x Map", the after-an-edit block: the `--check-determinism` line becomes `build_map.py
    --check-determinism --changed overworld` (the full check falls back by itself, `--full` forces it);
  - "The world (pass NW)", "Compile": the gates line (`--changed` beside the full check);
  - "The world (pass NW)", "Commands": the `--mutate` advice becomes "the integrator's, once per batch; parallel
    (`--jobs`, default 6), about 13 min; writes the cache; agents may run it when they edit a gate row or
    `nonLoadBearing`", plus `--cache`, `--audit` and the env vars.
- **`build_map.py`'s docstring usage** (lines 6-8): add `--check-determinism --changed [--base REV] [--full]
  [--serial] overworld` and the internal `--hash --rects FILE --per-chunk FILE`.
- **`questMutateWorld.test.ts`'s header**: rewritten for 4.3 (hit: derive, check, audit; miss: the live pool run;
  the env vars). Its "about half an hour on one worker" text goes.
- `tests/tiers.ts`'s `why` as above. `questMutate.test.ts`'s header names the pool and cache tests.
- **The full-tier timing guard (ruling R14).** The 90 s budget stays for the fast tier only, unchanged; a world-tier
  budget would fail every honest miss.
  - What is added is visibility. `questMutateWorld.test.ts` sets `task.meta.questMutateCache = {source:
    'hit' | 'miss', fp12, wallS, jobs}`. `tests/timingReporter.ts` copies `meta` into the `TEST_TIMINGS` JSON and
    prints one summary line at the end of every run that included the file: `questMutateWorld: cache hit <fp12>
    (audit 150 s)` or `questMutateWorld: cache MISS <fp12> (live run 1210 s on 4 workers)`.
  - A miss is never a failure, but it is visible in the summary and in the timings.
- The user's memory note "No hour-long agent tests" holds as it is.

## 8. Tests

**The repository-layout fixture** (`tests/helpers/questRepoFixture.ts`, new).
- The mini fixtures (`tests/fixtures/quest/*.yaml`, one file each, read by `loadFixture`) are not in the repository
  layout, and the pool's `module` recipe builds its context without `readInput`. So neither can exercise the
  fingerprint.
- `writeRepoFixture(dir, name = 'mini')` writes the fixture into a temp root in repository layout:
  - `fixtureInput(name)`'s maps as `assets/maps/ai/<id>.yaml`, plus `assets/maps/ai/index.yaml`;
  - its quest as `assets/data/quest.yaml`, its cutscenes and items as `cutscenes.yaml` and `items.yaml`;
  - `MINI_LATE` as `enemies.yaml`, `kits.yaml` and `spells.yaml` (an empty list), and a minimal
    `world-anchors.yaml`;
  - one legacy `assets/maps/<id>.yaml` linked from a compiled map, for the probe cases.
- The repository loader starts a new game at Cornelia, but the mini world starts at `{map: overworld, x: 2, y: 2}`.
  So `LoadOptions` gains the **test-only** `start` and `worldMap` overrides, passed through to `buildQuestWorld`
  (which already takes them) and recorded in the fingerprint's `options` (3).
- `repoContext({root: dir, start, worldMap})` then loads every byte through `readInput`.
- The fixture's travel rows are the defaults (`MINI_ROWS` is code, not data), so its verdicts may differ from
  `miniContext()`'s. The tests that use it assert hit == miss and fingerprint behaviour, never specific verdicts.

| File | Tier | What |
|---|---|---|
| `tests/progression/questInputs.test.ts` (new) | fast | **Data**, on the repository-layout fixture: changing one byte flips fp, for each file (a compiled map, `index.yaml`, the linked legacy map, `quest.yaml`, `cutscenes.yaml`, `items.yaml`, `enemies.yaml`, `spells.yaml`, `kits.yaml`, `world-anchors.yaml`); adding a probed-absent legacy map (a transition target with no file) flips it; an unread file (a stray `assets/data/x.yaml`) does not. **Options**: `maxStates`, `stage`, `worstCanoe`, `start` and the salt flip it. **Code**: the metafile closure lists `fieldRules.ts`, `worldReset.ts`, `worldRevalidate.ts`, `schemaValidation.ts` and, after WR, `worldWrap.ts` and `questWrap.ts`; a comment-only edit of a closure file (in a temp copy, through a `codeRoot` option of the bundle helper) flips it. **The T2 guard** (12) runs here |
| `tests/progression/questMutatePool.test.ts` (new) | fast | on `miniContext()` through the `module` recipe: `jobs: 1` deep-equals `jobs: 2`, `jobs: 3` and two `shuffleSeed`s (both variants, the job list, the raw keys, the line); a worker killed mid-job is retried and the result is equal; an injected OOM on the first cap is retried at the 8 GB cap (a stub job that allocates past a small test cap) and succeeds; a job failing twice rejects with its id; a timeout (`QUEST_MUTATE_JOB_TIMEOUT_S` set tiny on a stub job) rejects; `prefilled` throws on a missing key; the factory context's `graph` and `sat` stay unset after a run (fix 1); a second pool waits on the lock (a lock file held by a live pid, a short poll) and takes a stale one |
| `tests/progression/questMutateCache.test.ts` (new) | fast | on the repository-layout fixture, with `QUEST_MUTATE_STORE=<temp dir>` (4.4): miss, then store, then hit gives the same results; the fixture's bytes enter `data` (one byte changed in the fixture gives a miss); an edited `results` fails the re-derivation; an edited light raw run fails the audit; an edited `fingerprint` or `inputs` is a miss; a malformed file is a miss with a message; `refresh` and `off` behave as stated; `--maps` and other-root runs neither read nor write; `QUEST_MUTATE_STORE` throws outside vitest; atomic rename; a hit touches the mtime; pruning keeps the 32 most recently used; an input edited mid-run is not stored; no stored `ProofFailure` holds an absolute path (`path` holds event ids and `message` map ids, so this is asserted, not expected to fail) |
| `tests/progression/questMutateWorld.test.ts` | world | rewritten as in 4.3; the four assertions unchanged |
| `assets-src/tools/det_changed.py` selftest, in `build_map.py --selftest` | python | on a synthetic 48x48 world with digests in a temp git repo: one changed cell gives 1 changed chunk, painted with its ring; an object edit marks its reach; an explicit-rects compile equals the full compile on the changed chunks; each fallback gives the full check with its reason (a closure file changed, an untracked closure file, a missing `build.chunks`, a size change, a different `build.runtime`, the painted count at the limit through the caught `RegionError`); a tampered unchanged chunk file fails step 8; a stale changed file fails step 7; an injected seed-dependent paint (a test-only hook) fails step 6; the pre-compile `compiler_closure()` equals the closure recorded after a compile |

`test:fast` grows by 3 small files (expected under 15 s in total, the pool test included; the worker bundle is built
once per run).

## 9. Tranches

Rules:
- **TS-0 and TS-D may start now** (integrator ruling), on branches from today's `mainline`, and rebase over `wr`
  when it merges (11). **TS-P, TS-C and TS-G** branch from `mainline` after `wr` has merged. Each tranche is
  mergeable alone and in order.
- Agents run `npm run build`, `npm run test:fast` and the tests they touched.
- Scratch goes in `/tmp/<agent>/`, review output in `~/temp/ff-game/test_speed/<tranche>/`.
- No tranche changes a proof, a bound, a seed count, the mutation rows or any world data.
- **Line ceilings.** Every new or edited `src/progression` file stays under 250 lines: `tests/data/questCeilings.test.ts`
  finds new files by itself and has no exceptions. The expected sizes:

| File | Lines |
|---|---|
| `questInputs.ts` | about 120 |
| `questMutateSuite.ts` | about 180 |
| `questMutatePool.ts` (with the lock) | about 230 |
| `questMutateWorker.ts` | about 90 |
| `questMutateCache.ts` | about 200 |
| `questMutate.ts` | 157 -> about 185 |
| `questMutateCheck.ts` | 160 -> about 190 |
| `questReport.ts` | 149 -> about 175 |

  If the pool passes 240, the lock moves to `questMutateLock.ts`. Python: `det_changed.py` stays under 250, and
  `build_map.py` is a known exception (only its flags and `--hash` grow, about 30 lines).

| Tranche | Owner | Content | Gates | Depends | Effort |
|---|---|---|---|---|---|
| **TS-0 Inputs** | verifier agent | `questInputs.ts` (`readInput`, `probeInput`, `fingerprint`, the bundle and metafile helper, the T2 guard); the three loaders switched over; `QuestWorld.inputs`, `LateData.inputs`; `LoadOptions.start` / `worldMap` (test-only); `tests/helpers/questRepoFixture.ts`; `questInputs.test.ts`; esbuild pinned in `devDependencies` (R15) | build; test:fast; `npm run quest -- --strict --json` gives the same JSON as before the change (diff) | none (rebase over `wr`) | 5 h |
| **TS-P Pool** | verifier agent | the `RunSource` in `questMutateCheck.ts`; `runMutations(ctx, source)`, `elementsById` (`questMutate.ts`); `questMutateSuite.ts` (plan, compute, derive, `repoContext`, the CLI variant rule); `questMutatePool.ts` (the pull queue, the factory and throwaway contexts, the 8 GB retry, the lock, peak heap); `questMutateWorker.ts`; `questReport.ts` (`--jobs`, the `mutate:` line); `scripts/quest-verify.ts`; `questMutatePool.test.ts` | build; test:fast; G1 (the real world, once, in the background) | TS-0, `wr` merged | 11 h |
| **TS-C Cache** | verifier agent | `questMutateCache.ts` (the store in the git common dir, `QUEST_MUTATE_STORE`, the entry, hit with derive and audit, miss with run, re-fingerprint and store, LRU prune); the CLI's `--cache`, `--audit`; `questMutateWorld.test.ts` rewritten with its header and `task.meta`; `tests/timingReporter.ts` (R14's summary line and `meta` in `TEST_TIMINGS`); `questMutateCache.test.ts`; `tests/tiers.ts` text | build; test:fast; G2, G3 | TS-P | 7 h |
| **TS-D Determinism** | tools agent | `det_changed.py`; `build_map.py` (`--changed`, `--base`, `--full`, `--serial`, `--hash --rects --per-chunk`, the closure recorded at the end of a compile, `build.runtime`, the docstring); `terrain/region.py` (`compiler_closure()`, R9's digest); its selftest; one full world recompile at merge (the chunks byte-identical; `build.compiler` and `build.runtime` change) | `build_map.py --selftest`; G5; `--check-determinism overworld` (full) still passes; `git diff --stat` after the recompile shows only `assets/maps/ai/*.yaml` `build` lines | none (rebase over `wr`) | 7 h |
| **TS-G Process** | integrator | AGENTS.md (7.1, 7.2 by section); PROGRESS; `docs/TEST_SPEED_PLAN.md` (this plan, with its result section); the first batch run under the new checklist, its figures recorded | G4; the checklist run end to end once on an integration branch | TS-C, TS-D | 2 h |

Merge order: TS-0 and TS-D whenever ready (before or after `wr`). Then TS-P after `wr`, then TS-C, and TS-G last.
That is about 32 h of work. The critical path from the `wr` merge, TS-P then TS-C then TS-G, is about 20 h, plus
G1's runs in the background (about 77 + 13 min, plus the pre-TS reference if none is saved).

## 10. Gates for the work itself

| Gate | Command | Pass |
|---|---|---|
| **G1** serial == parallel == pre-TS, real world, once | (0) the reference: the pre-TS `npm run quest -- --strict --mutate --json /tmp/ts/pre.json` on the same tree. Use WR's integration run if it saved `--json` on a tree with the same verifier inputs (check its data hashes); otherwise run it from a worktree at the `wr` merge commit. (1) `--jobs 1 --cache off --json /tmp/ts/serial.json`. (2) `--jobs 6 --cache off --json /tmp/ts/par.json`. Then a `node -e` deep-equal of `.mutations`, `.proofs` and `.ok` | all three equal (the pre-TS run against the refactored serial run proves the refactor; serial against parallel proves the pool). Record each walltime, the peak RSS, and **every job's peak heap** from the pool's job log (`/tmp/ts/par.jobs.json`: id, ms, peakHeapMb, retried). Targets: parallel at most 18 min, at most 24 GB, no 8 GB retry |
| **G2** a hit and a miss give the same verdict | `QUEST_MUTATE_CACHE=refresh npx vitest run --project world tests/progression/questMutateWorld.test.ts` (miss, live, stores), then the same with no env (hit), then with `QUEST_MUTATE_AUDIT=all` (hit, full live audit) | all three pass; the hit's derived results deep-equal the miss's (the test logs both sha256s); the miss's wall time and the whole run's peak RSS recorded (5.4's `test:full`-miss estimate checked) |
| **G3** the full suite with a hit | `npm run test:full` after G2 | OK, at most 12 min (target 10), the reporter's `questMutateWorld: cache hit` line |
| **G4** test:fast unchanged | `npm run test:fast` before and after TS | the same files plus the 3 new ones, every old test still passing, wall within +10 s, no fast file over budget |
| **G5** changed-chunk determinism | in a scratch clone (`/tmp/ts/clone`, an APFS clone of the committed compile): a one-region source edit (e.g. a deco moved), compile, then `--check-determinism --changed`; then the same with a closure-file touch, and with an untracked closure file (each gives the full check) | `deterministic (changed C, painted P ...)`; wall and peak recorded (target at most 150 s for a QW2-sized change); each fallback prints its reason |

## 11. Sequencing with WR

- WR (branch `wr`, 4 commits ahead: WR-0 to WR-3) touches `src/progression` (`questSearch.ts`, `questPlaces.ts`,
  `questRoute.ts`, `questExits.ts`, `questTravel.ts`, `questGeo.ts`, `questMutateFind.ts`, `questProofsLate.ts`,
  `questCurve.ts`, the new `questWrap.ts`), `src/systems/fieldRules.ts`, the new `worldWrap.ts`, `build_map.py` (the
  `wrap` passthrough, `check_seam` in `write()`, the wrapped preview), `mode7_atlas.py` (the 2048 POT low atlas),
  `build_hooks.py`, `map_checks*.py` and the world. It still has an open ruling (S21 at L29.2).
- **TS-0 and TS-D start now** and rebase over `wr` when it merges: `git fetch` if needed, then `git rebase mainline`
  on the TS branch.
  - **TS-0's conflicts:** `questData.ts`, `questMaps.ts` and `questLateData.ts` are TS-0's (WR touches none of
    them), so none are expected. After the rebase, `questInputs.test.ts`'s closure assertion must list
    `worldWrap.ts` and `questWrap.ts`. Add them to the test in the rebase commit, and confirm with the metafile
    that they are really in the closure.
  - **TS-D's conflicts:** in `build_map.py`, WR adds `"wrap"` to `PASSTHROUGH`, `HOOKS.check_seam` in `write()`
    and the wrapped `preview`, while TS-D adds flags in `main()`, `--hash`, and the closure and `build.runtime` in
    `write()`. Take both, keeping TS-D's closure capture after `check_seam`. In `build_hooks.py`, WR adds
    `check_seam`; TS-D does not edit the file.
  - After TS-D's rebase, `compiler_closure()` must contain `map_checks_wrap.py`. The selftest's pre-compile
    against post-compile equality catches a miss.
  - The world recompile TS-D needs at its merge (R9) is done once, on the rebased tree, after WR's recompile.
  - After either rebase, re-run its tests and `build_map.py --selftest`.
- **TS-P, TS-C and TS-G branch from `mainline` after the `wr` merge.** TS-P edits `questMutate.ts` and
  `questMutateCheck.ts`, which WR does not touch, so it could rebase cleanly too. It waits anyway, because G1 must
  run on the wrapped world that it will guard.
- Any cache entry made before a rebase is dead: its fingerprint changes with the code.
- WR's own integration run (`--strict --mutate` on the wrapped world) runs the old serial way. Keep its `--json`
  as G1's pre-TS reference. Nothing in TS changes a verdict.

## 12. Risks

| # | Risk | Mitigation |
|---|---|---|
| T1 | A proof is not deterministic (e.g. Map iteration over a set built in a different order in a worker), so serial and parallel differ or a hit's audit fails | G1 (against pre-TS too) and the mini tests; the audit on every hit; derivation in one place; on a mismatch the fix is the proof, never a looser compare |
| T2 | An input not recorded (a module reads a file through a path that skips `readInput`) | **the guard runs over the bundle's metafile closure**, the same closure the fingerprint hashes, not over a directory listing: for every input in `metafile.inputs`, its `imports` must not contain `fs`, `node:fs`, `fs/promises` or `node:fs/promises`, except for `src/progression/questInputs.ts`, `questMutateCache.ts` and `questMutatePool.ts`. The cache and pool modules do read and write, but only their own store, lock and bundle, never a verifier input. So a new `fs` user anywhere in the closure (in `src/systems`, `src/core` too) fails `questInputs.test.ts`. Today the closure's only `fs` users are `questData.ts`, `questMaps.ts` and `questLateData.ts`, which TS-0 moves to `readInput` |
| T3 | `worker_threads` under vitest's `forks` pool: the bundle path, the `yaml` resolution, or the teardown | the bundle is plain ESM in `node_modules/.cache`; the pool test runs in the fast tier under the default `threads` pool and in the world tier under `forks`; fallback R4: child processes with the same bundle |
| T4 | Memory: several graphs at once plus other agents' work | measured live set under 2 GB per worker; 3.5 GB first-try cap with the 8 GB retry (one at a time); default W 6 (CLI), 4 (vitest); the pool lock (one pool on the machine); 5.4's table |
| T5 | The heavy jobs' times vary (0-100 s), so the rounds are uneven | pull queue, heavy first; at worst one extra round (about 90 s) |
| T6 | The cache store grows or is corrupted | LRU prune to 32; atomic writes; a malformed entry is a miss with a message |
| T7 | Changed-chunk mode misses a dependency outside the digest window (an art reach over `OBJ_REACH`, a global step) | step 8 (an unchanged-digest file that changes fails); the integrator's full compile writes every chunk, so drift shows as a file change; `--full` at will; the recorded closure and `build.runtime`; WR: if painting ever wraps, the ring must wrap too |
| T8 | The fingerprint is so strict that a hit is rare (any compiled-map byte, e.g. `build.compiler` after a tools change) | accepted: a miss costs about 13 min (CLI) or 20 (`test:full`) now, not 70; the integrator's own run fills the store once per batch, so `test:full` hits in the normal flow; R14's summary line shows every miss |
| T9 | A deliberately forged heavy raw run | accepted residual (4.5); `QUEST_MUTATE_AUDIT=all` |
| T10 | Agents skip `--mutate` and a branch breaks a gate row, found only at the batch | the integration branch: `mainline` never advances on a failure; 7.1's drop-and-re-run; agents may run `--mutate` themselves (13 min) when they edit rows |
| T11 | A stale pool lock blocks every pool (a crashed holder) | the pid check takes over a lock whose pid is dead; the wait message names the holder; `QUEST_MUTATE_LOCK_HELD=1` for a parent that holds it |

## 13. Rulings (integrator, 2026-11-22: R1-R12 at their defaults, amended by momus's fixes; R13-R15 new defaults)

| # | Question | Ruling |
|---|---|---|
| R1 | Where the cache lives | **the git common dir, `.git/ff-cache/quest-mutate/<fp>.json`**, untracked and shared by all worktrees (4.1, option A); a test-only `QUEST_MUTATE_STORE` override |
| R2 | The live audit on a hit | **every light job plus 1 seeded heavy job** (about 2.5 min), each baseline key on a throwaway context; `QUEST_MUTATE_AUDIT` overrides |
| R3 | Workers and memory | **CLI W = min(6, cores - 2); vitest W = 4; first-try heap cap 3,584 MB per worker; an OOM retry at 8,192 MB (the serial run's heap), one at a time, so the pool never fails where the serial run passes; one pool per machine (the lock)**; the integrator may use `--jobs 8` on an idle machine |
| R4 | Worker model | **`worker_threads` with an esbuild bundle**; child processes as the fallback |
| R5 | Which runs read and write the cache | **only default-option repository runs** (no `--stage`, `--maps`, `--anchors`, `--worst-canoe`, default `maxStates`) **whose `--root` is the bundle's source root**; another root neither reads nor writes; the test-only store override as the exception (4.4) |
| R6 | Runtime in the fingerprint | **full Node version, and the installed `yaml` and `esbuild` versions** (from `node_modules/<pkg>/package.json`) |
| R7 | May agents' runs write the shared cache? | **yes** (the entries are content-addressed, so a stale tree cannot pollute another's key) |
| R8 | Changed-chunk check: the two seeds | **in parallel by default** (`--serial` to run them in turn); **full check automatic** on a change in the recorded compiler closure (untracked files included), the kit art or the Python, Pillow or numpy versions; otherwise at the integrator's `--full`; no periodic full check |
| R9 | Fix `compiler_digest` | **yes, in TS-D: it hashes the recorded loaded-module closure** (6.3) and the runtime versions instead of `CODE`; one full world recompile at its merge (chunks byte-identical) |
| R10 | `--from-reset` | **unchanged (serial, 11 min)**, run beside `--mutate` only when no world-lock job runs; parallelising its 195 states is a possible later tranche, not in TS |
| R11 | Agents' verifier gate | **`npm run quest -- --strict`** (all proofs, 2 min) after world, quest or verifier changes |
| R12 | `FULL_ABOVE` for `--changed` | **120 painted chunks, ring included, or more** gives the full check (`R.painted(..., limit=119)`, `RegionError` caught) |
| R13 | Every merge a batch, on an integration branch | **yes** (7.1): `mainline` fast-forwards only after steps 2-5 |
| R14 | The full-tier timing guard | **keep the 90 s fast budget unchanged; add no world budget; add visibility**: `task.meta` in `TEST_TIMINGS` plus the reporter's `questMutateWorld: cache hit / MISS` summary line (7.2). If vitest 1.6's `task.meta` does not reach the reporter, the test writes `<TEST_TIMINGS dir>/questMutateCache.json` and the reporter reads it |
| R15 | Pin esbuild | **yes**: `"esbuild": "0.21.5"` (the installed version) in `devDependencies`, so the bundle and the fingerprint do not move with a vite update |

## Changelog

- Rev 2 (2026-11-22): momus's 10 required fixes, the added items and the optional items (see "Rev 2: momus
  fixes" at the top); the integrator's rulings recorded (13); TS-0 and TS-D may start before `wr`.
- Rev 1 (2026-11-22): first plan (PT). Measured: the job shape (109 results = 66 + 1 + 42), (c) about 90 % of the
  time (84.5 s per context of 93.4 s), live heap per graph, the 31 ms / 48-file code closure, and the
  compiler-digest gap.

## TS result (2026-11-23, branch `ts`, on `mainline` 524cae8d with `wr` merged)

Commits: TS-0 4b4ca745, TS-D 19936929, the `mainline` merge 0db772d5, TS-D's world recompile 91bdab51, TS-P 8346f8d6,
TS-C ad22924e, the G3 fixes 9f59118a, TS-G (this section, AGENTS.md, PROGRESS). Measured on this machine (14 cores,
48 GB) with other agents' work running (load 6-9).

| What | Before TS | After TS |
|---|---|---|
| `npm run quest -- --strict --mutate` | 4,620 s, 6.9 GB (pre-TS code at 524cae8d) | `--jobs 1`: 5,047 s, 7.0 GB; `--jobs 6`: 1,080 s (mutate 959 s), 11.6 GB; again with the final code: 1,002 s (mutate 878 s), 11.3 GB, entry stored |
| `questMutateWorld.test.ts` (world tier, 4 workers) | about 28 min | miss 1,272-1,317 s, 9.3-10.4 GB; hit 118-134 s, 2.3 GB; hit with `QUEST_MUTATE_AUDIT=all` 1,315 s |
| `npm run test:full` (2 workers) | 72-79 min | hit 224 s (427 files, 10,233 passed, 2 skipped); a miss is the world file's live run, about 23 min (estimated from G2, not run separately) |
| `npm run test:fast` | 61.6 s, 422 files, 10,133 tests (524cae8d) | 67.7 s, 425 files (the 3 new ones), 10,201 tests |
| `build_map.py --check-determinism overworld` (full) | 400 s, 13.1 GB (NW2-INT) | 591 s under load (the fallback, unchanged) |
| `--check-determinism --changed` (a moved boulder: 16 changed chunks, 36 painted) | - | 65 s, the parent 4.1 GB |
| world compile | 326-346 s, 15.6 GB | unchanged (354 s, 11.3 GB in the scratch tree) |

Gates:
- **G1** (real world, once each, one at a time): the pre-TS run, the refactored `--jobs 1` and `--jobs 6` give equal
  `.mutations`, `.proofs` and `.ok` (68 rows, 109 elements, OK). 112 jobs, no retry; the job log
  (`/tmp/ts/par.jobs.json`) reports peaks of up to 5,307 MB per job (`G#62 past-temple-2 gate`), the slowest job
  331 s (`G#5 cavern-earth-b5`). Parallel 18.0 min end to end (target 18), 11.6 GB (cap 24).
- **G2**: miss (`QUEST_MUTATE_CACHE=refresh`), hit and hit with the full audit: all pass with the same results
  sha256 (plain and strict e7130748e025); the hit audits 67 light + 1 heavy jobs.
- **G3**: `test:full` on the hit, 224 s, `questMutateWorld: cache hit ec5a469fa3aa (audit 134 s)`. The first run
  found three failures, fixed in 9f59118a (below).
- **G4**: the 3 new files, every old test passing, +6 s wall, no fast file over budget (the slowest new file
  `questMutatePool.test.ts` about 33 s).
- **G5**: in a scratch worktree, a moved boulder: `overworld: deterministic (changed 16 chunks, painted 36 with the
  ring, base HEAD; files match)` in 65 s; a comment in `waterline.py` and an untracked `assets-src/tools/zz_new.py`
  run the full check: the comment as `full check (the compiler digest differs from the base's)` (the digest hashes
  the closure, so it is caught first), the untracked file as `full check (compiler files changed since HEAD:
  assets-src/tools/zz_new.py)`. The full check on `ts`: `overworld: deterministic`, 591 s (under load);
  `mode7_atlas.py --check-determinism overworld` deterministic.
- `npm run build` OK; `npm run quest -- --strict` OK (inside the `--mutate` runs); `build_map.py --selftest` 153
  checks (det_changed's 7 among them; 251 s, was 150 s); the real `overworld` compile's closure (30 files after the
  compile) is within the pre-compile closure (30), printed by every world compile.

Deviations and findings:
- **The process heap flag overrides the workers' caps.** `--max-old-space-size` (8,192 through the NODE_OPTIONS of
  `npm run quest`, `test:full`, `test:world`) is a V8 process flag: a worker's `resourceLimits` is ignored under it
  (probed: a 48 MB cap allocates 160 MB) and `execArgv` cannot set it per worker. So in the CLI and the world tier
  every worker is capped at the serial heap (8,192 MB) from the start; the 3,584 MB first cap and the OOM retry work
  only without the flag (the fast tier, where their tests run). R3's rule still holds (no worker has less than the
  serial heap). The memory table: the measured peaks are 11.3-11.6 GB at 6 workers and 9.3-10.4 GB at 4, inside
  the table's figures; the per-job peaks from `worker.getHeapStatistics()` (up to 5.3 GB) are transient and did not
  coincide (the process peak was 11.6 GB).
- R3's lock is not taken by the fast tier's fixture pools (`lock: false`): in `test:full` they waited behind the
  world tier's audit pool.
- `questGraph.test.ts`'s import rule failed on `mainline` since the `wr` merge (`questExits.ts` imports
  `../systems/worldWrap.js`); fixed in 9f59118a.
- The pool test runs the mini world serial against 4 shuffled workers; the in-order 2-worker run and the other
  shuffles run on the clean fixture (the mini serial run alone is 20 s).
- `InputLog.read` / `.probe` are the plan's `readInput` / `probeInput`.
- The `--jobs 1` line counts raw runs (1,567), the pool line jobs (112).
- The full determinism check stays serial (two full compiles at once would be about 30 GB); only `--changed` runs
  its two seeds at once.
- TS-D's recompile is its own commit after the `wr` merge (the branch merged `mainline` rather than rebasing).

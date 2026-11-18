# PLAY-3 fix list (pass W, stages S23-S31)

Playtester PLAY-3, branch `w-play3` (from mainline 64be8290). Scenario-hop with a headless browser, keyboard input,
`mute=1`. This file is updated as the playtest goes; the latest section says how far it got.

Severity: P0 blocks progress or crashes; P1 serious, wrong-side or unfair; P2 noticeable; P3 polish.

## Findings

| Id | Sev | Stage | Map + cell | Repro | Expected | Actual | Evidence |
|---|---|---|---|---|---|---|---|
| P3-01 (unconfirmed) | P3 | S24 | `onrac` (37, 27) -> gate (38, 27) | `w_s24_start`, one 90 ms tap of Right at the dry-dock entrance, oxyale held | the submarine boards (map `sea-shrine-b3`, entrance `nave` (21, 28)) | Once it boarded; on a second load of the same scenario the single tap did nothing for 5 s (still `onrac` 37,27, no dialog). Walking to (38, 27) with repeated steps boarded at once. Probably the scene-entry or dialog-close hold-off swallowing the first press, so not a game bug; recheck by hand. | `/tmp` log lost in the reboot |

No P0/P1/P2 found yet in S23-S25 or the Sea Shrine. Data-only review (reading the generated map YAML and
`cutscenes.yaml`) of S26-S31 found nothing wrong; it still needs the live pass below.

## Checked and fine so far

- S23 `w_s23_start`: Gaia gate enter (150,13) -> `gaia` entrance `gate`; all 19 town NPCs talkable and speak sensible
  lines (the court child answered empty in one run; the NPC wanders and the talk likely missed it, not re-tested);
  spring `gaia-spring` reachable by walking; warden + bottle -> cutscene `wnd_fairy_freed`: FAIRY_FREED set, `fairy_bottle`
  taken, `oxyale` given, fairy NPC appears, water patch flows, no console errors. Hints point the player to the spring
  ("take it up to the spring at the top"), the warden says "Unstop it over the spring".
- S23 negative `w_s23_neg_nobottle`: warden tells of the caravan; no flag, no oxyale.
- S24 negative `w_s24_neg_nooxyale`: stepping at (38, 27) gives the shipwright's message; the map stays `onrac`.
- S24 `w_s24_start`: board -> `sea-shrine-b3` nave (21, 28). B3 chests (3) and the echo priest, B2 chests (3) and brother,
  B1 chests (2), elder and three mermaid hints, B4 chests (4) and librarian all reachable and give their items. Hints:
  up = counsel, down = the king with the tablet; "either stair at the bottom takes you to the throne" matches two B4->B5
  stairs. Random battles on B3/B4 (sahagin_prince x2, sea_troll x3, water_naga, deepeyes + sea_troll) were all won by
  mashing Fight at L27 with the stage kit; none was a wipe.
- Data check: S31 Smyth (`dwarf-hall`, `ert_smyth`): dialog and cutscene `ert_smyth_forge` are gated on WIND_CRYSTAL_LIT
  in the version I tested (the fix agent is changing this; behaviour noted only). Chest `adamant` is on `sky-castle-3f`
  (4, 26).

## Not yet done (continuing after the reboot)

B5 and the Drowned Sovereign, S25 (Unne), S26 (Lufenia), S27 (Mirage Tower), S28 (sky castle + Seraph + Warmech), S29,
S30 (four refights, Death Eye, Chaos four forms), the ending, S31, the originality spot-check, console and
performance notes.

import { BitmapText } from 'pixi.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE } from '../../core/LayoutConstants.js';
import type { Window } from '../../ui/Window.js';

/** Capitalize first letter of a string. */
export function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/**
 * Parse verbose battle result messages into a concise turn-list string.
 * Handles physical hits, spells (damage/heal/status), items, escape, and status-tick skips.
 * Falls back to a truncated summary of the first message for unrecognized patterns.
 */
export function formatConciseResult(messages: Array<{ text: string }>, actorName: string): string {
  const texts = messages.map(m => m.text);

  // --- Status-tick-skip patterns (checked FIRST — these override the intended action) ---
  const poisonMatch = texts.find(t => t.match(new RegExp(`^${escRe(actorName)} takes (\\d+) poison damage!$`)));
  if (poisonMatch) {
    const n = poisonMatch.match(/takes (\d+) poison/)![1];
    const died = texts.some(t => /defeated!$|fell!$/.test(t));
    return `Poison → ${n} dmg${died ? ' ☠' : ''}`;
  }
  if (texts.some(t => t === `${actorName} is asleep!` || t === `${actorName} is stunned!`)) {
    const status = texts.find(t => t.includes('asleep')) ? 'Asleep' : 'Stunned';
    return status;
  }
  if (texts.some(t => t === `${actorName} is trembling with fear!`)) return 'Afraid';

  // --- Escape ---
  if (texts.includes('Escaped!')) return '→ Escaped!';
  if (texts.includes('Cannot escape!')) return '→ Failed!';

  // --- Miss ---
  if (texts.some(t => t === `${actorName} missed!`)) return '→ Miss!';

  // --- Physical hit: "X hits Y for N!" or "X hits Y for N! Critical!" ---
  const hitRe = new RegExp(`^${escRe(actorName)} hits (.+?) for (\\d+)!(.*)$`);
  const hitMatch = texts.find(t => hitRe.test(t));
  if (hitMatch) {
    const m = hitMatch.match(hitRe)!;
    const target = m[1], dmg = m[2], crit = m[3].includes('Critical') ? '!' : '';
    const died = texts.some(t => t === `${target} defeated!` || t === `${target} fell!`);
    return `→ ${dmg} to ${target}${crit}${died ? ' ☠' : ''}`;
  }

  // --- Enemy physical hit on party: "EnemyName hits CharName for N!" ---
  const enemyHitRe = /^(.+?) hits (.+?) for (\d+)!(.*)$/;
  const enemyHitMatch = texts.find(t => enemyHitRe.test(t));
  if (enemyHitMatch) {
    const m = enemyHitMatch.match(enemyHitRe)!;
    const target = m[2], dmg = m[3], crit = m[4].includes('Critical') ? '!' : '';
    const died = texts.some(t => t === `${target} defeated!` || t === `${target} fell!`);
    return `→ ${dmg} to ${target}${crit}${died ? ' ☠' : ''}`;
  }

  // --- Filter out "casts SPELL!" announce for spell result parsing ---
  const filtered = texts.filter(t => !t.match(new RegExp(`^${escRe(actorName)} casts `)));

  // --- Spell/multi-target damage: "Y takes N damage!" ---
  const dmgRe = /^(.+?) takes (\d+) damage!$/;
  const dmgMsgs = filtered.filter(t => dmgRe.test(t));
  if (dmgMsgs.length > 0) {
    const defeats = filtered.filter(t => /defeated!$|fell!$/.test(t));
    const skull = defeats.length > 0 ? ' ☠' : '';
    if (dmgMsgs.length === 1) {
      const m = dmgMsgs[0].match(dmgRe)!;
      return `→ ${m[2]} to ${m[1]}${skull}`;
    }
    const total = dmgMsgs.reduce((s, t) => s + parseInt(t.match(dmgRe)![2], 10), 0);
    return `→ ${total} to ${dmgMsgs.length} foes${skull}`;
  }

  // --- Heal: "Y recovers N HP!" (spell) or "Y recovered N HP" (item) ---
  const healRe = /^(.+?) recover(?:s|ed) (\d+) HP!?$/;
  const healMsgs = filtered.filter(t => healRe.test(t));
  if (healMsgs.length > 0) {
    if (healMsgs.length === 1) {
      const m = healMsgs[0].match(healRe)!;
      return `→ ${m[2]} HP to ${m[1]}`;
    }
    const total = healMsgs.reduce((s, t) => s + parseInt(t.match(healRe)![2], 10), 0);
    return `→ ${total} HP to ${healMsgs.length} allies`;
  }

  // --- Status effects from spells ---
  const frightenRe = /^(.+?) is frightened!$/;
  const frightenMatch = filtered.find(t => frightenRe.test(t));
  if (frightenMatch) return `→ Frightened ${frightenMatch.match(frightenRe)![1]}`;

  const affectedRe = /^(.+?) is affected by (.+?)!$/;
  const affectedMatch = filtered.find(t => affectedRe.test(t));
  if (affectedMatch) {
    const m = affectedMatch.match(affectedRe)!;
    return `→ ${capitalize(m[2])} ${m[1]}`;
  }

  // --- Revive ---
  if (filtered.some(t => /is revived!$|was revived$/.test(t))) {
    const m = filtered.find(t => /revive/.test(t))!;
    const name = m.replace(/ (is revived!|was revived)$/, '');
    return `→ Revived ${name}`;
  }

  // --- Cure ---
  const cureRe = /^(.+?) is cured of (.+)$/;
  const cureMatch = filtered.find(t => cureRe.test(t));
  if (cureMatch) return `→ Cured ${cureMatch.match(cureRe)![1]}`;

  // --- Buff/debuff: "X's Y increased/decreased!" ---
  if (filtered.some(t => /increased!$|decreased!$/.test(t))) {
    const m = filtered.find(t => /increased!$|decreased!$/.test(t))!;
    const up = m.includes('increased');
    const label = m.match(/'s (.+?) (increased|decreased)/)?.[1] ?? 'stat';
    return `→ ${capitalize(label)} ${up ? 'up' : 'down'}!`;
  }

  // --- No effect ---
  if (filtered.some(t => t.includes('No effect') || t.includes('no effect'))) return '→ No effect';

  // --- Graceful fallback: extract short summary from first message ---
  const first = (filtered[0] ?? texts[0] ?? '').replace(new RegExp(`^${escRe(actorName)}['s ]*\\s*`, 'i'), '');
  const short = first.length > 20 ? first.slice(0, 18) + '..' : first;
  return `→ ${short || 'Act'}`;
}

/** Escape a string for use in a RegExp. */
function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Creates a blinking ▼ prompt indicator positioned at bottom-right of the message window. */
export function createPromptIndicator(messageWindow: Window): BitmapText {
  const indicator = new BitmapText({
    text: '\u25bc',
    style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff },
  });
  indicator.position.set(messageWindow.contentWidth - FONT_SIZE, messageWindow.contentHeight - FONT_SIZE);
  messageWindow.addChild(indicator);
  return indicator;
}

/** Removes and destroys a prompt indicator. */
export function destroyPromptIndicator(indicator: BitmapText | null, messageWindow: Window): void {
  if (indicator) {
    messageWindow.removeChild(indicator);
    indicator.destroy();
  }
}

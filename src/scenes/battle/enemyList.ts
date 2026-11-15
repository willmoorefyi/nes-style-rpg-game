/**
 * BA-8: the battle enemy list, grouped by species as FF1 does ("6x Goblin", "3x Wolf"): one line per base enemy
 * name (not the lettered displayName), in first-seen order. More than ROWS_PER_COLUMN lines use two columns.
 */
export interface EnemyListEntry { name: string; alive: number; label: string }
export interface EnemyListCell { x: number; y: number }

export const ROWS_PER_COLUMN = 5;
export const ENEMY_LIST_LINE = 40;

export function groupEnemies(enemies: readonly { data: { name: string }; currentHp: number }[]): EnemyListEntry[] {
  const order: string[] = [];
  const alive = new Map<string, number>();
  for (const e of enemies) {
    const n = e.data.name;
    if (!alive.has(n)) order.push(n);
    alive.set(n, (alive.get(n) ?? 0) + (e.currentHp > 0 ? 1 : 0));
  }
  return order.map(name => {
    const n = alive.get(name) ?? 0;
    return { name, alive: n, label: n > 1 ? `${n}x ${name}` : name };
  });
}

/** The width of one list column: the content box, or half of it past 5 lines. */
export function listColumnWidth(count: number, contentWidth: number): number {
  return Math.floor(contentWidth / (count > ROWS_PER_COLUMN ? 2 : 1));
}

/** Top-left of each line inside a window's content box (origin 0,0): one column up to 5 lines, else two. */
export function enemyListCells(count: number, contentWidth: number): EnemyListCell[] {
  const columns = count > ROWS_PER_COLUMN ? 2 : 1;
  const rows = Math.ceil(count / columns);
  const colWidth = listColumnWidth(count, contentWidth);
  return Array.from({ length: count }, (_, i) => ({ x: Math.floor(i / rows) * colWidth, y: (i % rows) * ENEMY_LIST_LINE }));
}

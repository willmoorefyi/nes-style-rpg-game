import type { EnemyData } from '../../types/index.js';

export const ENEMY_COLORS: Record<string, number> = {
  goblin: 0x228b22,    // green
  wolf: 0x808080,      // gray
  skeleton: 0xd4d4d4,  // bone white
  pirate: 0x8b4513,    // brown
  garland: 0x4b0082,   // dark purple
  zombie: 0x556b2f,    // olive
  ogre: 0xb22222,      // dark red
  vampire: 0x800020,   // burgundy
  lich: 0x191970,      // midnight blue
  kraken: 0x006994,    // teal
  tiamat: 0x8b0000,    // crimson
  chaos: 0x1a1a1a,     // near-black
};
export const DEFAULT_ENEMY_COLOR = 0xff4444;

export function computeEnemyLayout(data: EnemyData[]): Array<{ x: number; y: number; w: number; h: number }> {
  const sizeMap = { small: 96, large: 192, boss: 288 } as const;
  const getSize = (d: EnemyData) => d.size ?? 'small';

  const bosses: number[] = [], larges: number[] = [], smalls: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const s = getSize(data[i]);
    if (s === 'boss') bosses.push(i);
    else if (s === 'large') larges.push(i);
    else smalls.push(i);
  }

  const result: Array<{ x: number; y: number; w: number; h: number }> = new Array(data.length);

  // Boss layout
  if (bosses.length > 0) {
    result[bosses[0]] = { x: 400, y: 350, w: 288, h: 288 };
    // Remaining enemies around boss
    const rest = [...bosses.slice(1), ...larges, ...smalls];
    const startY = 200;
    const spacing = rest.length > 1 ? 400 / (rest.length - 1) : 0;
    for (let i = 0; i < rest.length; i++) {
      const s = sizeMap[getSize(data[rest[i]])];
      result[rest[i]] = { x: 700, y: startY + i * spacing, w: s, h: s };
    }
    return result;
  }

  // Only small enemies
  if (larges.length === 0) {
    const grids: Record<number, [number, number][]> = {
      1: [[400,400]],
      2: [[300,350],[500,450]],
      3: [[250,300],[400,400],[550,500]],
      4: [[250,300],[500,300],[250,500],[500,500]],
      5: [[200,250],[450,250],[650,250],[300,450],[550,450]],
      6: [[200,250],[400,250],[600,250],[200,450],[400,450],[600,450]],
      7: [[150,200],[350,200],[550,200],[250,400],[450,400],[200,550],[400,550]],
      8: [[150,200],[350,200],[550,200],[150,400],[350,400],[550,400],[250,550],[450,550]],
      9: [[150,200],[350,200],[550,200],[150,400],[350,400],[550,400],[150,550],[350,550],[550,550]],
    };
    const positions = grids[Math.min(smalls.length, 9)] ?? grids[9]!;
    for (let i = 0; i < smalls.length; i++) {
      const [x, y] = positions[i] ?? positions[positions.length - 1];
      result[smalls[i]] = { x, y, w: 96, h: 96 };
    }
    return result;
  }

  // Only large enemies
  if (smalls.length === 0) {
    const grids: Record<number, [number, number][]> = {
      1: [[350,350]],
      2: [[200,300],[500,400]],
      3: [[150,250],[400,350],[250,500]],
      4: [[200,250],[500,250],[200,475],[500,475]],
    };
    const positions = grids[Math.min(larges.length, 4)] ?? grids[4]!;
    for (let i = 0; i < larges.length; i++) {
      const [x, y] = positions[i] ?? positions[positions.length - 1];
      result[larges[i]] = { x, y, w: 192, h: 192 };
    }
    return result;
  }

  // Mixed: large on left, small on right
  const lSpacing = larges.length > 1 ? 400 / (larges.length - 1) : 0;
  const lStartY = 425 - (larges.length - 1) * lSpacing / 2;
  for (let i = 0; i < larges.length; i++) {
    result[larges[i]] = { x: 225, y: lStartY + i * lSpacing, w: 192, h: 192 };
  }
  const sSpacing = smalls.length > 1 ? 400 / (smalls.length - 1) : 0;
  const sStartY = 425 - (smalls.length - 1) * sSpacing / 2;
  for (let i = 0; i < smalls.length; i++) {
    result[smalls[i]] = { x: 600, y: sStartY + i * sSpacing, w: 96, h: 96 };
  }
  return result;
}

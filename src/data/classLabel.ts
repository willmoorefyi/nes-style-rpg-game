import type { CharacterClassData } from '../types/index.js';

/** A class's short label in tight UI (slot strip, magic shop, save slots): `abbr` from classes.yaml (WAR, WHM), else its full name. */
export function classLabel(cls: Pick<CharacterClassData, 'name' | 'abbr'>): string {
  return cls.abbr ?? cls.name;
}

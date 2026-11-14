import type { EquipmentSlot } from '../types/index.js';

/** Display names of the equipment slots (Status and Equip screens). */
export const SLOT_LABELS: Readonly<Record<EquipmentSlot, string>> = {
  weapon: 'Weapon',
  armor: 'Body',
  shield: 'Shield',
  helmet: 'Helmet',
};

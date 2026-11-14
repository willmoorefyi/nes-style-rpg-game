/**
 * Pickup and full-bag wording (U9), shared by the field (chests, gifts) and the menus (shop, equip).
 * Every function takes an item id and looks the item up itself; an unknown id falls back to the id as its name.
 */
import { ItemRegistry } from '../data/ItemRegistry.js';

/** Names that take no article: mass nouns such as "Wooden Armor" and "Chain Mail" (U revision 1). */
const NO_ARTICLE = /(Armor|Mail)$/;

/** The indefinite article for `name`: '' for armour and mail, 'an' before a vowel, otherwise 'a'. */
export function article(name: string): '' | 'a' | 'an' {
  if (NO_ARTICLE.test(name)) return '';
  return /^[AEIOU]/i.test(name) ? 'an' : 'a';
}

/** The item's display name (the id when the item is unknown). */
export function pickupName(itemId: string): string {
  return ItemRegistry.getItem(itemId)?.name ?? itemId;
}

/** The name with its article: "a Potion", "an Iron Helm", "Wooden Armor", and "the Lute" for a key item. */
export function itemPhrase(itemId: string): string {
  const name = pickupName(itemId);
  if (ItemRegistry.getItem(itemId)?.type === 'key') return `the ${name}`;
  const a = article(name);
  return a ? `${a} ${name}` : name;
}

/** "You found a Potion!" */
export function foundText(itemId: string): string {
  return `You found ${itemPhrase(itemId)}!`;
}

/** "You received a Potion!", "You received the Lute!" */
export function receivedText(itemId: string): string {
  return `You received ${itemPhrase(itemId)}!`;
}

/** "You can't carry another Potion." */
export function cantCarryText(itemId: string): string {
  return `You can't carry another ${pickupName(itemId)}.`;
}

/** "You can't carry another Potion, so you leave it." */
export function leftBehindText(itemId: string): string {
  return `You can't carry another ${pickupName(itemId)}, so you leave it.`;
}

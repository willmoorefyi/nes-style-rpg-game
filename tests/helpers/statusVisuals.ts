/** assets/data/status-visuals.yaml read from disk and validated as the game does (for the status-visual tests). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { validateStatusVisuals } from '../../src/core/schemaValidationFx.js';
import type { StatusVisual } from '../../src/types/fxData.js';

export function loadStatusVisuals(): Record<string, StatusVisual> {
  const text = readFileSync(resolve(__dirname, '../../assets/data/status-visuals.yaml'), 'utf8');
  return validateStatusVisuals(parse(text)).statuses;
}

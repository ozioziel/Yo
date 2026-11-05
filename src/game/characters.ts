import entries from './extraPenguins.json';
import type { ExtraVariant } from './types';

/**
 * Single registry of the identities a visitor can summon by name. The same file drives
 * the asset pipeline (tools/extras); generated frames are never discovered as characters,
 * and typed text is only ever matched against these entries.
 */
export interface ExtraPenguin {
  id: string;
  name: string;
  aliases: string[];
  /** Original reference image, kept untouched; the sprites are cut from it. */
  reference: string;
  /** Animation variant with every clip of the base penguin, in this identity's clothes. */
  variant: ExtraVariant;
  /** Size relative to a base penguin, so the penguin body (not the hair) matches it. */
  bodyScale: number;
  /** Where its puppet (moving parts, eyes) is defined. */
  appearance: string;
}

export const extraPenguins = entries as ExtraPenguin[];

/** Case, outer spaces, repeated inner spaces and hyphens do not matter: "  Zorro   NEGRO " = "zorro-negro". */
export function normalizePenguinName(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('es').replace(/[\s-]+/gu, ' ');
}

const byName = new Map<string, ExtraPenguin>();
for (const character of extraPenguins) {
  for (const name of [character.name, character.id, ...character.aliases]) {
    const key = normalizePenguinName(name);
    const existing = byName.get(key);
    if (existing && existing.id !== character.id) throw new Error(`Nombre ambiguo: ${name}`);
    byName.set(key, character);
  }
}

export function resolvePenguinName(value: string): ExtraPenguin | undefined {
  return byName.get(normalizePenguinName(value));
}

export function extraById(id: string): ExtraPenguin | undefined {
  return extraPenguins.find(c => c.id === id);
}

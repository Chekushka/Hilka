/**
 * The character's words: item names, ranks and what is unlocked next, from
 * messages/uk.json. Kept beside the components that show them, since
 * lib/meta/character.ts stays free of user-facing text.
 */
import { nextUnlock, type CharacterItem } from '@/lib/meta/character';
import { t } from '@/lib/i18n';

export function itemLabel(item: Pick<CharacterItem, 'slot' | 'id'>): string {
  return t(`character.items.${item.slot}.${item.id}`);
}

export function itemsLabel(items: readonly CharacterItem[]): string {
  return items.map(itemLabel).join(', ');
}

/** "Level 3 · <rank>", in Ukrainian. */
export function levelRankLabel(level: number): string {
  return t('character.levelRank', { level, rank: t(`character.ranks.${level}`) });
}

/** What the next unlocking level opens, in words; null once everything is open. */
export function nextUnlockLabel(level: number): string | null {
  const next = nextUnlock(level);
  return next ? t('character.nextUnlock', { level: next.level, items: itemsLabel(next.items) }) : null;
}

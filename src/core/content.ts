import type { LanguagePack } from '../content/types.js';
import { Dictionary } from './dictionary.js';
import { allThemeWords } from './themes.js';

/**
 * Готовый к игре язык: пакет плюс собранный из него словарь. Строить
 * префиксное дерево на каждый уровень незачем, поэтому результат кэшируется.
 */
export interface GameContent {
  pack: LanguagePack;
  dictionary: Dictionary;
}

const cache = new Map<string, GameContent>();

export function createContent(pack: LanguagePack): GameContent {
  const ready = cache.get(pack.id);
  if (ready) return ready;
  const content: GameContent = {
    pack,
    dictionary: new Dictionary(pack.dictionary, allThemeWords(pack.themes)),
  };
  cache.set(pack.id, content);
  return content;
}

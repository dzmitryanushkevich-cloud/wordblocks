import type { LanguagePack } from './types.js';
import { english } from './en/index.js';
import { russian } from './ru/index.js';

/** Реестр языков. Новый язык добавляется сюда одной строкой. */
export const PACKS: LanguagePack[] = [russian, english];

export const DEFAULT_PACK = russian;

export function packById(id: string | null | undefined): LanguagePack | undefined {
  return PACKS.find((pack) => pack.id === id);
}

/**
 * Какой язык показывать: сначала адрес (?lang=en), потом выбор игрока,
 * потом язык браузера. Выбор запоминается, чтобы файл на диске открывался
 * так же, как в прошлый раз.
 */
export function pickPack(): LanguagePack {
  const url = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('lang');
  const saved = readChoice();
  const browser = typeof navigator === 'undefined' ? '' : (navigator.language ?? '').slice(0, 2);
  return packById(url) ?? packById(saved) ?? packById(browser) ?? DEFAULT_PACK;
}

const CHOICE_KEY = 'wordblocks.lang';

function readChoice(): string | null {
  try {
    return localStorage.getItem(CHOICE_KEY);
  } catch {
    return null;
  }
}

export function rememberChoice(id: string): void {
  try {
    localStorage.setItem(CHOICE_KEY, id);
  } catch {
    // Файл открыт с диска и хранилище запрещено — язык просто не запомнится.
  }
}

export type { LanguagePack } from './types.js';

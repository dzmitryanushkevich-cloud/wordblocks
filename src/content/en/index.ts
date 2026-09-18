import type { LanguagePack, ThemeContent } from '../types.js';
import dictionary from './dictionary.json' with { type: 'json' };
import themes from './themes.json' with { type: 'json' };
import { en as ui } from './strings.js';

/**
 * Английский пакет. Слова здесь короче русских, поэтому и кривая короче:
 * якорь доходит до десяти букв, а не до одиннадцати, — длинных слов
 * в категориях просто меньше (STRAWBERRY, ELECTRICIAN, GRASSHOPPER).
 */
export const english: LanguagePack = {
  id: 'en',
  htmlLang: 'en',
  name: 'English',
  dictionary,
  themes: themes as ThemeContent,
  curve: {
    // Блоков в уровне: три на знакомстве, семь к концу. То же расписание
    // продублировано в оффлайновом сборщике планов (plan.py).
    blocks: [
      { from: 1, count: 3 },
      { from: 3, count: 4 },
      { from: 5, count: 5 },
      { from: 11, count: 6 },
      { from: 21, count: 7 },
    ],
    opening: [
      { anchors: [4, 4, 4, 4, 4], size: 7, turns: 1, goal: 0.6, words: 5, themed: 2, short: 3, pool: 700 },
      { anchors: [4, 4, 5, 4, 4], size: 8, turns: 1, goal: 0.65, words: 6, themed: 2, short: 3, pool: 900 },
      { anchors: [4, 5, 4, 5, 5], size: 8, turns: 2, goal: 0.69, words: 6, themed: 2, short: 3, pool: 1100 },
      { anchors: [5, 5, 4, 5, 5], size: 9, turns: 2, goal: 0.72, words: 7, themed: 2, short: 4, pool: 1400 },
      { anchors: [5, 5, 6, 5, 5], size: 10, turns: 2, goal: 0.74, words: 8, themed: 3, short: 4, pool: 1700 },
      { anchors: [5, 6, 5, 6, 6], size: 10, turns: 3, goal: 0.75, words: 9, themed: 3, short: 4, pool: 2000 },
      { anchors: [6, 6, 5, 6, 6], size: 11, turns: 3, goal: 0.76, words: 10, themed: 3, short: 5, pool: 2400 },
      { anchors: [6, 6, 7, 6, 6], size: 12, turns: 3, goal: 0.77, words: 11, themed: 3, short: 5, pool: 2800 },
      { anchors: [6, 7, 6, 7, 7], size: 12, turns: 4, goal: 0.78, words: 12, themed: 3, short: 5, pool: 3200 },
      { anchors: [7, 7, 6, 7, 7], size: 13, turns: 4, goal: 0.78, words: 12, themed: 3, short: 5, pool: 3600 },
    ],
    later: {
      anchorBase: 7,
      anchorPerLevels: 5,
      anchorCap: 10,
      sizeBase: 13,
      sizePerLevels: 3,
      sizeCap: 17,
      turns: 5,
      goal: 0.78,
      // Английских коротких слов в разы больше русских, и в блоке их всегда много.
      // Считаются всё равно только слова темы, поэтому шум просто не режем.
      words: 12,
      themed: 3,
      short: 6,
    },
    // Первые уровни читаются как написано: слово лежит слева направо.
    readableUntil: 2,
    tangleFrom: 5,
    coreUntil: 3,
    commonUntil: 12,
    shapeStages: [4, 9],
    minWord: 3,
    maxWord: 12,
  },
  ui,
};

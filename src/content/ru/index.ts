import type { LanguagePack, ThemeContent } from '../types.js';
import dictionary from './dictionary.json' with { type: 'json' };
import themes from './themes.json' with { type: 'json' };
import { ru as ui } from './strings.js';

/**
 * Русский пакет. Кривая длин подобрана под русские слова: якорь доходит
 * до одиннадцати букв, потому что в категориях тем такие слова есть,
 * а в общем словаре — нет (там максимум девять).
 */
export const russian: LanguagePack = {
  id: 'ru',
  htmlLang: 'ru',
  name: 'Русский',
  dictionary: { ...dictionary, fillerExclude: ['ъ'] },
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
      { anchors: [4, 4, 4, 4, 4], size: 7, turns: 1, goal: 0.6, words: 3, themed: 2, short: 3, pool: 700 },
      { anchors: [4, 4, 5, 4, 4], size: 8, turns: 1, goal: 0.65, words: 4, themed: 2, short: 3, pool: 900 },
      { anchors: [4, 5, 4, 5, 5], size: 8, turns: 2, goal: 0.69, words: 4, themed: 2, short: 3, pool: 1100 },
      { anchors: [5, 5, 4, 5, 5], size: 9, turns: 2, goal: 0.72, words: 5, themed: 2, short: 3, pool: 1400 },
      { anchors: [5, 5, 6, 5, 5], size: 10, turns: 2, goal: 0.74, words: 5, themed: 3, short: 3, pool: 1700 },
      { anchors: [5, 6, 5, 6, 6], size: 10, turns: 3, goal: 0.75, words: 6, themed: 3, short: 3, pool: 2000 },
      { anchors: [6, 6, 5, 6, 6], size: 11, turns: 3, goal: 0.76, words: 6, themed: 3, short: 3, pool: 2400 },
      { anchors: [6, 6, 7, 6, 6], size: 12, turns: 3, goal: 0.77, words: 7, themed: 3, short: 3, pool: 2800 },
      { anchors: [6, 7, 6, 7, 7], size: 12, turns: 4, goal: 0.78, words: 7, themed: 3, short: 4, pool: 3200 },
      { anchors: [7, 7, 6, 7, 7], size: 13, turns: 4, goal: 0.78, words: 8, themed: 3, short: 4, pool: 3600 },
    ],
    later: {
      anchorBase: 7,
      anchorPerLevels: 4,
      anchorCap: 11,
      sizeBase: 13,
      sizePerLevels: 3,
      sizeCap: 18,
      turns: 5,
      goal: 0.78,
      words: 8,
      themed: 3,
      short: 4,
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

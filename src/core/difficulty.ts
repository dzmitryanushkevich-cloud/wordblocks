export interface FigureParams {
  size: number;
  anchorLength: number;
  boxW: number;
  boxH: number;
  /** Сколько трёхбуквенных слов допускается в блоке (умная добивка режет лёгкие выходы). */
  maxShortWords: number;
  /** Верхняя граница на общее число спрятанных слов. */
  maxWords: number;
  /**
   * Длина «слова-соблазна» — короткого слова, которое генератор специально
   * подкладывает рядом с якорем. Без него в блоке не из чего выбирать
   * и весь конфликт игры (взять быстро или искать длинное) исчезает.
   */
  temptationLength: number;
  /**
   * Насколько частотным должно быть якорное слово: на ранних уровнях берём
   * только самые ходовые, чтобы игрок не гадал, что такое ШАРМ.
   */
  anchorPool: number;
  /**
   * Сколько раз путь якорного слова может менять направление. Прямое слово
   * видно сразу, извилистое приходится выискивать — это главный рычаг
   * сложности поиска, не считая размера блока.
   */
  maxTurns: number;
}

export interface LevelParams {
  figures: FigureParams[];
  /** Доля от максимума (суммы якорных слов), которую нужно набрать для победы. */
  goalRatio: number;
}

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

/**
 * Первые десять уровней расписаны вручную: это обучение, и каждый шаг должен
 * добавлять ровно одну новую трудность. Сначала растёт длина слова, потом
 * размер блока, потом извилистость пути, и только затем ужимается запас по цели.
 *
 * anchors — длина якоря в каждом из пяти блоков, size — клеток в блоке,
 * turns — предел поворотов пути, goal — какую долю максимума нужно набрать.
 */
const OPENING: {
  anchors: number[];
  size: number;
  turns: number;
  goal: number;
  words: number;
  pool: number;
}[] = [
  { anchors: [4, 4, 4, 4, 4], size: 7, turns: 1, goal: 0.6, words: 3, pool: 700 },
  { anchors: [4, 4, 5, 4, 4], size: 8, turns: 1, goal: 0.65, words: 3, pool: 900 },
  { anchors: [4, 5, 4, 5, 5], size: 8, turns: 2, goal: 0.69, words: 4, pool: 1100 },
  { anchors: [5, 5, 4, 5, 5], size: 9, turns: 2, goal: 0.72, words: 4, pool: 1400 },
  { anchors: [5, 5, 6, 5, 5], size: 10, turns: 2, goal: 0.74, words: 4, pool: 1700 },
  { anchors: [5, 6, 5, 6, 6], size: 10, turns: 3, goal: 0.75, words: 5, pool: 2000 },
  { anchors: [6, 6, 5, 6, 6], size: 11, turns: 3, goal: 0.76, words: 5, pool: 2400 },
  { anchors: [6, 6, 7, 6, 6], size: 12, turns: 3, goal: 0.77, words: 5, pool: 2800 },
  { anchors: [6, 7, 6, 7, 7], size: 12, turns: 4, goal: 0.78, words: 5, pool: 3200 },
  { anchors: [7, 7, 6, 7, 7], size: 13, turns: 4, goal: 0.78, words: 5, pool: 3600 },
];

/** Дальше десятого уровня кривая продолжается формулой. */
function laterLevel(levelIndex: number, figureCount: number) {
  const anchors = Array.from({ length: figureCount }, (_, i) =>
    clamp(7 + Math.floor((levelIndex - 10) / 4) + (i % 3 === 2 ? 1 : 0), 6, 9),
  );
  return {
    anchors,
    size: clamp(13 + Math.floor((levelIndex - 10) / 3), 13, 15),
    turns: 5,
    goal: 0.78,
    words: 5,
    pool: Infinity,
  };
}

export function levelParams(levelIndex: number, figureCount = 5): LevelParams {
  const plan =
    levelIndex <= OPENING.length
      ? OPENING[levelIndex - 1]
      : laterLevel(levelIndex, figureCount);

  const figures: FigureParams[] = [];
  for (let i = 0; i < figureCount; i++) {
    const anchorLength = plan.anchors[i % plan.anchors.length];
    // Блок должен вмещать слово с запасом на отвлекающие буквы.
    const size = Math.max(plan.size, anchorLength + 3);
    const box = size <= 9 ? 4 : 5;
    figures.push({
      size,
      anchorLength,
      boxW: box,
      boxH: box,
      maxShortWords: levelIndex <= 3 ? 2 : 1,
      maxWords: plan.words,
      temptationLength: clamp(anchorLength - 3, 3, 4),
      maxTurns: plan.turns,
      anchorPool: plan.pool,
    });
  }
  return { figures, goalRatio: plan.goal };
}

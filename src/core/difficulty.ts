export interface FigureParams {
  size: number;
  anchorLength: number;
  boxW: number;
  boxH: number;
  /** Сколько трёхбуквенных слов допускается в фигуре (умная добивка режет лёгкие выходы). */
  maxShortWords: number;
  /** Верхняя граница на общее число спрятанных слов. */
  maxWords: number;
  /**
   * Длина «слова-соблазна» — короткого слова, которое генератор специально
   * подкладывает рядом с якорем. Без него в фигуре не из чего выбирать
   * и весь конфликт игры (взять быстро или искать длинное) исчезает.
   */
  temptationLength: number;
}

export interface LevelParams {
  figures: FigureParams[];
  /** Доля от максимума (суммы якорных слов), которую нужно набрать для победы. */
  goalRatio: number;
}

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

/**
 * Кривая сложности. Растёт не количество фигур (их всегда пять),
 * а размер фигуры и длина спрятанного в ней слова.
 */
export function levelParams(levelIndex: number, figureCount = 5): LevelParams {
  const figures: FigureParams[] = [];
  for (let i = 0; i < figureCount; i++) {
    // Внутри уровня слова тоже разной длины, чтобы фигуры не были одинаковыми.
    const wobble = i % 3 === 2 ? 1 : 0;
    const anchorLength = clamp(4 + Math.floor((levelIndex - 1) / 3) + wobble, 4, 8);
    const size = clamp(anchorLength + 4 + Math.floor((levelIndex - 1) / 4), 8, 14);
    const box = size <= 9 ? 4 : 5;
    figures.push({
      size,
      anchorLength,
      boxW: box,
      boxH: box,
      maxShortWords: levelIndex <= 3 ? 2 : 1,
      maxWords: 5,
      temptationLength: clamp(anchorLength - 3, 3, 4),
    });
  }
  return { figures, goalRatio: 0.78 };
}

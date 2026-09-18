import type { LevelTheme } from './themes.js';

/** Координата клетки в сетке фигуры. */
export interface Coord {
  x: number;
  y: number;
}

/** Клетка фигуры: позиция плюс буква. */
export interface Cell extends Coord {
  letter: string;
}

/** Путь — последовательность индексов клеток в Figure.cells. */
export type CellPath = number[];

/** Слово, найденное в фигуре, вместе с путём, которым оно выложено. */
export interface WordHit {
  word: string;
  path: CellPath;
}

export interface Figure {
  /** Клетки, нормализованные к началу координат (минимальные x и y равны нулю). */
  cells: Cell[];
  width: number;
  height: number;
  /** Все валидные слова фигуры, от длинных к коротким. Для итогов уровня и отладки. */
  words: WordHit[];
  /** Якорное слово — то самое длинное и узнаваемое, ради которого фигура построена. */
  anchor: string;
  /** Категории спрятанных слов: подпись над блоком. */
  labels: string[];
  /**
   * Слова блока, которые засчитываются: только они из темы уровня.
   * Всё остальное (ЛАЙ внутри ЛАЙМА, ИВА из случайных букв) — фон, который
   * подписи не соответствует и блок не рассыпает. От длинного к короткому.
   */
  scoring: string[];
  /** Сколько попыток генерации ушло на эту фигуру (диагностика баланса). */
  attempts: number;
}

export interface Level {
  index: number;
  seed: number;
  /** Тема уровня: её категории задают, из каких слов берутся якоря. */
  theme: LevelTheme;
  figures: Figure[];
  /** Цель по буквам: столько нужно набрать суммой найденных слов, чтобы пройти уровень. */
  goalLetters: number;
  /** Максимум, достижимый при идеальной игре: сумма длин якорных слов. */
  maxLetters: number;
}

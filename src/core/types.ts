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
  /** Сколько попыток генерации ушло на эту фигуру (диагностика баланса). */
  attempts: number;
}

export interface Level {
  index: number;
  seed: number;
  figures: Figure[];
  /** Цель по буквам: столько нужно набрать суммой найденных слов, чтобы пройти уровень. */
  goalLetters: number;
  /** Максимум, достижимый при идеальной игре: сумма длин якорных слов. */
  maxLetters: number;
}

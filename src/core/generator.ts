import type { Dictionary } from './dictionary.js';
import { Rng, levelSeed } from './rng.js';
import {
  buildAdjacency,
  bounds,
  findPath,
  findPathWithin,
  growPolyomino,
  isBoring,
} from './shape.js';
import { solve } from './solver.js';
import type { FigureParams, LevelParams } from './difficulty.js';
import { levelParams } from './difficulty.js';
import type { Cell, Figure, Level, WordHit } from './types.js';

const SHAPE_ATTEMPTS = 60;
const ANCHOR_ATTEMPTS = 12;
const REPAIR_ROUNDS = 150;

/**
 * Генерация одной фигуры.
 *
 * 1. Растим форму нужного размера и отбрасываем скучные (полоса, сплошной прямоугольник).
 * 2. Ищем в ней простой путь длины якорного слова и выкладываем слово по этому пути.
 * 3. Рядом подкладываем короткое «слово-соблазн»: без него выбирать не из чего
 *    и весь конфликт игры (взять быстро или искать длинное) исчезает.
 * 4. Остальные клетки заполняем «умной добивкой»: буквы берём по частотности словаря,
 *    но если солвер находит лишние лёгкие слова или слово длиннее якоря — точечно
 *    меняем букву в мешающей клетке (кроме клеток якоря и соблазна) и пробуем снова.
 *    Так в фигуре остаётся ровно один осмысленный соблазн, а не россыпь лёгких выходов.
 */
export function generateFigure(rng: Rng, dictionary: Dictionary, params: FigureParams): Figure | null {
  const anchors = dictionary.core(params.anchorLength);
  if (anchors.length === 0) return null;
  let attempts = 0;

  for (let shapeTry = 0; shapeTry < SHAPE_ATTEMPTS; shapeTry++) {
    const body = growPolyomino(rng, params);
    if (!body || isBoring(body)) continue;
    const adjacency = buildAdjacency(body);
    const anchorPath = findPath(rng, adjacency, params.anchorLength);
    if (!anchorPath) continue;

    for (let anchorTry = 0; anchorTry < ANCHOR_ATTEMPTS; anchorTry++) {
      attempts++;
      const anchor = rng.pick(anchors);
      const protectedCells = new Set(anchorPath);
      const cells: Cell[] = body.map((c) => ({ ...c, letter: '' }));
      anchorPath.forEach((cellIndex, i) => {
        cells[cellIndex].letter = anchor[i];
      });

      plantTemptation(rng, dictionary, cells, adjacency, protectedCells, params);

      const free = cells.map((_, i) => i).filter((i) => !protectedCells.has(i));
      for (const i of free) cells[i].letter = dictionary.randomLetter(rng);

      const fixed = repair(rng, dictionary, cells, adjacency, protectedCells, anchor, params);
      if (fixed) {
        const size = bounds(body);
        return {
          cells,
          width: size.width,
          height: size.height,
          words: fixed,
          anchor,
          attempts,
        };
      }
    }
  }
  return null;
}

/**
 * Подкладываем короткое слово в свободные клетки — так у игрока появляется
 * дешёвый и заманчивый вариант вместо длинного якоря. Если места под него нет,
 * фигура остаётся без соблазна и это проверит валидатор.
 */
function plantTemptation(
  rng: Rng,
  dictionary: Dictionary,
  cells: Cell[],
  adjacency: readonly number[][],
  protectedCells: Set<number>,
  params: FigureParams,
): boolean {
  const candidates = dictionary.core(params.temptationLength);
  if (candidates.length === 0) return false;
  const allowed = cells.map((_, i) => i).filter((i) => !protectedCells.has(i));
  if (allowed.length < params.temptationLength) return false;

  const path = findPathWithin(rng, adjacency, new Set(allowed), params.temptationLength);
  if (!path) return false;

  const word = rng.pick(candidates);
  path.forEach((cellIndex, i) => {
    cells[cellIndex].letter = word[i];
    protectedCells.add(cellIndex);
  });
  return true;
}

/**
 * Цикл починки: пока фигура нарушает требования, меняем одну букву вне якоря и соблазна.
 * Возвращает список слов фигуры, если удалось уложиться в ограничения.
 */
function repair(
  rng: Rng,
  dictionary: Dictionary,
  cells: Cell[],
  adjacency: readonly number[][],
  onAnchor: ReadonlySet<number>,
  anchor: string,
  params: FigureParams,
): WordHit[] | null {
  const free = cells.map((_, i) => i).filter((i) => !onAnchor.has(i));
  if (free.length === 0) {
    const words = solve(cells, adjacency, dictionary);
    return accepts(words, anchor, params) ? words : null;
  }

  for (let round = 0; round < REPAIR_ROUNDS; round++) {
    const words = solve(cells, adjacency, dictionary);
    if (accepts(words, anchor, params)) return words;

    const offender = pickOffender(words, anchor, params);
    let candidates = offender ? offender.path.filter((i) => !onAnchor.has(i)) : [];
    if (candidates.length === 0) candidates = free;
    const target = rng.pick(candidates);

    const before = cells[target].letter;
    let replacement = before;
    for (let tries = 0; tries < 8 && replacement === before; tries++) {
      replacement = dictionary.randomLetter(rng);
    }
    cells[target].letter = replacement;
  }
  return null;
}

function accepts(words: WordHit[], anchor: string, params: FigureParams): boolean {
  if (!words.some((w) => w.word === anchor)) return false;
  if (words[0].word.length > anchor.length) return false;
  if (words.length > params.maxWords) return false;
  // В фигуре обязан быть выбор: хотя бы одно слово короче якоря.
  if (!words.some((w) => w.word.length < anchor.length)) return false;
  const short = words.filter((w) => w.word.length === 3).length;
  return short <= params.maxShortWords;
}

/** Слово, из-за которого фигура пока не проходит: его и будем ломать. */
function pickOffender(words: WordHit[], anchor: string, params: FigureParams): WordHit | undefined {
  const tooLong = words.find((w) => w.word.length > anchor.length);
  if (tooLong) return tooLong;
  // Если выбора нет вовсе, ломать нечего — пусть починка тасует случайную клетку.
  if (!words.some((w) => w.word.length < anchor.length)) return undefined;
  const short = words.filter((w) => w.word.length === 3);
  if (short.length > params.maxShortWords) return short[short.length - 1];
  if (words.length > params.maxWords) {
    return [...words].reverse().find((w) => w.word !== anchor);
  }
  return undefined;
}

export interface GenerateLevelOptions {
  gameSeed?: number;
  figureCount?: number;
  params?: LevelParams;
}

/** Сборка уровня: пять фигур плюс цель по буквам, вычисленная от их содержимого. */
export function generateLevel(
  dictionary: Dictionary,
  levelIndex: number,
  options: GenerateLevelOptions = {},
): Level {
  const gameSeed = options.gameSeed ?? 1;
  const seed = levelSeed(gameSeed, levelIndex);
  const rng = new Rng(seed);
  const params = options.params ?? levelParams(levelIndex, options.figureCount ?? 5);

  const figures: Figure[] = [];
  for (const figureParams of params.figures) {
    let figure = generateFigure(rng, dictionary, figureParams);
    // Подстраховка: если с заданными параметрами не вышло, ослабляем требования.
    for (let relax = 1; !figure && relax <= 3; relax++) {
      figure = generateFigure(rng, dictionary, {
        ...figureParams,
        maxShortWords: figureParams.maxShortWords + relax,
        maxWords: figureParams.maxWords + relax,
      });
    }
    if (!figure) throw new Error(`Не удалось сгенерировать фигуру для уровня ${levelIndex}`);
    figures.push(figure);
  }

  const maxLetters = figures.reduce((sum, f) => sum + f.anchor.length, 0);
  const floor = figures.length * 3 + 1;
  const goalLetters = Math.min(maxLetters, Math.max(floor, Math.round(maxLetters * params.goalRatio)));

  return { index: levelIndex, seed, figures, goalLetters, maxLetters };
}

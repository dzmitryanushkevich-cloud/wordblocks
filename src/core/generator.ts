import type { Dictionary } from './dictionary.js';
import { Rng, levelSeed } from './rng.js';
import {
  buildAdjacency,
  bounds,
  findPath,
  growShape,
  isBoring,
} from './shape.js';
import { solve } from './solver.js';
import type { FigureParams, LevelParams } from './difficulty.js';
import { levelParams } from './difficulty.js';
import type { Cell, Figure, Level, WordHit } from './types.js';
import { figureLabels, levelTheme, themeWords } from './themes.js';
import type { GameContent } from './content.js';

const SHAPE_ATTEMPTS = 60;
const ANCHOR_ATTEMPTS = 12;
const REPAIR_ROUNDS = 150;
/** Сколько слов пробуем уложить, прежде чем сдаться: перебирать весь список незачем. */
const PLACE_ATTEMPTS = 12;

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
export function generateFigure(
  rng: Rng,
  dictionary: Dictionary,
  params: FigureParams,
  /** Слова, уже занятые другими блоками уровня: повтор якоря в одном уровне заметен. */
  used: ReadonlySet<string> = new Set(),
  /** Слова темы уровня: из них якорь берут в первую очередь. */
  themePool: readonly string[] = [],
): Figure | null {
  const inTheme = new Set(themePool);
  // Соблазны тоже берём из темы и тоже не повторяем в пределах уровня.
  const temptations = themePool.filter((word) => !used.has(word));
  const free = (length: number): string[] =>
    temptations.filter((word) => word.length === length);

  // Якорь обязан быть из темы: засчитываются только её слова, и блок с чужим
  // якорем был бы просто непроходимым. Сначала идут слова нужной длины, за ними
  // на букву короче и длиннее — длинных слов в категориях единицы, и упереться
  // в пустой список хуже, чем разойтись с кривой на одну букву.
  const themed = nearestLengths(params.anchorLength).flatMap((length) => rng.shuffled(free(length)));
  const anchors =
    themed.length > 0
      ? themed
      : dictionary.core(Math.min(params.anchorLength, 9), params.anchorPool);
  if (anchors.length === 0) return null;

  /**
   * Длины якоря по предпочтению. Пока слов нужной длины хватает, кривая
   * сложности не двигается вовсе. Соседние длины подключаются только когда
   * в категориях пусто — на длинном конце слов единицы. Короче соблазна
   * якорь не берём никогда: тогда в блоке нечего выбирать.
   */
  function nearestLengths(target: number): number[] {
    const floor = params.temptationLength + 1;
    if (target >= floor && free(target).length >= 2) return [target];
    const order: number[] = [target];
    for (let step = 1; step <= 6; step++) {
      if (target - step >= floor) order.push(target - step);
      if (target + step <= 12) order.push(target + step);
    }
    return order.filter((length) => free(length).length > 0).slice(0, 3);
  }
  let attempts = 0;

  for (let shapeTry = 0; shapeTry < SHAPE_ATTEMPTS; shapeTry++) {
    const body = growShape(rng, params);
    if (!body || isBoring(body)) continue;
    const adjacency = buildAdjacency(body);

    for (let anchorTry = 0; anchorTry < ANCHOR_ATTEMPTS; anchorTry++) {
      attempts++;
      // Слова перебираем по порядку и без повторов: их в категории единицы,
      // и крутить одно и то же по десять раз — только жечь попытки.
      const anchor = anchors[anchorTry] ?? rng.pick(anchors);
      const anchorPath = findPath(rng, adjacency, anchor.length, body, params.maxTurns);
      if (!anchorPath) continue;
      const protectedCells = new Set(anchorPath);
      const cells: Cell[] = body.map((c) => ({ ...c, letter: '' }));
      anchorPath.forEach((cellIndex, i) => {
        cells[cellIndex].letter = anchor[i];
      });

      const taken = [anchor];
      const lure = plantTemptation(
        rng, dictionary, cells, adjacency, protectedCells, params, temptations, anchor, themePool,
      );
      if (lure) taken.push(lure);
      if (params.themedWords >= 3) {
        plantMiddle(rng, cells, adjacency, protectedCells, params, temptations, taken);
      }

      const free = cells.map((_, i) => i).filter((i) => !protectedCells.has(i));
      for (const i of free) cells[i].letter = dictionary.randomLetter(rng);

      const fixed = repair(rng, dictionary, cells, adjacency, protectedCells, anchor, params, inTheme);
      if (fixed) {
        const size = bounds(body);
        return {
          cells,
          width: size.width,
          height: size.height,
          words: fixed,
          anchor,
          labels: [],
          scoring: [],
          attempts,
        };
      }
    }
  }
  return null;
}

/**
 * Подкладываем в блок ещё одно слово из темы — это и есть «соблазн»: дешёвый
 * заманчивый вариант вместо длинного якоря, без которого выбирать не из чего.
 *
 * Слово ищет себе путь по всей фигуре, а не только по пустым клеткам: если
 * буква уже лежит и совпадает, слово через неё проходит. Именно так блоки
 * становятся запутанными — слова пересекаются, а не лежат рядом.
 */
function plantTemptation(
  rng: Rng,
  dictionary: Dictionary,
  cells: Cell[],
  adjacency: readonly number[][],
  protectedCells: Set<number>,
  params: FigureParams,
  /** Свободные слова темы уровня: соблазн честнее брать из неё. */
  themed: readonly string[] = [],
  anchor = '',
  /** Слова темы, уже занятые в этом уровне: запасной вариант, если свежие кончились. */
  repeats: readonly string[] = [],
): string | null {
  // Сначала пробуем тему и ровно ту длину, что заложена в кривую сложности.
  // Если слов такой длины в категориях нет, берём чуть длиннее — но так,
  // чтобы соблазн всё равно стоил игроку букв.
  const nearest = anchor.length <= 5 ? anchor.length - 1 : anchor.length - 2;
  const longest = Math.max(
    params.temptationLength,
    Math.min(nearest, params.temptationLength + 2),
  );
  for (let length = params.temptationLength; length <= longest; length++) {
    const fresh = themed.filter((word) => word.length === length && word !== anchor);
    // Когда свежих слов этой длины в теме не осталось, берём уже встречавшееся:
    // повтор ЛУКА в двух блоках честнее, чем блок с одним-единственным ответом.
    const pool = fresh.length > 0 ? fresh : repeats.filter((word) => word.length === length && word !== anchor);
    const placed = tryPlace(rng, cells, adjacency, protectedCells, pool);
    if (placed) return placed;
  }

  // Тема не подошла — соблазн из общего словаря, но всё равно ходовой:
  // на незнакомое слово никто не клюнет.
  const candidates = dictionary.core(params.temptationLength, params.anchorPool);
  return tryPlace(rng, cells, adjacency, protectedCells, candidates);
}

/**
 * Третье тематическое слово — средней длины, между соблазном и якорем.
 * Из-за него блок перестаёт быть задачей «одно против одного»: выбирать
 * приходится из трёх, и подпись над блоком честно называет все категории.
 */
function plantMiddle(
  rng: Rng,
  cells: Cell[],
  adjacency: readonly number[][],
  protectedCells: Set<number>,
  params: FigureParams,
  themed: readonly string[],
  taken: readonly string[],
): string | null {
  const anchor = taken[0] ?? '';
  const target = Math.round((params.temptationLength + anchor.length) / 2);
  const length = Math.min(Math.max(target, params.temptationLength + 1), anchor.length - 1);
  if (length <= params.temptationLength) return null;

  const pool = themed.filter((word) => word.length === length && !taken.includes(word));
  return tryPlace(rng, cells, adjacency, protectedCells, pool);
}

/** Берёт случайные слова из списка и кладёт первое, которому нашёлся путь. */
function tryPlace(
  rng: Rng,
  cells: Cell[],
  adjacency: readonly number[][],
  protectedCells: Set<number>,
  pool: readonly string[],
): string | null {
  if (pool.length === 0) return null;
  for (const word of rng.shuffled(pool).slice(0, PLACE_ATTEMPTS)) {
    const path = findWordPath(rng, cells, adjacency, word);
    if (!path) continue;
    path.forEach((cellIndex, i) => {
      cells[cellIndex].letter = word[i];
      protectedCells.add(cellIndex);
    });
    return word;
  }
  return null;
}

/**
 * Путь под конкретное слово. По пустой клетке идём свободно, по занятой —
 * только если буква совпадает: так новое слово вплетается в уже лежащие.
 */
function findWordPath(
  rng: Rng,
  cells: readonly Cell[],
  adjacency: readonly number[][],
  word: string,
): number[] | null {
  const fits = (cell: number, index: number): boolean =>
    cells[cell].letter === '' || cells[cell].letter === word[index];

  const walk = (path: number[]): number[] | null => {
    if (path.length === word.length) return path;
    const next = rng.shuffled(adjacency[path[path.length - 1]]);
    for (const cell of next) {
      if (path.includes(cell) || !fits(cell, path.length)) continue;
      const found = walk([...path, cell]);
      if (found) return found;
    }
    return null;
  };

  for (const start of rng.shuffled(cells.map((_, i) => i))) {
    if (!fits(start, 0)) continue;
    const found = walk([start]);
    if (found) return found;
  }
  return null;
}

/**
 * Цикл починки: пока блок нарушает требования, меняем одну букву вне уложенных слов.
 * Возвращает список слов блока, если удалось уложиться в ограничения.
 */
function repair(
  rng: Rng,
  dictionary: Dictionary,
  cells: Cell[],
  adjacency: readonly number[][],
  onAnchor: ReadonlySet<number>,
  anchor: string,
  params: FigureParams,
  inTheme: ReadonlySet<string>,
): WordHit[] | null {
  const free = cells.map((_, i) => i).filter((i) => !onAnchor.has(i));
  if (free.length === 0) {
    const words = solve(cells, adjacency, dictionary);
    return accepts(words, anchor, params, inTheme) ? words : null;
  }

  for (let round = 0; round < REPAIR_ROUNDS; round++) {
    const words = solve(cells, adjacency, dictionary);
    if (accepts(words, anchor, params, inTheme)) return words;

    const offender = pickOffender(words, anchor, params, inTheme);
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

/**
 * Годится ли блок. Считаются только слова темы уровня, поэтому требования
 * теперь к ним: якорь на месте, ничего длиннее него в теме нет, и есть хотя бы
 * одно слово темы покороче — иначе выбирать не из чего. Слова не из темы блок
 * не рассыпают, они фон; ограничение на их число нужно только против каши.
 */
function accepts(
  words: WordHit[],
  anchor: string,
  params: FigureParams,
  inTheme: ReadonlySet<string>,
): boolean {
  if (!words.some((w) => w.word === anchor)) return false;
  const scoring = words.filter((w) => inTheme.has(w.word) || w.word === anchor);
  if (scoring.some((w) => w.word.length > anchor.length)) return false;
  if (!scoring.some((w) => w.word.length < anchor.length)) return false;
  if (words.length > params.maxWords) return false;
  const short = words.filter((w) => w.word.length === 3).length;
  return short <= params.maxShortWords;
}

/** Слово, из-за которого блок пока не проходит: его и будем ломать. */
function pickOffender(
  words: WordHit[],
  anchor: string,
  params: FigureParams,
  inTheme: ReadonlySet<string>,
): WordHit | undefined {
  const tooLong = words.find(
    (w) => w.word.length > anchor.length && (inTheme.has(w.word) || w.word === anchor),
  );
  if (tooLong) return tooLong;
  // Если выбора нет вовсе, ломать нечего — пусть починка тасует случайную клетку.
  if (!words.some((w) => w.word.length < anchor.length && inTheme.has(w.word))) return undefined;
  const short = words.filter((w) => w.word.length === 3);
  if (short.length > params.maxShortWords) return short[short.length - 1];
  if (words.length > params.maxWords) {
    return [...words].reverse().find((w) => w.word !== anchor && !inTheme.has(w.word));
  }
  return undefined;
}

export interface GenerateLevelOptions {
  gameSeed?: number;
  figureCount?: number;
  params?: LevelParams;
}

/** Сборка уровня: пять блоков плюс цель по буквам, вычисленная от их содержимого. */
export function generateLevel(
  content: GameContent,
  levelIndex: number,
  options: GenerateLevelOptions = {},
): Level {
  const { dictionary, pack } = content;
  const gameSeed = options.gameSeed ?? 1;
  const seed = levelSeed(gameSeed, levelIndex);
  const rng = new Rng(seed);
  const params =
    options.params ?? levelParams(pack.curve, levelIndex, options.figureCount ?? 5);
  const theme = levelTheme(pack.themes, levelIndex);
  // Прячем слова по кривой, а засчитываем любые слова темы: если редкое слово
  // сложилось случайно, оно всё равно из категории и обязано считаться.
  const pool = themeWords(pack.themes, theme, params.commonOnly);
  const inTheme = new Set(themeWords(pack.themes, theme));

  const figures: Figure[] = [];
  const usedAnchors = new Set<string>();

  for (const figureParams of params.figures) {
    let figure = generateFigure(rng, dictionary, figureParams, usedAnchors, pool);
    // Подстраховка: если с заданными параметрами не вышло, ослабляем требования.
    for (let relax = 1; !figure && relax <= 3; relax++) {
      figure = generateFigure(
        rng,
        dictionary,
        {
          ...figureParams,
          maxShortWords: figureParams.maxShortWords + relax,
          maxWords: figureParams.maxWords + relax,
          maxTurns: figureParams.maxTurns + relax,
          anchorPool: figureParams.anchorPool * (1 + relax),
        },
        usedAnchors,
        pool,
      );
    }
    if (!figure) throw new Error(`Не удалось сгенерировать блок для уровня ${levelIndex}`);
    // Подпись блока: какие категории уровня в нём вообще встречаются.
    const words = figure.words.map((w) => w.word);
    figure.labels = figureLabels(pack.themes, words, theme);
    figure.scoring = words.filter((word) => inTheme.has(word));
    usedAnchors.add(figure.anchor);
    // Тематические слова блока в этом уровне больше не повторяем: одна и та же
    // приманка в трёх блоках подряд читается как ошибка генератора.
    for (const word of words) if (pool.includes(word)) usedAnchors.add(word);
    figures.push(figure);
  }

  const maxLetters = figures.reduce((sum, f) => sum + f.anchor.length, 0);
  const floor = figures.length * 3 + 1;
  const goalLetters = Math.min(maxLetters, Math.max(floor, Math.round(maxLetters * params.goalRatio)));

  return { index: levelIndex, seed, theme, figures, goalLetters, maxLetters };
}

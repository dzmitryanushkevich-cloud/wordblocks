import type { Dictionary } from './dictionary.js';
import { Rng, levelSeed } from './rng.js';
import {
  buildAdjacency,
  bounds,
  findPath,
  isForward,
  growShape,
  isBoring,
} from './shape.js';
import { solve } from './solver.js';
import type { FigureParams, LevelParams } from './difficulty.js';
import { levelParams } from './difficulty.js';
import type { Cell, Figure, Level, WordHit } from './types.js';
import {
  categoryPool,
  categoryWords,
  figureLabels,
  levelTheme,
  siblingForms,
  themeScoring,
  themeWords,
} from './themes.js';
import type { GameContent } from './content.js';

const SHAPE_ATTEMPTS = 60;
const ANCHOR_ATTEMPTS = 12;
const REPAIR_ROUNDS = 150;
/** Сколько ещё форм перебрать, когда годный блок с повтором уже отложен. */
const SPARE_PATIENCE = 6;
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
  /**
   * Откуда брать якорь, если это не вся тема: на ранних уровнях блоки берут
   * категории по очереди, и якорь обязан быть из своей. Соблазн при этом можно
   * взять из всей темы — трёхбуквенных слов в одной категории часто нет вовсе
   * (у птиц их нет ни одного), а без соблазна блок не собирается.
   */
  anchorPool: readonly string[] = themePool,
  /**
   * Откуда в первую очередь брать соблазн. По умолчанию — вся тема, но уровень
   * сужает выбор до пары категорий: иначе одна ходовая категория расселяется
   * по всем блокам и подпись повторяется у соседей. Это именно предпочтение —
   * если слов нужной длины в паре нет, соблазн всё равно берётся из всей темы.
   */
  plantPool: readonly string[] = themePool,
  /**
   * Запасной список для соблазна, когда в паре категорий нет слова нужной длины.
   * Уровень вычитает отсюда категории соседнего блока: именно так в блок
   * «транспорт» попадал ЛЕВ, а подпись повторяла соседа.
   */
  widePool: readonly string[] = themePool,
  /**
   * Слова темы, уже найденные в других блоках уровня. Блок, в котором они
   * складываются заново, отвергаем: одно и то же слово, засчитанное дважды,
   * игрок читает как ошибку генератора.
   */
  usedInLevel: ReadonlySet<string> = new Set(),
  /** Слова категорий соседних блоков: их не подкладываем даже из общего словаря. */
  shun: ReadonlySet<string> = new Set(),
  /** Пары «единственное — множественное»: обе формы в одном блоке не нужны. */
  siblings: ReadonlyMap<string, string> = new Map(),
  /**
   * Сколько ещё форм перебрать, когда годный блок с огрехом уже отложен.
   * На коротких уровнях блоков мало, а слов в ядре категорий совсем чуть-чуть,
   * поэтому там ищем дольше: лишние попытки стоят миллисекунды, а первые уровни
   * игрок разглядывает внимательнее всего.
   */
  patience = SPARE_PATIENCE,
): Figure | null {
  // Тема для проверки блока — всегда вся тема уровня: засчитывается она целиком,
  // и слово длиннее якоря из «чужой» категории сделало бы блок непроходимым.
  const inTheme = new Set(themePool);
  // Соблазны тоже берём из темы и тоже не повторяем в пределах уровня.
  const temptations = plantPool.filter((word) => !used.has(word));
  /**
   * Слово, внутри которого целиком лежит уже найденное в этом уровне. КЕДЫ
   * после КЕДА — именно такой случай: солвер найдёт в блоке и КЕД, и его
   * засчитают второй раз, а убрать его нельзя — он лежит на клетках якоря.
   * Поэтому такие якоря отсеиваем сразу, а не чиним потом.
   */
  const swallows = (word: string): boolean => {
    for (const done of usedInLevel) if (done !== word && word.includes(done)) return true;
    return false;
  };
  const free = (length: number): string[] =>
    anchorPool.filter((word) => word.length === length && !used.has(word) && !swallows(word));

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
  /**
   * Чего в блоке быть не должно: слов, уже найденных в уровне, и слов из
   * категорий соседних блоков. И то и другое солвер находит в случайной добивке
   * сам — ДОМ, РОТ и КОТ складываются почти из любых букв, — поэтому чинится
   * это одинаково: блок с таким словом откладывается в запас, а генератор идёт
   * пробовать другую форму и другой якорь.
   */
  const avoid = new Set([...usedInLevel, ...shun]);
  let attempts = 0;
  /** Годный блок, в котором остался повтор: запасной вариант на случай неудачи. */
  let spare: Figure | null = null;
  let spareAt = 0;

  for (let shapeTry = 0; shapeTry < SHAPE_ATTEMPTS; shapeTry++) {
    // Запасной вариант уже есть — ищем чистый ещё немного и уходим. Иногда
    // чистого не существует вовсе (короткое слово темы осталось одно, и оно
    // уже найдено), и без этой границы генератор перебирал бы блок секундами.
    if (spare && shapeTry > spareAt + patience) break;
    const body = growShape(rng, params);
    if (!body || isBoring(body)) continue;
    const adjacency = buildAdjacency(body);

    for (let anchorTry = 0; anchorTry < ANCHOR_ATTEMPTS; anchorTry++) {
      attempts++;
      // Слова перебираем по порядку и без повторов: их в категории единицы,
      // и крутить одно и то же по десять раз — только жечь попытки.
      const anchor = anchors[anchorTry] ?? rng.pick(anchors);
      const anchorPath = findPath(
        rng, adjacency, anchor.length, body, params.maxTurns, params.readable, params.minTurns,
      );
      if (!anchorPath) continue;
      const protectedCells = new Set(anchorPath);
      const cells: Cell[] = body.map((c) => ({ ...c, letter: '' }));
      anchorPath.forEach((cellIndex, i) => {
        cells[cellIndex].letter = anchor[i];
      });

      const taken = [anchor];
      const lure = plantTemptation(
        rng, dictionary, cells, adjacency, protectedCells, params, temptations, anchor, widePool,
        shun,
      );
      if (lure) taken.push(lure);
      if (params.themedWords >= 3) {
        plantMiddle(rng, cells, adjacency, protectedCells, params, temptations, taken);
      }

      plantFalseStarts(rng, cells, adjacency, protectedCells, anchor, params.falseStarts);

      const free = cells.map((_, i) => i).filter((i) => !protectedCells.has(i));
      for (const i of free) cells[i].letter = dictionary.randomLetter(rng);

      const fixed = repair(
        rng, dictionary, cells, adjacency, protectedCells, anchor, params, inTheme, avoid, siblings,
      );
      if (fixed) {
        const size = bounds(body);
        const made: Figure = {
          cells,
          width: size.width,
          height: size.height,
          words: fixed,
          anchor,
          labels: [],
          scoring: [],
          attempts,
        };
        // Повтор слова, уже найденного в уровне, починка убрать не смогла:
        // придерживаем блок и пробуем другую форму и другой якорь. Часто дело
        // именно в якоре — у ТУФЛИ короткое слово темы осталось одно, и это
        // ровно то, что уже нашли. Если чистого не выйдет вовсе, вернём этот:
        // повтор неприятен, но пустое место вместо блока хуже.
        if (!fixed.some((w) => w.word !== anchor && avoid.has(w.word))) return made;
        if (!spare) {
          spare = made;
          spareAt = shapeTry;
        }
      }
    }
  }
  return spare;
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
  /**
   * Слова, которых в блоке быть не должно: они из категорий соседних блоков.
   * Нужны именно здесь — в категории может не оказаться слова нужной длины,
   * тогда соблазн берётся из общего словаря, а там РОТ и КОТ попадаются чаще
   * всего. Такое слово тянет за собой чужую подпись и повторяет соседа.
   */
  shun: ReadonlySet<string> = new Set(),
): string | null {
  // Сначала пробуем тему и ровно ту длину, что заложена в кривую сложности.
  // Если слов такой длины в категориях нет, берём чуть длиннее — но так,
  // чтобы соблазн всё равно стоил игроку букв.
  const nearest = anchor.length <= 5 ? anchor.length - 1 : anchor.length - 2;
  const longest = Math.max(
    params.temptationLength,
    Math.min(nearest, params.temptationLength + 2),
  );
  /**
   * Слово, которое тянет за собой чужую категорию. Не только само: ТОК читается
   * задом наперёд как КОТ, и солвер найдёт в блоке оба. Подложив ТОК в блок
   * «птицы», мы тем самым подкладываем туда и зверя.
   */
  const drags = (word: string): boolean =>
    shun.has(word) || shun.has([...word].reverse().join(''));

  for (let length = params.temptationLength; length <= longest; length++) {
    const fresh = themed.filter((word) => word.length === length && word !== anchor && !drags(word));
    // Когда свежих слов этой длины в теме не осталось, берём уже встречавшееся:
    // повтор ЛУКА в двух блоках честнее, чем блок с одним-единственным ответом.
    const pool =
      fresh.length > 0
        ? fresh
        : repeats.filter((word) => word.length === length && word !== anchor && !drags(word));
    const placed = tryPlace(
      rng, cells, adjacency, protectedCells, pool, params.readable, params.crossing,
    );
    if (placed) return placed;
  }

  // Тема не подошла — соблазн из общего словаря, но всё равно ходовой:
  // на незнакомое слово никто не клюнет.
  const candidates = dictionary
    .core(params.temptationLength, params.anchorPool)
    .filter((word) => !drags(word));
  return tryPlace(
    rng, cells, adjacency, protectedCells, candidates, params.readable, params.crossing,
  );
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
  return tryPlace(
    rng, cells, adjacency, protectedCells, pool, params.readable, params.crossing,
  );
}

/**
 * Ложные начала: клетки с первой буквой якоря, от которых слово не собирается.
 * Взгляд цепляется за букву и ведёт не туда — именно из-за этого блок ищется
 * долго, хотя слово в нём простое. У одного из ложных начал ставим и вторую
 * букву: тупик на втором шаге обманывает лучше, чем на первом.
 *
 * Клетки занимаем не все: починке нужно оставить свободные, иначе блок
 * перестанет собираться вовсе.
 */
function plantFalseStarts(
  rng: Rng,
  cells: Cell[],
  adjacency: readonly number[][],
  protectedCells: Set<number>,
  anchor: string,
  count: number,
): void {
  if (count <= 0 || anchor.length < 2) return;
  const free = cells.map((_, i) => i).filter((i) => !protectedCells.has(i));
  const room = Math.min(count, Math.floor(free.length / 3));
  if (room <= 0) return;

  let planted = 0;
  let tail = false;
  for (const cell of rng.shuffled(free)) {
    if (planted >= room) break;
    if (protectedCells.has(cell)) continue;
    cells[cell].letter = anchor[0];
    protectedCells.add(cell);
    planted++;
    // Вторая буква — только у одного ложного начала и только если рядом
    // осталась свободная клетка.
    if (tail) continue;
    const next = adjacency[cell].find((i) => !protectedCells.has(i));
    if (next === undefined) continue;
    cells[next].letter = anchor[1];
    protectedCells.add(next);
    tail = true;
  }
}

/** Берёт случайные слова из списка и кладёт первое, которому нашёлся путь. */
function tryPlace(
  rng: Rng,
  cells: Cell[],
  adjacency: readonly number[][],
  protectedCells: Set<number>,
  pool: readonly string[],
  forward = false,
  /** Слово должно пройти хотя бы через одну уже занятую клетку. */
  crossing = false,
): string | null {
  if (pool.length === 0) return null;
  const words = rng.shuffled(pool).slice(0, PLACE_ATTEMPTS);
  const lay = (word: string, path: number[]): string => {
    path.forEach((cellIndex, i) => {
      cells[cellIndex].letter = word[i];
      protectedCells.add(cellIndex);
    });
    return word;
  };

  // Сначала ищем слово, которое вплетается в уже уложенное: два слова в одних
  // клетках путают взгляд сильнее, чем два слова рядом. Если такого нет,
  // кладём как получится — блок без соблазна хуже блока без пересечения.
  if (crossing) {
    for (const word of words) {
      const path = findWordPath(rng, cells, adjacency, word, forward, protectedCells);
      if (path) return lay(word, path);
    }
  }
  for (const word of words) {
    const path = findWordPath(rng, cells, adjacency, word, forward);
    if (path) return lay(word, path);
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
  /** Только вправо и вниз: на первых уровнях слово должно читаться как написано. */
  forward = false,
  /** Путь обязан пройти хотя бы по одной из этих клеток: так слова переплетаются. */
  touch?: ReadonlySet<number>,
): number[] | null {
  const fits = (cell: number, index: number): boolean =>
    cells[cell].letter === '' || cells[cell].letter === word[index];

  const walk = (path: number[]): number[] | null => {
    if (path.length === word.length) {
      return !touch || path.some((cell) => touch.has(cell)) ? path : null;
    }
    const next = rng.shuffled(adjacency[path[path.length - 1]]);
    for (const cell of next) {
      if (path.includes(cell) || !fits(cell, path.length)) continue;
      if (forward && !isForward(cells, path[path.length - 1], cell)) continue;
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
  taken: ReadonlySet<string>,
  siblings: ReadonlyMap<string, string>,
): WordHit[] | null {
  const free = cells.map((_, i) => i).filter((i) => !onAnchor.has(i));
  if (free.length === 0) {
    const words = solve(cells, adjacency, dictionary);
    return accepts(words, anchor, params, inTheme, siblings) ? words : null;
  }

  /** Повтор слова, уже найденного в этом уровне: его в блоке быть не должно. */
  const repeats = (words: WordHit[]): boolean =>
    words.some((w) => w.word !== anchor && taken.has(w.word));
  // Блок, годный во всём кроме повтора, придерживаем: если чистого так и не
  // выйдет, он лучше пустого места. Но сначала честно пробуем его доломать.
  // Вместе со словами запоминаем и буквы: починка правит клетки на месте, и
  // без снимка отложенный вариант разошёлся бы с тем, что лежит на поле.
  let spare: { words: WordHit[]; letters: string[] } | null = null;

  for (let round = 0; round < REPAIR_ROUNDS; round++) {
    const words = solve(cells, adjacency, dictionary);
    if (accepts(words, anchor, params, inTheme, siblings)) {
      if (!repeats(words)) return words;
      if (!spare) spare = { words, letters: cells.map((cell) => cell.letter) };
    }

    const offender = pickOffender(words, anchor, params, inTheme, taken, siblings);
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
  if (!spare) return null;
  spare.letters.forEach((letter, i) => {
    cells[i].letter = letter;
  });
  return spare.words;
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
  /** Пары «единственное — множественное»: обе формы в одном блоке не нужны. */
  siblings: ReadonlyMap<string, string> = new Map(),
): boolean {
  if (!words.some((w) => w.word === anchor)) return false;
  if (twinned(words, siblings)) return false;
  const scoring = words.filter((w) => inTheme.has(w.word) || w.word === anchor);
  if (scoring.some((w) => w.word.length > anchor.length)) return false;
  if (!scoring.some((w) => w.word.length < anchor.length)) return false;
  if (words.length > params.maxWords) return false;
  const short = words.filter((w) => w.word.length === 3).length;
  return short <= params.maxShortWords;
}

/**
 * Лежат ли в блоке обе формы одного слова. Проверяем только засчитываемые:
 * два случайных слова из общего словаря друг другу не мешают.
 */
function twinned(words: WordHit[], siblings: ReadonlyMap<string, string>): boolean {
  if (siblings.size === 0) return false;
  const here = new Set(words.map((w) => w.word));
  for (const word of here) {
    const other = siblings.get(word);
    if (other && here.has(other)) return true;
  }
  return false;
}

/** Слово, из-за которого блок пока не проходит: его и будем ломать. */
function pickOffender(
  words: WordHit[],
  anchor: string,
  params: FigureParams,
  inTheme: ReadonlySet<string>,
  taken: ReadonlySet<string> = new Set(),
  siblings: ReadonlyMap<string, string> = new Map(),
): WordHit | undefined {
  // Повтор слова темы ломаем первым: он дороже всех прочих огрехов блока.
  const repeat = words.find((w) => w.word !== anchor && taken.has(w.word));
  if (repeat) return repeat;
  // Вторая форма того же слова: ломаем ту, что не якорь.
  const here = new Set(words.map((w) => w.word));
  const twin = words.find((w) => {
    const other = siblings.get(w.word);
    return w.word !== anchor && other !== undefined && here.has(other);
  });
  if (twin) return twin;
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
    options.params ?? levelParams(pack.curve, levelIndex, options.figureCount);
  const theme = levelTheme(pack.themes, levelIndex);
  // Прячем слова по кривой, а засчитываем любые слова темы: если редкое слово
  // сложилось случайно, оно всё равно из категории и обязано считаться.
  const siblings = siblingForms(pack.themes);
  const patience = SPARE_PATIENCE;
  const pool = themeWords(pack.themes, theme, params.poolDepth);
  const inTheme = new Set(themeScoring(pack.themes, theme));

  const figures: Figure[] = [];
  const usedAnchors = new Set<string>();
  /**
   * Всё, что вообще можно найти в уже собранных блоках. Не то же самое, что
   * `usedAnchors`: тот запрещает класть слово повторно, а солвер находит в блоке
   * и то, что никто не клал, — КОТ и КЕД складываются почти из любой россыпи
   * букв. Одно и то же слово, засчитанное в уровне дважды, игрок читает как
   * ошибку, поэтому такие блоки пересобираем.
   */
  const already = new Set<string>();
  // Блоки берут категории по очереди: первый — из первой (в плане она стоит
  // более прозрачной), второй — из второй, третий снова из первой. Иначе три
  // блока подряд оказываются про одно и то же и уровень выглядит однообразным.
  const byCategory = theme.categories.map((id) =>
    categoryPool(pack.themes, id, params.poolDepth),
  );
  /**
   * Приманки блока берём не из всей темы, а из пары «своя категория плюс
   * та, что через одну». Иначе одна ходовая категория расселяется по всем пяти
   * блокам, и подпись повторяется в соседних блоках: игрок видит «звери» и в
   * первом, и во втором, хотя в плане у них разные категории. Шаг через одну
   * при пяти категориях как раз и разводит соседей: {1,3}, {2,4}, {3,5}, {4,1},
   * {5,2} — ни одна пара не пересекается с соседней.
   */
  const duoPool = (index: number): string[] => [...byCategory[index % byCategory.length]];

  for (const [figureIndex, figureParams] of params.figures.entries()) {
    const turn = byCategory[figureIndex % byCategory.length];
    const ownPool = turn.length >= 4 ? turn : pool;
    const duo = duoPool(figureIndex);
    // Пара категорий должна быть достаточно широкой, иначе приманок не хватит
    // и блок выродится в одно длинное слово.
    const temptPool = duo.length >= 8 ? duo : pool;
    /*
     * Чужая категория уровня в блоке не нужна вовсе: каждая стоит ровно в одном
     * блоке, поэтому её слово, попавшее в чужой блок, — это всегда возвращение.
     * «Овощи · Семья» в первом блоке и «Семья» в третьем читаются как повтор,
     * хотя соседями не стоят. Поэтому вычитаем слова всех остальных категорий
     * уровня разом, а не только соседних, и вместе с множественным числом:
     * ЕЛИ — такие же деревья, как ЕЛЬ.
     *
     * Но у блока обязано быть слово темы короче якоря — иначе выбирать не из
     * чего. Если в своей категории такого слова нет вовсе (у птиц нет ни одного
     * трёхбуквенного), запрет пришлось бы соблюдать ценой непроходимого блока.
     * Тогда он смягчается до соседних блоков: возвращение через блок — меньшее
     * зло, чем блок без выбора.
     */
    const mine = theme.categories[figureIndex % theme.categories.length];
    const ownShort = ownPool.some((word) => word.length < figureParams.anchorLength);
    const before = figures[figures.length - 1]?.labels ?? [];
    // Категория следующего блока — но без «по кругу»: за последним блоком уровня
    // никого нет, и запрещать там первую категорию значит отнимать у блока
    // последний доступный вариант.
    const ahead = theme.categories[figureIndex + 1];
    const bannedIds = ownShort
      ? theme.categories.filter((id) => id !== mine)
      : [...before, ...(ahead ? [ahead] : [])].filter((id) => id !== mine);
    const banned = new Set(bannedIds.flatMap((id) => categoryWords(pack.themes, id)));
    const widePool = pool.filter((word) => !banned.has(word));
    // Якорь блока из этого списка, конечно, исключаем: сам блок про свою категорию.
    const shun = new Set([...banned].filter((word) => !ownPool.includes(word)));
    // Слова темы, которые в этом уровне уже находятся: генератор обязан их обойти.
    const taken = new Set([...already].filter((word) => inTheme.has(word)));
    /**
     * Одна попытка собрать блок. Уступаем по очереди и в понятном порядке:
     * сначала слабеют рамки фигуры, потом расширяется запас приманок и только
     * в самом конце отпускается категория якоря. Именно она держит подпись
     * блока, поэтому отдаём её последней: блок «транспорт» с якорем из деревьев
     * — это и есть та самая однобокость, на которую жалуются.
     */
    const attempt = (): Figure | null => {
      const looser = (relax: number): FigureParams => ({
        ...figureParams,
        maxShortWords: figureParams.maxShortWords + relax,
        maxWords: figureParams.maxWords + relax,
        maxTurns: figureParams.maxTurns + relax,
        anchorPool: figureParams.anchorPool * (1 + relax),
      });

      let made = generateFigure(
        rng, dictionary, figureParams, usedAnchors, pool, ownPool, temptPool, widePool, taken,
        shun, siblings, patience,
      );
      for (let relax = 1; !made && relax <= 3; relax++) {
        made = generateFigure(
          rng, dictionary, looser(relax), usedAnchors, pool, ownPool, temptPool, widePool,
          taken, shun, siblings, patience,
        );
      }
      // Приманок в паре категорий не хватило — берём их из всей темы,
      // но якорь всё ещё из своей категории: подпись блока не меняется.
      // Запрет на уже найденные слова здесь снимается: держать его на всех
      // ступенях лестницы слишком дорого — на редких категориях генератор
      // перебирал бы блок секундами. Пересборка ниже всё равно предпочтёт
      // вариант без повтора, если он вообще найдётся.
      if (!made && temptPool !== pool) {
        made = generateFigure(
          rng, dictionary, figureParams, usedAnchors, pool, ownPool, pool, widePool, taken,
          shun, siblings, patience,
        );
        for (let relax = 1; !made && relax <= 3; relax++) {
          made = generateFigure(
            rng, dictionary, looser(relax), usedAnchors, pool, ownPool, pool, widePool, taken,
            shun, siblings, patience,
          );
        }
      }
      // И только теперь отпускаем категорию: непроходимый блок хуже смешанной подписи.
      if (!made) {
        made = generateFigure(
          rng, dictionary, figureParams, usedAnchors, pool, pool, pool, pool, new Set(), new Set(),
          siblings,
        );
      }
      return made;
    };

    const previous = figures[figures.length - 1]?.labels ?? [];
    // Сколько раз категория уже попадала в подписи этого уровня.
    const seen = new Map<string, number>();
    for (const done of figures) {
      for (const category of done.labels) seen.set(category, (seen.get(category) ?? 0) + 1);
    }
    /**
     * Что считаем однобокостью. Дороже всего повтор подписи у соседнего блока:
     * два блока подряд про одно и то же читаются как ошибка. Но и возвращение
     * категории через блок заметно — «Овощи · Семья», потом «Семья · Овощи»
     * выглядят одинаково, хотя соседями не стоят. Поэтому любое повторное
     * появление категории в уровне тоже стоит денег, просто втрое дешевле.
     */
    const dullness = (labels: readonly string[]): number =>
      labels.reduce(
        (sum, c) => sum + (previous.includes(c) ? 3 : 0) + (seen.get(c) ?? 0),
        0,
      );

    /**
     * Цена варианта блока. Дороже всего повтор слова темы: его засчитают второй
     * раз, и уровень выглядит сломанным. Повтор слова не из темы дешевле — оно
     * уходит в копилку, а копилка отвечает «уже было». Однобокая подпись стоит
     * посередине.
     */
    const price = (made: Figure): number => {
      const words = made.words.map((w) => w.word);
      const repeats = words.filter((word) => already.has(word));
      const themed = repeats.filter((word) => inTheme.has(word)).length;
      return themed * 6 + (repeats.length - themed) + dullness(figureLabels(pack.themes, words, theme));
    };

    // Блок пересобираем несколько раз и оставляем самый дешёвый: безупречного
    // может не найтись вовсе — «лев» и «кот» складываются почти в любой россыпи
    // букв, — но пустое место вместо блока хуже.
    let figure = attempt();
    let best = figure ? price(figure) : 0;
    for (let retry = 0; figure && best > 0 && retry < 6; retry++) {
      const another = attempt();
      if (!another) break;
      const score = price(another);
      if (score < best) {
        figure = another;
        best = score;
      }
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
    for (const word of words) already.add(word);
    figures.push(figure);
  }

  const maxLetters = figures.reduce((sum, f) => sum + f.anchor.length, 0);
  // Худшая игра: в каждом блоке взято самое короткое слово темы. Цель обязана
  // быть хотя бы на букву выше — иначе уровень выигрывается любой игрой
  // и перестаёт быть задачей.
  const worst = figures.reduce((sum, f) => {
    const shortest = f.scoring.reduce((best, w) => (w.length < best.length ? w : best), f.anchor);
    return sum + shortest.length;
  }, 0);
  const floor = Math.max(figures.length * 3 + 1, worst + 1);
  const goalLetters = Math.min(maxLetters, Math.max(floor, Math.round(maxLetters * params.goalRatio)));

  return { index: levelIndex, seed, theme, figures, goalLetters, maxLetters };
}

/**
 * Блок «последнего шанса»: ещё одна фигура для проигранного уровня. Тема и
 * сложность те же, что у первого блока уровня, а сид другой — иначе игрок
 * получил бы ровно тот блок, с которого начинал.
 *
 * Отдельный уровень из одной фигуры мы и строим: так у блока честно считаются
 * и подпись, и засчитываемые слова, и ни одно правило генератора не обходится.
 */
export function generateRescue(content: GameContent, levelIndex: number, seed = 1): Figure {
  const level = generateLevel(content, levelIndex, {
    gameSeed: 101 + seed,
    figureCount: 1,
  });
  return level.figures[0];
}

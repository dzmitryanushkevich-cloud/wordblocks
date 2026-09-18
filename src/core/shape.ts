import type { Cell, Coord } from './types.js';
import type { Rng } from './rng.js';

const DIRECTIONS: readonly Coord[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const key = (c: Coord): string => `${c.x},${c.y}`;

export interface ShapeParams {
  /** Сколько клеток в фигуре. */
  size: number;
  /** Ограничение габарита: фигура должна поместиться в boxW x boxH. */
  boxW: number;
  boxH: number;
  /** Ступень формы: 0 — только простые силуэты, 2 — вся выдумка целиком. */
  shapeStage?: number;
}

/**
 * Характер формы. Случайный рост всегда даёт округлую кляксу, поэтому
 * разнообразие приходится задавать намеренно: вытянутые, симметричные,
 * выращенные из готового силуэта.
 */
export type ShapeStyle = 'blob' | 'tall' | 'wide' | 'symmetric' | 'template';

/*
 * Форма тоже идёт по кривой сложности. На первых уровнях блок должен читаться
 * с одного взгляда: плотное пятно или симметричная деталь. Дальше добавляются
 * вытянутые, и только к десятому уровню — скелеты с дырками и коридорами
 * в одну клетку, где путь слова приходится выискивать.
 *
 * Внутри каждой ступени веса перекошены в сторону широких форм: поля под блоком
 * больше в ширину, чем в высоту, поэтому вытянутая вбок фигура выходит крупнее
 * такой же вытянутой вверх.
 */
const STAGE_WEIGHTS: [ShapeStyle, number][][] = [
  [
    ['blob', 72],
    ['symmetric', 28],
  ],
  [
    ['blob', 40],
    ['wide', 24],
    ['symmetric', 22],
    ['tall', 14],
  ],
  [
    ['blob', 32],
    ['wide', 22],
    ['tall', 16],
    ['symmetric', 16],
    ['template', 14],
  ],
];

/** Скелеты силуэтов: из них форма доращивается до нужного размера. */
const SKELETONS: string[][] = [
  ['#.#', '#.#', '###'], // подкова
  ['#..', '#..', '###'], // уголок
  ['.#.', '###', '.#.'], // крест
  ['#.#', '###', '#.#'], // буква Н
  ['###', '.#.', '.#.'], // буква Т
  ['#.#', '###'], // гребёнка
  ['.##', '##.', '.##'], // зигзаг
  ['##.', '.##', '..#'], // лесенка
];

function fromRows(rows: string[]): Coord[] {
  const cells: Coord[] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && cells.push({ x, y })));
  return cells;
}

/** Повороты и отражения: один скелет даёт восемь разных силуэтов. */
function orient(rng: Rng, cells: readonly Coord[]): Coord[] {
  let out = cells.map((c) => ({ ...c }));
  if (rng.next() < 0.5) out = out.map((c) => ({ x: -c.x, y: c.y }));
  const quarter = rng.int(4);
  for (let i = 0; i < quarter; i++) out = out.map((c) => ({ x: -c.y, y: c.x }));
  return normalize(out);
}

/** Доращивание формы до нужного размера с соблюдением габарита. */
function growFrom(
  rng: Rng,
  seed: readonly Coord[],
  size: number,
  boxW: number,
  boxH: number,
): Coord[] | null {
  const body = seed.map((c) => ({ ...c }));
  const taken = new Set(body.map(key));
  const bbox = () => ({
    minX: Math.min(...body.map((c) => c.x)),
    maxX: Math.max(...body.map((c) => c.x)),
    minY: Math.min(...body.map((c) => c.y)),
    maxY: Math.max(...body.map((c) => c.y)),
  });

  let box = bbox();
  if (box.maxX - box.minX + 1 > boxW || box.maxY - box.minY + 1 > boxH) return null;
  // Скелет крупнее нужного — подрезаем с краёв, сохраняя связность.
  while (body.length > size) {
    const index = body.findIndex((_, i) => isConnectedWithout(body, i));
    if (index < 0) return null;
    taken.delete(key(body[index]));
    body.splice(index, 1);
  }

  let guard = size * 80;
  while (body.length < size && guard-- > 0) {
    const from = rng.pick(body);
    const dir = rng.pick(DIRECTIONS);
    const next = { x: from.x + dir.x, y: from.y + dir.y };
    if (taken.has(key(next))) continue;
    box = bbox();
    const width = Math.max(box.maxX, next.x) - Math.min(box.minX, next.x) + 1;
    const height = Math.max(box.maxY, next.y) - Math.min(box.minY, next.y) + 1;
    if (width > boxW || height > boxH) continue;
    body.push(next);
    taken.add(key(next));
  }
  return body.length === size ? normalize(body) : null;
}

function isConnectedWithout(body: readonly Coord[], skip: number): boolean {
  const rest = body.filter((_, i) => i !== skip);
  if (rest.length === 0) return false;
  const index = new Set(rest.map(key));
  const seen = new Set<string>([key(rest[0])]);
  const queue = [rest[0]];
  while (queue.length) {
    const c = queue.pop()!;
    for (const dir of DIRECTIONS) {
      const next = { x: c.x + dir.x, y: c.y + dir.y };
      const k = key(next);
      if (index.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(next);
      }
    }
  }
  return seen.size === rest.length;
}

/** Симметричная форма: строим половину и зеркалим — так рождаются арки и кресты. */
function symmetricShape(rng: Rng, size: number): Coord[] | null {
  const half = Math.ceil(size / 2);
  const grown = growPolyomino(rng, { size: half, boxW: rng.int(2) + 2, boxH: 6 });
  if (!grown) return null;
  const width = Math.max(...grown.map((c) => c.x));
  const seen = new Set<string>();
  const cells: Coord[] = [];
  for (const c of grown) {
    for (const p of [c, { x: 2 * width + 1 - c.x, y: c.y }]) {
      if (!seen.has(key(p))) {
        seen.add(key(p));
        cells.push(p);
      }
    }
  }
  while (cells.length > size) {
    const index = cells.findIndex((_, i) => isConnectedWithout(cells, i));
    if (index < 0) break;
    cells.splice(index, 1);
  }
  return cells.length === size ? normalize(cells) : null;
}

/**
 * Форма нужного размера со случайным характером. Стиль выбирается по весам,
 * непригодные варианты отсеиваются валидатором блока уровнем выше.
 */
export function growShape(rng: Rng, params: ShapeParams): Coord[] | null {
  const weights = STAGE_WEIGHTS[Math.min(params.shapeStage ?? 2, STAGE_WEIGHTS.length - 1)];
  const style = rng.weighted(
    weights.map(([name]) => name),
    weights.map(([, weight]) => weight),
  );

  switch (style) {
    case 'tall':
      return growPolyomino(rng, { size: params.size, boxW: rng.int(2) + 3, boxH: 6 });
    case 'wide':
      return growPolyomino(rng, { size: params.size, boxW: 7, boxH: rng.int(2) + 3 });
    case 'symmetric':
      return symmetricShape(rng, params.size);
    case 'template': {
      const seed = orient(rng, fromRows(rng.pick(SKELETONS)));
      return growFrom(rng, seed, params.size, 6, 6);
    }
    default:
      return growPolyomino(rng, params);
  }
}

/**
 * Случайный полиомино: растём от стартовой клетки, каждый раз добавляя
 * соседа к уже построенному телу. Габарит ограничен, чтобы фигура
 * оставалась компактной и читалась на экране.
 */
export function growPolyomino(rng: Rng, params: ShapeParams): Coord[] | null {
  const { size, boxW, boxH } = params;
  if (size > boxW * boxH) return null;

  const body: Coord[] = [{ x: 0, y: 0 }];
  const taken = new Set<string>([key(body[0])]);
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  let guard = size * 60;
  while (body.length < size && guard-- > 0) {
    const from = rng.pick(body);
    const dir = rng.pick(DIRECTIONS);
    const next: Coord = { x: from.x + dir.x, y: from.y + dir.y };
    if (taken.has(key(next))) continue;
    const nMinX = Math.min(minX, next.x);
    const nMaxX = Math.max(maxX, next.x);
    const nMinY = Math.min(minY, next.y);
    const nMaxY = Math.max(maxY, next.y);
    if (nMaxX - nMinX + 1 > boxW || nMaxY - nMinY + 1 > boxH) continue;
    body.push(next);
    taken.add(key(next));
    minX = nMinX;
    maxX = nMaxX;
    minY = nMinY;
    maxY = nMaxY;
  }

  return body.length === size ? normalize(body) : null;
}

/** Сдвигаем фигуру так, чтобы минимальные x и y были нулевыми. */
export function normalize(body: readonly Coord[]): Coord[] {
  const minX = Math.min(...body.map((c) => c.x));
  const minY = Math.min(...body.map((c) => c.y));
  return body.map((c) => ({ x: c.x - minX, y: c.y - minY }));
}

export function bounds(body: readonly Coord[]): { width: number; height: number } {
  return {
    width: Math.max(...body.map((c) => c.x)) + 1,
    height: Math.max(...body.map((c) => c.y)) + 1,
  };
}

/**
 * Скучная фигура — прямая полоса или сплошной прямоугольник.
 * И то и другое не даёт головоломке формы, ради которой всё затевалось.
 */
export function isBoring(body: readonly Coord[]): boolean {
  const { width, height } = bounds(body);
  if (width === 1 || height === 1) return true;
  if (width * height === body.length) return true;
  return false;
}

/** Списки соседей по рёбрам: adjacency[i] — индексы клеток, смежных с i. */
export function buildAdjacency(body: readonly Coord[]): number[][] {
  const index = new Map<string, number>();
  body.forEach((c, i) => index.set(key(c), i));
  return body.map((c) => {
    const near: number[] = [];
    for (const dir of DIRECTIONS) {
      const found = index.get(key({ x: c.x + dir.x, y: c.y + dir.y }));
      if (found !== undefined) near.push(found);
    }
    return near;
  });
}

/** Сколько раз путь меняет направление: прямое слово заметно, извилистое нужно выискивать. */
export function countTurns(body: readonly Coord[], path: readonly number[]): number {
  let turns = 0;
  for (let i = 2; i < path.length; i++) {
    const a = body[path[i - 2]];
    const b = body[path[i - 1]];
    const c = body[path[i]];
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) turns++;
  }
  return turns;
}

/**
 * Случайный простой путь заданной длины (без повторов клеток, только по рёбрам).
 * По такому пути потом выкладывается якорное слово. Извилистость ограничена:
 * на ранних уровнях слово должно читаться почти прямой линией.
 */
export function findPath(
  rng: Rng,
  adjacency: readonly number[][],
  length: number,
  body?: readonly Coord[],
  maxTurns = Infinity,
): number[] | null {
  if (length > adjacency.length) return null;
  const starts = rng.shuffled(adjacency.map((_, i) => i));
  for (const start of starts) {
    const path = [start];
    const used = new Set<number>([start]);
    if (walk(rng, adjacency, path, used, length, body, maxTurns)) return path;
  }
  return null;
}

function walk(
  rng: Rng,
  adjacency: readonly number[][],
  path: number[],
  used: Set<number>,
  length: number,
  body?: readonly Coord[],
  maxTurns = Infinity,
): boolean {
  if (path.length === length) return true;
  const options = rng.shuffled(adjacency[path[path.length - 1]]);
  for (const next of options) {
    if (used.has(next)) continue;
    path.push(next);
    if (body && countTurns(body, path) > maxTurns) {
      path.pop();
      continue;
    }
    used.add(next);
    if (walk(rng, adjacency, path, used, length, body, maxTurns)) return true;
    path.pop();
    used.delete(next);
  }
  return false;
}

/** Проверка пути игрока: клетки не повторяются и каждая следующая смежна с предыдущей. */
export function isValidPath(adjacency: readonly number[][], path: readonly number[]): boolean {
  if (path.length === 0) return false;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    if (cell < 0 || cell >= adjacency.length || seen.has(cell)) return false;
    if (i > 0 && !adjacency[path[i - 1]].includes(cell)) return false;
    seen.add(cell);
  }
  return true;
}

export function readWord(cells: readonly Cell[], path: readonly number[]): string {
  return path.map((i) => cells[i].letter).join('');
}

/**
 * Простой путь заданной длины внутри разрешённого подмножества клеток.
 * Нужен, чтобы подложить короткое слово, не задевая уже выложенное якорное.
 */
export function findPathWithin(
  rng: Rng,
  adjacency: readonly number[][],
  allowed: ReadonlySet<number>,
  length: number,
): number[] | null {
  if (allowed.size < length) return null;
  const starts = rng.shuffled([...allowed]);
  for (const start of starts) {
    const path = [start];
    const used = new Set<number>([start]);
    if (walkWithin(rng, adjacency, allowed, path, used, length)) return path;
  }
  return null;
}

function walkWithin(
  rng: Rng,
  adjacency: readonly number[][],
  allowed: ReadonlySet<number>,
  path: number[],
  used: Set<number>,
  length: number,
): boolean {
  if (path.length === length) return true;
  const options = rng.shuffled(adjacency[path[path.length - 1]]);
  for (const next of options) {
    if (used.has(next) || !allowed.has(next)) continue;
    path.push(next);
    used.add(next);
    if (walkWithin(rng, adjacency, allowed, path, used, length)) return true;
    path.pop();
    used.delete(next);
  }
  return false;
}

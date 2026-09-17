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

/**
 * Случайный простой путь заданной длины (без повторов клеток, только по рёбрам).
 * По такому пути потом выкладывается якорное слово.
 */
export function findPath(rng: Rng, adjacency: readonly number[][], length: number): number[] | null {
  if (length > adjacency.length) return null;
  const starts = rng.shuffled(adjacency.map((_, i) => i));
  for (const start of starts) {
    const path = [start];
    const used = new Set<number>([start]);
    if (walk(rng, adjacency, path, used, length)) return path;
  }
  return null;
}

function walk(
  rng: Rng,
  adjacency: readonly number[][],
  path: number[],
  used: Set<number>,
  length: number,
): boolean {
  if (path.length === length) return true;
  const options = rng.shuffled(adjacency[path[path.length - 1]]);
  for (const next of options) {
    if (used.has(next)) continue;
    path.push(next);
    used.add(next);
    if (walk(rng, adjacency, path, used, length)) return true;
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

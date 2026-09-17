import type { Coord } from '../core/types.js';

type Point = [number, number];

const key = (x: number, y: number): string => `${x},${y}`;

/**
 * Контур фигуры одной линией: обходим внешние рёбра клеток и склеиваем их в замкнутые петли.
 * Нужен, чтобы нарисовать под плитками одну общую подложку, а не набор отдельных квадратов.
 *
 * pitch — шаг сетки (плитка плюс зазор), offset сдвигает контур так, чтобы подложка
 * выступала за плитки на половину зазора со всех сторон.
 */
export function outlinePath(
  cells: readonly Coord[],
  pitchX: number,
  pitchY: number,
  offsetX: number,
  offsetY: number,
): string {
  const filled = new Set(cells.map((c) => key(c.x, c.y)));
  // Из одной вершины может выходить два ребра — там, где клетки смыкаются углами.
  const edges = new Map<string, Point[]>();
  const add = (from: Point, to: Point): void => {
    const list = edges.get(key(from[0], from[1]));
    if (list) list.push(to);
    else edges.set(key(from[0], from[1]), [to]);
  };

  for (const { x, y } of cells) {
    if (!filled.has(key(x, y - 1))) add([x, y], [x + 1, y]);
    if (!filled.has(key(x + 1, y))) add([x + 1, y], [x + 1, y + 1]);
    if (!filled.has(key(x, y + 1))) add([x + 1, y + 1], [x, y + 1]);
    if (!filled.has(key(x - 1, y))) add([x, y + 1], [x, y]);
  }

  const toPixels = (p: Point): string =>
    `${(p[0] * pitchX + offsetX).toFixed(2)} ${(p[1] * pitchY + offsetY).toFixed(2)}`;

  const loops: string[] = [];
  let guard = cells.length * 8;

  while (edges.size > 0 && guard-- > 0) {
    const startKey = edges.keys().next().value as string;
    const [sx, sy] = startKey.split(',').map(Number);
    let current: Point = [sx, sy];
    const loop: Point[] = [current];

    for (let step = 0; step < cells.length * 8; step++) {
      const list = edges.get(key(current[0], current[1]));
      if (!list || list.length === 0) break;
      const next = list.pop()!;
      if (list.length === 0) edges.delete(key(current[0], current[1]));
      if (next[0] === sx && next[1] === sy) break;
      loop.push(next);
      current = next;
    }

    loops.push(`M ${loop.map(toPixels).join(' L ')} Z`);
  }

  return loops.join(' ');
}

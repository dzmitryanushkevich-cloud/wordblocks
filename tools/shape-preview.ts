/**
 * Витрина форм блоков: показывает, какими они получаются сейчас и какими могли бы
 * стать при других способах построения. Игру не трогает — это отдельная страница
 * для решения «берём или нет».
 *
 *   npx tsx tools/shape-preview.ts   →  dist/shapes.html
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rng } from '../src/core/rng.js';
import { buildAdjacency, bounds, findPath, growPolyomino, isBoring, normalize } from '../src/core/shape.js';
import { outlinePath } from '../src/ui/outline.js';
import type { Coord } from '../src/core/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Готовые силуэты: рисуем решёткой, решётка и есть форма. */
const TEMPLATES: Record<string, string[]> = {
  крест: ['.#.', '###', '.#.', '.#.'],
  подкова: ['#.#', '#.#', '###'],
  лесенка: ['##..', '.##.', '..##'],
  зигзаг: ['.##', '##.', '.##', '##.'],
  кольцо: ['###', '#.#', '###'],
  буква_Т: ['###', '.#.', '.#.', '.#.'],
  буква_Н: ['#.#', '###', '#.#'],
  стрела: ['..#..', '.###.', '#####', '..#..'],
  уголок: ['#...', '#...', '#...', '####'],
  гребёнка: ['#.#.#', '#####'],
};

function fromTemplate(rows: string[]): Coord[] {
  const cells: Coord[] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && cells.push({ x, y })));
  return cells;
}

/** Симметричная форма: строим половину и зеркалим — так рождаются кресты и буквы. */
function symmetricShape(rng: Rng, size: number): Coord[] | null {
  const half = Math.ceil(size / 2);
  const grown = growPolyomino(rng, { size: half, boxW: 3, boxH: 4 });
  if (!grown) return null;
  const width = Math.max(...grown.map((c) => c.x));
  const seen = new Set<string>();
  const cells: Coord[] = [];
  for (const c of grown) {
    for (const p of [c, { x: 2 * width + 1 - c.x, y: c.y }]) {
      const key = `${p.x},${p.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        cells.push(p);
      }
    }
  }
  return normalize(cells);
}

interface Sample {
  style: string;
  cells: Coord[];
  fits: string;
}

function pathReport(cells: Coord[]): string {
  const adjacency = buildAdjacency(cells);
  const rng = new Rng(7);
  const easy = findPath(rng, adjacency, 5, cells, 2) ? '5 букв ≤2 поворотов ✓' : '5 букв ≤2 поворотов ✗';
  const hard = findPath(rng, adjacency, 7, cells, 3) ? '7 ≤3 ✓' : '7 ≤3 ✗';
  return `${easy} · ${hard}`;
}

const samples: Sample[] = [];
const rng = new Rng(20260917);

for (let i = 0; i < 8; i++) {
  const cells = growPolyomino(rng, { size: 10, boxW: 5, boxH: 5 });
  if (cells && !isBoring(cells)) samples.push({ style: 'сейчас: клякса 5×5', cells, fits: pathReport(cells) });
}
for (let i = 0; i < 8; i++) {
  const box = i % 2 === 0 ? { boxW: 6, boxH: 3 } : { boxW: 3, boxH: 6 };
  const cells = growPolyomino(rng, { size: 10, ...box });
  if (cells && !isBoring(cells)) samples.push({ style: 'вытянутая 6×3', cells, fits: pathReport(cells) });
}
for (let i = 0; i < 8; i++) {
  const cells = symmetricShape(rng, 10);
  if (cells && !isBoring(cells)) samples.push({ style: 'симметричная', cells, fits: pathReport(cells) });
}
for (const [name, rows] of Object.entries(TEMPLATES)) {
  const cells = fromTemplate(rows);
  samples.push({ style: `шаблон: ${name.replace('_', ' ')}`, cells, fits: pathReport(cells) });
}

const UNIT = 30;
const cards = samples
  .map((s) => {
    const size = bounds(s.cells);
    return `<figure>
  <svg viewBox="-0.35 -0.35 ${size.width + 0.7} ${size.height + 0.7}"
       width="${size.width * UNIT}" height="${size.height * UNIT}">
    <path d="${outlinePath(s.cells, 1, 1, 0, 0)}" />
  </svg>
  <figcaption><b>${s.style}</b><span>${s.cells.length} клеток · ${s.fits}</span></figcaption>
</figure>`;
  })
  .join('\n');

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WordBlocks — формы блоков</title>
<style>
  body { margin: 0; padding: 28px; background: #3f7f68; color: #f3f7f4;
         font-family: 'Trebuchet MS', system-ui, sans-serif; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  p { margin: 0 0 24px; opacity: 0.85; max-width: 62ch; line-height: 1.5; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;
          align-items: stretch; }
  figure { margin: 0; display: grid; grid-template-rows: 1fr auto; justify-items: center;
           align-items: center; gap: 12px; background: rgba(255,255,255,0.07);
           border-radius: 14px; padding: 18px 12px; min-height: 230px; }
  svg { overflow: visible; max-width: 150px; max-height: 150px; width: auto; height: auto;
        filter: drop-shadow(0 4px 0 #ded8bb); }
  path { fill: #f7f3dd; stroke: #f7f3dd; stroke-width: 0.5; stroke-linejoin: round;
         paint-order: stroke; }
  figcaption { display: grid; gap: 3px; text-align: center; font-size: 12px; }
  figcaption b { font-size: 13px; }
  figcaption span { opacity: 0.7; }
</style></head>
<body>
<h1>Какими могут быть блоки</h1>
<p>Первые восемь — то, что игра делает сейчас. Дальше: вытянутые габариты, симметричные формы
и готовые силуэты. Подпись показывает, влезает ли в форму слово из пяти букв с двумя поворотами
(ранние уровни) и из семи с тремя (поздние).</p>
<div class="grid">
${cards}
</div>
</body></html>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'shapes.html'), html, 'utf8');
console.log(`dist/shapes.html — ${samples.length} форм`);

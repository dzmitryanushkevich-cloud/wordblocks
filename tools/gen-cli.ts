/**
 * Консольный прогон генератора: печатает фигуры уровня, все спрятанные слова
 * и сводную статистику. Нужен, чтобы оценивать качество контента без интерфейса.
 *
 *   npm run gen -- balance 10 — отчёт по балансу первых уровней
 *   npm run gen               — уровни 1, 5 и 10 подробно
 *   npm run gen -- 3          — подробно уровень 3
 *   npm run gen -- stats 40   — статистика по 40 уровням без печати фигур
 */
import { getDictionary } from '../src/core/loadDictionary.js';
import { generateLevel } from '../src/core/generator.js';
import type { Figure, Level } from '../src/core/types.js';

const dictionary = getDictionary();

function drawFigure(figure: Figure): string {
  const grid: string[][] = Array.from({ length: figure.height }, () =>
    Array.from({ length: figure.width }, () => '  '),
  );
  for (const cell of figure.cells) grid[cell.y][cell.x] = `${cell.letter.toUpperCase()} `;
  return grid.map((row) => '   ' + row.join('')).join('\n');
}

function printLevel(level: Level): void {
  console.log(`\n=== Уровень ${level.index} (сид ${level.seed}) ===`);
  console.log(`цель ${level.goalLetters} из ${level.maxLetters} букв\n`);
  level.figures.forEach((figure, i) => {
    const words = figure.words.map((w) => w.word.toUpperCase()).join(', ');
    console.log(`Фигура ${i + 1}: ${figure.cells.length} клеток, якорь ${figure.anchor.toUpperCase()}`);
    console.log(drawFigure(figure));
    console.log(`   слова (${figure.words.length}): ${words}`);
    console.log(`   попыток генерации: ${figure.attempts}\n`);
  });
}

function printStats(levels: number): void {
  const started = Date.now();
  let figures = 0;
  let words = 0;
  let shortWords = 0;
  let attempts = 0;
  let anchorLetters = 0;
  let goal = 0;
  let max = 0;
  const wordCounts = new Map<number, number>();

  for (let i = 1; i <= levels; i++) {
    const level = generateLevel(dictionary, i);
    goal += level.goalLetters;
    max += level.maxLetters;
    for (const figure of level.figures) {
      figures++;
      words += figure.words.length;
      shortWords += figure.words.filter((w) => w.word.length === 3).length;
      attempts += figure.attempts;
      anchorLetters += figure.anchor.length;
      wordCounts.set(figure.words.length, (wordCounts.get(figure.words.length) ?? 0) + 1);
    }
  }

  const ms = Date.now() - started;
  console.log(`\nУровней: ${levels}, фигур: ${figures}, время: ${ms} мс (${(ms / levels).toFixed(1)} мс на уровень)`);
  console.log(`Слов на фигуру: ${(words / figures).toFixed(2)} (распределение ${[...wordCounts]
    .sort((a, b) => a[0] - b[0])
    .map(([n, c]) => `${n}:${c}`)
    .join(' ')})`);
  console.log(`Трёхбуквенных слов на фигуру: ${(shortWords / figures).toFixed(2)}`);
  console.log(`Средняя длина якоря: ${(anchorLetters / figures).toFixed(2)}`);
  console.log(`Средняя цель: ${(goal / levels).toFixed(1)} из ${(max / levels).toFixed(1)} букв`);
  console.log(`Попыток генерации на фигуру: ${(attempts / figures).toFixed(1)}`);
}

/** Сколько раз путь якорного слова меняет направление: прямое слово найти легче извилистого. */
function turns(figure: Figure): number {
  const path = figure.words.find((w) => w.word === figure.anchor)?.path ?? [];
  let count = 0;
  for (let i = 2; i < path.length; i++) {
    const a = figure.cells[path[i - 2]];
    const b = figure.cells[path[i - 1]];
    const c = figure.cells[path[i]];
    if ((b.x - a.x) !== (c.x - b.x) || (b.y - a.y) !== (c.y - b.y)) count++;
  }
  return count;
}

/**
 * Баланс уровня: что можно набрать при идеальной игре, что нужно для победы
 * и сколько букв игрок может потерять, прежде чем уровень будет провален.
 */
function printBalance(levels: number): void {
  console.log('\nур  якоря          клеток        слов  поворотов  цель/макс  запас  худший');
  for (let index = 1; index <= levels; index++) {
    const level = generateLevel(dictionary, index);
    const anchors = level.figures.map((f) => f.anchor.length);
    const sizes = level.figures.map((f) => f.cells.length);
    const words = level.figures.map((f) => f.words.length);
    const bends = level.figures.map(turns);
    // Худший исход: в каждом блоке игрок берёт самое короткое слово.
    const worst = level.figures.reduce(
      (sum, f) => sum + Math.min(...f.words.map((w) => w.word.length)),
      0,
    );
    const slack = level.maxLetters - level.goalLetters;
    console.log(
      `${String(index).padStart(2)}  ${anchors.join(',')}     ${sizes.join(',')}   ` +
        `${words.join(',')}   ${bends.join(',')}      ${String(level.goalLetters).padStart(2)}/${level.maxLetters}     ` +
        `${String(slack).padStart(2)}    ${worst} ${worst >= level.goalLetters ? '(пройдёт)' : '(провал)'}`,
    );
  }
}

const args = process.argv.slice(2);
if (args[0] === 'balance') {
  printBalance(Number(args[1] ?? 10));
} else if (args[0] === 'stats') {
  printStats(Number(args[1] ?? 20));
} else if (args.length > 0) {
  printLevel(generateLevel(dictionary, Number(args[0])));
} else {
  for (const index of [1, 5, 10]) printLevel(generateLevel(dictionary, index));
}

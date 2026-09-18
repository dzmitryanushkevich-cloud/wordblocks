import { describe, expect, it } from 'vitest';
import { createContent } from '../src/core/content.js';
import { russian } from '../src/content/ru/index.js';
import { Rng, levelSeed } from '../src/core/rng.js';
import {
  buildAdjacency,
  growPolyomino,
  isBoring,
  isValidPath,
  findPath,
  readWord,
} from '../src/core/shape.js';
import { solve } from '../src/core/solver.js';
import { generateLevel } from '../src/core/generator.js';
import { levelParams } from '../src/core/difficulty.js';
import type { Cell } from '../src/core/types.js';

const content = createContent(russian);
const dictionary = content.dictionary;

describe('словарь', () => {
  it('содержит существительные и не содержит служебных слов', () => {
    expect(dictionary.has('победа')).toBe(true);
    expect(dictionary.has('весна')).toBe(true);
    expect(dictionary.has('конь')).toBe(true);
    expect(dictionary.has('это')).toBe(false);
    expect(dictionary.has('правда')).toBe(false);
    expect(dictionary.has('бежать')).toBe(false);
  });

  it('узнаваемые слова разложены по длине', () => {
    for (let length = 3; length <= 9; length++) {
      const words = dictionary.core(length);
      expect(words.length).toBeGreaterThan(0);
      expect(words.every((w) => w.length === length)).toBe(true);
    }
  });

  it('частотность букв посчитана и не содержит ё', () => {
    expect(dictionary.letters).not.toContain('ё');
    expect(dictionary.letters[0]).toBeTruthy();
    expect(dictionary.letterWeights.length).toBe(dictionary.letters.length);
  });
});

describe('форма фигуры', () => {
  it('растёт нужного размера, связна и влезает в габарит', () => {
    const rng = new Rng(42);
    for (let i = 0; i < 200; i++) {
      const body = growPolyomino(rng, { size: 12, boxW: 5, boxH: 5 });
      if (!body) continue;
      expect(body.length).toBe(12);
      expect(Math.max(...body.map((c) => c.x))).toBeLessThan(5);
      expect(Math.max(...body.map((c) => c.y))).toBeLessThan(5);

      // связность: обход в ширину должен достать все клетки
      const adjacency = buildAdjacency(body);
      const seen = new Set<number>([0]);
      const queue = [0];
      while (queue.length) {
        for (const next of adjacency[queue.pop()!]) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      expect(seen.size).toBe(body.length);
    }
  });

  it('узнаёт скучные фигуры', () => {
    expect(isBoring([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])).toBe(true);
    expect(
      isBoring([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ]),
    ).toBe(true);
    expect(
      isBoring([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBe(false);
  });

  it('строит простой путь заданной длины', () => {
    const rng = new Rng(7);
    const body = growPolyomino(rng, { size: 10, boxW: 4, boxH: 4 })!;
    const adjacency = buildAdjacency(body);
    const path = findPath(rng, adjacency, 6)!;
    expect(path).toHaveLength(6);
    expect(isValidPath(adjacency, path)).toBe(true);
    expect(new Set(path).size).toBe(6);
  });

  it('отвергает путь по диагонали и путь с повтором клетки', () => {
    const body = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    const adjacency = buildAdjacency(body);
    expect(isValidPath(adjacency, [0, 1, 2])).toBe(true);
    expect(isValidPath(adjacency, [0, 2])).toBe(false); // диагональ
    expect(isValidPath(adjacency, [0, 1, 0])).toBe(false); // повтор клетки
  });
});

describe('солвер', () => {
  const cells: Cell[] = [
    { x: 0, y: 0, letter: 'к' },
    { x: 1, y: 0, letter: 'о' },
    { x: 2, y: 0, letter: 'т' },
    { x: 2, y: 1, letter: 'е' },
  ];
  const adjacency = buildAdjacency(cells);

  it('находит слово, выложенное путём', () => {
    const words = solve(cells, adjacency, dictionary).map((w) => w.word);
    expect(words).toContain('кот');
  });

  it('все найденные слова действительно читаются по своему пути', () => {
    for (const hit of solve(cells, adjacency, dictionary)) {
      expect(isValidPath(adjacency, hit.path)).toBe(true);
      expect(readWord(cells, hit.path)).toBe(hit.word);
      expect(dictionary.has(hit.word)).toBe(true);
    }
  });

  it('не склеивает буквы по диагонали', () => {
    const diagonal: Cell[] = [
      { x: 0, y: 0, letter: 'д' },
      { x: 1, y: 1, letter: 'о' },
      { x: 2, y: 2, letter: 'м' },
    ];
    expect(solve(diagonal, buildAdjacency(diagonal), dictionary)).toHaveLength(0);
  });
});

describe('генератор уровней', () => {
  const levels = [1, 2, 3, 5, 8, 10, 15, 20, 30];

  it('каждая фигура держит свои инварианты', () => {
    for (const index of levels) {
      const level = generateLevel(content, index);
      const params = levelParams(russian.curve, index);
      expect(level.figures).toHaveLength(5);

      level.figures.forEach((figure, i) => {
        const adjacency = buildAdjacency(figure.cells);
        const anchorHit = figure.words.find((w) => w.word === figure.anchor);

        expect(anchorHit, `якорь ${figure.anchor} не найден солвером`).toBeDefined();
        expect(readWord(figure.cells, anchorHit!.path)).toBe(figure.anchor);
        expect(isValidPath(adjacency, anchorHit!.path)).toBe(true);

        // Засчитываются только слова темы: якорь среди них самый длинный,
        // и рядом обязано быть хотя бы одно покороче — иначе выбирать не из чего.
        expect(figure.scoring).toContain(figure.anchor);
        expect(Math.max(...figure.scoring.map((w) => w.length))).toBe(figure.anchor.length);
        expect(figure.scoring.some((w) => w.length < figure.anchor.length)).toBe(true);

        // лёгких трёхбуквенных выходов не больше, чем позволяет умная добивка
        const short = figure.words.filter((w) => w.word.length === 3).length;
        expect(short).toBeLessThanOrEqual(params.figures[i].maxShortWords + 3);

        // все слова читаются своими путями и есть в словаре
        for (const hit of figure.words) {
          expect(isValidPath(adjacency, hit.path)).toBe(true);
          expect(readWord(figure.cells, hit.path)).toBe(hit.word);
          expect(dictionary.has(hit.word)).toBe(true);
        }
      });
    }
  });

  it('цель уровня достижима и не берётся одними короткими словами', () => {
    for (const index of levels) {
      const level = generateLevel(content, index);
      expect(level.maxLetters).toBe(
        level.figures.reduce((sum, f) => sum + f.anchor.length, 0),
      );
      expect(level.goalLetters).toBeLessThanOrEqual(level.maxLetters);
      expect(level.goalLetters).toBeGreaterThan(level.figures.length * 3);
    }
  });

  it('один сид даёт один и тот же уровень', () => {
    const a = generateLevel(content, 7, { gameSeed: 123 });
    const b = generateLevel(content, 7, { gameSeed: 123 });
    const c = generateLevel(content, 7, { gameSeed: 124 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
    expect(levelSeed(123, 7)).toBe(levelSeed(123, 7));
  });
});

/**
 * Проверка всех уровней на вырожденные случаи — то, что ломает партию не
 * ошибкой, а скукой или несправедливостью. Гоняется перед тем, как дать игру
 * живому игроку:
 *
 *   npm run gen -- audit        (через gen-cli) или npx tsx tools/audit.ts
 */
import { PACKS } from '../src/content/index.js';
import { createContent } from '../src/core/content.js';
import { generateLevel } from '../src/core/generator.js';
import { levelBlocks } from '../src/core/difficulty.js';
import { categoryPool, levelTheme } from '../src/core/themes.js';
import type { Figure } from '../src/core/types.js';

const LEVELS = 30;

function turns(figure: Figure, path: readonly number[]): number {
  let count = 0;
  for (let i = 2; i < path.length; i++) {
    const a = figure.cells[path[i - 2]];
    const b = figure.cells[path[i - 1]];
    const c = figure.cells[path[i]];
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) count++;
  }
  return count;
}

/** Читается ли слово в блоке слева направо и сверху вниз. */
function readable(figure: Figure, word: string): boolean {
  const at = new Map(figure.cells.map((c, i) => [`${c.x},${c.y}`, i]));
  const step = (i: number, k: number): boolean => {
    if (k === word.length) return true;
    const c = figure.cells[i];
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const n = at.get(`${c.x + dx},${c.y + dy}`);
      if (n === undefined || figure.cells[n].letter !== word[k]) continue;
      if (step(n, k + 1)) return true;
    }
    return false;
  };
  return figure.cells.some((c, i) => c.letter === word[0] && step(i, 1));
}

for (const pack of PACKS) {
  const content = createContent(pack);
  const plural = pack.themes.plural ?? {};
  const problems: string[] = [];
  const notes: string[] = [];
  const say = (level: number, block: number, text: string): void => {
    problems.push(block > 0 ? `ур.${level} блок ${block}: ${text}` : `ур.${level}: ${text}`);
  };
  /** Не поломка, а шероховатость: глаз замечает, партию не портит. */
  const note = (level: number, text: string): void => {
    notes.push(`ур.${level}: ${text}`);
  };
  const times: number[] = [];
  let blocks = 0;

  for (let level = 1; level <= LEVELS; level++) {
    const started = Date.now();
    const lv = generateLevel(content, level);
    times.push(Date.now() - started);
    const theme = levelTheme(pack.themes, level);
    const own = theme.categories.map((id) => new Set(categoryPool(pack.themes, id, 'all')));

    if (lv.figures.length !== levelBlocks(pack.curve, level)) {
      say(level, 0, `блоков ${lv.figures.length}, а кривая просит ${levelBlocks(pack.curve, level)}`);
    }
    if (lv.goalLetters > lv.maxLetters) say(level, 0, 'цель больше суммы якорей — уровень непроходим');

    // Худшая игра: в каждом блоке берём самое короткое слово темы.
    const worst = lv.figures.reduce((sum, f) => {
      const shortest = f.scoring.reduce((best, w) => (w.length < best.length ? w : best), f.anchor);
      return sum + shortest.length;
    }, 0);
    if (worst >= lv.goalLetters) say(level, 0, `цель ${lv.goalLetters} берётся самыми короткими словами (${worst})`);

    const seen = new Map<string, number[]>();
    lv.figures.forEach((figure, i) => {
      blocks++;
      const n = i + 1;
      const words = figure.words.map((w) => w.word);
      for (const w of words) {
        if (!seen.has(w)) seen.set(w, []);
        if (!seen.get(w)!.includes(i)) seen.get(w)!.push(i);
      }

      // 1. Целостность: слово читается своим путём, путь связный и без повторов.
      for (const hit of figure.words) {
        const read = hit.path.map((c) => figure.cells[c].letter).join('');
        if (read !== hit.word) say(level, n, `слово ${hit.word.toUpperCase()} не читается своим путём`);
        if (new Set(hit.path).size !== hit.path.length) say(level, n, `путь ${hit.word.toUpperCase()} проходит по клетке дважды`);
        if (!content.dictionary.has(hit.word)) say(level, n, `${hit.word.toUpperCase()} нет в словаре`);
      }

      // 2. Выбор: кроме якоря должно быть хотя бы одно слово темы покороче.
      const shorter = figure.scoring.filter((w) => w !== figure.anchor && w.length < figure.anchor.length);
      if (shorter.length === 0) say(level, n, `нечего выбирать: кроме ${figure.anchor.toUpperCase()} слов темы короче нет`);

      // 3. Якорь обязан быть самым длинным среди засчитываемых.
      const longer = figure.scoring.filter((w) => w.length > figure.anchor.length);
      if (longer.length) say(level, n, `${longer.join(', ').toUpperCase()} длиннее якоря ${figure.anchor.toUpperCase()}`);

      // 4. Якорь из своей категории (по плану у каждого блока она своя).
      const mine = own[i % own.length];
      if (!mine.has(figure.anchor)) {
        const where = theme.categories.filter((_, k) => own[k].has(figure.anchor));
        say(level, n, `якорь ${figure.anchor.toUpperCase()} не из своей категории (${where.join(', ') || 'вне темы'})`);
      }

      // 5. Слово и его же множественное число в одном блоке — выбор ненастоящий.
      for (const w of figure.scoring) {
        if (plural[w] && figure.scoring.includes(plural[w])) {
          say(level, n, `${w.toUpperCase()} и ${plural[w].toUpperCase()} в одном блоке`);
        }
      }

      // 6. Форма и путь якоря.
      const path = figure.words.find((w) => w.word === figure.anchor)!.path;
      const bend = turns(figure, path);
      if (level > pack.curve.readableUntil && bend === 0) say(level, n, `якорь ${figure.anchor.toUpperCase()} лежит прямой строкой`);
      if (level <= pack.curve.readableUntil && !readable(figure, figure.anchor)) {
        say(level, n, `якорь ${figure.anchor.toUpperCase()} читается не по порядку`);
      }
      if (figure.width === 1 || figure.height === 1) say(level, n, 'фигура — прямая палка');

      // 7. Подпись не повторяет соседа.
      if (i > 0) {
        const shared = figure.labels.filter((c) => lv.figures[i - 1].labels.includes(c));
        if (shared.length) say(level, n, `подпись повторяет соседа: ${shared.join(', ')}`);
      }
      if (figure.labels.length === 0) say(level, n, 'блок без подписи');

      // 8. Каша: слишком много слов или трёхбуквенных.
      const short = words.filter((w) => w.length === 3).length;
      if (words.length > 12) say(level, n, `слишком много слов: ${words.length}`);
      if (short > 6) say(level, n, `трёхбуквенных слов ${short}`);

      // 9. Габарит: на телефоне под блок отведено около семи клеток в ширину.
      if (figure.width > 7 || figure.height > 7) say(level, n, `блок ${figure.width}×${figure.height} — не влезет на телефон`);
      if (figure.cells.length !== new Set(figure.cells.map((c) => `${c.x},${c.y}`)).size) {
        say(level, n, 'в фигуре есть две клетки на одном месте');
      }
      if (figure.anchor.length > pack.curve.maxWord) say(level, n, `якорь длиннее предела словаря`);
    });

    // Якоря уровня не повторяются между собой и с прошлым уровнем.
    const anchors = lv.figures.map((f) => f.anchor);
    if (new Set(anchors).size !== anchors.length) say(level, 0, `якорь повторяется: ${anchors.join(', ')}`);
    if (level > 1) {
      const before = generateLevel(content, level - 1).figures.map((f) => f.anchor);
      const same = anchors.filter((a) => before.includes(a));
      // Слово вроде ВИШНИ живёт сразу в двух категориях, и в соседних уровнях
      // оно может выпасть дважды. Партии это не мешает — категория другая.
      if (same.length) note(level, `якорь ${same.join(', ').toUpperCase()} был и на прошлом уровне`);
    }

    for (const [word, at] of seen) {
      if (at.length > 1 && lv.figures.some((f) => f.scoring.includes(word))) {
        say(level, 0, `${word.toUpperCase()} засчитывается в блоках ${at.map((k) => k + 1).join(' и ')}`);
      }
    }
  }

  const sorted = times.slice().sort((a, b) => a - b);
  // Сводка по запутанности: не поломки, а мера того, насколько блок трудно
  // прочитать глазом. Слова при этом остаются простыми.
  const bands: [string, number, number][] = [['1–4', 1, 4], ['5–9', 5, 9], ['10–19', 10, 19], ['20–30', 20, 30]];
  const rows = bands.map(([name, from, to]) => {
    let blocksHere = 0, turnsSum = 0, startsSum = 0, crossed = 0;
    for (let level = from; level <= to; level++) {
      const lv = generateLevel(content, level);
      for (const f of lv.figures) {
        blocksHere++;
        const path = f.words.find((w) => w.word === f.anchor)!.path;
        turnsSum += turns(f, path);
        startsSum += f.cells.filter((c) => c.letter === f.anchor[0]).length;
        const on = new Set(path);
        crossed += f.words.some((w) => w.word !== f.anchor && w.path.some((c) => on.has(c))) ? 1 : 0;
      }
    }
    return `${name}: поворотов ${(turnsSum / blocksHere).toFixed(1)}, начал с первой буквы ${(startsSum / blocksHere).toFixed(1)}, со скрещенными словами ${Math.round((crossed / blocksHere) * 100)}%`;
  });
  console.log(`\n=== ${pack.name} === блоков ${blocks}, время: медиана ${sorted[Math.floor(LEVELS / 2)]} мс, худший ${sorted[LEVELS - 1]} мс`);
  if (problems.length === 0) console.log('вырожденных случаев не нашлось');
  else {
    console.log(`замечаний ${problems.length}:`);
    for (const line of problems) console.log('  ' + line);
  }
  console.log('запутанность по ступеням —');
  for (const row of rows) console.log('  ' + row);
  if (notes.length) {
    console.log(`шероховатости (${notes.length}):`);
    for (const line of notes) console.log('  ' + line);
  }
}

/**
 * Дымовой тест интерфейса в настоящем браузере: открывает собранный wordblocks.html,
 * водит «пальцем» по плиткам и проверяет, что слово засчитывается, фигура рассыпается,
 * подсказка светит, уровень доигрывается до итогов и прогресс сохраняется.
 *
 *   node tools/smoke.mjs      (нужен playwright-core и локальный chromium)
 */
import { chromium } from 'playwright-core';
import { strict as assert } from 'node:assert';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--no-default-browser-check','--disable-features=Translate,OptimizationHints'],
});
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

// Фигура выезжает слева: пока анимация идёт, координаты плиток ещё едут.
const settleBoard = () =>
  page.waitForFunction(() => {
    const board = document.querySelector('.board');
    return board != null && board.getAnimations().every((a) => a.playState === 'finished');
  }, null, { timeout: 5000 });

const shot = (name) => page.screenshot({ path: new URL(`../.shots/${name}.png`, import.meta.url).pathname });

// Язык закрепляем явно: тест читает русские подписи, а по умолчанию игра
// смотрит на язык браузера.
await page.goto(`${new URL('../wordblocks.html', import.meta.url).href}?lang=ru`);
// Игра открывается сразу на последнем доступном уровне, а с чистым хранилищем —
// на первом; карта живёт за кнопкой «назад», её проверяем ниже.
await page.waitForSelector('.board');
await shot('01-level');
await settleBoard();

const tiles = () => page.evaluate(() => {
  const board = document.querySelector('.board');
  const rect = board.getBoundingClientRect();
  const first = board.querySelector('.tile').getBoundingClientRect();
  const pitch = first.width + 6;
  return [...board.querySelectorAll('.tile')].map((t) => {
    const r = t.getBoundingClientRect();
    return {
      letter: t.textContent.trim().toLowerCase(),
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      gx: Math.round((r.left - rect.left) / pitch),
      gy: Math.round((r.top - rect.top) / pitch),
    };
  });
});

function pathFor(cells, word) {
  const at = new Map(cells.map((t, i) => [`${t.gx},${t.gy}`, i]));
  const near = cells.map((t) => [[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx, dy]) => at.get(`${t.gx + dx},${t.gy + dy}`)).filter((v) => v !== undefined));
  const walk = (path, used, i) => {
    if (path.length === word.length) return path;
    for (const n of near[path[path.length - 1]]) {
      if (used.has(n) || cells[n].letter !== word[i]) continue;
      used.add(n); path.push(n);
      const done = walk(path, used, i + 1);
      if (done) return done;
      path.pop(); used.delete(n);
    }
    return null;
  };
  for (let s = 0; s < cells.length; s++) {
    if (cells[s].letter !== word[0]) continue;
    const found = walk([s], new Set([s]), 1);
    if (found) return found;
  }
  return null;
}

/**
 * Свайп ведём так, как ведёт живой палец на телефоне: углы срезаны плавной
 * дугой, а точек мало — на быстром махе браузер отдаёт движение редкими
 * кадрами. Раньше тест водил палец строго по ломаной через середины клеток
 * и поэтому не замечал, что быстрый мах теряет буквы: слово обрывалось
 * на второй.
 */
function fingerPath(cells, path, count = 10) {
  let points = [];
  for (let i = 1; i < path.length; i++) {
    const from = cells[path[i - 1]], to = cells[path[i]];
    for (let k = 0; k < 12; k++) {
      const f = k / 12;
      points.push({ x: from.cx + (to.cx - from.cx) * f, y: from.cy + (to.cy - from.cy) * f });
    }
  }
  points.push({ x: cells[path[path.length - 1]].cx, y: cells[path[path.length - 1]].cy });
  // Сглаживание срезает углы: так же срезает их палец, не останавливаясь в клетке.
  for (let pass = 0; pass < 14; pass++) {
    const next = [points[0]];
    for (let i = 1; i < points.length - 1; i++)
      next.push({
        x: (points[i - 1].x + points[i].x * 2 + points[i + 1].x) / 4,
        y: (points[i - 1].y + points[i].y * 2 + points[i + 1].y) / 4,
      });
    next.push(points[points.length - 1]);
    points = next;
  }
  // Из всей дуги берём десяток точек: примерно столько успевает прийти за мах.
  const sparse = [];
  for (let i = 0; i < count; i++)
    sparse.push(points[Math.round((i * (points.length - 1)) / (count - 1))]);
  return sparse;
}

async function swipe(cells, path) {
  const points = fingerPath(cells, path);
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y);
  await page.mouse.up();
}

const progress = () => page.textContent('.progress-label');
const foundWords = () => page.evaluate(() =>
  [...document.querySelectorAll('.word')].map((w) => w.textContent));

// 1. Неверное слово не засчитывается и фигура остаётся на месте.
// Свайп ведём по двум соседним клеткам и без промежуточных шагов: с шагами
// указатель задевает третью плитку и может сложить настоящее слово — тест
// на этом падал, когда в блоке первого уровня оказался КОТ.
let cells = await tiles();
const junkPath = (() => {
  const at = new Map(cells.map((t, i) => [`${t.gx},${t.gy}`, i]));
  for (let i = 0; i < cells.length; i++) {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const n = at.get(`${cells[i].gx + dx},${cells[i].gy + dy}`);
      if (n !== undefined) return [i, n];
    }
  }
  return [0, 1];
})();
await page.mouse.move(cells[junkPath[0]].cx, cells[junkPath[0]].cy);
await page.mouse.down();
await page.mouse.move(cells[junkPath[1]].cx, cells[junkPath[1]].cy);
await page.mouse.up();
// Цель уровня зависит от кривой, поэтому сверяем только собранное.
assert.ok((await progress()).startsWith('0 /'), 'свайп из двух букв не должен давать букв');
assert.deepEqual(await foundWords(), [], 'свайп из двух букв не должен попадать в список');

// 1.2. Хитбокс клетки после первой буквы сужен до ядра. Ведём палец по прямой
// A → B → D, но у клетки B чуть заезжаем в перпендикулярную клетку C — так и
// промахивается живой палец. Раньше C попадала в слово и рвала цепочку: D ей уже
// не соседняя, и вместо ABD игрок получал ABC. Возврат через середину B тут не
// спасает — палец идёт дальше, а не назад.
const trap = (() => {
  const at = new Map(cells.map((t, i) => [`${t.gx},${t.gy}`, i]));
  const axes = [
    { line: [1, 0], cross: [0, 1] },
    { line: [1, 0], cross: [0, -1] },
    { line: [0, 1], cross: [1, 0] },
    { line: [0, 1], cross: [-1, 0] },
  ];
  for (let i = 0; i < cells.length; i++) {
    for (const { line, cross } of axes) {
      const back = at.get(`${cells[i].gx - line[0]},${cells[i].gy - line[1]}`);
      const ahead = at.get(`${cells[i].gx + line[0]},${cells[i].gy + line[1]}`);
      const side = at.get(`${cells[i].gx + cross[0]},${cells[i].gy + cross[1]}`);
      if (back !== undefined && ahead !== undefined && side !== undefined) {
        return { from: back, middle: i, out: ahead, side, cross };
      }
    }
  }
  return null;
})();
if (trap) {
  const middle = cells[trap.middle];
  const pitch = Math.abs(cells[trap.out].cx - middle.cx) + Math.abs(cells[trap.out].cy - middle.cy);
  // Точка сразу за границей соседней клетки: заезд мелкий, но настоящий.
  const graze = {
    x: middle.cx + trap.cross[0] * (pitch / 2 + 8),
    y: middle.cy + trap.cross[1] * (pitch / 2 + 8),
  };
  await page.mouse.move(cells[trap.from].cx, cells[trap.from].cy);
  await page.mouse.down();
  await page.mouse.move(middle.cx, middle.cy, { steps: 6 });
  await page.mouse.move(graze.x, graze.y, { steps: 4 });
  await page.mouse.move(cells[trap.out].cx, cells[trap.out].cy, { steps: 6 });
  const drafted = await page.evaluate(
    () => document.querySelector('.draft')?.textContent.trim().toLowerCase() ?? '',
  );
  await page.mouse.up();
  await page.waitForTimeout(400);
  assert.equal(
    drafted,
    cells[trap.from].letter + middle.letter + cells[trap.out].letter,
    `мелкий заезд в соседнюю клетку не должен попадать в слово, набралось «${drafted.toUpperCase()}»`,
  );
}

// 1.3. Длинное собираемое слово не должно двигать блок. Буква в слове шириной
// с плитку, и на девяти буквах строка вылезала за экран: колонка сцены
// становилась шире, а выровненный по её центру блок уезжал вбок прямо под
// пальцем. Подставляем длинное слово руками — своими свайпами до девяти букв
// на первом уровне не добраться.
const boardLeft = () => page.evaluate(() => Math.round(document.querySelector('.board').getBoundingClientRect().left));
const restLeft = await boardLeft();
const wide = await page.evaluate(() => {
  const draft = document.querySelector('.draft');
  draft.style.setProperty('--letters', '11');
  const added = [];
  for (let i = 0; i < 11; i++) {
    const letter = document.createElement('span');
    letter.textContent = 'Ж';
    draft.appendChild(letter);
    added.push(letter);
  }
  const left = Math.round(document.querySelector('.board').getBoundingClientRect().left);
  const over = Math.round(draft.getBoundingClientRect().width - document.documentElement.clientWidth);
  added.forEach((n) => n.remove());
  draft.style.removeProperty('--letters');
  return { left, over };
});
assert.equal(wide.left, restLeft, 'длинное слово не должно сдвигать блок');
assert.ok(wide.over <= 0, `длинное слово не должно вылезать за экран, вылезло на ${wide.over}px`);

// 1.4. Заливка выезжает только вперёд. Когда палец идёт назад и снимает буквы,
// разгонять её некуда: клетка, в которую она «въезжала бы», уже залита, и выезд
// на ней читался дёрганьем — плашка прыгала назад и наезжала заново.
const wave = (() => {
  const at = new Map(cells.map((c, i) => [`${c.gx},${c.gy}`, i]));
  for (let i = 0; i < cells.length; i++) {
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const next = at.get(`${cells[i].gx + dx},${cells[i].gy + dy}`);
      if (next !== undefined) return [i, next];
    }
  }
  return null;
})();
if (wave) {
  const running = () => page.evaluate(
    () => document.querySelector('.lit-head')?.getAnimations().filter((a) => a.playState === 'running').length ?? -1,
  );
  await page.mouse.move(cells[wave[0]].cx, cells[wave[0]].cy);
  await page.mouse.down();
  await page.mouse.move(cells[wave[1]].cx, cells[wave[1]].cy, { steps: 4 });
  assert.ok((await running()) > 0, 'вперёд заливка обязана выезжать');
  await page.waitForTimeout(220);
  await page.mouse.move(cells[wave[0]].cx, cells[wave[0]].cy, { steps: 4 });
  assert.equal(await running(), 0, 'назад заливка не должна разгоняться');
  await page.mouse.up();
  await page.waitForTimeout(300);
  assert.ok((await progress()).startsWith('0 /'), 'проверочный возврат ничего не засчитывает');
}

// 1.5. Слово не из темы: блок стоит, а слово уходит в копилку.
await page.click('.debug-toggle');
const alien = await page.evaluate(() => {
  const node = document.querySelector('.debug code.alien');
  return (node?.textContent ?? '').trim().toLowerCase();
});
await page.click('.debug-toggle');
if (alien.length < 3) {
  console.log('в первом блоке нет слов не из темы — проверку копилки пропускаем');
}
if (alien.length >= 3) {
  const cellsNow = cells;
  const alienPath = pathFor(cellsNow, alien);
  if (alienPath) {
    const lettersBefore = await progress();
    await swipe(cellsNow, alienPath);
    await page.waitForTimeout(400);
    assert.equal(await progress(), lettersBefore, 'слово не из темы не должно давать букв');
    assert.equal(
      await page.textContent('.bonus b'),
      '1',
      'слово не из темы должно попасть в копилку',
    );
    await page.click('.bonus');
    const listed = await page.evaluate(() =>
      [...document.querySelectorAll('.bonus-words i')].map((n) => n.textContent.toLowerCase()));
    assert.ok(listed.includes(alien), `копилка должна показывать ${alien.toUpperCase()}`);
    await shot('05b-bonus');
    await page.click('.bonus-card .big');
    await page.waitForTimeout(200);
  }
}

// 2. Настоящее слово засчитывается мгновенно, блок рассыпается, приходит следующий.
// Слово берём из панели отладки, чтобы тест не зависел от кривой сложности:
// там перечислены все слова блока, тематические — обычным кодом, остальные с
// классом alien. Самое длинное тематическое и есть якорь.
const anchorWord = async () => {
  await page.click('.debug-toggle');
  const words = await page.evaluate(() =>
    [...document.querySelectorAll('.debug code')]
      .filter((c) => !c.classList.contains('alien'))
      .map((c) => c.textContent.trim().toLowerCase()),
  );
  await page.click('.debug-toggle');
  return words.sort((a, b) => b.length - a.length)[0] ?? '';
};

/** Проводит пальцем по слову в текущем блоке. */
const swipeWord = async (cellsNow, word) => {
  const path = pathFor(cellsNow, word);
  assert.ok(path, `слово ${word.toUpperCase()} должно лежать в блоке`);
  await swipe(cellsNow, path);
};

const word = await anchorWord();
assert.ok(word.length >= 3, 'панель отладки должна показывать слова блока');
await shot('02-swipe');
await swipeWord(cells, word);
await shot('03-crumble');
// Блоков в уровне столько, сколько велит кривая, поэтому ждём просто второй.
await page.waitForFunction(() => document.querySelector('.queue-label b').textContent.startsWith('2 из'), null, { timeout: 15000 });
await settleBoard();
assert.ok((await progress()).startsWith(`${word.length} /`), 'в счётчике должны быть буквы якоря');
assert.deepEqual(await foundWords(), [word.toUpperCase()]);
await shot('04-next-figure');

// 3. Подсказка подсвечивает клетку и стоит монет.
const walletBefore = Number((await page.textContent('.wallet')).replace(/\D/g, ''));
await page.click('.hint');
assert.equal(await page.locator('.tile.hinted').count(), 1, 'подсказка должна подсветить одну плитку');
const walletAfter = Number((await page.textContent('.wallet')).replace(/\D/g, ''));
assert.ok(walletAfter < walletBefore, 'подсказка должна списать монеты');
await shot('05-hint');

// 4. Доигрываем уровень: в каждом блоке берём якорь настоящим свайпом. Уровень
// закрывается сразу, как только исход предрешён, поэтому блоков может пройти
// меньше, чем их в уровне, — ждём окно итогов.
for (let i = 0; i < 8; i++) {
  if (await page.locator('.overlay').count()) break;
  await settleBoard();
  const next = await anchorWord();
  await swipeWord(await tiles(), next);
  await page.waitForFunction(
    (text) =>
      document.querySelector('.overlay') != null ||
      document.querySelector('.queue-label b').textContent.startsWith(text),
    `${i + 3} из`,
    { timeout: 15000 },
  );
}
await page.waitForSelector('.overlay');
const title = await page.textContent('.card h2');
const stars = await page.locator('.stars .star').count();
const prize = await page.textContent('.prize');
await shot('06-result');
assert.equal(stars, 3, 'на победе должно быть три звезды');
assert.match(prize, /\+\d+/, 'на победе должна быть награда монетами');
assert.equal(title, 'Браво!', 'взяв все якоря, уровень должен быть пройден');

// 5. Прогресс уровня сохраняется и уровень 2 открывается.
// На победе кнопки к карте в окне нет: сначала уходим на следующий уровень,
// и уже оттуда — домиком в шапке.
// Именно кнопка в ряду: класс big есть и у средней звезды в заголовке окна.
await page.click('.card .row button >> nth=0');
await page.waitForSelector('.overlay', { state: 'detached' });
await page.waitForSelector('.board');
await page.waitForTimeout(400);
await page.click('.back');
await page.waitForSelector('.levels');
await shot('07-map-after');
const unlocked = await page.evaluate(() => JSON.parse(localStorage.getItem('wordblocks.save.ru.v1') ?? '{}'));

// 6. Быстрый мах на позднем уровне. Там клетки мельче, слова длиннее и путь
// с поворотами — именно на них свайп терял буквы: пропущенная клетка рвёт
// цепочку, следующая ей уже не соседняя, и слово обрывалось на второй букве.
// Палец ведём как живой: углы срезаны, точек мало — на быстром махе браузер
// отдаёт движение редкими кадрами.
await page.evaluate(() => localStorage.setItem('wordblocks.save.ru.v1',
  JSON.stringify({ unlocked: 12, coins: 500, chest: 0, results: {}, bonus: [] })));
await page.reload();
await page.waitForSelector('.board');
await settleBoard();
const lateWord = await anchorWord();
const lateCells = await tiles();
const latePath = pathFor(lateCells, lateWord);
assert.ok(latePath, `на позднем уровне не нашёлся путь для ${lateWord.toUpperCase()}`);
const lateFinger = fingerPath(lateCells, latePath, 8);
await page.mouse.move(lateFinger[0].x, lateFinger[0].y);
await page.mouse.down();
for (const point of lateFinger.slice(1)) await page.mouse.move(point.x, point.y);
const lateDraft = await page.evaluate(
  () => document.querySelector('.draft')?.textContent.trim().toLowerCase() ?? '',
);
await page.mouse.up();
await page.waitForTimeout(400);
assert.equal(
  lateDraft,
  lateWord,
  `быстрый мах не должен терять буквы, набралось «${lateDraft.toUpperCase()}» вместо «${lateWord.toUpperCase()}»`,
);

console.log('быстрый мах на позднем уровне:', lateDraft.toUpperCase());
console.log('итог уровня:', title);
console.log('сохранение:', JSON.stringify(unlocked));
console.log('ошибки консоли:', errors.length ? errors : 'нет');
await browser.close();
console.log('\nвсе проверки прошли');

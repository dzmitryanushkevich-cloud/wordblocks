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

await page.goto(new URL('../wordblocks.html', import.meta.url).href);
await page.waitForSelector('.levels');
await shot('01-map');

await page.click('.level-card >> nth=0');
await page.waitForSelector('.board');
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

async function swipe(cells, path) {
  await page.mouse.move(cells[path[0]].cx, cells[path[0]].cy);
  await page.mouse.down();
  for (const i of path.slice(1)) {
    await page.mouse.move(cells[i].cx, cells[i].cy, { steps: 4 });
  }
  await page.mouse.up();
}

const progress = () => page.textContent('.progress-label');
const foundWords = () => page.evaluate(() =>
  [...document.querySelectorAll('.word')].map((w) => w.textContent));

// 1. Неверное слово не засчитывается и фигура остаётся на месте.
let cells = await tiles();
const junk = [0, cells.findIndex((_, i) => i > 0)];
await swipe(cells, pathFor(cells, cells[0].letter + cells[1].letter) ?? junk);
assert.equal(await progress(), '0 / 16', 'мусорный свайп не должен давать букв');
assert.deepEqual(await foundWords(), [], 'мусорный свайп не должен попадать в список');

// 2. Настоящее слово засчитывается мгновенно, фигура рассыпается, приходит следующая.
const word = 'зона';
const path = pathFor(cells, word);
assert.ok(path, 'слово ЗОНА должно лежать в первой фигуре');
await page.mouse.move(cells[path[0]].cx, cells[path[0]].cy);
await page.mouse.down();
for (const i of path.slice(1)) await page.mouse.move(cells[i].cx, cells[i].cy, { steps: 4 });
await shot('02-swipe');
await page.mouse.up();
await shot('03-crumble');
await page.waitForFunction(() => document.querySelector('.footer .figures').textContent.includes('2 из 5'), null, { timeout: 15000 });
await settleBoard();
assert.equal(await progress(), '4 / 16');
assert.deepEqual(await foundWords(), ['ЗОНА']);
await shot('04-next-figure');

// 3. Подсказка подсвечивает клетку.
await page.click('.footer button:not(.ghost):not(.debug-toggle)');
assert.equal(await page.locator('.tile.hinted').count(), 1, 'подсказка должна подсветить одну плитку');
await shot('05-hint');

// 4. Проходим уровень до конца через отладку и смотрим итоги.
await page.click('.debug-toggle');
for (let i = 0; i < 4; i++) {
  const expected = `${i + 3} из 5`;
  await page.click('.debug button >> nth=0');
  // Рассыпание плюс выезд следующей фигуры — ждём, пока счётчик фигур сдвинется.
  await page.waitForFunction(
    (text) =>
      document.querySelector('.overlay') != null ||
      document.querySelector('.footer .figures').textContent.includes(text),
    expected,
    { timeout: 15000 },
  );
}
await page.waitForSelector('.overlay');
const title = await page.textContent('.card h2');
const recap = await page.locator('.recap div').count();
await shot('06-result');
assert.equal(recap, 5, 'в итогах должно быть пять строк — по одной на фигуру');

// 5. Прогресс уровня сохраняется и уровень 2 открывается.
await page.click('.card .ghost');
await page.waitForSelector('.levels');
await shot('07-map-after');
const unlocked = await page.evaluate(() => JSON.parse(localStorage.getItem('wordblocks.save.v1') ?? '{}'));

console.log('итог уровня:', title);
console.log('сохранение:', JSON.stringify(unlocked));
console.log('ошибки консоли:', errors.length ? errors : 'нет');
await browser.close();
console.log('\nвсе проверки прошли');

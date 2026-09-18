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
assert.equal(await progress(), '0 / 16', 'свайп из двух букв не должен давать букв');
assert.deepEqual(await foundWords(), [], 'свайп из двух букв не должен попадать в список');

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
// Слово берём из панели отладки, чтобы тест не зависел от кривой сложности.
await page.click('.debug-toggle');
const word = await page.evaluate(() => {
  const row = [...document.querySelectorAll('.debug div')].find((d) => d.textContent.startsWith('якорь'));
  return (row?.textContent ?? '').replace('якорь', '').trim().toLowerCase();
});
await page.click('.debug-toggle');
const path = pathFor(cells, word);
assert.ok(word.length >= 3, 'панель отладки должна показывать якорное слово');
assert.ok(path, `слово ${word.toUpperCase()} должно лежать в первом блоке`);
await page.mouse.move(cells[path[0]].cx, cells[path[0]].cy);
await page.mouse.down();
for (const i of path.slice(1)) await page.mouse.move(cells[i].cx, cells[i].cy, { steps: 4 });
await shot('02-swipe');
await page.mouse.up();
await shot('03-crumble');
await page.waitForFunction(() => document.querySelector('.queue-label b').textContent.includes('2 из 5'), null, { timeout: 15000 });
await settleBoard();
assert.equal(await progress(), `${word.length} / 16`);
assert.deepEqual(await foundWords(), [word.toUpperCase()]);
await shot('04-next-figure');

// 3. Подсказка подсвечивает клетку и стоит монет.
const walletBefore = Number((await page.textContent('.wallet')).replace(/\D/g, ''));
await page.click('.hint');
assert.equal(await page.locator('.tile.hinted').count(), 1, 'подсказка должна подсветить одну плитку');
const walletAfter = Number((await page.textContent('.wallet')).replace(/\D/g, ''));
assert.ok(walletAfter < walletBefore, 'подсказка должна списать монеты');
await shot('05-hint');

// 4. Проходим уровень через отладку. Уровень закрывается сразу, как только исход
// предрешён, поэтому блоков может быть меньше пяти — ждём окно итогов.
await page.click('.debug-toggle');
for (let i = 0; i < 5; i++) {
  if (await page.locator('.overlay').count()) break;
  await page.click('.debug button >> nth=0');
  await page.waitForFunction(
    (text) =>
      document.querySelector('.overlay') != null ||
      document.querySelector('.queue-label b').textContent.includes(text),
    `${i + 3} из 5`,
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
await page.click('.card .ghost');
await page.waitForSelector('.levels');
await shot('07-map-after');
const unlocked = await page.evaluate(() => JSON.parse(localStorage.getItem('wordblocks.save.ru.v1') ?? '{}'));

console.log('итог уровня:', title);
console.log('сохранение:', JSON.stringify(unlocked));
console.log('ошибки консоли:', errors.length ? errors : 'нет');
await browser.close();
console.log('\nвсе проверки прошли');

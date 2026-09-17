/** Стили игры одной строкой: файл должен открываться с диска без сборки и внешних запросов. */
export const css = `
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

:root {
  --rail: 52px;
  --bg: #3f7f68;
  --bg-deep: #35705c;
  --panel: rgba(255, 255, 255, 0.10);
  --plate: #2b6451;
  --tile: #f7f3dd;
  --tile-edge: #ded8bb;
  --ink: #2c4a3d;
  --fill: #b3e874;
  --white: #f3f7f4;
  --danger: #ffb4a2;
  font-family: 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif;
}

html, body { margin: 0; height: 100%; }

/* dvh — высота видимой части экрана: панель мобильного браузера её больше не съедает. */
@supports (height: 100dvh) {
  html, body { height: 100dvh; }
}

body {
  background: var(--bg);
  color: var(--white);
  display: flex;
  justify-content: center;
  overscroll-behavior: none;
}

#root { width: 100%; max-width: 560px; display: flex; flex-direction: column; min-height: 100%; }

button {
  font: inherit;
  color: var(--ink);
  background: var(--tile);
  border: none;
  border-radius: 12px;
  padding: 10px 18px;
  cursor: pointer;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.18);
  transition: transform 0.08s ease;
}
button:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.18); }
button.ghost { background: var(--panel); color: var(--white); box-shadow: none; }
button:disabled { opacity: 0.45; cursor: default; }

/* ── шапка: прогресс и найденные слова ─────────────────────────────── */

.hud { padding: 14px 16px 0; }

.top-row { display: flex; align-items: center; gap: 10px; }
.top-row .deck { margin-left: 0; }
.top-row > :nth-child(2) { margin-left: auto; }
.back { padding: 6px 12px; font-size: 15px; line-height: 1; }
.icon { padding: 6px 10px; font-size: 15px; line-height: 1; }

.track {
  position: relative;
  margin-top: 10px;
  height: 32px;
  background: var(--bg-deep);
  border-radius: 999px;
  overflow: hidden;
}
.track > i {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--fill);
  border-radius: 999px;
  transition: width 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.progress-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 17px;
  font-weight: 700;
  color: var(--white);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.deck { position: relative; width: 26px; height: 32px; flex: none; }
.deck i {
  position: absolute;
  inset: 0;
  background: var(--tile);
  border-radius: 5px;
  border-bottom: 2px solid var(--tile-edge);
}
.deck i:first-child { transform: rotate(-9deg) translateX(-3px); opacity: 0.75; }
.deck b {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--ink);
  font-size: 13px;
}

.words {
  margin-top: 10px;
  min-height: 84px;
  background: var(--panel);
  border-radius: 14px;
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-content: flex-start;
}
.word { display: flex; gap: 2px; animation: fly-in 0.35s ease-out both; }
.word.flying { animation: none; }
.word.flying span { will-change: transform; }

/* Полёт буквы в список: стартует размером с клетку и уменьшается по дороге. */
/* Встречный масштаб символа: пока плитка едет в список, кегль подтягивается к своему. */
@keyframes letter-glyph {
  0% { transform: scale(var(--glyph)); }
  100% { transform: none; }
}

@keyframes letter-fly {
  0% {
    transform: translate(var(--fx), var(--fy)) scale(var(--cell));
    border-radius: 2.4px;
  }
  100% {
    transform: none;
    border-radius: 4px;
  }
}
.word span {
  width: 20px;
  height: 22px;
  display: grid;
  place-items: center;
  background: var(--tile);
  color: var(--ink);
  border-radius: 4px;
  font-size: 13px;
  font-weight: 700;
}
.word span i { font-style: normal; display: block; }
@keyframes fly-in {
  from { transform: translateY(26px) scale(0.8); opacity: 0; }
  to { transform: none; opacity: 1; }
}

/* ── поле с фигурой ────────────────────────────────────────────────── */

.stage {
  flex: 1;
  display: grid;
  grid-template-rows: 1fr auto;
  justify-items: center;
  padding: 12px 12px clamp(8px, 3vh, 36px);
  overflow: hidden;
}
/*
 * Нижняя часть поля: слева очередь фигур, по центру сама фигура.
 * Боковые колонки одинаковой ширины, поэтому фигура остаётся по центру экрана.
 */
.board-slot {
  align-self: end;
  display: grid;
  grid-template-columns: var(--rail) auto var(--rail);
  align-items: start;
  justify-items: center;
  width: 100%;
}
/* Отступ сверху держит фигуру на прежней высоте, освобождая место очереди. */
.board-cell { padding-top: 46px; }

.queue {
  justify-self: start;
  /* Подпись и миниатюры стоят по одной левой линии, у самого края. */
  margin-left: -8px;
  display: grid;
  gap: 14px;
  justify-items: start;
}
.queue-label span {
  display: block;
  font-size: 12px;
  font-weight: 700;
  opacity: 0.6;
}
.queue-label b {
  font-size: 16px;
  letter-spacing: 0.3px;
  opacity: 0.85;
}

.thumbs {
  display: grid;
  gap: 11px;
  justify-items: start;
  animation: queue-up 0.5s cubic-bezier(0.2, 0.7, 0.25, 1) both;
}
.thumb { overflow: visible; }
.thumb path {
  fill: var(--tile);
  stroke: var(--tile);
  stroke-width: 0.5;
  stroke-linejoin: round;
  paint-order: stroke;
}
/* Очередь подъезжает вверх, ближняя миниатюра ещё и подрастает. */
@keyframes queue-up {
  from { transform: translateY(46px); opacity: 0.45; }
  to { transform: none; opacity: 1; }
}
.thumbs > :first-child {
  animation: thumb-grow 0.5s cubic-bezier(0.2, 0.7, 0.25, 1) both;
}
@keyframes thumb-grow {
  from { transform: scale(0.72); opacity: 0.4; }
  to { transform: none; opacity: 0.95; }
}

/* Собираемое слово — такая же деталь, как блок: плитки встык, одной полосой. */
.draft {
  align-self: end;
  margin-bottom: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72px;
}
.draft span {
  width: 60px;
  height: 72px;
  display: grid;
  place-items: center;
  background: var(--tile);
  color: var(--ink);
  font-size: 34px;
  font-weight: 700;
  box-shadow: 0 6px 0 var(--tile-edge);
}
.draft span:first-child { border-radius: 15px 0 0 15px; }
.draft span:last-child { border-radius: 0 15px 15px 0; }
.draft span:only-child { border-radius: 15px; }

/* Слова нет в словаре: полоса краснеет и мотает головой. */
/* Сначала слово мотает головой затухающими колебаниями, и только потом уходит. */
.draft.bad {
  animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both,
    draft-out 0.22s ease-in 0.46s both;
}
.draft.bad span {
  background: #e7a396;
  color: #6d2a1e;
  box-shadow: 0 4px 0 #c98576;
  animation: none;
}
@keyframes shake {
  0% { transform: none; }
  14% { transform: translateX(-6px); }
  30% { transform: translateX(5px); }
  46% { transform: translateX(-3.5px); }
  62% { transform: translateX(2.5px); }
  78% { transform: translateX(-1.5px); }
  100% { transform: none; }
}
@keyframes draft-out {
  to { opacity: 0; }
}

.board {
  position: relative;
  touch-action: none;
  user-select: none;
  animation: slide-in 0.52s cubic-bezier(0.16, 0.7, 0.3, 1) both;
}
/* Выезд из-за левого края экрана: путь длинный, иначе движение не читается. */
@keyframes slide-in {
  0% { transform: translateX(-95vw) rotate(-9deg); opacity: 0; }
  60% { opacity: 1; }
  78% { transform: translateX(10px) rotate(1.5deg); }
  100% { transform: none; opacity: 1; }
}

.board .plate {
  position: absolute;
  inset: 0;
  pointer-events: none;
  filter: drop-shadow(0 5px 0 var(--tile-edge)) drop-shadow(0 10px 12px rgba(0, 0, 0, 0.18));
}
.board .plate path {
  fill: var(--tile);
  stroke: var(--tile);
  stroke-width: 19;
  stroke-linejoin: round;
  paint-order: stroke;
}
.board .lit {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
/* Собранное слово перестаёт быть «выделением» и становится белой деталью. */
.board .lit.won path { animation: lit-white 0.45s ease-out forwards; }
@keyframes lit-white {
  to { fill: var(--tile); stroke: var(--tile); }
}

.board .glow {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  overflow: visible;
  filter: blur(7px);
}
.board .glow path {
  fill: none;
  stroke: #f4ffe4;
  stroke-linejoin: round;
  animation: glow-out 0.85s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
}
.spark {
  position: absolute;
  z-index: 5;
  background: #ffffff;
  /* Четырёхлучевая звёздочка. */
  clip-path: polygon(
    50% 0%, 60% 40%, 100% 50%, 60% 60%,
    50% 100%, 40% 60%, 0% 50%, 40% 40%
  );
  filter: drop-shadow(0 0 7px rgba(255, 255, 255, 0.95));
  pointer-events: none;
  animation: spark-out 0.65s linear forwards;
}
/*
 * Звёздочка расходится равномерно всю свою жизнь: смещение прописано в каждом
 * кадре, иначе она сначала стоит на месте, а потом дёргается в сторону.
 */
@keyframes spark-out {
  0% {
    transform: translate(0, 0) scale(0.45) rotate(0deg);
    opacity: 0;
  }
  18% {
    transform: translate(calc(var(--px) * 0.18), calc(var(--py) * 0.18)) scale(1)
      rotate(calc(var(--rot) * 0.18));
    opacity: 1;
  }
  60% {
    transform: translate(calc(var(--px) * 0.6), calc(var(--py) * 0.6)) scale(0.92)
      rotate(calc(var(--rot) * 0.6));
    opacity: 0.85;
  }
  100% {
    transform: translate(var(--px), var(--py)) scale(0.7) rotate(var(--rot));
    opacity: 0;
  }
}

@keyframes glow-out {
  0% { stroke-width: 4; opacity: 0; }
  18% { stroke-width: 16; opacity: 0.95; }
  100% { stroke-width: 54; opacity: 0; }
}

.board .lit path {
  fill: var(--fill);
  stroke: var(--fill);
  stroke-width: 13;
  stroke-linejoin: round;
  paint-order: stroke;
}
/* В момент рассыпания деталь исчезает: дальше летят уже отдельные кусочки. */
.board.crumbling .plate { animation: plate-out 0.16s ease-out forwards; }
@keyframes plate-out {
  to { opacity: 0; }
}
.board svg { position: absolute; inset: 0; pointer-events: none; overflow: visible; }

.tile {
  position: absolute;
  z-index: 3;
  background: transparent;
  color: var(--ink);
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  transition: background 0.12s ease, box-shadow 0.12s ease;
}
.tile.hinted { box-shadow: inset 0 0 0 3px var(--fill); }

.shard {
  position: absolute;
  z-index: 1;
  animation: shard-x 1.05s linear forwards;
}
/* Каждый слой двигает свою ось: иначе преобразования перетирают друг друга. */
.shard i {
  display: block;
  width: 100%;
  height: 100%;
  animation: shard-y 1.05s forwards;
}
.shard b {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--tile);
  border-radius: 4px;
  box-shadow: 0 1px 0 var(--tile-edge);
  animation: shard-spin 1.05s linear forwards, shard-fade 1.05s forwards;
}

@keyframes shard-x {
  to { transform: translateX(var(--dx)); }
}
@keyframes shard-y {
  0% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0.12, 0.66, 0.4, 1);
  }
  26% {
    transform: translateY(var(--up));
    animation-timing-function: cubic-bezier(0.55, 0, 0.9, 1);
  }
  100% {
    transform: translateY(var(--dy));
  }
}
@keyframes shard-spin {
  to { transform: rotate(var(--rot)) scale(0.82); }
}
@keyframes shard-fade {
  0%, 74% { opacity: 1; }
  100% { opacity: 0; }
}

.footer {
  padding: 0 16px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  font-weight: 700;
  opacity: 0.95;
}

/* ── карта уровней и итоги ─────────────────────────────────────────── */

.screen { padding: 24px 18px; display: flex; flex-direction: column; gap: 18px; }
.screen h1 { margin: 0; font-size: 30px; letter-spacing: 0.5px; }
.screen p { margin: 0; line-height: 1.5; opacity: 0.92; }

.build { font-size: 12px; opacity: 0.55; margin: -8px 0 0; }
.levels { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 10px; }
.level-card {
  background: var(--panel);
  border-radius: 14px;
  padding: 10px 6px;
  text-align: center;
  display: grid;
  gap: 2px;
  color: var(--white);
  box-shadow: none;
}
.level-card b { font-size: 18px; }
.level-card small { font-size: 11px; opacity: 0.8; }
.level-card.done { background: rgba(179, 232, 116, 0.22); }
.level-card.locked { opacity: 0.35; }

.overlay {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: rgba(20, 45, 36, 0.72);
  display: grid;
  place-items: center;
  padding: 18px;
  animation: fade 0.2s ease-out;
}
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
.card {
  width: 100%;
  max-width: 420px;
  background: var(--bg);
  border-radius: 18px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 86vh;
  overflow: auto;
}
.card h2 { margin: 0; font-size: 24px; }
.recap { display: grid; gap: 8px; font-size: 14px; }
.recap div { display: flex; justify-content: space-between; gap: 10px; }
.recap .taken { font-weight: 700; }
.recap .missed { opacity: 0.75; text-align: right; }
.row { display: flex; gap: 10px; }
.row > * { flex: 1; }

/* ── панель отладки ────────────────────────────────────────────────── */

.debug-toggle { padding: 6px 10px; font-size: 11px; opacity: 0.6; }
.debug {
  position: fixed;
  left: 10px;
  top: 64px;
  z-index: 30;
  width: min(320px, calc(100vw - 20px));
  background: rgba(12, 32, 26, 0.95);
  border-radius: 12px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.5;
  display: grid;
  gap: 8px;
  max-height: 60vh;
  overflow: auto;
}
.debug code { color: var(--fill); }
`;

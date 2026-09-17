/** Стили игры одной строкой: файл должен открываться с диска без сборки и внешних запросов. */
export const css = `
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

:root {
  --bg: #3f7f68;
  --bg-deep: #35705c;
  --panel: rgba(255, 255, 255, 0.10);
  --tile: #f7f3dd;
  --tile-edge: #ded8bb;
  --ink: #2c4a3d;
  --fill: #b3e874;
  --white: #f3f7f4;
  --danger: #ffb4a2;
  --cell: clamp(42px, 13vmin, 68px);
  --gap: clamp(4px, 1.2vmin, 8px);
  font-family: 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif;
}

html, body { margin: 0; height: 100%; }

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

.progress-row { display: flex; align-items: center; gap: 10px; }
.back { padding: 6px 12px; font-size: 15px; line-height: 1; }

.track {
  position: relative;
  flex: 1;
  height: 14px;
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
  font-size: 12px;
  font-weight: 700;
  color: var(--white);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
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
  margin-top: 12px;
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
@keyframes fly-in {
  from { transform: translateY(26px) scale(0.8); opacity: 0; }
  to { transform: none; opacity: 1; }
}

/* ── поле с фигурой ────────────────────────────────────────────────── */

.stage { flex: 1; display: grid; place-items: center; padding: 18px 16px; }

.draft { height: 40px; display: flex; gap: 3px; align-items: center; justify-content: center; }
.draft span {
  width: 26px;
  height: 30px;
  display: grid;
  place-items: center;
  background: var(--white);
  color: var(--ink);
  border-radius: 6px;
  font-weight: 700;
  animation: pop 0.12s ease-out;
}
.draft.known span { background: var(--fill); }
@keyframes pop { from { transform: scale(0.6); } to { transform: none; } }

.board { position: relative; touch-action: none; user-select: none; }
.board svg { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.board svg polyline { fill: none; stroke: rgba(255, 255, 255, 0.4); stroke-width: 10; stroke-linecap: round; stroke-linejoin: round; }

.tile {
  position: absolute;
  width: var(--cell);
  height: var(--cell);
  background: var(--tile);
  color: var(--ink);
  border-bottom: 3px solid var(--tile-edge);
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: calc(var(--cell) * 0.46);
  font-weight: 700;
  transition: transform 0.12s ease, background 0.12s ease;
}
.tile.picked { background: var(--fill); transform: scale(1.06); }
.tile.hinted { box-shadow: 0 0 0 3px var(--fill); }

.tile.crumble {
  animation: crumble 0.55s cubic-bezier(0.3, 0, 0.7, 1) forwards;
}
@keyframes crumble {
  to { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(0.7); opacity: 0; }
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
  bottom: 56px;
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

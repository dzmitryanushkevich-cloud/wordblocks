/** Стили игры одной строкой: файл должен открываться с диска без сборки и внешних запросов. */
export const css = `
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

:root {
  /* Ночная палитра казуального жанра: глубокий синий фон, светлые панели,
     сочные кнопки. Плитки остаются кремовыми — на синем они читаются лучше
     всего, и это единственное, что в игре нельзя терять из виду. */
  --bg: #1d2f63;
  --bg-deep: #14204a;
  --panel: rgba(255, 255, 255, 0.12);
  --panel-deep: rgba(6, 40, 46, 0.55);
  --edge: rgba(255, 255, 255, 0.28);
  --plate: #16255a;
  --tile: #f7f3dd;
  --tile-edge: #d8d2b4;
  /* Обводка детали: тёмная, иначе светлые клетки тонут в небе и в песке. */
  --rim: #123b45;
  /* Обводка текста поверх пейзажа: тем же синим, что и плашки. */
  --rim-ink: #0e3a44;
  --ink: #23335f;
  --fill: #7bd85c;
  --white: #f2f5ff;
  --danger: #ffb4a2;
  /* Кнопки: заливка градиентом, тёмная нижняя грань, проседание при нажатии. */
  --go: #61d24a;
  --go-deep: #37a52c;
  --go-edge: #257a1e;
  --gold: #ffc93c;
  --gold-deep: #f0a32a;
  --gold-edge: #bf7a14;
  /* Высота кнопок нижней полосы: копилка и подсказка должны стоять вровень. */
  --tray-btn: 62px;
  font-family: 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif;
}

html, body { margin: 0; height: 100%; }

/* dvh — высота видимой части экрана: панель мобильного браузера её больше не съедает. */
@supports (height: 100dvh) {
  html, body { height: 100dvh; }
}

body {
  /* Дневное небо: та же гамма, что у пейзажей, — пока картинка не встала,
     подмены не видно. */
  background: linear-gradient(180deg, #2f8188 0%, #1c5a62 100%);
  color: var(--white);
  display: flex;
  justify-content: center;
  overscroll-behavior: none;
  /* Игра всегда в один экран: прокрутка страницы означала бы, что блок уехал
     под край, а не что его надо искать пальцем. */
  overflow: hidden;
}

/* Задник: пейзаж главы. Лежит под всем, поэтому фиксирован по экрану,
   а не по колонке игры. Затемнение поверх картинки обязательно — без него
   светлые места пейзажа спорят с плитками, а текст на карте плывёт. */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
}
.backdrop .sky {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center bottom;
}
.backdrop .sky.fade { animation: sky-in 0.9s ease both; }
@keyframes sky-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(85% 60% at 50% 40%, rgba(5, 34, 38, 0) 0%, rgba(5, 34, 38, 0.3) 100%);
}

#root {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/*
 * Кнопки сделаны в идиоме казуальных игр: заливка градиентом, тёмная нижняя
 * грань вместо тени и проседание при нажатии. Это не украшение — на телефоне
 * такая кнопка читается как физическая и явно приглашает её нажать.
 */
button {
  font: inherit;
  color: var(--white);
  text-shadow: 0 2px 0 rgba(20, 64, 15, 0.55);
  background: linear-gradient(180deg, var(--go), var(--go-deep));
  border: none;
  border-radius: 16px;
  padding: 11px 18px;
  cursor: pointer;
  font-weight: 700;
  box-shadow: 0 4px 0 var(--go-edge), 0 7px 14px rgba(6, 14, 38, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}
button:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--go-edge), 0 2px 6px rgba(6, 14, 38, 0.45);
}
button.ghost {
  background: linear-gradient(180deg, rgba(23, 62, 116, 0.82), rgba(12, 42, 84, 0.82));
  color: var(--white);
  box-shadow: 0 4px 0 rgba(6, 22, 48, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.22);
}
button.gold {
  color: var(--white);
  text-shadow: 0 2px 0 rgba(120, 72, 6, 0.6);
  background: linear-gradient(180deg, var(--gold), var(--gold-deep));
  box-shadow: 0 4px 0 var(--gold-edge), 0 6px 12px rgba(8, 24, 19, 0.3);
}
button.gold:active { box-shadow: 0 1px 0 var(--gold-edge), 0 2px 6px rgba(8, 24, 19, 0.3); }
button:disabled { opacity: 0.45; cursor: default; }

/* ── шапка: прогресс и найденные слова ─────────────────────────────── */

.hud { padding: 14px 16px 0; }

.top-row { display: flex; align-items: center; gap: 10px; }
.top-row > :nth-child(2) { margin-left: auto; }
.back { padding: 6px 12px; font-size: 15px; line-height: 1; }
.icon { padding: 6px 10px; font-size: 15px; line-height: 1; }

.track {
  position: relative;
  margin-top: 10px;
  height: 32px;
  background: var(--panel-deep);
  border: 1px solid var(--edge);
  border-radius: 999px;
  overflow: hidden;
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.35);
}
.track > i {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(180deg, #c3f08a, #8fd14f);
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
/* Кошелёк в шапке: монеты видно всегда, иначе цена подсказки ни о чём не говорит. */
.wallet {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 13px 5px 7px;
  border-radius: 999px;
  background: rgba(9, 18, 45, 0.7);
  border: 1px solid rgba(255, 201, 60, 0.5);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  font-size: 16px;
  font-weight: 700;
  color: #ffe9a8;
}
.wallet.bump { animation: wallet-bump 0.45s cubic-bezier(0.2, 0.8, 0.3, 1); }
@keyframes wallet-bump {
  0% { transform: none; }
  35% { transform: scale(1.18); }
  100% { transform: none; }
}

.words {
  margin-top: 10px;
  min-height: 109px;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.18);
  /* Плитка слова сжимается на узком экране: ПОЛИЦЕЙСКИЙ в одиннадцать букв
     иначе вылезает за край и тянет за собой горизонтальную прокрутку. */
  background: var(--panel-deep);
  border: 1px solid var(--edge);
  border-radius: 18px;
  padding: 13px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
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
  width: clamp(17px, 6.3vw, 26px);
  height: clamp(19px, 7vw, 29px);
  display: grid;
  place-items: center;
  background: var(--tile);
  color: var(--ink);
  border-radius: 5px;
  font-size: clamp(11px, 4.2vw, 17px);
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
  /* Поле ужимается, когда список слов разрастается: иначе оно распирает страницу. */
  min-height: 0;
  display: grid;
  /* Первая строка забирает весь свободный остаток, вторая равна блоку с подписью.
     Собираемое слово висит в этом остатке по центру — между шкалой цели сверху
     и подписью категорий снизу; прижатое к какому-нибудь краю, оно читается
     как часть шкалы или как часть подписи. */
  grid-template-rows: 1fr auto;
  justify-items: center;
  /* Сверху отступа нет намеренно: он оказывался вне строки со словом, и слово
     вставало на 12 пикселей ниже середины — между шкалой и подписью зазоры
     переставали быть равными. */
  padding: 0 12px clamp(28px, 5.6vh, 56px);
  overflow: hidden;
}
/* Нижняя часть поля: подпись категорий и сам блок, во всю ширину экрана. */
/* Блок прижат к низу: до него дотягивается палец, и от блока к блоку он
   не прыгает по вертикали. Пустое место собирается над ним, а не под ним —
   там живёт собираемое слово. */
.board-slot {
  align-self: end;
  display: grid;
  justify-items: center;
  width: 100%;
  /* Подпись стоит над блоком на высоту собственной строки: вплотную она
     читается как часть блока, а не как его имя. */
  row-gap: 62px;
}
/* Отступ сверху держит фигуру на прежней высоте, освобождая место очереди. */
.board-cell { padding-top: 0; }
/* Подпись блока: что в нём спрятано. Высота держится всегда, даже когда
   подписи нет, — иначе блок подпрыгивает от одного блока к другому. */
.block-labels {
  grid-column: 1 / -1;
  color: #ffffff;
  /* Обводка из восьми теней: на пёстром фоне белая подпись без неё пропадает,
     а -webkit-text-stroke режет букву изнутри и делает шрифт тоньше. */
  text-shadow:
    -2px -2px 0 var(--rim-ink), 2px -2px 0 var(--rim-ink), -2px 2px 0 var(--rim-ink),
    2px 2px 0 var(--rim-ink), 0 -2px 0 var(--rim-ink), 0 2px 0 var(--rim-ink),
    -2px 0 0 var(--rim-ink), 2px 0 0 var(--rim-ink);
  /* Тень отдельным фильтром, а не девятой text-shadow: фильтр отбрасывает её
     от всей буквы вместе с обводкой, а не от одной заливки под кантом. */
  filter: drop-shadow(0 3px 4px rgba(8, 40, 80, 0.55));
  min-height: 30px;
  /* На узком экране две категории должны уместиться в строку, а не ломаться. */
  font-size: clamp(19px, 5.6vw, 26px);
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  opacity: 0.95;
  text-align: center;
  /* Подпись проявляется, когда блок уже выехал: сначала деталь, потом её имя. */
  animation: label-in 0.5s ease-out 0.5s both;
}
/* Блок рассыпается — подпись гаснет вместе с ним. Именно анимацией, а не классом
   с прозрачностью: у анимации с fill-mode приоритет выше, и класс она перебивала. */
.block-labels.gone { animation: label-out 0.32s ease-in both; }
@keyframes label-in {
  from { opacity: 0; }
  to { opacity: 0.95; }
}
@keyframes label-out {
  from { opacity: 0.95; }
  to { opacity: 0; }
}

/* Нижняя полоса: подсказка слева, очередь блоков по центру, отладка справа. */
.tray {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 0 8px 24px 12px;
}

/* Слева в полосе два элемента: копилка и подсказка. Копилка первая, потому что
   она меньше и реже нужна, а подсказка должна остаться под большим пальцем. */
.tray-left {
  /* Группа занимает всю левую колонку: копилка прижата к краю экрана,
     а подсказка встаёт по центру промежутка между нею и счётчиком блоков. */
  justify-self: stretch;
  width: 100%;
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

/* Копилка слов не из темы: звезда с числом найденного на этом уровне. */
.bonus {
  position: relative;
  padding: 0;
  width: var(--tray-btn);
  height: var(--tray-btn);
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #5aa0e8, #2f6fc0);
  box-shadow: 0 4px 0 #1f4f8f, 0 6px 12px rgba(6, 22, 48, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
  color: #fff3c4;
}
.bonus:active { box-shadow: 0 1px 0 #1f4f8f, 0 2px 6px rgba(6, 22, 48, 0.35); }
.bonus svg.star-icon {
  width: 27px;
  height: 27px;
  filter: drop-shadow(0 1px 1px rgba(8, 40, 80, 0.45));
}
/* Число найденного — на уголке, как счётчик непрочитанного. */
.bonus b {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 21px;
  height: 21px;
  padding: 0 5px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--gold), var(--gold-deep));
  color: #5a3c08;
  font-size: 13px;
  line-height: 21px;
  text-shadow: none;
  box-shadow: 0 2px 0 var(--gold-edge);
}
.bonus.bump { animation: bonus-bump 0.6s cubic-bezier(0.2, 0.8, 0.3, 1); }
@keyframes bonus-bump {
  0% { transform: none; }
  30% { transform: scale(1.2) rotate(-6deg); }
  100% { transform: none; }
}

/* Окно копилки: тот же картон, что у итогов уровня. */
.bonus-card { gap: 14px; }
.bonus-here {
  background: var(--panel-deep);
  border: 1px solid var(--edge);
  border-radius: 16px;
  padding: 12px;
  display: grid;
  gap: 10px;
  min-height: 112px;
}
.bonus-here > span {
  font-size: 14px;
  font-weight: 700;
  opacity: 0.75;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.bonus-empty { margin: 0; font-size: 14px; line-height: 1.45; opacity: 0.75; }
/* Слов за уровень бывает и десяток: список прокручивается внутри окна,
   а не распирает карточку. */
.bonus-words {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
  max-height: 156px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.bonus-words i {
  font-style: normal;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.04em;
  padding: 5px 10px;
  border-radius: 10px;
  background: var(--tile);
  color: var(--ink);
  box-shadow: 0 2px 0 var(--tile-edge);
}
.debug code.alien { color: #ffd98a; opacity: 0.85; }
/* Буквы, летящие в копилку: живут поверх всего и не ловят касания. */
.bonus-flight {
  position: fixed;
  inset: 0;
  z-index: 9;
  pointer-events: none;
}
.bonus-flight span {
  position: fixed;
  transform-origin: center;
  display: grid;
  place-items: center;
  border-radius: 10px;
  font-weight: 700;
  background: linear-gradient(180deg, var(--gold), var(--gold-deep));
  color: #5a3c08;
  box-shadow: 0 3px 0 var(--gold-edge), 0 6px 12px rgba(8, 40, 80, 0.35);
  margin-left: -0.5px;
  translate: -50% -50%;
}
@keyframes bonus-fly {
  0% { transform: none; opacity: 1; }
  65% { opacity: 1; }
  100% { transform: translate(var(--tx), var(--ty)) scale(0.3); opacity: 0; }
}

.bonus-prize { display: flex; align-items: center; gap: 6px; font-weight: 700; color: #ffe9a8; }

.hint {
  /* Автоматические поля с обеих сторон и центруют кнопку в остатке. */
  margin: 0 auto;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 1px;
  width: 78px;
  height: var(--tray-btn);
  padding: 4px 2px;
  border-radius: 18px;
  font-size: 12px;
  font-weight: 700;
  color: #5a3c08;
  background: linear-gradient(180deg, var(--gold), var(--gold-deep));
  box-shadow: 0 4px 0 var(--gold-edge), 0 6px 12px rgba(8, 24, 19, 0.3);
}
.hint:active { box-shadow: 0 1px 0 var(--gold-edge), 0 2px 6px rgba(8, 24, 19, 0.3); }
.hint .price {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(90, 60, 8, 0.22);
  font-size: 11px;
}
.hint.poor { opacity: 0.55; }
/* Короткое сообщение о нехватке монет — над полосой, чтобы не двигать вёрстку. */
.toast {
  position: fixed;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  z-index: 8;
  padding: 9px 16px;
  border-radius: 999px;
  background: rgba(12, 32, 26, 0.92);
  color: var(--white);
  font-size: 14px;
  font-weight: 700;
  animation: toast-in 0.25s ease-out both;
}
@keyframes toast-in {
  from { opacity: 0; transform: translate(-50%, 8px); }
  to { opacity: 1; transform: translateX(-50%); }
}

.hint svg.bulb {
  width: 23px;
  height: 23px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Счётчик блоков стоит по центру полосы, миниатюры начинаются сразу правее. */
.queue-label {
  white-space: nowrap;
  text-align: center;
  font-weight: 700;
  line-height: 1.2;
  text-shadow: 0 2px 6px rgba(8, 40, 80, 0.7);
}
.queue-label span { display: block; font-size: 18px; opacity: 0.8; }
.queue-label b { font-size: 22px; letter-spacing: 0.3px; }

.thumbs {
  display: flex;
  align-items: flex-end;
  justify-self: start;
  gap: 10px;
  min-height: 51px;
  animation: queue-in 0.5s cubic-bezier(0.2, 0.7, 0.25, 1) both;
}
.thumb {
  overflow: visible;
  /* Кремовая миниатюра на светлом небе пропадает — держим её тенью. */
  filter: drop-shadow(0 3px 4px rgba(8, 40, 80, 0.45));
  width: calc(var(--w) * var(--s, 1));
  height: calc(var(--h) * var(--s, 1));
}
.thumb path {
  stroke-linejoin: round;
  paint-order: stroke;
}
.thumb .body {
  fill: var(--tile);
  stroke: var(--tile);
  stroke-width: 0.5;
}
.thumb .rim {
  fill: var(--rim);
  stroke: var(--rim);
  stroke-width: 0.76;
}
/* Очередь подъезжает справа, ближняя миниатюра ещё и подрастает. */
@keyframes queue-in {
  from { transform: translateX(38px); opacity: 0.4; }
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
  position: relative;
  align-self: center;
  margin: 0;
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
/* Невысокий экран (короткое окно на десктопе, маленький телефон): интерфейс
   ужимается целиком, иначе блоку не остаётся высоты и он лезет под нижнюю полосу. */
@media (max-height: 720px) {
  .words { min-height: 76px; padding: 9px; gap: 8px; }
  .word span { width: clamp(15px, 5.6vw, 22px); height: clamp(17px, 6.2vw, 25px); font-size: clamp(10px, 3.8vw, 15px); }
  .draft { min-height: 54px; margin-bottom: 16px; }
  .draft span { width: 44px; height: 54px; font-size: 26px; }
  .board-slot { row-gap: 44px; }
  .block-labels { min-height: 26px; font-size: clamp(17px, 5vw, 22px); }
  .stage { padding-bottom: clamp(16px, 3vh, 28px); }
  .tray { padding-bottom: 14px; }
}

/* Края слова скругляем по первой и последней БУКВЕ, а не по первому и последнему
   ребёнку: под словом лежит ещё подпись «в копилку», и с :last-child последняя
   буква теряла скругление — слово выглядело обрезанным. */
.draft span:first-of-type { border-radius: 15px 0 0 15px; }
.draft span:last-of-type { border-radius: 0 15px 15px 0; }
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
/* Слово есть в языке, но не из темы уровня: жёлтая полоса и тот же отказ,
   только мягче — игрок не ошибся в слове, он ошибся темой. */
.draft.alien {
  animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both,
    draft-out 0.22s ease-in 0.46s both;
}
.draft.alien span {
  /* Слово не из темы теперь не «отказ», а находка в копилку — поэтому золото,
     а не тусклая горчица: игрок должен видеть, что слово зачтено куда-то. */
  background: linear-gradient(180deg, var(--gold), var(--gold-deep));
  color: #5a3c08;
  box-shadow: 0 4px 0 var(--gold-edge);
  animation: none;
}
/* Подпись под золотым словом: куда оно ушло. Без неё золото читается как ошибка. */
.draft .kept {
  position: absolute;
  top: 100%;
  margin-top: 6px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffe9a8;
  text-shadow: 0 2px 4px rgba(8, 40, 80, 0.6);
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
  overflow: visible;
}
.board .plate path {
  stroke-linejoin: round;
  paint-order: stroke;
}
/* Тело детали: кремовая плита с тёмной нижней гранью и мягкой тенью. */
.board .plate .body {
  fill: var(--tile);
  stroke: var(--tile);
  stroke-width: 19;
  filter: drop-shadow(0 5px 0 var(--tile-edge)) drop-shadow(0 14px 18px rgba(8, 40, 80, 0.38));
}
/* Обводка: тот же контур, но шире и тёмный — деталь читается на любом пейзаже.
   Тень тем же цветом на 5 пикселей вниз обводит не плоскую верхнюю грань,
   а весь объём вместе с нижней гранью, иначе тёмный кант ложился поверх неё
   и нижний ряд клеток выглядел обрезанным. */
.board .plate .rim {
  fill: var(--rim);
  stroke: var(--rim);
  stroke-width: 24;
  filter: drop-shadow(0 5px 0 var(--rim));
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

.top-row .debug-toggle { margin-right: auto; }

/* ── карта уровней и итоги ─────────────────────────────────────────── */

/* Карта уровней — единственный экран, который прокручивается: страница целиком
   прокрутку не имеет, поэтому список крутится внутри себя. */
.screen {
  padding: 24px 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.screen h1 {
  margin: 0;
  font-size: 30px;
  letter-spacing: 0.5px;
  text-shadow: 0 3px 10px rgba(8, 40, 80, 0.55);
}
.screen p { margin: 0; line-height: 1.5; opacity: 0.92; }

/* Вступление стоит на плашке: длинный текст поверх яркого неба не читается. */
.intro {
  background: var(--panel-deep);
  border: 1px solid var(--edge);
  border-radius: 18px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
.build { font-size: 12px; opacity: 0.7; margin: 0; }
/* Переключатель языка: его нет, пока в сборке один пакет. */
.langs { display: flex; gap: 8px; }
.lang { padding: 6px 14px; font-size: 13px; border-radius: 12px; }
.lang.on { box-shadow: 0 3px 0 rgba(0, 0, 0, 0.18); }
.levels { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 10px; }
.level-card {
  background: linear-gradient(180deg, #59b0f5, #2f86dc);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  padding: 10px 6px;
  text-align: center;
  display: grid;
  gap: 2px;
  color: var(--white);
  text-shadow: 0 2px 0 rgba(12, 58, 110, 0.5);
  box-shadow: 0 4px 0 #1f66ae, inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.level-card b { font-size: 18px; }
.level-card small { font-size: 11px; opacity: 0.8; }
.level-card em {
  font-style: normal;
  font-size: 10px;
  line-height: 1.2;
  opacity: 0.6;
  letter-spacing: 0.04em;
}
.level-card.done {
  background: linear-gradient(180deg, var(--go), var(--go-deep));
  color: var(--white);
  text-shadow: 0 2px 0 rgba(20, 64, 15, 0.45);
  box-shadow: 0 4px 0 var(--go-edge), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.level-card.done em, .level-card.done small { opacity: 0.92; }
/* Закрытый уровень не бледнеет, а глохнет: на ярком небе полупрозрачная
   карточка выглядела бы сломанной, а не запертой. */
.level-card.locked {
  background: linear-gradient(180deg, rgba(20, 52, 96, 0.72), rgba(12, 36, 72, 0.72));
  box-shadow: 0 4px 0 rgba(6, 22, 48, 0.5);
  text-shadow: none;
  opacity: 0.85;
}

/* Итоги — единственный праздничный экран, поэтому он единственный,
   где есть глубина: подсветка из-за карточки и затемнение по краям. */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 10;
  background:
    radial-gradient(120% 80% at 50% 34%, rgba(92, 140, 226, 0.45), rgba(7, 14, 36, 0.88) 70%),
    rgba(7, 14, 36, 0.72);
  display: grid;
  place-items: center;
  padding: 18px;
  animation: fade 0.2s ease-out;
}
/* Уход окна итогов: гаснет вместе с карточкой, и только потом меняется уровень. */
.overlay.out {
  animation: fade 0.22s ease-in reverse both;
  pointer-events: none;
}
.overlay.out .card { animation: card-out 0.22s ease-in both; }
@keyframes card-out {
  from { transform: none; opacity: 1; }
  to { transform: translateY(12px) scale(0.96); opacity: 0; }
}
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
.card {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: linear-gradient(180deg, #2b4287, #1e3064);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 24px;
  padding: 22px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 86vh;
  overflow: auto;
  box-shadow: 0 18px 44px rgba(4, 10, 28, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: card-in 0.36s cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
}
@keyframes card-in {
  from { transform: translateY(18px) scale(0.94); opacity: 0; }
  to { transform: none; opacity: 1; }
}
.card h2 {
  margin: 0;
  font-size: 34px;
  text-align: center;
  letter-spacing: 0.5px;
  /* Плотный заголовок с тенью — так он читается как надпись на плакате. */
  text-shadow: 0 3px 0 rgba(6, 14, 38, 0.45), 0 6px 14px rgba(6, 14, 38, 0.45);
}
.card .why { margin: 0; text-align: center; opacity: 0.85; }

/* Три звезды и награда — праздничная часть карточки. */
.stars {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: -4px;
}
.star {
  width: 58px;
  height: 58px;
  filter: drop-shadow(0 3px 0 rgba(0, 0, 0, 0.2)) drop-shadow(0 0 14px rgba(255, 214, 92, 0.55));
  animation: star-pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.25) both;
}
.star.big { width: 80px; height: 80px; margin-bottom: 14px; }
.stars > :nth-child(1) { animation-delay: 0.05s; }
.stars > :nth-child(2) { animation-delay: 0.2s; }
.stars > :nth-child(3) { animation-delay: 0.35s; }
@keyframes star-pop {
  0% { transform: scale(0.2) rotate(-25deg); opacity: 0; }
  65% { transform: scale(1.16) rotate(4deg); opacity: 1; }
  100% { transform: none; opacity: 1; }
}
/* Тёплое сияние за звёздами — оно и делает экран праздничным. */
.stars::before {
  content: '';
  position: absolute;
  width: 220px;
  height: 220px;
  margin-top: 10px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 214, 92, 0.32), rgba(255, 214, 92, 0) 68%);
  animation: glow-in 0.6s ease-out 0.15s both;
  pointer-events: none;
}
@keyframes glow-in {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: none; }
}
.stars { position: relative; }

.prize {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 22px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 226, 138, 0.26), rgba(240, 195, 60, 0.16));
  border: 1px solid rgba(255, 226, 138, 0.35);
  color: #ffe9a8;
  font-size: 24px;
  font-weight: 700;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.18);
  animation: prize-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.5s both;
}
@keyframes prize-in {
  from { transform: translateY(8px) scale(0.9); opacity: 0; }
  to { transform: none; opacity: 1; }
}
/* Кнопки итогов стоят столбиком: главная широкая, как в жанре принято.
   Нижняя грань и проседание при нажатии — та самая «объёмность» жанра. */
.row { display: grid; gap: 10px; margin-top: 4px; }
.row .big {
  padding: 16px 18px;
  font-size: 19px;
  font-weight: 700;
  border-radius: 18px;
  background: linear-gradient(180deg, #6fe055, #3fb130);
  color: var(--white);
  text-shadow: 0 2px 0 rgba(20, 64, 15, 0.6);
  box-shadow: 0 6px 0 var(--go-edge), 0 12px 20px rgba(6, 14, 38, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.row .big:active { transform: translateY(4px); box-shadow: 0 2px 0 var(--go-edge); }
.row .ghost { padding: 13px 18px; font-size: 16px; border-radius: 16px; }

/* Сундук: полоска прогресса и сам сундук справа. */
.chest-row { display: flex; align-items: center; gap: 12px; }
.chest-bar {
  position: relative;
  flex: 1;
  height: 30px;
  border-radius: 999px;
  background: rgba(9, 18, 45, 0.6);
  border: 1px solid var(--edge);
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}
.chest-bar > i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: linear-gradient(180deg, #8ceb6a, #45b534);
  transition: width 0.8s cubic-bezier(0.2, 0.8, 0.3, 1);
}
.chest-bar > b {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 15px;
  color: var(--white);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
}
.chest { position: relative; flex: none; display: grid; place-items: center; }
.chest.open { animation: chest-jump 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
@keyframes chest-jump {
  0% { transform: none; }
  40% { transform: translateY(-8px) scale(1.12); }
  100% { transform: none; }
}
.chest.open .lid { transform-origin: 20px 14px; animation: lid-open 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
@keyframes lid-open {
  to { transform: rotate(-24deg) translateY(-2px); }
}
/* Конфетти летит за карточкой: дешёвые прямоугольники, без картинок. */
.confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.confetti i {
  position: absolute;
  top: -8%;
  width: 9px;
  height: 14px;
  border-radius: 2px;
  opacity: 0.9;
  animation: confetti-fall 2.6s linear both;
}
@keyframes confetti-fall {
  from { transform: translateY(-10vh) rotate(0deg); }
  to { transform: translateY(105vh) rotate(540deg); }
}

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

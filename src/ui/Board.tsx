import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Figure } from '../core/types.js';
import { outlinePath } from './outline.js';
import { primeSound } from './audio.js';

const GAP = 6;
/**
 * Подложка блока обведена наружу (stroke у .plate), поэтому видимая деталь шире
 * решётки плиток. Этот запас входит в расчёт ширины — иначе деталь наползает
 * на миниатюры очереди, хотя по клеткам всё «помещается».
 */
const BLEED = 10;
/** Воздух по бокам блока: деталь не должна упираться в край экрана. */
const CLEAR = 10;
/**
 * Запас под блоком сверх отступа сцены. Считаем его от канта: подложка обведена
 * наружу и вдобавок отбрасывает «толщину» вниз, поэтому видимый низ детали ниже
 * последней плитки примерно на кант плюс эту толщину. С запасом в шесть пикселей
 * высокий блок на невысоком экране краем заезжал под нижнюю полосу.
 */
const BOTTOM_AIR = BLEED + 12;
/* Нижняя граница клетки: ниже пальцу уже неудобно, но обрезать фигуру хуже,
   поэтому на маленьком экране высокий блок всё же ужимается. */
const MIN_CELL = 26;
const MAX_CELL = 82;
/** Кегль буквы в клетке: от него же считается полоса хода, см. CORE. */
const LETTER = 0.46;
/**
 * Ширина полосы, по которой палец ведёт слово, — доля от шага сетки, примерно
 * с саму букву. Первое касание ловится всей клеткой: игрок ставит палец
 * осознанно и в одну точку. Дальше клетка засчитывается, только если палец
 * прошёл через неё близко к середине — но близко поперёк хода, а не во все
 * стороны.
 *
 * Разница принципиальная. Клетки стоят вплотную, и на всю ширину они ловят
 * палец краем: ведя вдоль ряда, его почти невозможно не занести на соседний
 * ряд, и в слово лезла буква, которую никто не выбирал. Круглое же ядро режет
 * и то, ради чего свайп делается: на быстром махе браузер отдаёт движение
 * редкими точками, палец пролетает клетку насквозь, в середину не попадает —
 * и слово обрывается на второй букве.
 *
 * Полоса вдоль хода решает оба: вперёд она открыта на всю клетку, поперёк —
 * узкая. Клетка по пути засчитывается, едва палец в неё вошёл; клетка сбоку
 * требует зайти в неё глубоко, а не задеть краем.
 */
const CORE = LETTER + 0.1;
/** Толщина обводки у заливки выделения. Столько же стоит в css у `.lit path`. */
const LIT_STROKE = 10;
/** Сколько выезжает голова заливки. Дольше — заливка отстаёт от пальца. */
const CROWN_MS = 130;

/** Псевдослучайное, но стабильное число из индекса: одна и та же фигура рассыпается одинаково. */
function jitter(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Искры по контуру собранного слова. Ищем у каждой клетки стороны, за которыми
 * нет соседа из того же слова, — это и есть край детали. Только оттуда и только
 * наружу летят звёздочки: внутри деталь белая, там их всё равно не видно.
 */
function sparks(figure: Figure, taken: number[], cell: number, pitch: number) {
  if (taken.length === 0) return null;

  const inWord = new Set(taken.map((i) => `${figure.cells[i].x},${figure.cells[i].y}`));
  const sides = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];

  const pieces: ReactElement[] = [];
  for (const i of taken) {
    const { x, y } = figure.cells[i];
    const cx = x * pitch + cell / 2;
    const cy = y * pitch + cell / 2;

    sides.forEach((side, sideIndex) => {
      if (inWord.has(`${x + side.dx},${y + side.dy}`)) return; // сторона внутри слова

      // У большого блока искр вдвое меньше: каждая — отдельный элемент со своим
      // свечением, а в куче они всё равно читаются как одна вспышка.
      for (let k = 0; k < (taken.length > 4 ? 1 : 2); k++) {
        const seed = i * 29 + sideIndex * 7 + k;
        // Точка на стороне: середина плюс смещение вдоль неё.
        const along = (jitter(seed) - 0.5) * cell * 0.8;
        const size = 9 + Math.round(jitter(seed + 21) * 11);
        // Рождаются уже за краем детали: на самой кромке они сливаются с клетками.
        const offset = cell * 0.5 + 12 + jitter(seed + 27) * 16;
        const left = cx + side.dx * offset + (side.dx === 0 ? along : 0) - size / 2;
        const top = cy + side.dy * offset + (side.dy === 0 ? along : 0) - size / 2;

        // Летит перпендикулярно стороне, слегка вбок.
        const spreadX = side.dx === 0 ? (jitter(seed + 5) * 2 - 1) * 0.55 : 0;
        const spreadY = side.dy === 0 ? (jitter(seed + 9) * 2 - 1) * 0.55 : 0;
        // Смещение короткое: звёздочка чуть отходит от края и гаснет.
        // Путь и время ужаты вдвое вместе, поэтому скорость расхождения та же.
        const distance = 5 + jitter(seed + 13) * 12;

        pieces.push(
          <div
            key={`s${i}-${sideIndex}-${k}`}
            className="spark"
            style={{
              left: Math.round(left),
              top: Math.round(top),
              width: size,
              height: size,
              animationDelay: `${Math.round(jitter(seed + 3) * 230)}ms`,
              ['--px' as string]: `${Math.round((side.dx + spreadX) * distance)}px`,
              ['--py' as string]: `${Math.round((side.dy + spreadY) * distance)}px`,
              ['--rot' as string]: `${Math.round((jitter(seed + 41) * 2 - 1) * 200)}deg`,
            }}
          />,
        );
      }
    });
  }
  return pieces;
}

/** Один летящий кусочек: где лежал и куда его унесло. */
interface Shard {
  key: string;
  left: number;
  top: number;
  size: number;
  delay: number;
  dx: number;
  up: number;
  dy: number;
  rot: number;
}

/**
 * Осколки фигуры. Каждая клетка, кроме клеток найденного слова, распадается
 * на кусочки и разлетается.
 *
 * Полёт — дуга: вбок кусочек уходит ровно, вверх подлетает и тормозит, вниз
 * падает с ускорением. Считаем только числа; саму анимацию вешает поле — см.
 * `useLayoutEffect` в `Board`, там же объяснено, почему не через css.
 */
function shards(figure: Figure, cell: number, pitch: number, taken: number[]): Shard[] {
  // Крупный блок сыплется той же горстью, что и мелкий: на семи-восьми клетках
  // сетка 3×3 даёт под сотню летящих кусочков, каждый со своим слоем, и телефон
  // на этом захлёбывается. Отдельный кусочек в такой куче всё равно не разглядеть,
  // поэтому у большого блока он просто крупнее.
  const grid = figure.cells.length - taken.length > 5 ? 2 : 3;
  const size = Math.ceil(cell / grid);
  const step = (cell - size) / (grid - 1);
  const skip = new Set(taken);
  const pieces: Shard[] = [];

  for (let i = 0; i < figure.cells.length; i++) {
    if (skip.has(i)) continue;
    const { x, y } = figure.cells[i];

    // Импульс всей клетки: куда её в целом отбросило и как сильно подкинуло.
    const cellDx = (jitter(i * 3 + 1) * 2 - 1) * 190;
    const cellUp = 40 + jitter(i * 3 + 2) * 70;

    for (let row = 0; row < grid; row++) {
      for (let column = 0; column < grid; column++) {
        const seed = i * 37 + row * 7 + column;
        const outX = column - (grid - 1) / 2;
        const outY = row - (grid - 1) / 2;

        pieces.push({
          key: `${i}-${row}-${column}`,
          left: x * pitch + Math.round(column * step),
          top: y * pitch + Math.round(row * step),
          size,
          delay: (i % 5) * 35 + jitter(seed + 3) * 80,
          dx: Math.round(cellDx + outX * (60 + jitter(seed) * 90) + (jitter(seed + 11) * 2 - 1) * 55),
          up: -Math.round(cellUp + Math.max(0, -outY) * 30 + jitter(seed + 5) * 45),
          dy: Math.round(300 + jitter(seed + 17) * 260 + outY * 20),
          rot: Math.round((jitter(seed + 23) * 2 - 1) * 320),
        });
      }
    }
  }
  return pieces;
}

/** Сколько летит кусочек. Столько же стоит в css у затухания. */
const SHARD_MS = 1050;

interface BoardProps {
  figure: Figure;
  selection: number[];
  hintCells: number[];
  crumbling: boolean;
  /** Клетки найденного слова: они не рассыпаются, их буквы улетают в список. */
  taken: number[];
  /** Сколько букв слова уже сорвалось в список: эти клетки плашка теряет по одной. */
  departed: number;
  onPick: (cell: number) => void;
  /** Центры выделенных плиток и размер клетки: из них буквы полетят в список. */
  onRelease: (letterPoints: { x: number; y: number }[], cellSize: number) => void;
}

/**
 * Поле с одной фигурой. Плитки разложены абсолютно по своим координатам,
 * поверх рисуется линия выделения. Ввод — pointer events, поэтому мышь
 * и палец работают одним и тем же кодом.
 */
export function Board({ figure, selection, hintCells, crumbling, taken, departed, onPick, onRelease }: BoardProps) {
  const ref = useRef<HTMLDivElement>(null);
  /** Где палец был в прошлый раз: между двумя точками достраиваем путь. */
  const trail = useRef<{ x: number; y: number } | null>(null);
  /** Клетка, о которой уже сказали выделению: подряд одну и ту же не повторяем. */
  const reported = useRef<number | undefined>(undefined);
  /** Рамка поля на время одного свайпа: см. cellAt. */
  const frame = useRef<DOMRect | null>(null);
  /** Куда идёт палец: вдоль этого направления клетка открыта целиком. */
  const heading = useRef<{ ux: number; uy: number } | null>(null);
  /** Плашка последней залитой клетки: её и разгоняем в новую клетку. */
  const crownRef = useRef<HTMLDivElement>(null);
  const growth = useRef<Animation | null>(null);
  /** Сколько клеток было залито в прошлый раз: по нему видно, назад пошёл палец или вперёд. */
  const grown = useRef(0);
  const [box, setBox] = useState({ width: 0, height: 0, cell: 0, gap: GAP });

  /**
   * Размер клетки считаем сами и только целыми пикселями. Дробный размер
   * (а он неизбежен, если считать его в vmin) разбрасывает буквы по долям пикселя,
   * и одна и та же буква в разных клетках выглядит то сжатой, то размытой.
   */
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const stage = node.closest('.stage') as HTMLElement | null;

    const update = (): void => {
      // Отступы сцены входят в её clientHeight, поэтому вычитаем их:
      // иначе опущенная вниз фигура не уместится на невысоком экране.
      const padding = stage ? getComputedStyle(stage) : null;
      const padY = padding
        ? parseFloat(padding.paddingTop) + parseFloat(padding.paddingBottom)
        : 0;
      const padX = padding
        ? parseFloat(padding.paddingLeft) + parseFloat(padding.paddingRight)
        : 0;
      const slot = node.closest('.board-slot') as HTMLElement | null;
      const availableWidth =
        (stage?.clientWidth ?? window.innerWidth) - padX - (BLEED + CLEAR) * 2;
      // Сверху над блоком живут собираемое слово и подпись категорий. Их высоту
      // меряем по факту: подпись из двух категорий на узком экране занимает две
      // строки, и на глазок заложенный запас в этом случае съедает низ фигуры.
      const draft = stage?.querySelector('.draft');
      const labels = slot?.querySelector('.block-labels');
      const rowGap = slot ? parseFloat(getComputedStyle(slot).rowGap) || 0 : 0;
      const reserve =
        (draft?.getBoundingClientRect().height ?? 0) +
        (labels?.getBoundingClientRect().height ?? 0) +
        rowGap +
        BOTTOM_AIR;
      const availableHeight = (stage?.clientHeight ?? 420) - padY - reserve;
      const cell = Math.max(
        MIN_CELL,
        Math.min(
          MAX_CELL,
          Math.floor((availableWidth - GAP * (figure.width - 1)) / figure.width),
          Math.floor((availableHeight - GAP * (figure.height - 1)) / figure.height),
        ),
      );
      // Поле переехало или изменилось — запомненная рамка больше не годится.
      frame.current = null;
      setBox({
        cell,
        gap: GAP,
        width: cell * figure.width + GAP * (figure.width - 1),
        height: cell * figure.height + GAP * (figure.height - 1),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    if (stage) observer.observe(stage);
    return () => observer.disconnect();
  }, [figure]);

  const index = useMemo(() => {
    const map = new Map<string, number>();
    figure.cells.forEach((cell, i) => map.set(`${cell.x},${cell.y}`, i));
    return map;
  }, [figure]);

  /**
   * Клетка под пальцем. Считаем по сетке, поэтому зазоры тоже попадают в ближнюю
   * плитку. `strict` сужает клетку до ядра: точка вне круга в середине не
   * принадлежит никакой клетке, и между соседями остаётся мёртвая полоса.
   */
  const cellAt = useCallback(
    (
      clientX: number,
      clientY: number,
      /** Куда идёт палец (единичный вектор). Без него клетка ловится целиком. */
      heading?: { ux: number; uy: number },
    ): number | undefined => {
      const node = ref.current;
      if (!node) return undefined;
      // Рамку поля берём ту, что запомнили в момент касания. Свайп спрашивает
      // клетку десятки раз за кадр, а getBoundingClientRect заставляет браузер
      // доверстать страницу, чтобы ответить честно. Поле за время одного свайпа
      // никуда не уезжает: страница не прокручивается, выезд блока к этому
      // моменту закончился.
      const rect = frame.current ?? node.getBoundingClientRect();
      const fx = ((clientX - rect.left) / rect.width) * figure.width;
      const fy = ((clientY - rect.top) / rect.height) * figure.height;
      const x = Math.floor(fx);
      const y = Math.floor(fy);
      if (heading) {
        // Насколько палец отклонился от середины клетки поперёк своего хода.
        // Вдоль хода не смотрим вовсе: там клетка открыта целиком.
        const dx = fx - x - 0.5;
        const dy = fy - y - 0.5;
        const across = Math.abs(dx * -heading.uy + dy * heading.ux);
        if (across > CORE / 2) return undefined;
      }
      return index.get(`${x},${y}`);
    },
    [figure, index],
  );

  /**
   * Палец от прошлой точки до нынешней. Идём отрезком, а не прыгаем: шаг в
   * четверть клетки гарантирует, что ядро по дороге не перескочит даже быстрый
   * рывок. Каждое попадание отдаём в выделение — лишние повторы оно само гасит.
   */
  const walk = (point: { x: number; y: number }): void => {
    const from = trail.current ?? point;
    const dx = point.x - from.x;
    const dy = point.y - from.y;
    const span = Math.hypot(dx, dy);
    // Ход пальца на этом отрезке. Совсем короткий отрезок направления не задаёт —
    // берём прошлый, иначе полоса встанет поперёк движения.
    if (span > 1) heading.current = { ux: dx / span, uy: dy / span };
    const steps = Math.max(1, Math.ceil(span / Math.max(4, (box.cell + box.gap) / 4)));
    for (let i = 1; i <= steps; i++) {
      const cell = cellAt(
        from.x + (dx * i) / steps,
        from.y + (dy * i) / steps,
        heading.current ?? undefined,
      );
      if (cell === undefined) continue;
      // Палец идёт внутри одной клетки десятком точек подряд. Дёргать состояние
      // партии на каждую незачем: выделение всё равно отбросит повтор, но React
      // успеет прогнать проверку по всему дереву. Повтор отсекаем здесь.
      const last = reported.current;
      if (cell === last) continue;
      reported.current = cell;
      if (last !== undefined && !touching(last, cell)) {
        // Через клетку перескочили — достраиваем пропуск, иначе слово оборвётся.
        for (const step of bridgeTo(last, cell)) onPick(step);
        continue;
      }
      onPick(cell);
    }
    trail.current = point;
  };

  /** Соседние ли клетки: только по стороне, диагональ соседством не считается. */
  const touching = useCallback(
    (a: number, b: number): boolean => {
      const one = figure.cells[a];
      const two = figure.cells[b];
      return Math.abs(one.x - two.x) + Math.abs(one.y - two.y) === 1;
    },
    [figure],
  );

  /**
   * Клетки между двумя точками пути, когда палец перескочил через них.
   *
   * Быстрый мах браузер отдаёт редкими точками, и отрезок между двумя такими
   * точками — хорда, а не дуга, по которой шёл палец: ядро клетки посередине она
   * не задевает. Одна пропущенная клетка раньше убивала весь свайп — следующая
   * ей уже не соседняя, и слово обрывалось на второй букве. Поэтому пропуск
   * достраивается по сетке: идём от прошлой клетки к новой кратчайшим путём,
   * без обходов дырок, и не дальше четырёх шагов — дальше это уже не мах,
   * а палец, ушедший с блока и вернувшийся в другом месте.
   */
  const bridgeTo = useCallback(
    (from: number, to: number): number[] => {
      const target = figure.cells[to];
      let { x, y } = figure.cells[from];
      const steps: number[] = [];
      while (x !== target.x || y !== target.y) {
        if (steps.length >= 4) return [];
        const dx = Math.sign(target.x - x);
        const dy = Math.sign(target.y - y);
        const byX = dx !== 0 ? index.get(`${x + dx},${y}`) : undefined;
        const byY = dy !== 0 ? index.get(`${x},${y + dy}`) : undefined;
        // Сначала та ось, где идти дальше: так достроенный путь повторяет мах,
        // а не рисует лесенку.
        const next = Math.abs(target.x - x) >= Math.abs(target.y - y)
          ? byX ?? byY
          : byY ?? byX;
        if (next === undefined) return [];
        x = figure.cells[next].x;
        y = figure.cells[next].y;
        steps.push(next);
      }
      return steps;
    },
    [figure, index],
  );

  const release = (): void => {
    trail.current = null;
    reported.current = undefined;
    frame.current = null;
    const node = ref.current;
    const points = node
      ? selection.map((cell) => {
          const tile = node.querySelectorAll('.tile')[cell] as HTMLElement;
          const rect = tile.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })
      : [];
    onRelease(points, box.cell);
  };

  const handleDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (crumbling) return;
    // Звук браузер разрешает заводить только из касания — вот оно.
    primeSound();
    ref.current?.setPointerCapture(event.pointerId);
    frame.current = ref.current?.getBoundingClientRect() ?? null;
    trail.current = { x: event.clientX, y: event.clientY };
    reported.current = undefined;
    heading.current = null;
    // Первая буква ловится всей клеткой: игрок ставит палец осознанно и в одну
    // точку, промахнуться мимо ядра тут было бы обидно на ровном месте.
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === undefined) return;
    reported.current = cell;
    onPick(cell);
  };

  /*
   * Движение пальца слушаем напрямую у элемента, а не через onPointerMove.
   * React ловит события на корне документа и на каждое прогоняет свою машинерию
   * синтетических событий — на нажатии это незаметно, но движений в секунду
   * приходит под сотню, и именно они тормозят выделение на телефоне. Нажатие
   * и отпускание остаются обычными: они редкие.
   *
   * Обработчик ставится один раз на блок, поэтому всё изменчивое он берёт
   * из `live`, а не из замыкания.
   */
  const live = useRef({ crumbling, idle: selection.length === 0, walk });
  useEffect(() => {
    live.current = { crumbling, idle: selection.length === 0, walk };
  });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const move = (event: PointerEvent): void => {
      const now = live.current;
      if (now.crumbling || now.idle) return;
      // Браузер отдаёт движение редкими кадрами, а точки между ними копит
      // отдельно. Берём их все: с узким ядром пропущенный кадр — это
      // пропущенная клетка, а она рвёт цепочку, потому что следующая уже
      // не соседняя.
      const points =
        typeof event.getCoalescedEvents === 'function'
          ? event.getCoalescedEvents().map((step) => ({ x: step.clientX, y: step.clientY }))
          : [];
      if (points.length === 0) points.push({ x: event.clientX, y: event.clientY });
      for (const point of points) now.walk(point);
    };
    node.addEventListener('pointermove', move, { passive: true });
    return () => node.removeEventListener('pointermove', move);
  }, []);

  const pitch = box.cell + box.gap;
  const flying = useMemo(
    () => (crumbling && box.cell > 0 ? shards(figure, box.cell, pitch, taken) : []),
    [crumbling, figure, box.cell, pitch, taken],
  );
  /*
   * Полёт кусочков заводим руками, а не классом в css. Причина одна: в css
   * путь каждого кусочка приходится передавать через свои переменные
   * (`--dx`, `--dy`, …), а кадры с `var()` браузер не умеет отдавать
   * композитору — он пересчитывает их на главном потоке каждый кадр, вместе
   * со стилями всего блока. На горсти кусочков это и есть та самая дёрганость
   * рассыпания. Тот же полёт, выписанный числами, уезжает на композитор
   * и главный поток не трогает вовсе.
   */
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || flying.length === 0) return;
    const parts = node.querySelectorAll<HTMLElement>('.shard');
    if (typeof parts[0]?.animate !== 'function') return; // очень старый браузер: пусть просто лежат
    flying.forEach((shard, i) => {
      const part = parts[i];
      if (!part) return;
      part.animate(
        [
          {
            offset: 0,
            transform: 'translate(0px, 0px) rotate(0deg)',
            easing: 'cubic-bezier(0.12, 0.66, 0.4, 1)',
          },
          {
            offset: 0.26,
            transform: `translate(${Math.round(shard.dx * 0.26)}px, ${shard.up}px) rotate(${Math.round(shard.rot * 0.26)}deg)`,
            easing: 'cubic-bezier(0.55, 0, 0.9, 1)',
          },
          {
            offset: 1,
            transform: `translate(${shard.dx}px, ${shard.dy}px) rotate(${shard.rot}deg) scale(0.82)`,
          },
        ],
        { duration: SHARD_MS, delay: shard.delay, fill: 'forwards' },
      );
      part.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.74 }, { opacity: 0 }], {
        duration: SHARD_MS,
        delay: shard.delay,
        fill: 'forwards',
      });
    });
  }, [flying]);

  // Контур подложки не зависит от выделения, а строка пути у большого блока
  // длинная: пересобирать её на каждое движение пальца незачем.
  const plate = useMemo(
    () => (box.cell > 0 ? outlinePath(figure.cells, pitch, pitch, -box.gap / 2, -box.gap / 2) : ''),
    [figure, pitch, box.cell, box.gap],
  );
  // Пока фигура осыпается, клетки найденного слова стоят на месте и остаются
  // подсвеченными — слово «застывает» на секунду, и только потом буквы улетают.
  // Слово держится на месте, пока его буквы не улетели. Каждая улетевшая буква
  // забирает свою клетку с собой: плашка тает по кусочку, а не гаснет целиком
  // и не раскалывается вся разом — иначе на её месте видны швы и дыры.
  const frozen = crumbling ? taken.slice(departed) : [];
  const picking = selection.length > 0;
  /*
   * Заливка растёт за пальцем. Общий контур рисуется по всем клеткам, кроме
   * последней, а последняя — отдельной плашкой, которая выезжает из предыдущей.
   * Разделение нужно именно для этого: форму пути между двумя наборами клеток
   * не проанимируешь, а выезд плашки — это одно преобразование, которое браузер
   * считает на композиторе и главный поток не трогает вовсе.
   *
   * Пока блок осыпается, головы нет: слово уже собрано и просто горит целиком.
   */
  const body = picking ? selection.slice(0, -1) : frozen;
  const head = picking ? selection[selection.length - 1] : undefined;
  const behind = picking && selection.length > 1 ? selection[selection.length - 2] : undefined;
  const picked =
    box.cell > 0 && body.length > 0
      ? outlinePath(
          body.map((i) => figure.cells[i]),
          pitch,
          pitch,
          -box.gap / 2,
          -box.gap / 2,
        )
      : '';

  /*
   * Плашка последней клетки. Размер и скругление повторяют то, что даёт контуру
   * его обводка: она расширяет многоугольник на половину своей толщины и на
   * столько же скругляет углы — иначе голова не сойдётся с телом заливки.
   * Хвост уходит назад, в предыдущую клетку: без него на стыке двух скруглённых
   * углов остаётся щербинка.
   */
  const crown = (() => {
    if (head === undefined || box.cell <= 0) return null;
    const cell = figure.cells[head];
    const edge = LIT_STROKE / 2;
    const tail = pitch * 0.6;
    let left = cell.x * pitch - box.gap / 2 - edge;
    let top = cell.y * pitch - box.gap / 2 - edge;
    let width = pitch + LIT_STROKE;
    let height = pitch + LIT_STROKE;
    let origin = '50% 50%';
    let axis: 'x' | 'y' | null = null;
    if (behind !== undefined) {
      const from = figure.cells[behind];
      if (cell.x > from.x) { left -= tail; width += tail; origin = '0% 50%'; axis = 'x'; }
      else if (cell.x < from.x) { width += tail; origin = '100% 50%'; axis = 'x'; }
      else if (cell.y > from.y) { top -= tail; height += tail; origin = '50% 0%'; axis = 'y'; }
      else if (cell.y < from.y) { height += tail; origin = '50% 100%'; axis = 'y'; }
    }
    // Стартовая доля: плашка начинается ровно там, где кончается уже залитое,
    // поэтому в первый кадр из-под тела ничего не торчит.
    const along = axis === 'x' ? width : height;
    return { head, left, top, width, height, origin, axis, from: (tail + LIT_STROKE) / along };
  })();

  /*
   * Выезд головы. Числами через `animate`, а не классом в css: у каждой клетки
   * своя стартовая доля, а кадры с переменными css браузер считает на главном
   * потоке каждый кадр. Здесь же едет одно преобразование — это композитор,
   * и на телефоне выезд ничего не стоит.
   */
  const crownKey = crown?.head;
  const crownAxis = crown?.axis ?? null;
  const crownFrom = crown?.from ?? 0;
  const litCount = selection.length;
  useLayoutEffect(() => {
    const node = crownRef.current;
    const before = grown.current;
    grown.current = litCount;
    if (!node || crownKey === undefined || typeof node.animate !== 'function') return;
    // Плашка одна на весь свайп, поэтому прошлый выезд снимаем: буквы идут
    // чаще, чем он успевает доиграть, и они копились бы на одном элементе.
    growth.current?.cancel();
    // Палец пошёл назад и снимает буквы — тут разгонять нечего. Клетка, в
    // которую заливка «въезжала бы», уже залита, и выезд на ней читается
    // дёрганьем: плашка каждый раз прыгает назад и наезжает заново.
    if (litCount <= before) return;
    const grow = crownAxis === 'x' ? 'scaleX' : crownAxis === 'y' ? 'scaleY' : null;
    growth.current = node.animate(
      grow
        ? [{ transform: `${grow}(${crownFrom})` }, { transform: `${grow}(1)` }]
        : // Первая буква слова: расти неоткуда, поэтому плашка всходит на месте.
          [{ transform: 'scale(0.55)', opacity: 0.2 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: CROWN_MS, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'backwards' },
    );
  }, [crownKey, crownAxis, crownFrom, litCount]);

  return (
    <div
      className={crumbling ? 'board crumbling' : 'board'}
      ref={ref}
      style={{ width: box.width, height: box.height }}
      onPointerDown={handleDown}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {/* Общая подложка под всеми плитками — фигура читается как одна деталь. */}
      {plate && (
        <svg className="plate" width={box.width} height={box.height}>
          {/* Светлая обводка идёт отдельным путём под деталью: на пёстром пейзаже
              кремовая плита без неё сливается то с небом, то с песком. */}
          <path className="rim" d={plate} />
          <path className="body" d={plate} />
        </svg>
      )}

      {/* Подсветка — отдельным слоем: деталь может осыпаться, а слово остаётся гореть. */}
      {picked && (
        <svg
          className={crumbling ? 'lit won' : 'lit'}
          width={box.width}
          height={box.height}
        >
          <path d={picked} />
        </svg>
      )}

      {/* Голова заливки: она и выезжает за пальцем в новую клетку. */}
      {crown && (
        <div
          ref={crownRef}
          className="lit-head"
          style={{
            left: crown.left,
            top: crown.top,
            width: crown.width,
            height: crown.height,
            borderRadius: LIT_STROKE / 2,
            transformOrigin: crown.origin,
          }}
        />
      )}

      {/* Вспышка по контуру собранного слова: разбегается наружу и рассеивается. */}
      {picked && crumbling && (
        <svg className="glow" width={box.width} height={box.height}>
          <path d={picked} />
        </svg>
      )}

      {/* Искры от вспышки: разлетаются от слова наружу и гаснут. */}
      {crumbling && box.cell > 0 && sparks(figure, taken, box.cell, pitch)}

      {figure.cells.map((cell, i) =>
        crumbling && !frozen.includes(i) ? null : (
          <div
            key={i}
            className={[
              'tile',
              selection.includes(i) ? 'picked' : '',
              hintCells.includes(i) ? 'hinted' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              left: cell.x * pitch,
              top: cell.y * pitch,
              width: box.cell,
              height: box.cell,
              fontSize: Math.round(box.cell * LETTER),
            }}
          >
            {cell.letter.toUpperCase()}
          </div>
        ),
      )}

      {/* Рассыпание: каждая клетка распадается на кусочки и разлетается. */}
      {flying.map((shard) => (
        <div
          key={shard.key}
          className="shard"
          style={{ left: shard.left, top: shard.top, width: shard.size, height: shard.size }}
        />
      ))}
    </div>
  );
}

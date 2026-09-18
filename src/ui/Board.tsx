import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Figure } from '../core/types.js';
import { outlinePath } from './outline.js';

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

      for (let k = 0; k < 2; k++) {
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

/**
 * Осколки фигуры. Каждая клетка, кроме клеток найденного слова, распадается
 * на девять кусочков.
 *
 * Полёт разложен по осям, иначе движение выглядит как рывок по прямой:
 * вбок кусочек уходит равномерно, вверх подлетает и тормозит, вниз падает
 * с ускорением — получается дуга. Вращение и затухание живут своим слоем,
 * потому что на одном элементе может быть только одно преобразование.
 */
function shards(figure: Figure, cell: number, pitch: number, taken: number[]) {
  const grid = 3;
  const size = Math.ceil(cell / grid);
  const step = (cell - size) / (grid - 1);
  const skip = new Set(taken);
  const pieces = [];

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

        const dx = cellDx + outX * (60 + jitter(seed) * 90) + (jitter(seed + 11) * 2 - 1) * 55;
        const up = -(cellUp + Math.max(0, -outY) * 30 + jitter(seed + 5) * 45);
        const dy = 300 + jitter(seed + 17) * 260 + outY * 20;
        const rot = (jitter(seed + 23) * 2 - 1) * 320;

        pieces.push(
          <div
            key={`${i}-${row}-${column}`}
            className="shard"
            style={{
              left: x * pitch + Math.round(column * step),
              top: y * pitch + Math.round(row * step),
              width: size,
              height: size,
              animationDelay: `${(i % 5) * 35 + jitter(seed + 3) * 80}ms`,
              ['--dx' as string]: `${Math.round(dx)}px`,
              ['--up' as string]: `${Math.round(up)}px`,
              ['--dy' as string]: `${Math.round(dy)}px`,
              ['--rot' as string]: `${Math.round(rot)}deg`,
            }}
          >
            <i>
              <b />
            </i>
          </div>,
        );
      }
    }
  }
  return pieces;
}

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

  /** Клетка под пальцем: считаем по сетке, поэтому зазоры тоже попадают в ближнюю плитку. */
  const cellAt = useCallback(
    (clientX: number, clientY: number): number | undefined => {
      const node = ref.current;
      if (!node) return undefined;
      const rect = node.getBoundingClientRect();
      const x = Math.floor(((clientX - rect.left) / rect.width) * figure.width);
      const y = Math.floor(((clientY - rect.top) / rect.height) * figure.height);
      return index.get(`${x},${y}`);
    },
    [figure, index],
  );

  const release = (): void => {
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
    ref.current?.setPointerCapture(event.pointerId);
    const cell = cellAt(event.clientX, event.clientY);
    if (cell !== undefined) onPick(cell);
  };

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (crumbling || selection.length === 0) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell !== undefined) onPick(cell);
  };

  const pitch = box.cell + box.gap;
  const plate =
    box.cell > 0 ? outlinePath(figure.cells, pitch, pitch, -box.gap / 2, -box.gap / 2) : '';
  // Пока фигура осыпается, клетки найденного слова стоят на месте и остаются
  // подсвеченными — слово «застывает» на секунду, и только потом буквы улетают.
  // Слово держится на месте, пока его буквы не улетели. Каждая улетевшая буква
  // забирает свою клетку с собой: плашка тает по кусочку, а не гаснет целиком
  // и не раскалывается вся разом — иначе на её месте видны швы и дыры.
  const frozen = crumbling ? taken.slice(departed) : [];
  const lit = selection.length > 0 ? selection : frozen;
  const picked =
    box.cell > 0 && lit.length > 0
      ? outlinePath(
          lit.map((i) => figure.cells[i]),
          pitch,
          pitch,
          -box.gap / 2,
          -box.gap / 2,
        )
      : '';

  return (
    <div
      className={crumbling ? 'board crumbling' : 'board'}
      ref={ref}
      style={{ width: box.width, height: box.height }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
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
              fontSize: Math.round(box.cell * 0.46),
            }}
          >
            {cell.letter.toUpperCase()}
          </div>
        ),
      )}

      {/* Рассыпание: каждая клетка распадается на четыре осколка и разлетается. */}
      {crumbling && box.cell > 0 && shards(figure, box.cell, pitch, taken)}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Figure } from '../core/types.js';
import { outlinePath } from './outline.js';
import { useUi } from './content.js';
import { Coin } from './Coin.js';

/** Размер клетки миниатюры по месту в очереди: ближняя крупнее дальних. */
const UNIT = [13.2, 12, 11.1, 10.5];
const FADE = [0.95, 0.72, 0.55, 0.42];
/** Габарит миниатюры: длинная фигура ужимается, чтобы полоса не разъезжалась. */
const MAX_SIDE = 51;
/** Зазор между миниатюрами — тот же, что в стилях. */
const GAP = 10;

/** Сторона клетки миниатюры на своём месте в очереди. */
function thumbUnit(figure: Figure, place: number): number {
  return Math.min(UNIT[place] ?? 10, MAX_SIDE / figure.width, MAX_SIDE / figure.height);
}

interface QueueProps {
  index: number;
  total: number;
  /** Фигуры, которые придут следом за текущей. */
  upcoming: Figure[];
}

/**
 * Очередь блоков под полем: какой блок идёт сейчас и что ждёт дальше.
 * Миниатюры рисуются тем же контуром, что и сама деталь, поэтому форму
 * следующего блока видно заранее — можно прикинуть, что там за слово.
 */
export function Queue({ index, total, upcoming }: QueueProps) {
  const ui = useUi();
  const ref = useRef<HTMLDivElement>(null);
  // Очередь занимает всё, что осталось в полосе после подсказки и счётчика.
  // На узком экране миниатюры целиком не влезают, поэтому ужимаем их все разом,
  // а не прячем дальние: форма следующих блоков должна быть видна всегда.
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = ref.current;
    const tray = node?.closest('.tray') as HTMLElement | null;
    if (!node || !tray) return;

    const fit = (): void => {
      const style = getComputedStyle(tray);
      const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const gap = parseFloat(style.columnGap) || 0;
      // Слева в полосе стоит группа кнопок (копилка и подсказка), а не одна
      // подсказка: мерить надо всю группу, иначе очередь вылезает за край.
      const left = tray.querySelector('.tray-left')?.getBoundingClientRect().width ?? 0;
      const label = tray.querySelector('.queue-label')?.getBoundingClientRect().width ?? 0;
      const room = tray.clientWidth - pad - left - label - gap * 2;
      // Ужимаются только сами миниатюры: зазоры между ними заданы в пикселях
      // и множителем не трогаются. Если считать их частью ужимаемой ширины,
      // очередь всё равно вылезает за край — ровно на несъеденные зазоры.
      const gaps = Math.max(0, upcoming.length - 1) * GAP;
      const natural = upcoming.reduce(
        (sum, figure, place) => sum + figure.width * thumbUnit(figure, place),
        0,
      );
      setScale(natural > 0 ? Math.min(1, (room - gaps) / natural) : 1);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(tray);
    return () => observer.disconnect();
  }, [upcoming]);

  return (
    <>
      <div className="queue-label">
        <span>{ui.blockWord}</span>
        <b>{ui.blockOf(index + 1, total)}</b>
      </div>

      {/* Ключ по номеру блока: при смене очередь заново въезжает справа. */}
      <div className="thumbs" key={index} ref={ref} style={{ ['--s' as string]: scale }}>
        {upcoming.map((figure, place) => {
          const unit = thumbUnit(figure, place);
          return (
            <svg
              key={place}
              className="thumb"
              viewBox={`-0.4 -0.4 ${figure.width + 0.8} ${figure.height + 0.8}`}
              style={{
                ['--w' as string]: `${figure.width * unit}px`,
                ['--h' as string]: `${figure.height * unit}px`,
                opacity: FADE[place] ?? 0.4,
              }}
            >
              {/* Два пути, как у самой детали: широкий тёмный кант снизу и кремовое
                  тело поверх. Скругление даёт именно обводка, поэтому у тела она
                  своя — без неё углы миниатюры выходят острыми. */}
              <path className="rim" d={outlinePath(figure.cells, 1, 1, 0, 0)} />
              <path className="body" d={outlinePath(figure.cells, 1, 1, 0, 0)} />
            </svg>
          );
        })}
      </div>
    </>
  );
}

/** Подсказка: слева от очереди, чтобы до неё дотягивался большой палец. */
export function HintButton({
  price,
  affordable,
  onClick,
}: {
  price: number;
  affordable: boolean;
  onClick: () => void;
}) {
  const ui = useUi();
  return (
    <button
      className={affordable ? 'hint' : 'hint poor'}
      onClick={onClick}
      title={ui.hintTitle}
    >
      <Bulb />
      {ui.hint}
      <span className="price">
        <Coin size={12} />
        {ui.hintCost(price)}
      </span>
    </button>
  );
}

/** Лампочка на кнопке подсказки: без иконки кнопка теряется в углу. */
function Bulb() {
  return (
    <svg viewBox="0 0 24 24" className="bulb" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0-3.4 10.9c.5.4.8 1 .9 1.6h5c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z" />
      <path d="M9.5 18.5h5" />
      <path d="M10.5 21h3" />
    </svg>
  );
}

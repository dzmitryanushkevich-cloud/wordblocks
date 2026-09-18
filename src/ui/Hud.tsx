import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { FoundEntry } from '../game/engine.js';
import { Fullscreen } from './Fullscreen.js';
import { useUi } from './content.js';
import { Coin } from './Coin.js';

/** Доля клетки, которую занимает буква на фигуре, — та же, что в Board. */
const TILE_GLYPH = 0.46;

export interface Flight {
  word: string;
  /** Центры плиток, с которых буквы стартуют, в координатах экрана. */
  points: { x: number; y: number }[];
  /** Размер клетки: буква взлетает ровно такой, какой лежала на фигуре. */
  size: number;
  /** Зазор между клетками: пока буква его перекрывает, слово выглядит цельной плашкой. */
  gap: number;
}

interface HudProps {
  letters: number;
  goal: number;
  found: FoundEntry[];
  flight: Flight | null;
  /** Последнее слово ещё «горит» на фигуре — в списке его пока не показываем. */
  hideLast: boolean;
  /** Монеты игрока: они же цена подсказки, поэтому видны всегда. */
  coins: number;
  /** Панель отладки: живёт в шапке, чтобы не занимать место в нижней полосе. */
  debug?: ReactNode;
  onMap: () => void;
}

/** Шапка: прогресс по буквам и найденные слова плитками, как в макете. */
export function Hud({ letters, goal, found, coins, flight, hideLast, debug, onMap }: HudProps) {
  const ui = useUi();
  const percent = Math.min(100, Math.round((letters / goal) * 100));
  // Кошелёк подпрыгивает на каждое изменение — иначе трату легко не заметить.
  const [bump, setBump] = useState(false);
  const known = useRef(coins);
  useLayoutEffect(() => {
    if (known.current === coins) return;
    known.current = coins;
    setBump(true);
    const timer = setTimeout(() => setBump(false), 460);
    return () => clearTimeout(timer);
  }, [coins]);
  return (
    <div className="hud">
      <div className="top-row">
        <button className="ghost back" onClick={onMap} title={ui.toMapTitle}>
          ←
        </button>
        {debug}
        <Fullscreen />
        <div className={bump ? 'wallet bump' : 'wallet'}>
          <Coin size={19} />
          {coins}
        </div>
      </div>

      <div className="words">
        {found.map((entry, i) =>
          hideLast && i === found.length - 1 ? null : (
            <WordChip
              key={`${entry.word}-${i}`}
              word={entry.word}
              from={i === found.length - 1 && flight?.word === entry.word ? flight.points : undefined}
              size={flight?.size}
              gap={flight?.gap}
            />
          ),
        )}
      </div>

      {/* Прогресс по буквам — под списком найденных слов. */}
      <div className="track">
        <i style={{ width: `${percent}%` }} />
        <div className="progress-label">
          {letters} / {goal}
        </div>
      </div>
    </div>
  );
}

/**
 * Слово в списке найденных. Если известно, с каких плиток оно взято,
 * буквы стартуют оттуда и по очереди прилетают на свои места.
 */
function WordChip({
  word,
  from,
  size,
  gap,
}: {
  word: string;
  from?: { x: number; y: number }[];
  size?: number;
  gap?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!from || !node) return;
    const spans = Array.from(node.querySelectorAll('span'));

    spans.forEach((span, i) => {
      const source = from[i];
      if (!source) return;
      const rect = span.getBoundingClientRect();
      const dx = source.x - (rect.left + rect.width / 2);
      const dy = source.y - (rect.top + rect.height / 2);

      // Буква стартует ровно в размер своей клетки и тут же уходит:
      // плашка под ней теряет эту клетку в тот же миг, так что дыры не возникает.
      const cell = size ? size / rect.width : 2.2;

      // Плитка растягивается до размера клетки вместе с буквой, а на фигуре буква
      // занимает меньшую долю квадрата — отсюда скачок кегля. Гасим его встречным
      // масштабом самого символа: на старте он ужат ровно во столько же раз.
      const chipFont = parseFloat(getComputedStyle(span).fontSize) || 13;
      const glyph = size ? (size * TILE_GLYPH) / (chipFont * cell) : 1;

      span.style.setProperty('--fx', `${dx}px`);
      span.style.setProperty('--fy', `${dy}px`);
      span.style.setProperty('--cell', `${cell}`);
      span.style.zIndex = '5';
      span.style.animation = `letter-fly 0.95s cubic-bezier(0.32, 0.72, 0.25, 1) ${i * 105}ms both`;

      const glyphNode = span.querySelector('i');
      if (glyphNode) {
        glyphNode.style.setProperty('--glyph', `${glyph}`);
        glyphNode.style.animation = `letter-glyph 0.95s cubic-bezier(0.32, 0.72, 0.25, 1) ${i * 105}ms both`;
      }
    });
  }, [from, size, gap]);

  return (
    <div className={from ? 'word flying' : 'word'} ref={ref}>
      {[...word].map((letter, i) => (
        <span key={i}>
          <i>{letter.toUpperCase()}</i>
        </span>
      ))}
    </div>
  );
}

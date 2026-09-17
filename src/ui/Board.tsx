import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Figure } from '../core/types.js';

interface BoardProps {
  figure: Figure;
  selection: number[];
  hintCell: number | null;
  crumbling: boolean;
  onPick: (cell: number) => void;
  onRelease: () => void;
}

/**
 * Поле с одной фигурой. Плитки разложены абсолютно по своим координатам,
 * поверх рисуется линия выделения. Ввод — pointer events, поэтому мышь
 * и палец работают одним и тем же кодом.
 */
export function Board({ figure, selection, hintCell, crumbling, onPick, onRelease }: BoardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  // Размер плитки задан в CSS через clamp, поэтому шаг сетки измеряем, а не считаем.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setBox({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
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

  const pitchX = box.width / figure.width;
  const pitchY = box.height / figure.height;
  const points = selection
    .map((cell) => {
      const c = figure.cells[cell];
      return `${(c.x + 0.5) * pitchX},${(c.y + 0.5) * pitchY}`;
    })
    .join(' ');

  return (
    <div
      className="board"
      ref={ref}
      style={{
        width: `calc(var(--cell) * ${figure.width} + var(--gap) * ${figure.width - 1})`,
        height: `calc(var(--cell) * ${figure.height} + var(--gap) * ${figure.height - 1})`,
      }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
    >
      {figure.cells.map((cell, i) => {
        const spread = ((i * 37) % 11) - 5;
        return (
          <div
            key={i}
            className={[
              'tile',
              selection.includes(i) ? 'picked' : '',
              hintCell === i ? 'hinted' : '',
              crumbling ? 'crumble' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              left: `calc((var(--cell) + var(--gap)) * ${cell.x})`,
              top: `calc((var(--cell) + var(--gap)) * ${cell.y})`,
              animationDelay: crumbling ? `${(i % 5) * 28}ms` : undefined,
              ['--dx' as string]: `${spread * 9}px`,
              ['--dy' as string]: `${60 + Math.abs(spread) * 6}px`,
              ['--rot' as string]: `${spread * 12}deg`,
            }}
          >
            {cell.letter.toUpperCase()}
          </div>
        );
      })}

      {/* Линия пути рисуется поверх плиток — так видно порядок букв. */}
      {selection.length > 1 && box.width > 0 && (
        <svg width={box.width} height={box.height}>
          <polyline points={points} />
        </svg>
      )}
    </div>
  );
}

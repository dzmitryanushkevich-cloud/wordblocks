import type { Figure } from '../core/types.js';
import { outlinePath } from './outline.js';

/** Размер клетки миниатюры по месту в очереди: ближняя крупнее дальних. */
const UNIT = [13.6, 11.5, 10, 9.4];
const FADE = [0.95, 0.75, 0.58, 0.45];
/** Габарит миниатюры: широкая фигура ужимается, чтобы не залезть на блок. */
const MAX_SIDE = 56;

interface QueueProps {
  index: number;
  total: number;
  /** Фигуры, которые придут следом за текущей. */
  upcoming: Figure[];
}

/**
 * Левая колонка: какая фигура идёт сейчас и что ждёт дальше.
 * Миниатюры рисуются тем же контуром, что и сама деталь, поэтому форму
 * следующей фигуры видно заранее — можно прикинуть, что там за слово.
 */
export function Queue({ index, total, upcoming }: QueueProps) {
  return (
    <div className="queue">
      <div className="queue-label">
        <span>Блок</span>
        <b>
          {index + 1} из {total}
        </b>
      </div>

      {/* Ключ по номеру фигуры: при смене колонка заново въезжает снизу. */}
      <div className="thumbs" key={index}>
        {upcoming.map((figure, place) => {
          const unit = Math.min(
            UNIT[place] ?? 9,
            MAX_SIDE / figure.width,
            MAX_SIDE / figure.height,
          );
          return (
            <svg
              key={place}
              className="thumb"
              viewBox={`-0.4 -0.4 ${figure.width + 0.8} ${figure.height + 0.8}`}
              style={{
                width: figure.width * unit,
                height: figure.height * unit,
                opacity: FADE[place] ?? 0.4,
              }}
            >
              <path d={outlinePath(figure.cells, 1, 1, 0, 0)} />
            </svg>
          );
        })}
      </div>
    </div>
  );
}

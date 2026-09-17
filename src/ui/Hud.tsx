import type { FoundEntry } from '../game/engine.js';
import { Fullscreen } from './Fullscreen.js';

interface HudProps {
  letters: number;
  goal: number;
  found: FoundEntry[];
  figuresLeft: number;
  onMap: () => void;
}

/** Шапка: прогресс по буквам и найденные слова плитками, как в макете. */
export function Hud({ letters, goal, found, figuresLeft, onMap }: HudProps) {
  const percent = Math.min(100, Math.round((letters / goal) * 100));
  return (
    <div className="hud">
      <div className="progress-row">
        <button className="ghost back" onClick={onMap} title="к карте уровней">
          ←
        </button>
        <div className="track">
          <i style={{ width: `${percent}%` }} />
          <div className="progress-label">
            {letters} / {goal}
          </div>
        </div>
        <Fullscreen />
        <div className="deck" title={`осталось фигур: ${figuresLeft}`}>
          <i />
          <i />
          <b>{figuresLeft}</b>
        </div>
      </div>

      <div className="words">
        {found.map((entry, i) => (
          <div className="word" key={`${entry.word}-${i}`}>
            {[...entry.word].map((letter, j) => (
              <span key={j}>{letter.toUpperCase()}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

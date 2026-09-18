import { useEffect, useState } from 'react';
import type { GameState } from '../game/engine.js';
import { currentFigure } from '../game/engine.js';

interface DebugProps {
  state: GameState;
  onReset: () => void;
}

/**
 * Панель отладки. В ней только два дела: посмотреть, какие слова лежат в блоке,
 * и сбросить прогресс. Всё остальное — сид, счётчики, авто-проход — было нужно,
 * пока настраивался генератор, а на глаз мешало.
 */
export function Debug({ state, onReset }: DebugProps) {
  const [open, setOpen] = useState(false);
  // Сброс спрашивает подтверждение вторым нажатием: промах по кнопке рядом
  // с «другим сидом» стоил бы всего пройденного. Через три секунды забывает.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  const figure = currentFigure(state);

  return (
    <>
      <button
        className="ghost debug-toggle"
        onClick={() => setOpen(!open)}
        title="отладка"
        aria-label="отладка"
      >
        <BugIcon />
      </button>
      {open && (
        <div className="debug">
          <div>
            слова блока:{' '}
            {figure.words.map((w) => (
              <span key={w.word}>
                {/* Жёлтым — слова не из темы: они не рассыпают блок, а идут в копилку. */}
                <code className={figure.scoring.includes(w.word) ? '' : 'alien'}>
                  {w.word.toUpperCase()}
                </code>{' '}
              </span>
            ))}
          </div>
          <div className="row">
            <button
              className={armed ? 'gold' : 'ghost'}
              onClick={() => {
                if (!armed) {
                  setArmed(true);
                  return;
                }
                setArmed(false);
                onReset();
              }}
            >
              {armed ? 'точно сбросить?' : 'сбросить прогресс'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Жук: общепринятый значок отладки. */
function BugIcon() {
  return (
    <svg viewBox="0 0 24 24" className="glyph" aria-hidden="true">
      <path d="M9.2 7.4a2.8 2.8 0 0 1 5.6 0" />
      <rect x="8" y="7.4" width="8" height="12.2" rx="4" />
      <path d="M8 11.2H4.6M16 11.2h3.4M8 15.4H4.6M16 15.4h3.4M9.6 5.2 8.2 3.2M14.4 5.2l1.4-2" />
      <path d="M12 8.4v10.8" />
    </svg>
  );
}

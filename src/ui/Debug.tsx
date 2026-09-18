import { useState } from 'react';
import type { GameState } from '../game/engine.js';
import { currentFigure } from '../game/engine.js';
import { BUILD } from './version.js';

interface DebugProps {
  state: GameState;
  onRegenerate: () => void;
  onSolve: () => void;
}

/** Панель отладки: сид, все слова фигуры, перегенерация уровня, авто-проход фигуры. */
export function Debug({ state, onRegenerate, onSolve }: DebugProps) {
  const [open, setOpen] = useState(false);
  const figure = currentFigure(state);

  return (
    <>
      <button className="ghost debug-toggle" onClick={() => setOpen(!open)}>
        отладка
      </button>
      {open && (
        <div className="debug">
          <div>
            сборка <code>{BUILD}</code>
          </div>
          <div>
            уровень <code>{state.level.index}</code>, сид <code>{state.level.seed}</code>
          </div>
          <div>
            цель <code>{state.level.goalLetters}</code> из{' '}
            <code>{state.level.maxLetters}</code>, собрано{' '}
            <code>{state.letters}</code>
          </div>
          <div>
            блок <code>{state.figureIndex + 1}</code> из{' '}
            <code>{state.level.figures.length}</code>, клеток{' '}
            <code>{figure.cells.length}</code>, попыток генерации{' '}
            <code>{figure.attempts}</code>
          </div>
          <div>
            якорь <code>{figure.anchor.toUpperCase()}</code>
          </div>
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
          <div>
            подсказок использовано: <code>{state.hintsUsed}</code>
          </div>
          <div className="row">
            <button onClick={onSolve}>взять якорь</button>
            <button onClick={onRegenerate}>другой сид</button>
          </div>
        </div>
      )}
    </>
  );
}

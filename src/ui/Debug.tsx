import { useState } from 'react';
import type { GameState } from '../game/engine.js';
import { currentFigure } from '../game/engine.js';

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
            уровень <code>{state.level.index}</code>, сид <code>{state.level.seed}</code>
          </div>
          <div>
            цель <code>{state.level.goalLetters}</code> из{' '}
            <code>{state.level.maxLetters}</code>, собрано{' '}
            <code>{state.letters}</code>
          </div>
          <div>
            фигура <code>{state.figureIndex + 1}</code> из{' '}
            <code>{state.level.figures.length}</code>, клеток{' '}
            <code>{figure.cells.length}</code>, попыток генерации{' '}
            <code>{figure.attempts}</code>
          </div>
          <div>
            якорь <code>{figure.anchor.toUpperCase()}</code>
          </div>
          <div>
            слова фигуры:{' '}
            {figure.words.map((w) => (
              <span key={w.word}>
                <code>{w.word.toUpperCase()}</code>{' '}
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

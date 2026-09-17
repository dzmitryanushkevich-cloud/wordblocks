import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDictionary } from '../core/loadDictionary.js';
import { generateLevel } from '../core/generator.js';
import {
  currentFigure,
  extendSelection,
  finishCrumble,
  releaseSelection,
  selectionWord,
  startLevel,
  useHint,
  type GameState,
} from '../game/engine.js';
import { loadSave, recordResult, type SaveData } from '../game/storage.js';
import { Board } from './Board.js';
import { Hud } from './Hud.js';
import { Debug } from './Debug.js';
import { letters, plural } from './plural.js';

const LEVEL_COUNT = 30;
const CRUMBLE_MS = 640;

export function App() {
  const dictionary = useMemo(() => getDictionary(), []);
  const [save, setSave] = useState<SaveData>(loadSave);
  const [game, setGame] = useState<GameState | null>(null);
  const [seedNudge, setSeedNudge] = useState(0);

  const openLevel = useCallback(
    (index: number, nudge = seedNudge) => {
      const level = generateLevel(dictionary, index, { gameSeed: 1 + nudge });
      setGame(startLevel(level));
    },
    [dictionary, seedNudge],
  );

  // Когда анимация рассыпания отыграла — переходим к следующей фигуре или к итогу.
  useEffect(() => {
    if (game?.phase !== 'crumbling') return;
    const timer = setTimeout(() => setGame((g) => (g ? finishCrumble(g) : g)), CRUMBLE_MS);
    return () => clearTimeout(timer);
  }, [game?.phase, game?.figureIndex]);

  // Итог уровня уходит в сохранение.
  useEffect(() => {
    if (!game || (game.phase !== 'won' && game.phase !== 'lost')) return;
    setSave((current) =>
      recordResult(
        current,
        game.level.index,
        game.letters,
        game.level.goalLetters,
        game.phase === 'won',
      ),
    );
  }, [game?.phase]);

  if (!game) {
    return <LevelMap save={save} onPick={(index) => openLevel(index)} />;
  }

  const figure = currentFigure(game);
  const draft = selectionWord(game);
  const draftKnown = draft.length >= 3 && dictionary.has(draft);

  const takeAnchor = () => {
    const path = figure.words.find((w) => w.word === figure.anchor)?.path ?? [];
    setGame((current) => {
      if (!current) return current;
      const withPath = { ...current, selection: path };
      return releaseSelection(withPath, dictionary).state;
    });
  };

  return (
    <>
      <Hud
        letters={game.letters}
        goal={game.level.goalLetters}
        found={game.found}
        figuresLeft={game.level.figures.length - game.figureIndex}
        onMap={() => setGame(null)}
      />

      <div className="stage">
        <div>
          <div className={draftKnown ? 'draft known' : 'draft'}>
            {[...draft].map((letter, i) => (
              <span key={i}>{letter.toUpperCase()}</span>
            ))}
          </div>
          <Board
            figure={figure}
            selection={game.selection}
            hintCell={game.hintCell}
            crumbling={game.phase === 'crumbling'}
            onPick={(cell) => setGame((g) => (g ? extendSelection(g, cell) : g))}
            onRelease={() =>
              setGame((g) => (g ? releaseSelection(g, dictionary).state : g))
            }
          />
        </div>
      </div>

      <div className="footer">
        <Debug
          state={game}
          onSolve={takeAnchor}
          onRegenerate={() => {
            const nudge = seedNudge + 1;
            setSeedNudge(nudge);
            openLevel(game.level.index, nudge);
          }}
        />
        <span>
          Фигура {game.figureIndex + 1} из {game.level.figures.length}
        </span>
        <button onClick={() => setGame((g) => (g ? useHint(g) : g))}>подсказка</button>
      </div>

      {(game.phase === 'won' || game.phase === 'lost') && (
        <Result
          state={game}
          onRetry={() => openLevel(game.level.index)}
          onNext={() => openLevel(game.level.index + 1)}
          onMap={() => setGame(null)}
        />
      )}
    </>
  );
}

interface LevelMapProps {
  save: SaveData;
  onPick: (index: number) => void;
}

function LevelMap({ save, onPick }: LevelMapProps) {
  return (
    <div className="screen">
      <h1>WordBlocks</h1>
      <p>
        В каждой фигуре спрятано несколько слов, но взять можно только одно: как только слово
        найдено, фигура рассыпается вместе с остальными. Прогресс уровня считается в буквах,
        поэтому короткое слово — это потерянные буквы. Пять фигур на уровень.
      </p>
      <p>Слово ведут свайпом по соседним плиткам: вверх, вниз, влево, вправо. Без диагоналей.</p>
      <div className="levels">
        {Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).map((index) => {
          const result = save.results[index];
          const locked = index > save.unlocked;
          return (
            <button
              key={index}
              className={['level-card', result?.passed ? 'done' : '', locked ? 'locked' : '']
                .filter(Boolean)
                .join(' ')}
              disabled={locked}
              onClick={() => onPick(index)}
            >
              <b>{index}</b>
              <small>{result ? `${result.bestLetters}/${result.goal}` : locked ? '🔒' : '—'}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ResultProps {
  state: GameState;
  onRetry: () => void;
  onNext: () => void;
  onMap: () => void;
}

function Result({ state, onRetry, onNext, onMap }: ResultProps) {
  const won = state.phase === 'won';
  return (
    <div className="overlay">
      <div className="card">
        <h2>{won ? 'Уровень пройден' : 'Не хватило букв'}</h2>
        <p>
          Собрано {letters(state.letters)} из {state.level.goalLetters} нужных. Максимум на этом
          уровне — {state.level.maxLetters}.
        </p>
        <div className="recap">
          {state.outcomes.map((outcome, i) => (
            <div key={i}>
              <span className="taken">
                {i + 1}. {outcome.taken.toUpperCase()}
              </span>
              <span className="missed">
                {outcome.missed.length
                  ? `упущено: ${outcome.missed.map((w) => w.toUpperCase()).join(', ')}`
                  : 'всё, что было'}
              </span>
            </div>
          ))}
        </div>
        {state.hintsUsed > 0 && (
          <p>
            {state.hintsUsed} {plural(state.hintsUsed, 'подсказка', 'подсказки', 'подсказок')}{' '}
            {plural(state.hintsUsed, 'использована', 'использовано', 'использовано')}.
          </p>
        )}
        <div className="row">
          {won ? (
            <button onClick={onNext}>следующий уровень</button>
          ) : (
            <button onClick={onRetry}>ещё раз</button>
          )}
          <button className="ghost" onClick={onMap}>
            к карте
          </button>
        </div>
      </div>
    </div>
  );
}

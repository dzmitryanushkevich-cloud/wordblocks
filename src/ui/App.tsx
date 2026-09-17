import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Hud, type Flight } from './Hud.js';
import { Debug } from './Debug.js';
import { Queue } from './Queue.js';
import { letters, plural } from './plural.js';
import { BUILD } from './version.js';

const LEVEL_COUNT = 30;
// Слово найдено → клетки слова застывают подсвеченными, вокруг осыпается фигура,
// и только через эту паузу буквы срываются в список.
const FREEZE_MS = 620;
/** Зазор между клетками — такой же, как в Board. */
const GAP = 6;
const LETTER_MS = 950;
const LETTER_STEP_MS = 105;
/** Сколько держим на экране отвергнутое слово: успеть покраснеть и вздрогнуть. */
const REJECT_MS = 700;

export function App() {
  const dictionary = useMemo(() => getDictionary(), []);
  const [save, setSave] = useState<SaveData>(loadSave);
  const [game, setGame] = useState<GameState | null>(null);
  const [seedNudge, setSeedNudge] = useState(0);
  // Откуда летят буквы последнего найденного слова — только для анимации.
  const [flight, setFlight] = useState<Flight | null>(null);
  const [departed, setDeparted] = useState(0);
  // Слово, которого нет в словаре: держим его на экране, пока оно краснеет и дрожит.
  const [rejected, setRejected] = useState<string | null>(null);
  const pending = useRef<Flight | null>(null);

  const openLevel = useCallback(
    (index: number, nudge = seedNudge) => {
      const level = generateLevel(dictionary, index, { gameSeed: 1 + nudge });
      setFlight(null);
      setDeparted(0);
      setRejected(null);
      pending.current = null;
      setGame(startLevel(level));
    },
    [dictionary, seedNudge],
  );

  // Порядок после найденного слова: пауза с подсветкой → полёт букв → следующая фигура.
  useEffect(() => {
    if (game?.phase !== 'crumbling') return;
    const word = game.lastWord ?? '';
    const flightMs = LETTER_MS + Math.max(0, word.length - 1) * LETTER_STEP_MS;

    const timers = [setTimeout(() => setFlight(pending.current), FREEZE_MS)];
    // Каждая буква забирает свою клетку в тот момент, когда сама срывается.
    for (let i = 0; i < word.length; i++) {
      timers.push(setTimeout(() => setDeparted(i + 1), FREEZE_MS + i * LETTER_STEP_MS));
    }
    timers.push(
      setTimeout(() => setGame((g) => (g ? finishCrumble(g) : g)), FREEZE_MS + flightMs + 120),
    );
    return () => timers.forEach(clearTimeout);
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
  const shown = draft || rejected || '';

  const takeAnchor = () => {
    const path = figure.words.find((w) => w.word === figure.anchor)?.path ?? [];
    const tiles = document.querySelectorAll('.board .tile');
    const size = tiles[0]?.getBoundingClientRect().width ?? 0;
    const points = path.map((cell) => {
      const rect = tiles[cell]?.getBoundingClientRect();
      return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 };
    });
    setGame((current) => {
      if (!current) return current;
      const result = releaseSelection({ ...current, selection: path }, dictionary);
      if (result.accepted) {
        // Полёт прошлого слова уже отыграл — гасим его, иначе новое слово
        // сочтут улетевшим и подсветка снимется мгновенно.
        setFlight(null);
        pending.current = { word: result.word, points, size, gap: GAP };
      }
      return result.state;
    });
  };

  const handleRelease = (points: { x: number; y: number }[], size: number) => {
    setGame((current) => {
      if (!current) return current;
      const result = releaseSelection(current, dictionary);
      if (result.accepted) {
        setFlight(null);
        setDeparted(0);
        setRejected(null);
        pending.current = { word: result.word, points, size, gap: GAP };
      } else if (result.word.length >= 2) {
        // Слова нет в словаре — показываем это отказом, а не молчанием.
        setRejected(result.word);
        setTimeout(() => setRejected(null), REJECT_MS);
      }
      return result.state;
    });
  };

  return (
    <>
      <Hud
        letters={game.letters}
        goal={game.level.goalLetters}
        found={game.found}
        figuresLeft={game.level.figures.length - game.figureIndex}
        flight={flight}
        hideLast={game.phase === 'crumbling' && flight === null}
        onMap={() => setGame(null)}
      />

      <div className="stage">
        <div className={rejected && !draft ? 'draft bad' : 'draft'}>
          {[...shown].map((letter, i) => (
            <span key={i}>{letter.toUpperCase()}</span>
          ))}
        </div>

        <div className="board-slot">
          <Queue
            index={game.figureIndex}
            total={game.level.figures.length}
            upcoming={game.level.figures.slice(game.figureIndex + 1)}
          />

          <div className="board-cell">
            <Board
              key={game.figureIndex}
              figure={figure}
              selection={game.selection}
              hintCell={game.hintCell}
              crumbling={game.phase === 'crumbling'}
              taken={game.lastPath}
              departed={departed}
              onPick={(cell) => setGame((g) => (g ? extendSelection(g, cell) : g))}
              onRelease={handleRelease}
            />
          </div>

          <span />
        </div>
      </div>

      <div className="footer">
        {/* Пока открыто окно итогов, панель отладки убираем: она его перекрывает. */}
        {game.phase === 'won' || game.phase === 'lost' ? (
          <span />
        ) : (
          <Debug
            state={game}
            onSolve={takeAnchor}
            onRegenerate={() => {
              const nudge = seedNudge + 1;
              setSeedNudge(nudge);
              openLevel(game.level.index, nudge);
            }}
          />
        )}
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
        В каждом блоке спрятано несколько слов, но взять можно только одно: как только слово
        найдено, блок рассыпается вместе с остальными. Прогресс уровня считается в буквах,
        поэтому короткое слово — это потерянные буквы. Пять блоков на уровень.
      </p>
      <p>Слово ведут свайпом по соседним плиткам: вверх, вниз, влево, вправо. Без диагоналей.</p>
      <p className="build">сборка {BUILD}</p>
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
  const played = state.outcomes.length;
  const total = state.level.figures.length;
  const early = played < total;

  return (
    <div className="overlay">
      <div className="card">
        <h2>{won ? 'Уровень пройден' : 'Не хватило букв'}</h2>
        <p>
          Собрано {letters(state.letters)} из {state.level.goalLetters} нужных.
          {won && early && ` Цель взята на ${played}-м блоке из ${total}.`}
          {!won && early && ` На оставшихся блоках цели было уже не достать, поэтому уровень
            закончен досрочно.`}
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

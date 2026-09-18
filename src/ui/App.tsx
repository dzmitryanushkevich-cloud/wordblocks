import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  applyResult,
  loadSave,
  spendCoins,
  type LevelOutcome,
  type SaveData,
} from '../game/storage.js';
import { Board } from './Board.js';
import { Hud, type Flight } from './Hud.js';
import { Debug } from './Debug.js';
import { Backdrop } from './Backdrop.js';
import { HintButton, Queue } from './Queue.js';
import { Coin, Confetti, Stars } from './Coin.js';
import { ChestBar } from './Chest.js';
import { BUILD } from './version.js';
import { levelTheme } from '../core/themes.js';
import { useContent, useUi } from './content.js';
import type { GameContent } from '../core/content.js';
import type { UiStrings } from '../content/types.js';
import { PACKS, rememberChoice } from '../content/index.js';

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
/** Цена подсказки в монетах. Бесплатная подсказка обесценивает поиск. */
const HINT_PRICE = 25;

export function App() {
  const content = useContent();
  const ui = useUi();
  const { dictionary, pack } = content;
  const [save, setSave] = useState<SaveData>(() => loadSave(pack.id));
  const [game, setGame] = useState<GameState | null>(null);
  const [seedNudge, setSeedNudge] = useState(0);
  // Откуда летят буквы последнего найденного слова — только для анимации.
  const [flight, setFlight] = useState<Flight | null>(null);
  const [departed, setDeparted] = useState(0);
  // Незачтённое слово держим на экране, пока оно отвечает отказом: красным,
  // если такого слова нет вовсе, и жёлтым, если слово есть, но не из темы уровня.
  const [rejected, setRejected] = useState<{ word: string; kind: 'unknown' | 'off-theme' } | null>(
    null,
  );
  const pending = useRef<Flight | null>(null);
  // Итог уровня считается один раз, в момент завершения: экран итогов
  // показывает именно его, а не разницу кошелька.
  const [outcome, setOutcome] = useState<LevelOutcome | null>(null);
  const [poor, setPoor] = useState(false);

  const openLevel = useCallback(
    (index: number, nudge = seedNudge) => {
      const level = generateLevel(content, index, { gameSeed: 1 + nudge });
      setFlight(null);
      setDeparted(0);
      setRejected(null);
      setOutcome(null);
      pending.current = null;
      setGame(startLevel(level));
    },
    [content, seedNudge],
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

  // Итог уровня уходит в сохранение, победа — ещё и в монеты.
  useEffect(() => {
    if (!game || (game.phase !== 'won' && game.phase !== 'lost')) return;
    const won = game.phase === 'won';
    // Безупречно — это когда в каждом блоке взято самое длинное слово и без подсказок.
    const perfect =
      won &&
      game.hintsUsed === 0 &&
      game.outcomes.every((o) => o.missed.every((w) => w.length <= o.taken.length));
    const result = applyResult(
      pack.id,
      save,
      game.level.index,
      game.letters,
      game.level.goalLetters,
      won,
      perfect,
    );
    setOutcome(result);
    setSave(result.save);
  }, [game?.phase]);

  if (!game) {
    // На карте за спиной стоит пейзаж той главы, до которой игрок дошёл.
    return (
      <>
        <Backdrop level={save.unlocked} />
        <LevelMap content={content} save={save} onPick={(index) => openLevel(index)} />
      </>
    );
  }

  const figure = currentFigure(game);
  const draft = selectionWord(game);
  const shown = draft || rejected?.word || '';

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

  /** Подсказка платная: списываем монеты только если она действительно новая. */
  const askHint = () => {
    if (!game || game.phase !== 'playing') return;
    if (save.coins < HINT_PRICE) {
      setPoor(true);
      setTimeout(() => setPoor(false), 1600);
      return;
    }
    const next = useHint(game);
    if (next.hintsUsed > game.hintsUsed) {
      setSave((current) => spendCoins(pack.id, current, HINT_PRICE));
    }
    setGame(next);
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
        // Отказ показываем, а не молчим: иначе непонятно, что свайп вообще засчитан.
        setRejected({ word: result.word, kind: result.status === 'off-theme' ? 'off-theme' : 'unknown' });
        setTimeout(() => setRejected(null), REJECT_MS);
      }
      return result.state;
    });
  };

  return (
    <>
      <Backdrop level={game.level.index} />
      <Hud
        letters={game.letters}
        goal={game.level.goalLetters}
        found={game.found}
        coins={save.coins}
        flight={flight}
        hideLast={game.phase === 'crumbling' && flight === null}
        debug={
          // Пока открыто окно итогов, панель отладки убираем: она его перекрывает.
          game.phase === 'won' || game.phase === 'lost' ? null : (
            <Debug
              state={game}
              onSolve={takeAnchor}
              onRegenerate={() => {
                const nudge = seedNudge + 1;
                setSeedNudge(nudge);
                openLevel(game.level.index, nudge);
              }}
            />
          )
        }
        onMap={() => setGame(null)}
      />

      <div className="stage">
        <div
          className={
            rejected && !draft ? `draft ${rejected.kind === 'off-theme' ? 'alien' : 'bad'}` : 'draft'
          }
        >
          {[...shown].map((letter, i) => (
            <span key={i}>{letter.toUpperCase()}</span>
          ))}
        </div>

        <div className="board-slot">
          {/* Что спрятано в этом блоке: категории уровня, которые в него попали. */}
          <div
            className={game.phase === 'playing' ? 'block-labels' : 'block-labels gone'}
            key={`labels-${game.figureIndex}`}
          >
            {figure.labels.join(' · ')}
          </div>

          <div className="board-cell">
            {/* Уровень доигран — поле убираем: блок уже рассыпался, и возвращать
                его на экран за окном итогов незачем. */}
            {game.phase !== 'won' && game.phase !== 'lost' && (
              <Board
                key={game.figureIndex}
                figure={figure}
                selection={game.selection}
                hintCells={game.hintCells}
                crumbling={game.phase === 'crumbling'}
                taken={game.lastPath}
                departed={departed}
                onPick={(cell) => setGame((g) => (g ? extendSelection(g, cell) : g))}
                onRelease={handleRelease}
              />
            )}
          </div>
        </div>
      </div>

      {/* Нижняя полоса: подсказка слева, очередь блоков по центру. */}
      <div className="tray">
        <HintButton price={HINT_PRICE} affordable={save.coins >= HINT_PRICE} onClick={askHint} />

        <Queue
          index={game.figureIndex}
          total={game.level.figures.length}
          upcoming={game.level.figures.slice(game.figureIndex + 1)}
        />

      </div>

      {poor && <div className="toast">{ui.notEnoughCoins}</div>}

      {(game.phase === 'won' || game.phase === 'lost') && (
        <Result
          ui={ui}
          state={game}
          outcome={outcome}
          onRetry={() => openLevel(game.level.index)}
          onNext={() => openLevel(game.level.index + 1)}
          onMap={() => setGame(null)}
        />
      )}
    </>
  );
}

interface LevelMapProps {
  content: GameContent;
  save: SaveData;
  onPick: (index: number) => void;
}

function LevelMap({ content, save, onPick }: LevelMapProps) {
  const ui = content.pack.ui;
  return (
    <div className="screen">
      <h1>{ui.title}</h1>
      <div className="intro">
        {ui.intro.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
        <p className="build">{ui.build(BUILD)}</p>
      </div>
      <LanguagePicker current={content.pack.id} />
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
              <em>{levelTheme(content.pack.themes, index).title}</em>
              <small>
                {result ? `${result.bestLetters}/${result.goal}` : locked ? ui.locked : ui.noResult}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Переключатель языка. Показывается, только когда в сборке больше одного пакета,
 * поэтому в одноязычной сборке его просто нет.
 */
function LanguagePicker({ current }: { current: string }) {
  if (PACKS.length < 2) return null;
  return (
    <div className="langs">
      {PACKS.map((pack) => (
        <button
          key={pack.id}
          className={pack.id === current ? 'lang on' : 'lang ghost'}
          onClick={() => {
            rememberChoice(pack.id);
            location.reload();
          }}
        >
          {pack.name}
        </button>
      ))}
    </div>
  );
}

interface ResultProps {
  ui: UiStrings;
  state: GameState;
  /** Что уровень принёс: награда, сундук. Показываем именно его, а не остаток. */
  outcome: LevelOutcome | null;
  onRetry: () => void;
  onNext: () => void;
  onMap: () => void;
}

function Result({ ui, state, outcome, onRetry, onNext, onMap }: ResultProps) {
  const won = state.phase === 'won';
  const played = state.outcomes.length;
  const total = state.level.figures.length;
  const early = played < total;
  const perfect =
    won &&
    state.hintsUsed === 0 &&
    state.outcomes.every((o) => o.missed.every((w) => w.length <= o.taken.length));

  return (
    <div className="overlay">
      {won && <Confetti />}
      <div className="card">
        {won && <Stars />}
        <h2>{won ? ui.won : ui.lost}</h2>
        {won && <p className="why">{perfect ? ui.perfect : ui.wellDone}</p>}
        {won && outcome && outcome.prize > 0 && (
          <div className="prize">
            <Coin size={26} />
            {ui.reward(outcome.prize)}
          </div>
        )}

        {won && outcome && <ChestBar outcome={outcome} ui={ui} />}
        {/* На победе всё лишнее убрано: это праздник, а не разбор партии.
            На поражении наоборот — важно понять, чего не хватило. */}
        {!won && (
          <p>
            {ui.collected(state.letters, state.level.goalLetters)}
            {early && ui.lostEarly}
          </p>
        )}

        <div className="row">
          {won ? (
            <button className="big" onClick={onNext}>
              {ui.next}
            </button>
          ) : (
            <button className="big" onClick={onRetry}>
              {ui.retry}
            </button>
          )}
          <button className="ghost" onClick={onMap}>
            {ui.toMap}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateLevel, generateRescue } from '../core/generator.js';
import {
  addRescue,
  canRescue,
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
  BONUS_GOAL,
  BONUS_REWARD,
  collectBonus,
  applyResult,
  loadSave,
  resetSave,
  spendCoins,
  type LevelOutcome,
  type SaveData,
} from '../game/storage.js';
import { Board } from './Board.js';
import { outlinePath } from './outline.js';
import { Hud, type Flight } from './Hud.js';
import { Debug } from './Debug.js';
import { Backdrop } from './Backdrop.js';
import { HintButton, Queue } from './Queue.js';
import { Coin, Confetti, Stars } from './Coin.js';
import { ChestBar } from './Chest.js';
import { BonusButton, BonusFlight, BonusPanel } from './Bonus.js';
import { BUILD } from './version.js';
import { levelTheme } from '../core/themes.js';
import { useContent, useUi } from './content.js';
import type { GameContent } from '../core/content.js';
import type { Figure } from '../core/types.js';
import type { UiStrings } from '../content/types.js';

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

/**
 * Уровень, на котором игра открывается: последний доступный. Сброшенный
 * прогресс — это `unlocked = 1`, поэтому отдельного случая для него нет.
 */
function latestLevel(content: GameContent, save: SaveData): GameState {
  const index = Math.min(Math.max(1, save.unlocked), LEVEL_COUNT);
  return startLevel(generateLevel(content, index, { gameSeed: 1 }));
}

export function App() {
  const content = useContent();
  const ui = useUi();
  const { dictionary, pack } = content;
  const [save, setSave] = useState<SaveData>(() => loadSave(pack.id));
  // Игра открывается сразу на последнем доступном уровне, а не на карте: игрок
  // почти всегда возвращается доигрывать, и лишний экран между ним и блоком —
  // это лишнее касание. Карта остаётся по кнопке «назад» в шапке.
  const [game, setGame] = useState<GameState | null>(() => latestLevel(content, save));
  const [seedNudge, setSeedNudge] = useState(0);
  // Счётчик запусков уровня: по нему интерфейс понимает, что партия новая.
  const [run, setRun] = useState(0);
  // Окно итогов уходит не мгновенно: сначала гаснет, и только потом меняется
  // уровень. Без этого следующий блок появлялся из-под ещё видимой карточки.
  const [leaving, setLeaving] = useState(false);
  // Откуда летят буквы последнего найденного слова — только для анимации.
  const [flight, setFlight] = useState<Flight | null>(null);
  const [departed, setDeparted] = useState(0);
  // Незачтённое слово держим на экране, пока оно отвечает отказом: красным,
  // если такого слова нет вовсе, и жёлтым, если слово есть, но не из темы уровня.
  const [rejected, setRejected] = useState<{
    word: string;
    kind: 'unknown' | 'off-theme';
    /** Слово уже лежит в копилке: второй раз оно ничего не приносит. */
    repeat?: boolean;
  } | null>(null);
  const pending = useRef<Flight | null>(null);
  // Итог уровня считается один раз, в момент завершения: экран итогов
  // показывает именно его, а не разницу кошелька.
  const [outcome, setOutcome] = useState<LevelOutcome | null>(null);
  const [poor, setPoor] = useState(false);
  // Блок «последнего шанса» готовим заранее, когда уровень проигран: кнопку
  // показываем только если этот блок правда может вытянуть партию.
  const [rescue, setRescue] = useState<Figure | null>(null);
  // Один шанс за уровень: иначе реклама превращается в бесконечные ходы.
  const [rescueUsed, setRescueUsed] = useState(false);
  // Копилка слов не из темы: открыта ли она и надо ли мигнуть звездой.
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusBump, setBonusBump] = useState(false);
  // Буквы слова, летящие в звезду: живут только на время анимации.
  const [bonusFlight, setBonusFlight] = useState<Flight | null>(null);

  const openLevel = useCallback(
    (index: number, nudge = seedNudge) => {
      const level = generateLevel(content, index, { gameSeed: 1 + nudge });
      setRun((current) => current + 1);
      setFlight(null);
      setDeparted(0);
      setRejected(null);
      setOutcome(null);
      setRescue(null);
      setRescueUsed(false);
      pending.current = null;
      setGame(startLevel(level));
    },
    [content, seedNudge],
  );

  /** Сброс прогресса из отладки: чистим сохранение и начинаем с первого уровня. */
  const resetProgress = useCallback(() => {
    const empty = resetSave(pack.id);
    setSave(empty);
    setBonusOpen(false);
    setSeedNudge(0);
    openLevel(1, 0);
  }, [openLevel, pack.id]);

  /*
   * Всё, что не зависит от выделения, получает постоянные ссылки. Игра держит
   * партию одним объектом состояния, и каждая буква свайпа его обновляет: без
   * этого шапка, очередь и задник перерисовывались бы на каждое движение пальца
   * вместе с полем, хотя показывают ровно то же самое. На телефоне это как раз
   * та работа, из-за которой выделение букв ощущается вязким.
   */
  const onMap = useCallback(() => setGame(null), []);
  const onLose = useCallback(
    () => setGame((current) => (current ? { ...current, phase: 'lost' as const } : current)),
    [],
  );
  const onPickCell = useCallback(
    (cell: number) => setGame((g) => (g ? extendSelection(g, cell) : g)),
    [],
  );
  const openBonus = useCallback(() => setBonusOpen(true), []);

  // Текущий блок: ссылка на него живёт, пока блок не сменится, — на неё
  // опираются и панель отладки, и мемоизация поля.
  const figure = game ? currentFigure(game) : null;
  const upcoming = useMemo(
    () => (game ? game.level.figures.slice(game.figureIndex + 1, game.figureIndex + 5) : []),
    [game?.level, game?.figureIndex],
  );
  // Пока открыто окно итогов, панель отладки убираем: она его перекрывает.
  const debugPanel = useMemo(
    () =>
      figure && game && game.phase !== 'won' && game.phase !== 'lost' ? (
        <Debug figure={figure} onLose={onLose} onReset={resetProgress} />
      ) : null,
    [figure, game?.phase, onLose, resetProgress],
  );

  // Уровень проигран — считаем, поможет ли ещё один блок. Лучшее, что он может
  // дать, — длина его якоря; если и с ней до цели не дотянуться, предлагать
  // нечего, и кнопки не будет.
  useEffect(() => {
    if (!game || game.phase !== 'lost' || rescueUsed) return;
    const figure = generateRescue(content, game.level.index);
    setRescue(canRescue(game, figure) ? figure : null);
  }, [game?.phase, game?.level.index, rescueUsed]);

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

  if (!game || !figure) {
    // На карте за спиной стоит пейзаж той главы, до которой игрок дошёл.
    return (
      <>
        <Backdrop level={save.unlocked} />
        <LevelMap content={content} save={save} onPick={(index) => openLevel(index)} />
      </>
    );
  }

  const draft = selectionWord(game);
  const shown = draft || rejected?.word || '';

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

  /** Закрыть окно итогов с затуханием и только потом сделать шаг.
      Обычная функция, а не хук: она объявлена после раннего возврата,
      и useCallback здесь ломает порядок хуков. */
  const leave = (action: () => void): void => {
    setLeaving(true);
    setTimeout(() => {
      setLeaving(false);
      action();
    }, 220);
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
        // Слово не из темы блок не рассыпает, но уходит в копилку. Если оно там
        // уже лежит, честно говорим «уже было»: второй раз оно ничего не приносит.
        const known = result.status === 'off-theme' && save.bonus.includes(result.word);
        setRejected({
          word: result.word,
          kind: result.status === 'off-theme' ? 'off-theme' : 'unknown',
          repeat: known,
        });
        setTimeout(() => setRejected(null), REJECT_MS);
        if (result.status === 'off-theme' && !known) {
          setSave((wallet) => collectBonus(pack.id, wallet, result.word).save);
          // Буквы улетают в звезду: находка должна дойти до копилки на глазах.
          setBonusFlight({ word: result.word, points, size, gap: GAP });
        }
      }
      return result.state;
    });
  };

  return (
    <>
      <Backdrop level={game.level.index} />
      <Hud
        run={run}
        level={game.level.index}
        letters={game.letters}
        goal={game.level.goalLetters}
        found={game.found}
        coins={save.coins}
        flight={flight}
        hideLast={game.phase === 'crumbling' && flight === null}
        debug={debugPanel}
        onMap={onMap}
      />

      <div className="stage">
        <div
          className={
            rejected && !draft ? `draft ${rejected.kind === 'off-theme' ? 'alien' : 'bad'}` : 'draft'
          }
          /* Сколько букв в слове — по этому числу буква ужимается по экрану. */
          style={{ ['--letters' as string]: Math.max(1, shown.length) }}
        >
          {[...shown].map((letter, i) => (
            <span key={i}>{letter.toUpperCase()}</span>
          ))}
          {/* Слово языка, но не из темы: блок стоит, а слово уходит в копилку. */}
          {rejected?.kind === 'off-theme' && !draft && (
            <em className="kept">{rejected.repeat ? ui.bonusAgain : ui.bonusFound}</em>
          )}
          {/* Первый уровень: пока игрок не повёл пальцем, на месте собираемого
              слова стоит подсказка, что вообще надо делать. Она гаснет с первой
              же буквой и возвращается с новым блоком. */}
          {game.level.index === 1 && game.phase === 'playing' && !shown && (
            <p className="tutor" key={`tutor-${game.figureIndex}`}>
              {ui.tutorHint}
            </p>
          )}
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
                onPick={onPickCell}
                onRelease={handleRelease}
              />
            )}
          </div>
        </div>
      </div>

      {/* Нижняя полоса: копилка и подсказка слева, очередь блоков по центру. */}
      <div className="tray">
        <div className="tray-left">
          <BonusButton
            count={game.bonus.length}
            ready={bonusBump}
            onClick={openBonus}
          />
          <HintButton price={HINT_PRICE} affordable={save.coins >= HINT_PRICE} onClick={askHint} />
        </div>

        <Queue
          index={game.figureIndex}
          total={game.level.figures.length}
          /* В очереди показываем не больше четырёх ближайших блоков: на поздних
             уровнях их семь, и все сразу ужимаются до нечитаемых крошек. */
          upcoming={upcoming}
        />

      </div>

      {poor && <div className="toast">{ui.notEnoughCoins}</div>}

      {bonusFlight && (
        <BonusFlight
          word={bonusFlight.word}
          points={bonusFlight.points}
          size={bonusFlight.size}
          onDone={() => {
            setBonusFlight(null);
            // Звезда мигает в момент прилёта, а не в момент свайпа.
            setBonusBump(true);
            setTimeout(() => setBonusBump(false), 600);
          }}
        />
      )}

      {bonusOpen && (
        <BonusPanel
          here={game.bonus}
          total={save.bonus.length}
          goal={BONUS_GOAL}
          reward={BONUS_REWARD}
          onClose={() => setBonusOpen(false)}
        />
      )}

      {(game.phase === 'won' || game.phase === 'lost') && (
        <Result
          ui={ui}
          state={game}
          outcome={outcome}
          leaving={leaving}
          onRetry={() => leave(() => openLevel(game.level.index))}
          onNext={() => leave(() => openLevel(game.level.index + 1))}
          rescue={rescue}
          onRescue={() => {
            const figure = rescue;
            if (!figure) return;
            setRescueUsed(true);
            setRescue(null);
            leave(() => {
              setOutcome(null);
              setGame((current) => (current ? addRescue(current, figure) : current));
            });
          }}
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
              /* Категории уровня — в подсказке, а не на карточке: их пять,
                 и списком они превращают карту в стену текста. Игрок всё равно
                 видит категорию над каждым блоком, когда играет. */
              title={levelTheme(content.pack.themes, index).title}
            >
              <b>{index}</b>
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

interface ResultProps {
  ui: UiStrings;
  state: GameState;
  /** Что уровень принёс: награда, сундук. Показываем именно его, а не остаток. */
  outcome: LevelOutcome | null;
  /** Окно уже гаснет: кнопки в этот момент трогать нечего. */
  leaving: boolean;
  onRetry: () => void;
  onNext: () => void;
  /** Блок, который даст реклама. null — значит он не спасёт, и кнопки нет. */
  rescue: Figure | null;
  onRescue: () => void;
}

function Result({ ui, state, outcome, leaving, onRetry, onNext, rescue, onRescue }: ResultProps) {
  const won = state.phase === 'won';
  const played = state.outcomes.length;
  const total = state.level.figures.length;
  const early = played < total;
  const perfect =
    won &&
    state.hintsUsed === 0 &&
    state.outcomes.every((o) => o.missed.every((w) => w.length <= o.taken.length));

  return (
    <div className={leaving ? 'overlay out' : 'overlay'}>
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
        {/* На поражении показываем ту же шкалу, что в шапке: словами «не хватило»
            звучит абстрактно, а полоска сразу показывает, насколько именно. */}
        {!won && (
          <>
            <div className="track">
              <i style={{ width: `${Math.min(100, Math.round((state.letters / state.level.goalLetters) * 100))}%` }} />
              <div className="progress-label">
                {state.letters} / {state.level.goalLetters}
              </div>
            </div>
            <p className="why-lost">
              {ui.collected(state.letters, state.level.goalLetters)}
              {early && ui.lostEarly}
            </p>
          </>
        )}

        {/* Последний шанс: блок за рекламу. Кнопка появляется только когда этот
            блок правда доводит до цели — обещать спасение и не спасти хуже,
            чем не обещать. */}
        {!won && rescue && (
          <button className="rescue" onClick={onRescue}>
            <AdIcon />
            <b>{ui.lastChance}</b>
            <span className="prize-block">
              <svg
                viewBox={`-0.4 -0.4 ${rescue.width + 0.8} ${rescue.height + 0.8}`}
                style={{ ['--w' as string]: `${rescue.width}`, ['--h' as string]: `${rescue.height}` }}
              >
                <path className="rim" d={outlinePath(rescue.cells, 1, 1, 0, 0)} />
                <path className="body" d={outlinePath(rescue.cells, 1, 1, 0, 0)} />
              </svg>
              <i>{ui.plusBlock}</i>
            </span>
          </button>
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
          {/* Кнопки к карте в окне итогов нет ни в победе, ни в поражении:
              в ряду должно стоять одно действие, а уйти на карту можно
              домиком в шапке. */}
        </div>
      </div>
    </div>
  );
}

/** Значок рекламного ролика: экран с треугольником «плей». */
function AdIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ad-icon" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="3.2" />
      <path d="M10 9.4 15.2 12 10 14.6z" className="play" />
    </svg>
  );
}

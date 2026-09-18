import { useLayoutEffect, useRef } from 'react';
import { useUi } from './content.js';
import { Coin } from './Coin.js';

/**
 * Копилка слов не из темы. Слово языка, которое не входит в категории уровня,
 * блок не рассыпает — но игрок его нашёл, и пропадать ему незачем. Такие слова
 * копятся здесь, и каждая полная двадцатка приносит монеты.
 *
 * Это единственная награда в игре, не связанная с целью уровня: она платит
 * за наблюдательность и заодно объясняет жёлтый отказ — слово не потеряно.
 */
export function BonusButton({
  count,
  ready,
  onClick,
}: {
  /** Сколько всего слов в копилке: она общая на всю игру, а не на уровень. */
  count: number;
  /** Подсветить: только что добавилось слово. */
  ready: boolean;
  onClick: () => void;
}) {
  const ui = useUi();
  return (
    <button
      className={ready ? 'bonus bump' : 'bonus'}
      onClick={onClick}
      title={ui.bonusButtonTitle}
    >
      <Star />
      {count > 0 && <b>{count}</b>}
    </button>
  );
}

interface PanelProps {
  /** Слова этого уровня — в порядке находки, как в жанре принято. */
  here: readonly string[];
  /** Сколько всего в копилке за всю игру: она общая, просто показываем числом. */
  total: number;
  goal: number;
  reward: number;
  onClose: () => void;
}

export function BonusPanel({ here, total, goal, reward, onClose }: PanelProps) {
  const ui = useUi();
  // Полоска считает текущую двадцатку, а не всю копилку: иначе к сотому слову
  // она перестаёт двигаться на глазах.
  const inRound = total % goal;
  // В окне — только этот уровень: копилка общая и растёт всю игру, но список
  // за сотню слов ничего не сообщает, а «что я нашёл здесь» читается сразу.
  const words = [...here].reverse();
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card bonus-card" onClick={(event) => event.stopPropagation()}>
        <h2>{ui.bonusTitle}</h2>
        <p className="why">{ui.bonusTotal(total)}</p>

        <div className="bonus-here">
          <span>{ui.bonusHere}</span>
          {words.length === 0 ? (
            <p className="bonus-empty">{ui.bonusEmpty}</p>
          ) : (
            <div className="bonus-words">
              {words.map((word) => (
                <i key={word}>{word.toUpperCase()}</i>
              ))}
            </div>
          )}
        </div>

        <div className="chest-row">
          <div className="chest-bar">
            <i style={{ width: `${(inRound / goal) * 100}%` }} />
            <b>{ui.bonusProgress(inRound, goal)}</b>
          </div>
          <div className="bonus-prize">
            <Coin size={26} />
            <span>{reward}</span>
          </div>
        </div>

        <div className="row">
          <button className="big" onClick={onClose}>
            {ui.bonusClose}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Звезда на кнопке: та же, что на экране победы, но одна и поменьше. */
function Star() {
  return (
    <svg viewBox="0 0 24 24" className="star-icon" aria-hidden="true">
      <path
        d="M12 2.6l2.9 6.1 6.7.9-4.9 4.6 1.2 6.6L12 17.7 6.1 20.8l1.2-6.6L2.4 9.6l6.7-.9z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Сколько летит одна буква и через сколько стартует следующая. */
const FLY_MS = 620;
const FLY_STEP_MS = 70;

/**
 * Полёт слова в копилку: буквы срываются со своих клеток и уходят в звезду.
 * Без этого находка выглядела как отказ — слово мигнуло золотом и пропало,
 * а куда именно оно «зачтено», игрок должен был догадаться сам.
 */
export function BonusFlight({
  word,
  points,
  size,
  onDone,
}: {
  word: string;
  /** Центры клеток, с которых стартуют буквы, в координатах экрана. */
  points: { x: number; y: number }[];
  /** Размер клетки: буква взлетает ровно такой, какой лежала на фигуре. */
  size: number;
  onDone: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const star = document.querySelector('.bonus')?.getBoundingClientRect();
    const target = star
      ? { x: star.left + star.width / 2, y: star.top + star.height / 2 }
      : { x: 40, y: window.innerHeight - 60 };

    node.querySelectorAll('span').forEach((span, i) => {
      const from = points[i];
      if (!from) return;
      span.style.setProperty('--tx', `${target.x - from.x}px`);
      span.style.setProperty('--ty', `${target.y - from.y}px`);
      span.style.animation = `bonus-fly ${FLY_MS}ms cubic-bezier(0.4, 0, 0.3, 1) ${
        i * FLY_STEP_MS
      }ms both`;
    });

    const timer = setTimeout(onDone, FLY_MS + word.length * FLY_STEP_MS);
    return () => clearTimeout(timer);
  }, [points, word, onDone]);

  return (
    <div className="bonus-flight" ref={ref}>
      {[...word].map((letter, i) => (
        <span
          key={i}
          style={{
            left: points[i]?.x ?? 0,
            top: points[i]?.y ?? 0,
            width: size,
            height: size,
            fontSize: Math.round(size * 0.46),
          }}
        >
          {letter.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

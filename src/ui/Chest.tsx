import { useEffect, useState } from 'react';
import type { LevelOutcome } from '../game/storage.js';
import type { UiStrings } from '../content/types.js';
import { Coin } from './Coin.js';

/**
 * Сундук между уровнями: каждый новый пройденный уровень двигает полоску,
 * на последнем шаге сундук открывается и высыпает горсть монет. Это повод
 * сыграть ещё один уровень прямо сейчас, а не отложить игру.
 */
export function ChestBar({ outcome, ui }: { outcome: LevelOutcome; ui: UiStrings }) {
  const { chestFrom, chestTo, chestGoal, chestBonus } = outcome;
  // Полоска заполняется на глазах: сначала рисуем «как было», потом «как стало».
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFilled(true), 650);
    return () => clearTimeout(timer);
  }, []);

  const shown = filled ? chestTo : chestFrom;
  const percent = Math.min(100, (shown / chestGoal) * 100);
  const open = filled && chestBonus > 0;

  return (
    <div className="chest-row">
      <div className="chest-bar">
        <i style={{ width: `${percent}%` }} />
        {/* Когда сундук полон, полоска сама объявляет награду — так надпись
            не лезет за край карточки и читается сразу. */}
        <b>
          {open ? (
            <>
              <Coin size={16} />
              {ui.reward(chestBonus)}
            </>
          ) : (
            `${Math.min(shown, chestGoal)}/${chestGoal}`
          )}
        </b>
      </div>

      <div className={open ? 'chest open' : 'chest'}>
        <ChestIcon open={open} />
      </div>
    </div>
  );
}

function ChestIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 40 34" width="46" height="39" aria-hidden="true">
      {/* крышка */}
      <g className="lid">
        <path
          d="M4 14V11a16 11 0 0 1 32 0v3z"
          fill="#c98a3c"
          stroke="#8f5a1d"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <rect x="17" y="10" width="6" height="6" rx="1.4" fill="#f0c33c" stroke="#8f5a1d" strokeWidth="1.4" />
      </g>
      {/* короб */}
      <path
        d="M4 14h32v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"
        fill="#b8792f"
        stroke="#8f5a1d"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect x="16.5" y="16" width="7" height="9" rx="1.6" fill="#f0c33c" stroke="#8f5a1d" strokeWidth="1.4" />
      {open && <circle cx="20" cy="9" r="13" fill="#ffe9a8" opacity="0.18" />}
    </svg>
  );
}

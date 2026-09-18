/**
 * Монета: плоский жёлто-оранжевый кружок с тёмной гранью снизу — тем же приёмом,
 * что и кнопки игры. Объём даёт грань, а не блики и чеканка: на размере
 * в полтора десятка пикселей от градиентов остаётся только грязь.
 */
export function Coin({ size = 22 }: { size?: number }) {
  return (
    <svg className="coin" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {/* Толщина монеты: тот же кружок, сдвинутый вниз и потемнее. */}
      <circle cx="12" cy="13.4" r="10.3" fill="#c26f12" />
      <circle cx="12" cy="11.2" r="10.3" fill="#ffc63c" />
      {/* Плоское поле внутри и ромб на нём — чтобы монета читалась монетой. */}
      <circle cx="12" cy="11.2" r="7.1" fill="#ffdd7d" />
      <path d="M12 7.5 15.5 11.2 12 14.9 8.5 11.2z" fill="#f2a01f" />
    </svg>
  );
}

/** Конфетти за карточкой итогов: полтора десятка бумажек в палитре игры. */
export function Confetti() {
  const colors = ['#f7f3dd', '#b3e874', '#f0c33c', '#8fd14f', '#ffe9a8'];
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 5.7 + (i % 3) * 7) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 6) * 0.22}s`,
            animationDuration: `${2.2 + (i % 4) * 0.45}s`,
            transform: `rotate(${i * 37}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/** Три звезды победы. Всегда три: это праздник, а не оценка. */
export function Stars() {
  return (
    <div className="stars" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={i === 1 ? 'star big' : 'star'}>
          <defs>
            <linearGradient id={`star-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffe483" />
              <stop offset="55%" stopColor="#ffc93c" />
              <stop offset="100%" stopColor="#f0a32a" />
            </linearGradient>
          </defs>
          <path
            d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z"
            fill={`url(#star-${i})`}
            stroke="#c4801a"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Блик — он и превращает плоскую звезду в наклейку. */}
          <path d="M12 5.2l1.7 3.5-3.9.6z" fill="#fff3bd" opacity="0.85" />
        </svg>
      ))}
    </div>
  );
}

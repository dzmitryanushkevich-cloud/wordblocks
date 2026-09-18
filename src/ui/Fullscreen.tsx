import { useEffect, useState } from 'react';
import { useUi } from './content.js';

/** Блокировка поворота живёт не во всех браузерах и на десктопе всегда отказывает. */
type Lockable = ScreenOrientation & {
  lock?: (orientation: 'portrait') => Promise<void>;
  unlock?: () => void;
};

const orientation = () => (typeof screen !== 'undefined' ? (screen.orientation as Lockable | undefined) : undefined);

/**
 * Разворот во весь экран. На Android так прячется панель браузера,
 * которая иначе съедает низ экрана. Где API не поддержан (iPhone) — кнопки просто нет.
 *
 * Вместе с полным экраном закрепляем книжную ориентацию: часть мобильных браузеров
 * во весь экран уходит в альбом вслед за датчиком поворота, а игра рассчитана
 * на вертикальный экран — в альбоме блок не помещается по высоте.
 */
export function Fullscreen() {
  const ui = useUi();
  const [active, setActive] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(Boolean(document.fullscreenEnabled));
    const sync = () => {
      const on = Boolean(document.fullscreenElement);
      setActive(on);
      // Выйти могли и системной кнопкой «назад», минуя нашу — замок снимаем здесь.
      if (!on) orientation()?.unlock?.();
    };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  if (!available) return null;

  const toggle = () => {
    if (document.fullscreenElement) {
      orientation()?.unlock?.();
      void document.exitFullscreen();
      return;
    }
    void document.documentElement
      .requestFullscreen()
      // Замок разрешён только внутри полного экрана, поэтому просим его после.
      // Отказ не мешает играть: браузер просто оставит поворот на усмотрение датчика.
      .then(() => orientation()?.lock?.('portrait')?.catch(() => undefined))
      .catch(() => setAvailable(false));
  };

  return (
    <button
      className="ghost"
      onClick={toggle}
      title={active ? ui.fullscreenExit : ui.fullscreenTitle}
      aria-label={active ? ui.fullscreenExit : ui.fullscreen}
    >
      {active ? <ShrinkIcon /> : <ExpandIcon />}
    </button>
  );
}

/** Стрелки в углы: развернуть. */
function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="glyph" aria-hidden="true">
      <path d="M4 9.5V4h5.5M20 9.5V4h-5.5M4 14.5V20h5.5M20 14.5V20h-5.5" />
    </svg>
  );
}

/** Стрелки к центру: свернуть. */
function ShrinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="glyph" aria-hidden="true">
      <path d="M9.5 4v5.5H4M14.5 4v5.5H20M9.5 20v-5.5H4M14.5 20v-5.5H20" />
    </svg>
  );
}

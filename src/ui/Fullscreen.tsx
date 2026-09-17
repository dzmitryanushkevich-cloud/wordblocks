import { useEffect, useState } from 'react';

/**
 * Разворот во весь экран. На Android так прячется панель браузера,
 * которая иначе съедает низ экрана. Где API не поддержан (iPhone) — кнопки просто нет.
 */
export function Fullscreen() {
  const [active, setActive] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(Boolean(document.fullscreenEnabled));
    const sync = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  if (!available) return null;

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => setAvailable(false));
  };

  return (
    <button className="ghost icon" onClick={toggle} title={active ? 'выйти из полного экрана' : 'во весь экран'}>
      {active ? '⤡' : '⤢'}
    </button>
  );
}

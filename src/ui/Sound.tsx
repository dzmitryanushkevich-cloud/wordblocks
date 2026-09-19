import { useState } from 'react';
import { useUi } from './content.js';
import { muteSound, primeSound, soundMuted } from './audio.js';

/**
 * Выключатель звука в шапке. Играют в метро и перед сном, поэтому глушилка
 * обязана быть на экране, а не в настройках, которых у игры нет. Выбор живёт
 * в том же хранилище, что и прогресс, и переживает перезагрузку.
 */
export function Sound() {
  const ui = useUi();
  const [muted, setMuted] = useState(soundMuted);
  return (
    <button
      className="ghost"
      onClick={() => {
        // Нажатие — законный повод завести звук: браузер разрешает только так.
        if (muted) primeSound();
        muteSound(!muted);
        setMuted(!muted);
      }}
      title={muted ? ui.soundOn : ui.soundOff}
      aria-label={muted ? ui.soundOn : ui.soundOff}
    >
      {muted ? <MutedIcon /> : <SpeakerIcon />}
    </button>
  );
}

/** Динамик с волнами. */
function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="glyph" aria-hidden="true">
      <path d="M4 9.5h3l4.5-3.8v12.6L7 14.5H4z" />
      <path d="M15.4 9a4 4 0 0 1 0 6" />
      <path d="M18.2 6.6a7.4 7.4 0 0 1 0 10.8" />
    </svg>
  );
}

/** Тот же динамик, но волны перечёркнуты. */
function MutedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="glyph" aria-hidden="true">
      <path d="M4 9.5h3l4.5-3.8v12.6L7 14.5H4z" />
      <path d="M15.6 9.8l4.8 4.4M20.4 9.8l-4.8 4.4" />
    </svg>
  );
}

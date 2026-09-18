import { useEffect, useState } from 'react';
import { sceneFor, type Scene } from './scenes.js';

interface BackdropProps {
  /** Номер уровня: по нему выбирается глава, а значит и картинка. */
  level: number;
}

/** Длительность перехода между главами; столько же стоит в css (.sky). */
const FADE_MS = 900;

/**
 * Задник игры. Картинок две только в момент смены главы: новая проявляется
 * поверх старой, иначе на её месте на полсекунды зияла бы голая заливка.
 */
export function Backdrop({ level }: BackdropProps) {
  const scene = sceneFor(level);
  const [layers, setLayers] = useState<Scene[]>([scene]);

  useEffect(() => {
    setLayers((current) => {
      const last = current[current.length - 1];
      if (last.id === scene.id) return current;
      return [last, scene];
    });
    const timer = setTimeout(() => setLayers([scene]), FADE_MS);
    return () => clearTimeout(timer);
  }, [scene.id]);

  return (
    <div className="backdrop">
      {layers.map((layer, i) => (
        <div
          key={layer.id}
          className={i === layers.length - 1 && layers.length > 1 ? 'sky fade' : 'sky'}
          style={{ backgroundImage: layer.image }}
        />
      ))}
    </div>
  );
}

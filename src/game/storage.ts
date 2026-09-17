export interface LevelResult {
  passed: boolean;
  bestLetters: number;
  goal: number;
}

export interface SaveData {
  unlocked: number;
  results: Record<number, LevelResult>;
}

const KEY = 'wordblocks.save.v1';
const EMPTY: SaveData = { unlocked: 1, results: {} };

/**
 * Прогресс в localStorage. При открытии файла с диска браузер может запретить
 * хранилище — тогда игра просто работает без сохранения, поэтому всё в try/catch.
 */
export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as SaveData;
    return {
      unlocked: Math.max(1, Number(parsed.unlocked) || 1),
      results: parsed.results ?? {},
    };
  } catch {
    return { ...EMPTY };
  }
}

export function storeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Хранилище недоступно — молча играем без прогресса.
  }
}

export function recordResult(
  data: SaveData,
  level: number,
  letters: number,
  goal: number,
  passed: boolean,
): SaveData {
  const previous = data.results[level];
  const next: SaveData = {
    unlocked: passed ? Math.max(data.unlocked, level + 1) : data.unlocked,
    results: {
      ...data.results,
      [level]: {
        passed: passed || previous?.passed || false,
        bestLetters: Math.max(letters, previous?.bestLetters ?? 0),
        goal,
      },
    },
  };
  storeSave(next);
  return next;
}

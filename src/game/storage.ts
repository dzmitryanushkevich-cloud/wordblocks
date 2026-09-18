export interface LevelResult {
  passed: boolean;
  bestLetters: number;
  goal: number;
}

export interface SaveData {
  unlocked: number;
  /** Монеты: копятся за пройденные уровни и тратятся на подсказки. */
  coins: number;
  /** Сколько новых уровней уже сложено в сундук: на десятом он открывается. */
  chest: number;
  results: Record<number, LevelResult>;
  /**
   * Копилка слов не из темы: все, что игрок нашёл по пути, без повторов.
   * Хранится списком, а не числом, чтобы одно и то же слово не приносило
   * монеты дважды — иначе выгодно было бы переигрывать один блок.
   */
  bonus: string[];
}

/** Стартовый кошелёк: хватает на две подсказки, дальше зарабатывай. */
export const START_COINS = 50;
/** Сундук: копится по уровням и разом высыпает горсть монет. */
export const CHEST_GOAL = 10;
export const CHEST_REWARD = 100;
/** Копилка слов не из темы: каждые двадцать слов приносят монеты. */
export const BONUS_GOAL = 20;
export const BONUS_REWARD = 20;

/** Прогресс отдельный на каждый язык: уровни и слова в них разные. */
const key = (lang: string): string => `wordblocks.save.${lang}.v1`;
const EMPTY: SaveData = { unlocked: 1, coins: START_COINS, chest: 0, results: {}, bonus: [] };

/**
 * Прогресс в localStorage. При открытии файла с диска браузер может запретить
 * хранилище — тогда игра просто работает без сохранения, поэтому всё в try/catch.
 */
export function loadSave(lang: string): SaveData {
  try {
    const raw = localStorage.getItem(key(lang));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as SaveData;
    return {
      unlocked: Math.max(1, Number(parsed.unlocked) || 1),
      // Старые сохранения монет не знали — выдаём стартовый кошелёк.
      coins: Number.isFinite(parsed.coins) ? Math.max(0, Math.round(parsed.coins)) : START_COINS,
      chest: Number.isFinite(parsed.chest) ? Math.max(0, Math.round(parsed.chest)) % CHEST_GOAL : 0,
      results: parsed.results ?? {},
      bonus: Array.isArray(parsed.bonus) ? parsed.bonus.filter((w) => typeof w === 'string') : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

export function storeSave(lang: string, data: SaveData): void {
  try {
    localStorage.setItem(key(lang), JSON.stringify(data));
  } catch {
    // Хранилище недоступно — молча играем без прогресса.
  }
}

/**
 * Сброс прогресса: чистим запись и возвращаем пустое сохранение. Нужен отладке,
 * чтобы проверять первые уровни и экономику с чистого листа, не роясь в хранилище.
 */
export function resetSave(lang: string): SaveData {
  try {
    localStorage.removeItem(key(lang));
  } catch {
    // Хранилище недоступно — в памяти всё равно начинаем сначала.
  }
  return { ...EMPTY };
}

/** Что уровень принёс игроку: это же показывает экран итогов. */
export interface LevelOutcome {
  save: SaveData;
  /** Монеты за сам уровень. */
  prize: number;
  /** Сундук до и после уровня, чтобы полоску можно было заполнить на глазах. */
  chestFrom: number;
  chestTo: number;
  chestGoal: number;
  /** Монеты за открытый сундук: ноль, пока он не полон. */
  chestBonus: number;
}

/**
 * Итог уровня: прогресс, монеты и сундук разом. Экономика игры живёт здесь,
 * чтобы правило начисления было в одном месте, а не размазано по интерфейсу.
 *
 * Первый проход даёт полную награду и шаг сундука, повтор — только символические
 * монеты: иначе один лёгкий уровень становится бесконечной фермой.
 */
export function applyResult(
  lang: string,
  data: SaveData,
  level: number,
  letters: number,
  goal: number,
  passed: boolean,
  perfect: boolean,
): LevelOutcome {
  const previous = data.results[level];
  const first = passed && !previous?.passed;
  const prize = passed ? (first ? BASE_REWARD + (perfect ? PERFECT_BONUS : 0) : REPLAY_REWARD) : 0;

  const chestFrom = data.chest;
  const chestTo = first ? chestFrom + 1 : chestFrom;
  const chestBonus = chestTo >= CHEST_GOAL ? CHEST_REWARD : 0;

  const next: SaveData = {
    ...data,
    unlocked: passed ? Math.max(data.unlocked, level + 1) : data.unlocked,
    coins: data.coins + prize + chestBonus,
    chest: chestBonus > 0 ? 0 : chestTo,
    results: {
      ...data.results,
      [level]: {
        passed: passed || previous?.passed || false,
        bestLetters: Math.max(letters, previous?.bestLetters ?? 0),
        goal,
      },
    },
  };
  storeSave(lang, next);
  return { save: next, prize, chestFrom, chestTo, chestGoal: CHEST_GOAL, chestBonus };
}

/** Списать монеты: подсказка бесплатной быть не должна, иначе она ничего не стоит. */
export function spendCoins(lang: string, data: SaveData, amount: number): SaveData {
  const next: SaveData = { ...data, coins: Math.max(0, data.coins - amount) };
  storeSave(lang, next);
  return next;
}

const BASE_REWARD = 20;
const PERFECT_BONUS = 10;
const REPLAY_REWARD = 5;

/** Что принесло слово в копилку: обновлённое сохранение и монеты, если порог взят. */
export interface BonusOutcome {
  save: SaveData;
  /** Сколько всего слов в копилке после этого. */
  count: number;
  /** Монеты за взятый порог: ноль, пока копилка не набрала очередную двадцатку. */
  reward: number;
}

/**
 * Слово не из темы уходит в копилку. Повтор не считается: слово уже лежит
 * в списке, и второй раз за него не платят. Каждая полная двадцатка приносит
 * монеты — это единственная награда за наблюдательность, не связанная с целью.
 */
export function collectBonus(lang: string, data: SaveData, word: string): BonusOutcome {
  if (data.bonus.includes(word)) {
    return { save: data, count: data.bonus.length, reward: 0 };
  }
  const bonus = [...data.bonus, word];
  const reward = bonus.length % BONUS_GOAL === 0 ? BONUS_REWARD : 0;
  const save: SaveData = { ...data, bonus, coins: data.coins + reward };
  storeSave(lang, save);
  return { save, count: bonus.length, reward };
}

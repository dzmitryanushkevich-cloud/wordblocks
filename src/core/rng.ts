/**
 * Детерминированный генератор случайных чисел (mulberry32).
 * Один и тот же сид всегда даёт один и тот же уровень — это позволяет
 * воспроизвести и починить любую жалобу на кривую фигуру.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Число в [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Целое в [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }

  /** Перемешанная копия массива (Фишер — Йетс). */
  shuffled<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Выбор по весам: weights[i] — относительная вероятность items[i]. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    let total = 0;
    for (const w of weights) total += w;
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

/** Сид уровня: стабильно выводится из номера уровня и сида игры. */
export function levelSeed(gameSeed: number, levelIndex: number): number {
  return (Math.imul(gameSeed ^ 0x9e3779b9, levelIndex + 1) ^ (levelIndex * 0x85ebca6b)) >>> 0;
}

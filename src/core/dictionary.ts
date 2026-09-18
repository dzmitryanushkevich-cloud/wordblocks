import type { DictionaryContent } from '../content/types.js';
import type { Rng } from './rng.js';

interface TrieNode {
  children: Map<string, TrieNode>;
  terminal: boolean;
}

function createNode(): TrieNode {
  return { children: new Map(), terminal: false };
}

/**
 * Словарь игры.
 *
 * Два уровня доверия к слову:
 *   - valid  — всё, что принимается как ответ игрока (весь список);
 *   - core   — узнаваемые частотные слова, только они прячутся в фигуру как якорь
 *              и только они предлагаются подсказкой.
 */
export class Dictionary {
  private readonly root: TrieNode = createNode();
  private readonly valid = new Set<string>();
  /** Узнаваемые слова по длине, в порядке убывания частоты (индекс = ранг). */
  private readonly coreByLength = new Map<number, string[]>();
  /** Частотность букв, посчитанная по самому словарю: основа «естественной» добивки. */
  private readonly rank = new Map<string, number>();
  private readonly themed = new Set<string>();
  readonly letters: string[] = [];
  readonly letterWeights: number[] = [];

  /**
   * @param data слова языка по убыванию частоты
   * @param themeWords слова категорий: собственный белый список языка
   */
  constructor(data: DictionaryContent, themeWords: readonly string[] = []) {
    const counts = new Map<string, number>();
    const skip = new Set(data.fillerExclude ?? []);

    // Слова тем — собственный белый список: они узнаваемы по построению,
    // и проверять их частотность в киносубтитрах бессмысленно (крыжовник,
    // стамеска и кабачок там почти не встречаются, а знают их все).
    for (const word of themeWords) {
      if (!this.valid.has(word)) {
        this.valid.add(word);
        this.insert(word);
      }
      this.themed.add(word);
    }

    data.words.forEach((word, index) => {
      this.valid.add(word);
      this.insert(word);
      if (index < data.coreCount) {
        const bucket = this.coreByLength.get(word.length);
        if (bucket) bucket.push(word);
        else this.coreByLength.set(word.length, [word]);
        this.rank.set(word, index);
      }
      // Буквы вроде русского «ъ» в добивку не берём: слово с них не начинается,
      // а в случайной клетке они читаются как опечатка. Список — в пакете языка.
      for (const ch of word) {
        if (!skip.has(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    });
    for (const [letter, count] of [...counts].sort((a, b) => b[1] - a[1])) {
      this.letters.push(letter);
      this.letterWeights.push(count);
    }
  }

  private insert(word: string): void {
    let node = this.root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) {
        next = createNode();
        node.children.set(ch, next);
      }
      node = next;
    }
    node.terminal = true;
  }

  get size(): number {
    return this.valid.size;
  }

  has(word: string): boolean {
    return this.valid.has(word);
  }

  /** Корень префиксного дерева — точка входа для солвера. */
  get trieRoot(): TrieNode {
    return this.root;
  }

  step(node: TrieNode, letter: string): TrieNode | undefined {
    return node.children.get(letter);
  }

  isTerminal(node: TrieNode): boolean {
    return node.terminal;
  }

  /**
   * Узнаваемые слова заданной длины. `maxRank` сужает выбор до самых частотных:
   * на первых уровнях якорем должно быть бытовое слово, а не ШАРМ или ЛАЖА.
   */
  core(length: number, maxRank = Infinity): readonly string[] {
    const bucket = this.coreByLength.get(length) ?? [];
    if (maxRank === Infinity) return bucket;
    const narrowed = bucket.filter((word) => (this.rank.get(word) ?? Infinity) <= maxRank);
    return narrowed.length > 0 ? narrowed : bucket;
  }

  /**
   * Узнаваемо ли слово: входит ли оно в самые частотные `maxRank` слов
   * или в тематические списки, которые собраны вручную и узнаваемы всегда.
   */
  isCommon(word: string, maxRank: number): boolean {
    return this.themed.has(word) || (this.rank.get(word) ?? Infinity) <= maxRank;
  }

  /** Случайная буква с учётом частотности словаря. */
  randomLetter(rng: Rng): string {
    return rng.weighted(this.letters, this.letterWeights);
  }
}

export type { TrieNode };

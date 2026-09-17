import type { Rng } from './rng.js';

interface TrieNode {
  children: Map<string, TrieNode>;
  terminal: boolean;
}

function createNode(): TrieNode {
  return { children: new Map(), terminal: false };
}

export interface DictionaryData {
  /** Сколько первых слов считаются узнаваемыми (только они идут в якоря). */
  coreCount: number;
  /** Слова по убыванию частоты. */
  words: string[];
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
  private readonly coreByLength = new Map<number, string[]>();
  /** Частотность букв, посчитанная по самому словарю: основа «естественной» добивки. */
  readonly letters: string[] = [];
  readonly letterWeights: number[] = [];

  constructor(data: DictionaryData) {
    const counts = new Map<string, number>();
    data.words.forEach((word, index) => {
      this.valid.add(word);
      this.insert(word);
      if (index < data.coreCount) {
        const bucket = this.coreByLength.get(word.length);
        if (bucket) bucket.push(word);
        else this.coreByLength.set(word.length, [word]);
      }
      for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1);
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

  /** Узнаваемые слова заданной длины. */
  core(length: number): readonly string[] {
    return this.coreByLength.get(length) ?? [];
  }

  /** Случайная буква с учётом частотности словаря. */
  randomLetter(rng: Rng): string {
    return rng.weighted(this.letters, this.letterWeights);
  }
}

export type { TrieNode };

import type { Dictionary, TrieNode } from './dictionary.js';
import type { Cell, WordHit } from './types.js';

export interface SolveOptions {
  minLength?: number;
  maxLength?: number;
}

/**
 * Полный перебор слов фигуры: обход в глубину из каждой клетки с отсечением
 * по префиксному дереву словаря. Если продолжения с таким префиксом в словаре нет,
 * ветка обрывается сразу — поэтому даже на 14 клетках это работает мгновенно.
 *
 * Возвращает все валидные слова, от длинных к коротким. Для каждого слова
 * хранится один путь — тот, который нашёлся первым.
 */
export function solve(
  cells: readonly Cell[],
  adjacency: readonly number[][],
  dictionary: Dictionary,
  options: SolveOptions = {},
): WordHit[] {
  const minLength = options.minLength ?? 3;
  const maxLength = options.maxLength ?? 9;
  const found = new Map<string, number[]>();
  const path: number[] = [];
  const used = new Array<boolean>(cells.length).fill(false);

  const visit = (cell: number, node: TrieNode, prefix: string): void => {
    const next = dictionary.step(node, cells[cell].letter);
    if (!next) return;

    const word = prefix + cells[cell].letter;
    path.push(cell);
    used[cell] = true;

    if (word.length >= minLength && dictionary.isTerminal(next) && !found.has(word)) {
      found.set(word, path.slice());
    }
    if (word.length < maxLength) {
      for (const neighbour of adjacency[cell]) {
        if (!used[neighbour]) visit(neighbour, next, word);
      }
    }

    path.pop();
    used[cell] = false;
  };

  for (let i = 0; i < cells.length; i++) {
    visit(i, dictionary.trieRoot, '');
  }

  return [...found.entries()]
    .map(([word, wordPath]) => ({ word, path: wordPath }))
    .sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));
}

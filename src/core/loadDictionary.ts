import { Dictionary, type DictionaryData } from './dictionary.js';
import data from '../data/dictionary.json' with { type: 'json' };

let instance: Dictionary | null = null;

/** Единственный экземпляр словаря на всё приложение: строить trie дважды незачем. */
export function getDictionary(): Dictionary {
  if (!instance) instance = new Dictionary(data as DictionaryData);
  return instance;
}

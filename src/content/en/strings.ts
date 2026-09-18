import type { UiStrings } from '../types.js';

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export const en: UiStrings = {
  title: 'WordBlocks',
  intro: [
    'Every level has two categories — they are printed above the block, and only their ' +
      'words count. A block hides several of them, but you may take one: the moment a word ' +
      'is found, the block crumbles with everything else inside. Progress is counted in ' +
      'letters, so a short word is letters lost. Five blocks per level.',
    'Trace a word by swiping across neighbouring tiles: up, down, left, right. No diagonals.',
  ],
  build: (stamp) => `build ${stamp}`,
  locked: '🔒',
  noResult: '—',
  toMap: 'levels',
  toMapTitle: 'back to the level map',
  hint: 'hint',
  hintTitle: 'light up the first letter of the long word',
  blockWord: 'Block',
  blockOf: (index, total) => `${index} of ${total}`,
  won: 'Brilliant!',
  lost: 'Not enough letters',
  perfect: 'Flawless: the longest word taken in every block.',
  wellDone: 'Level cleared.',
  reward: (coins) => `+${coins}`,
  hintCost: (coins) => `${coins}`,
  notEnoughCoins: 'Not enough coins',
  collected: (letters, goal) => `${plural(letters, 'letter', 'letters')} of ${goal} collected.`,
  lostEarly: ' The remaining blocks could not cover the goal, so the level ended early.',
  next: 'next level',
  retry: 'try again',
  bonusTitle: 'Extra words',
  bonusButtonTitle: 'words outside the theme you found along the way',
  bonusHere: 'On this level:',
  bonusEmpty: 'Nothing yet. A word outside the level categories keeps the block standing and lands here instead.',
  bonusTotal: (count) => `Found in total: ${count}`,
  bonusProgress: (count, goal) => `${count} / ${goal}`,
  bonusPaid: (coins) => `+${coins} for the collection`,
  bonusFound: 'collected',
  bonusAgain: 'already found',
  bonusClose: 'got it',
};

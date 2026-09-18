import type { UiStrings } from '../types.js';

/** Русское склонение после числа: 1 буква, 2 буквы, 5 букв. */
function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export const ru: UiStrings = {
  title: 'WordBlocks',
  intro: [
    'У каждого уровня две категории — они написаны над блоком, и считаются только их слова. ' +
      'В блоке спрятано несколько таких слов, но взять можно одно: как только слово найдено, ' +
      'блок рассыпается вместе с остальными. Прогресс уровня считается в буквах, поэтому ' +
      'короткое слово — это потерянные буквы. Пять блоков на уровень.',
    'Слово ведут свайпом по соседним плиткам: вверх, вниз, влево, вправо. Без диагоналей.',
  ],
  build: (stamp) => `сборка ${stamp}`,
  locked: '🔒',
  noResult: '—',
  toMap: 'к карте',
  toMapTitle: 'к карте уровней',
  hint: 'подсказка',
  hintTitle: 'подсветить первую букву длинного слова',
  blockWord: 'Блок',
  blockOf: (index, total) => `${index} из ${total}`,
  won: 'Браво!',
  lost: 'Не хватило букв',
  perfect: 'Безупречно: в каждом блоке взято самое длинное слово.',
  wellDone: 'Уровень пройден.',
  reward: (coins) => `+${coins}`,
  hintCost: (coins) => `${coins}`,
  notEnoughCoins: 'Не хватает монет',
  collected: (letters, goal) =>
    `Собрано ${letters} ${plural(letters, 'буква', 'буквы', 'букв')} из ${goal} нужных.`,
  lostEarly: ' На оставшихся блоках цели было уже не достать, поэтому уровень закончен досрочно.',
  bonusTitle: 'Доп. слова',
  bonusButtonTitle: 'слова не из темы, найденные по пути',
  bonusHere: 'На этом уровне:',
  bonusEmpty: 'Пока ничего. Слово не из категорий уровня блок не рассыпает, а попадает сюда и копится дальше.',
  bonusTotal: (count) =>
    `Всего найдено: ${count} ${plural(count, 'слово', 'слова', 'слов')}`,
  bonusProgress: (count, goal) => `${count} / ${goal}`,
  bonusPaid: (coins) => `+${coins} за копилку`,
  bonusFound: 'в копилку',
  bonusAgain: 'уже было',
  bonusClose: 'понятно',
  next: 'следующий уровень',
  retry: 'ещё раз',
};

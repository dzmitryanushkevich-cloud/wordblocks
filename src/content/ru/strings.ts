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
    'Категории блока написаны над ним — засчитываются только их слова. ' +
      'Слово соединяют свайпом по соседним плиткам, без диагоналей.',
    'Подходящих слов несколько, но взять можно одно: оно рассыпает блок вместе ' +
      'с остальными. Цель считается в буквах, поэтому короткое слово — потерянные буквы.',
    'Слово не из категорий уходит в копилку и приносит монеты, а монеты — подсказки.',
  ],
  build: (stamp) => `сборка ${stamp}`,
  locked: '🔒',
  noResult: '—',
  toMap: 'К карте',
  toMapTitle: 'к карте уровней',
  fullscreen: 'Весь экран',
  fullscreenExit: 'Свернуть',
  fullscreenTitle: 'развернуть игру во весь экран',
  soundOff: 'выключить звук',
  soundOn: 'включить звук',
  hint: 'Подсказка',
  hintTitle: 'подсветить первую букву длинного слова',
  tutorHint: 'Соедините буквы в слово',
  blockWord: 'Блок',
  blockOf: (index, total) => `${index} из ${total}`,
  levelName: (index) => `Уровень ${index}`,
  levelNameShort: (index) => `Ур. ${index}`,
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
  bonusClose: 'Понятно',
  next: 'Следующий уровень',
  retry: 'Ещё раз',
  lastChance: 'Последний шанс',
  plusBlock: '+1 блок',
};

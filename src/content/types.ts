/**
 * Языковой пакет: всё, что в игре зависит от языка, собрано здесь и передаётся
 * в ядро параметром. Ядро (рост фигур, поиск путей, солвер, генератор, правила
 * партии) не знает ни одного языка — ему всё равно, из каких букв слова.
 *
 * Новый язык — это новая папка в `src/content` с этими четырьмя частями
 * и строчка в реестре. Трогать ядро при этом не нужно.
 */

/** Словарь языка: слова по убыванию частоты. */
export interface DictionaryContent {
  /** Сколько первых слов считаются узнаваемыми (только они идут в якоря). */
  coreCount: number;
  words: string[];
  /**
   * Буквы, которых не должно быть в случайной добивке. В русском это «ъ»:
   * слово с него не начинается, а в случайной клетке он читается как опечатка.
   */
  fillerExclude?: string[];
}

/** Категории слов и их раскладка по уровням. */
export interface ThemeContent {
  /**
   * Множественное число слов темы: «туфля» → «туфли». Засчитываем обе формы —
   * игрок читает с блока то, что видит, и собранные ТУФЛИ обязаны считаться.
   * Прятать генератор при этом продолжает единственное число.
   */
  plural: Record<string, string>;
  /** Категория → слова через пробел. */
  categories: Record<string, string>;
  /** Ходовая часть категории: слова, которые знают все. */
  common: Record<string, string>;
  /** Семейство → входящие в него категории. Показывается на карточке уровня. */
  families: Record<string, string[]>;
  /** Прозрачность категории: 1 — предметы из детского словаря, 3 — абстрактное.
      Данные для скрипта, который считает план: ранние уровни берут только
      первый ярус. В игре не читается. */
  clarity: Record<string, number>;
  /** Ядро категории: слова, которые называют первыми. Ими прячутся первые уровни —
      частотность в субтитрах тут не помощник (ЗАЯЦ и БЕЛКА в неё не попадают вовсе,
      а БЫК и ЛОСЬ попадают), поэтому список ручной. */
  core: Record<string, string>;
  /** Тема каждого уровня. Когда список кончается, он идёт по кругу. */
  /** Пары категорий по уровням. Семейства тут нет намеренно: пара берётся
      из разных семейств, и одного имени у неё быть не может. */
  plan: { categories: string[] }[];
}

/** Ручная строка кривой сложности: один уровень. */
export interface CurveRow {
  /** Длина якоря в каждом из блоков уровня. */
  anchors: number[];
  /** Клеток в блоке. */
  size: number;
  /** Предел поворотов пути якоря. */
  turns: number;
  /** Какую долю максимума нужно набрать для победы. */
  goal: number;
  /** Верхняя граница на общее число слов в блоке. */
  words: number;
  /** Сколько слов кладём из темы: два (якорь и соблазн) или три. */
  themed: number;
  /** Сколько трёхбуквенных слов допускается. */
  short: number;
  /** Насколько частотным должно быть слово из общего словаря. */
  pool: number;
}

/** Кривая сложности языка: слова разных языков разной длины, кривая тоже своя. */
export interface CurveContent {
  /**
   * Сколько блоков в уровне. Растёт ступенями: короткое знакомство в начале
   * и длинная партия к концу. Каждая ступень — уровень, с которого она
   * действует; между ступенями число держится.
   */
  blocks: { from: number; count: number }[];
  /** Первые уровни расписаны вручную: это обучение. */
  opening: CurveRow[];
  /** Дальше кривая продолжается формулой от номера уровня. */
  later: {
    anchorBase: number;
    anchorPerLevels: number;
    anchorCap: number;
    sizeBase: number;
    sizePerLevels: number;
    sizeCap: number;
    turns: number;
    goal: number;
    words: number;
    themed: number;
    short: number;
  };
  /** До какого уровня слова лежат только слева направо и сверху вниз. */
  readableUntil: number;
  /**
   * С какого уровня блок начинает путать: якорь сворачивает дважды, соблазн
   * пересекает его, а в блоке появляются ложные начала. Сложность растёт
   * запутанностью, а не редкими словами.
   */
  tangleFrom: number;
  /** До какого уровня прячем только ходовые слова категорий. */
  /** До какого уровня прячем только ядро категорий. */
  coreUntil: number;
  commonUntil: number;
  /** До каких уровней форма остаётся простой, а потом без скелетов. */
  shapeStages: [number, number];
  /** Длина слова, с которой солвер считает находку словом. */
  minWord: number;
  /** Предел длины: длиннее слов в языке либо нет, либо они не нужны. */
  maxWord: number;
}

/** Тексты интерфейса. Склонения и порядок слов — забота самого языка. */
export interface UiStrings {
  title: string;
  /** Абзацы правил на карте уровней. */
  intro: string[];
  build: (stamp: string) => string;
  locked: string;
  noResult: string;
  toMap: string;
  toMapTitle: string;
  /** Кнопка полного экрана: надпись в обычном состоянии и в развёрнутом. */
  fullscreen: string;
  fullscreenExit: string;
  fullscreenTitle: string;
  hint: string;
  hintTitle: string;
  /** Подсказка новичку на первом уровне: стоит там же, где собираемое слово. */
  tutorHint: string;
  blockWord: string;
  blockOf: (index: number, total: number) => string;
  /** Подпись уровня в шапке: «Уровень 3» и её короткая форма для узкого экрана. */
  levelName: (index: number) => string;
  levelNameShort: (index: number) => string;
  won: string;
  lost: string;
  /** Похвала на экране победы: идеальный проход и обычный. */
  perfect: string;
  wellDone: string;
  /** Награда монетами и цена подсказки. */
  reward: (coins: number) => string;
  hintCost: (coins: number) => string;
  notEnoughCoins: string;
  collected: (letters: number, goal: number) => string;
  lostEarly: string;
  next: string;
  retry: string;
  /** Копилка слов не из темы: заголовок окна, подписи и награда. */
  bonusTitle: string;
  bonusButtonTitle: string;
  bonusHere: string;
  bonusEmpty: string;
  bonusTotal: (count: number) => string;
  bonusProgress: (count: number, goal: number) => string;
  bonusPaid: (coins: number) => string;
  bonusFound: string;
  bonusAgain: string;
  bonusClose: string;
}

export interface LanguagePack {
  /** Короткий код: он же в адресе (?lang=ru) и в ключе сохранения. */
  id: string;
  /** Значение для атрибута lang у страницы. */
  htmlLang: string;
  /** Название языка на нём самом — для переключателя. */
  name: string;
  dictionary: DictionaryContent;
  themes: ThemeContent;
  curve: CurveContent;
  ui: UiStrings;
}

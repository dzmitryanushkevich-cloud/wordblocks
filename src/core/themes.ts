import type { ThemeContent } from '../content/types.js';

/**
 * Слова категории: свой белый список, частотностью в словаре не проверяется.
 * Вместе с каждым словом идёт его множественное число: ТУФЛИ — такая же обувь,
 * как ТУФЛЯ, и засчитать их надо одинаково. Прятать генератор продолжает
 * единственное число — за него отвечает `categoryPool`.
 */
export function categoryWords(themes: ThemeContent, id: string): string[] {
  const singles = (themes.categories[id] ?? '').split(' ').filter(Boolean);
  const plural = singles.map((word) => themes.plural?.[word]).filter(Boolean) as string[];
  return [...singles, ...plural];
}

/** Только единственное число: из этого генератор строит блоки. */
function singleWords(themes: ThemeContent, id: string): string[] {
  return (themes.categories[id] ?? '').split(' ').filter(Boolean);
}

/** Ходовые слова категории — с них начинаются уровни. */
export function commonWords(themes: ThemeContent, id: string): string[] {
  return (themes.common[id] ?? '').split(' ').filter(Boolean);
}

/** Ядро категории: то, что называют первым. Им прячутся самые первые уровни. */
export function coreWords(themes: ThemeContent, id: string): string[] {
  return (themes.core[id] ?? '').split(' ').filter(Boolean);
}

export function allThemeWords(themes: ThemeContent): string[] {
  return Object.keys(themes.categories).flatMap((id) => categoryWords(themes, id));
}

export interface LevelTheme {
  /** Конкретные категории уровня — их и видит игрок. */
  categories: string[];
  /** Готовая подпись: «Фрукты · Овощи». */
  title: string;
}

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * Какая тема достаётся уровню. Раскладка лежит в пакете языка и подобрана
 * под кривую сложности: ранним уровням — категории, богатые короткими словами,
 * поздним — только те, где хватает длинных. Пара всегда из разных семейств:
 * «Овощи · Погода» интереснее «Фруктов · Овощей», потому что подпись блока
 * сразу говорит, в какую сторону думать. Когда план кончается, он идёт по кругу.
 */
export function levelTheme(themes: ThemeContent, levelIndex: number): LevelTheme {
  const row = themes.plan[(levelIndex - 1) % themes.plan.length];
  return {
    categories: row.categories,
    title: row.categories.map(capitalize).join(' · '),
  };
}

/**
 * Подписи категорий для слов блока: игрок видит над блоком, что в нём спрятано.
 * Считаем только категории самого уровня — слово из чужой темы подписывать нечем
 * и незачем, оно там случайное. Порядок — от длинного слова к короткому,
 * чтобы главная категория блока стояла первой.
 */
export function figureLabels(
  themes: ThemeContent,
  words: readonly string[],
  theme: LevelTheme,
): string[] {
  const labels: string[] = [];
  for (const word of [...words].sort((a, b) => b.length - a.length)) {
    for (const category of theme.categories) {
      if (!categoryWords(themes, category).includes(word)) continue;
      if (!labels.includes(category)) labels.push(category);
      // Слово подписываем одной категорией: сирень есть и в деревьях, и в цветах,
      // а игрок должен считать её за одно слово, а не за два.
      break;
    }
  }
  return labels;
}

/**
 * Слова одной категории — ими прячется первый блок уровня. Ходовая часть
 * на ранних уровнях по той же причине, что и у всей темы: незнакомое слово
 * игрок не ищет, а гадает.
 */
export function categoryPool(
  themes: ThemeContent,
  category: string,
  depth: PoolDepth = 'all',
): string[] {
  if (depth === 'core') {
    const core = coreWords(themes, category);
    if (core.length > 0) return core;
  }
  return depth === 'all' ? singleWords(themes, category) : commonWords(themes, category);
}

/**
 * Насколько глубоко генератор черпает слова темы:
 * ядро — самое очевидное, ходовая часть — всё, что знают, всё — вся категория.
 */
export type PoolDepth = 'core' | 'common' | 'all';

/**
 * Слова темы уровня одним списком. На ранних уровнях — только ходовая часть:
 * АЙВА и РЯПУШКА такие же фрукты и рыбы, как ЯБЛОКО и ЩУКА, но игрок,
 * который не знает слова, не ищет его, а гадает.
 */
export function themeWords(
  themes: ThemeContent,
  theme: LevelTheme,
  depth: PoolDepth = 'all',
): string[] {
  return theme.categories.flatMap((id) => categoryPool(themes, id, depth));
}

/**
 * Что в уровне засчитывается. Шире, чем то, что генератор прячет: сюда входит
 * вся категория целиком и множественное число каждого слова. Игрок читает
 * с блока то, что видит, и собранные ТУФЛИ обязаны считаться так же, как ТУФЛЯ.
 */
export function themeScoring(themes: ThemeContent, theme: LevelTheme): string[] {
  return theme.categories.flatMap((id) => categoryWords(themes, id));
}

/**
 * Пары «единственное — множественное» в обе стороны. Нужны генератору: ТУФЛЯ
 * и ТУФЛИ в одном блоке — это не выбор, а одно и то же слово дважды, и хуже
 * того, в английском форма длиннее якоря (COCONUT и COCONUTS) и ломает правило
 * «якорь — самое длинное слово темы».
 */
export function siblingForms(themes: ThemeContent): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const [single, many] of Object.entries(themes.plural ?? {})) {
    pairs.set(single, many);
    pairs.set(many, single);
  }
  return pairs;
}

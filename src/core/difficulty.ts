import type { PoolDepth } from './themes.js';
import type { CurveContent, CurveRow } from '../content/types.js';

export interface FigureParams {
  size: number;
  anchorLength: number;
  boxW: number;
  boxH: number;
  /** Сколько трёхбуквенных слов допускается в блоке (умная добивка режет лёгкие выходы). */
  maxShortWords: number;
  /** Верхняя граница на общее число спрятанных слов. */
  maxWords: number;
  /** Ступень формы: 0 — простые силуэты, 1 — вытянутые, 2 — скелеты и дырки. */
  shapeStage: number;
  /**
   * Сколько слов генератор кладёт из темы уровня: два — якорь и соблазн,
   * три — плюс слово средней длины. Подпись над блоком называет их категории,
   * поэтому лишнее тематическое слово делает блок гуще, а не несправедливее.
   */
  themedWords: number;
  /**
   * Длина «слова-соблазна» — короткого слова, которое генератор специально
   * подкладывает рядом с якорем. Без него в блоке не из чего выбирать
   * и весь конфликт игры (взять быстро или искать длинное) исчезает.
   */
  temptationLength: number;
  /**
   * Насколько частотным должно быть якорное слово: на ранних уровнях берём
   * только самые ходовые, чтобы игрок не гадал, что такое ШАРМ.
   */
  anchorPool: number;
  /**
   * Сколько раз путь якорного слова может менять направление. Прямое слово
   * видно сразу, извилистое приходится выискивать — это главный рычаг
   * сложности поиска, не считая размера блока.
   */
  maxTurns: number;
  /** Сколько поворотов путь обязан сделать: прямое слово читается по строке. */
  minTurns: number;
  /**
   * Сколько ложных начал подкладывать: клеток с первой буквой якоря, от которых
   * слово не собирается. Взгляд цепляется за букву и ведёт не туда — это и есть
   * запутанность, за которую блок становится трудным, а слова остаются простыми.
   */
  falseStarts: number;
  /** Соблазн обязан пересечь якорь, а не лежать рядом: два слова в одних клетках. */
  crossing: boolean;
  /**
   * Слово лежит только слева направо и сверху вниз. На первых уровнях, пока
   * игрок не понял правила, зеркальная ЛИСА читается как АСИЛ — это не
   * сложность, а путаница.
   */
  readable: boolean;
}

export interface LevelParams {
  figures: FigureParams[];
  /** Доля от максимума (суммы якорных слов), которую нужно набрать для победы. */
  goalRatio: number;
  /** Прятать только ходовые слова категорий: первые уровни знакомят с игрой. */
  /** Насколько глубоко черпаем слова темы: ядро → ходовая часть → вся категория. */
  poolDepth: PoolDepth;
}

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

/**
 * Сколько блоков в уровне. Это такая же ось сложности, как длина слова и размер
 * блока: первые уровни короткие, чтобы игру можно было попробовать за минуту,
 * дальше партия растёт. Расписание лежит в пакете языка, потому что там же
 * лежит вся остальная кривая.
 */
export function levelBlocks(curve: CurveContent, levelIndex: number): number {
  let count = curve.blocks[0]?.count ?? 5;
  for (const step of curve.blocks) if (levelIndex >= step.from) count = step.count;
  return count;
}

/**
 * Дальше расписанных вручную уровней кривая продолжается формулой.
 * Числа — из пакета языка: слова разных языков разной длины.
 */
function laterLevel(curve: CurveContent, levelIndex: number, figureCount: number): CurveRow {
  const { later, opening } = curve;
  const step = Math.floor((levelIndex - opening.length) / later.anchorPerLevels);
  const anchors = Array.from({ length: figureCount }, (_, i) =>
    clamp(later.anchorBase + step + (i % 3 === 2 ? 1 : 0), 6, later.anchorCap),
  );
  return {
    anchors,
    size: clamp(
      later.sizeBase + Math.floor((levelIndex - opening.length) / later.sizePerLevels),
      later.sizeBase,
      later.sizeCap,
    ),
    turns: later.turns,
    goal: later.goal,
    words: later.words,
    themed: later.themed,
    short: later.short,
    pool: Infinity,
  };
}

/**
 * Параметры уровня по кривой из пакета языка. Первые уровни расписаны в пакете
 * вручную — это обучение, и каждый шаг добавляет ровно одну новую трудность;
 * дальше кривая продолжается формулой от номера уровня.
 */
export function levelParams(
  curve: CurveContent,
  levelIndex: number,
  figureCount = levelBlocks(curve, levelIndex),
): LevelParams {
  const plan =
    levelIndex <= curve.opening.length
      ? curve.opening[levelIndex - 1]
      : laterLevel(curve, levelIndex, figureCount);

  const figures: FigureParams[] = [];
  for (let i = 0; i < figureCount; i++) {
    const anchorLength = plan.anchors[i % plan.anchors.length];
    // Блок должен вмещать слово с запасом на отвлекающие буквы.
    // Длинному слову нужен запас клеток, иначе блок превращается в одну змейку.
    const size = Math.max(plan.size, anchorLength + (anchorLength >= 10 ? 5 : 3));
    // Габарит растёт с размером блока, но по ширине охотнее, чем по высоте:
    // на телефоне под блок отведено больше ширины, чем высоты.
    const box = size <= 9 ? [4, 4] : size <= 12 ? [5, 5] : size <= 15 ? [6, 5] : [7, 6];
    figures.push({
      size,
      anchorLength,
      boxW: box[0],
      boxH: box[1],
      maxShortWords: plan.short,
      maxWords: plan.words,
      themedWords: plan.themed,
      // Форма усложняется отдельно от размера: сначала блок должен читаться.
      shapeStage:
        levelIndex <= curve.shapeStages[0] ? 0 : levelIndex <= curve.shapeStages[1] ? 1 : 2,
      temptationLength: clamp(anchorLength - 3, 3, 4),
      maxTurns: plan.turns,
      // Пока слова лежат по порядку, поворот не требуем: два ограничения сразу
      // не оставляют генератору выбора. Дальше якорь обязан хотя бы раз свернуть,
      // а с середины кривой — дважды: прямое слово находится без поиска.
      // Запутанность растёт отдельно от слов: с пятого уровня якорь обязан
      // свернуть дважды, дальше трижды. Слова при этом остаются теми же —
      // трудно становится не читать их, а находить.
      minTurns:
        levelIndex <= curve.readableUntil
          ? 0
          : levelIndex <= curve.tangleFrom - 1
            ? 1
            : Math.min(3, Math.max(2, plan.turns - 1)),
      falseStarts:
        levelIndex < curve.tangleFrom ? 0 : levelIndex < curve.tangleFrom + 5 ? 1 : 2,
      crossing: levelIndex >= curve.tangleFrom,
      anchorPool: plan.pool,
      readable: levelIndex <= curve.readableUntil,
    });
  }
  // До тринадцатого уровня прячем только то, что знают все: редкое слово
  // на старте читается как ошибка игры, а не как задача.
  // Узнаваемость слов идёт по кривой так же, как длина и форма: сначала только
  // ядро категории (ВОЛК и ЛИСА, но не ЛОСЬ и БЫК), потом вся ходовая часть,
  // а редкие слова появляются, когда игрок уже освоился.
  const poolDepth: PoolDepth =
    levelIndex <= curve.coreUntil ? 'core' : levelIndex <= curve.commonUntil ? 'common' : 'all';
  return { figures, goalRatio: plan.goal, poolDepth };
}

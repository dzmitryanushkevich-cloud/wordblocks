import type { Dictionary } from '../core/dictionary.js';
import { buildAdjacency, isValidPath, readWord } from '../core/shape.js';
import type { Figure, Level } from '../core/types.js';

export type Phase = 'playing' | 'crumbling' | 'won' | 'lost';

export interface FoundEntry {
  word: string;
  figureIndex: number;
}

export interface FigureOutcome {
  /** Слово, которое игрок взял в этой фигуре. */
  taken: string;
  /** Слова, которые в ней были и рассыпались вместе с фигурой. */
  missed: string[];
}

export interface GameState {
  level: Level;
  figureIndex: number;
  /** Соседство клеток текущей фигуры — считается один раз на фигуру. */
  adjacency: number[][];
  /** Путь, который игрок ведёт прямо сейчас. */
  selection: number[];
  found: FoundEntry[];
  letters: number;
  outcomes: FigureOutcome[];
  /** Открытые подсказкой клетки — начало загаданного слова, по одной за нажатие. */
  hintCells: number[];
  hintsUsed: number;
  phase: Phase;
  /** Последнее засчитанное слово — для анимации рассыпания. */
  lastWord: string | null;
  /** Клетки последнего слова: они не рассыпаются, их буквы улетают в список. */
  lastPath: number[];
}

export function currentFigure(state: GameState): Figure {
  return state.level.figures[state.figureIndex];
}

export function startLevel(level: Level): GameState {
  return {
    level,
    figureIndex: 0,
    adjacency: buildAdjacency(level.figures[0].cells),
    selection: [],
    found: [],
    letters: 0,
    outcomes: [],
    hintCells: [],
    hintsUsed: 0,
    phase: 'playing',
    lastWord: null,
    lastPath: [],
  };
}

/** Слово, собранное текущим выделением. */
export function selectionWord(state: GameState): string {
  return readWord(currentFigure(state).cells, state.selection);
}

/**
 * Добавление клетки к выделению во время свайпа.
 * Возврат на предыдущую клетку снимает последнюю букву — так исправляют ошибку пальцем.
 */
export function extendSelection(state: GameState, cell: number): GameState {
  if (state.phase !== 'playing') return state;
  const { selection, adjacency } = state;
  if (selection.length === 0) return { ...state, selection: [cell] };
  if (selection[selection.length - 1] === cell) return state;
  if (selection.length >= 2 && selection[selection.length - 2] === cell) {
    return { ...state, selection: selection.slice(0, -1) };
  }
  if (selection.includes(cell)) return state;
  if (!adjacency[selection[selection.length - 1]].includes(cell)) return state;
  return { ...state, selection: [...selection, cell] };
}

/**
 * Чем кончился свайп: слово засчитано, слово есть в языке, но не из темы уровня,
 * или такого слова нет вовсе. Интерфейс показывает три разных ответа.
 */
export type ReleaseStatus = 'accepted' | 'off-theme' | 'unknown';

export interface ReleaseResult {
  state: GameState;
  /** Засчитано ли слово: интерфейс по этому решает, играть ли анимацию. */
  accepted: boolean;
  status: ReleaseStatus;
  word: string;
}

/**
 * Палец отпущен. Слово засчитывается мгновенно, если оно есть в словаре
 * и в нём не меньше трёх букв. Никаких подтверждений: отпустил — фигура рассыпалась.
 */
export function releaseSelection(state: GameState, dictionary: Dictionary): ReleaseResult {
  if (state.phase !== 'playing') return { state, accepted: false, status: 'unknown', word: '' };
  const word = selectionWord(state);
  const figure = currentFigure(state);

  const drawn = word.length >= 3 && isValidPath(state.adjacency, state.selection);
  // Считаются только слова темы уровня — она написана над блоком. Остальные
  // слова языка в блоке неизбежны (ЛАЙ внутри ЛАЙМА), и рассыпать блок
  // случайной ИВОЙ на фруктовом уровне было бы нечестно.
  const scores = drawn && figure.scoring.includes(word);

  if (!scores) {
    const status: ReleaseStatus = drawn && dictionary.has(word) ? 'off-theme' : 'unknown';
    return { state: { ...state, selection: [] }, accepted: false, status, word };
  }

  const missed = figure.scoring.filter((w) => w !== word);
  return {
    state: {
      ...state,
      selection: [],
      found: [...state.found, { word, figureIndex: state.figureIndex }],
      letters: state.letters + word.length,
      outcomes: [...state.outcomes, { taken: word, missed }],
      hintCells: [],
      phase: 'crumbling',
      lastWord: word,
      lastPath: state.selection,
    },
    accepted: true,
    status: 'accepted',
    word,
  };
}

/**
 * Анимация рассыпания закончилась: либо следующий блок, либо итог уровня.
 *
 * Уровень закрывается досрочно в обе стороны. Цель взята — играть дальше нечего,
 * исход уже известен. Цель недостижима даже при идеальной игре на оставшихся
 * блоках — тем более: тянуть игрока через заведомо проигранные блоки незачем.
 */
export function finishCrumble(state: GameState): GameState {
  if (state.letters >= state.level.goalLetters) return { ...state, phase: 'won' };

  const next = state.figureIndex + 1;
  const stillPossible = state.level.figures
    .slice(next)
    .reduce((sum, figure) => sum + figure.anchor.length, 0);

  if (next >= state.level.figures.length || state.letters + stillPossible < state.level.goalLetters) {
    return { ...state, phase: 'lost' };
  }
  return {
    ...state,
    figureIndex: next,
    adjacency: buildAdjacency(state.level.figures[next].cells),
    selection: [],
    hintCells: [],
    phase: 'playing',
    lastWord: null,
    lastPath: [],
  };
}

/** Подсказка: подсвечиваем первую букву самого длинного слова фигуры. */
export function useHint(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  const figure = currentFigure(state);
  // Подсказка светит на длинное слово темы: только оно и имеет смысл.
  const target = figure.scoring[0] ?? figure.anchor;
  const best = figure.words.find((w) => w.word === target) ?? figure.words[0];
  if (!best) return state;
  // Каждое нажатие открывает следующую клетку слова: одна клетка показывает,
  // где слово начинается, две — ещё и куда оно идёт. Иначе вторая подсказка
  // ничего не добавляла и выглядела сломанной.
  const shown = Math.min(state.hintCells.length + 1, best.path.length);
  if (shown === state.hintCells.length) return state;
  return {
    ...state,
    hintCells: best.path.slice(0, shown),
    hintsUsed: state.hintsUsed + 1,
  };
}

/** Сколько букв ещё можно набрать на оставшихся блоках при идеальной игре. */
export function lettersStillAvailable(state: GameState): number {
  return state.level.figures
    .slice(state.figureIndex + (state.phase === 'crumbling' ? 1 : 0))
    .reduce((sum, figure) => sum + figure.anchor.length, 0);
}

/**
 * Звук игры.
 *
 * Звуков два рода: тон на каждую букву собираемого слова (они идут по
 * возрастанию, поэтому длинное слово звучит гаммой) и награда за собранное
 * слово. Файлы лежат в `src/content/sounds` и запекаются в сборку такими же
 * base64-строками, как и всё остальное: игра — один файл без внешних запросов,
 * и звук не может быть исключением.
 *
 * Играем через Web Audio, а не через <audio>. Причина простая: <audio> на
 * повторный запуск отматывается в начало и на телефоне отвечает с задержкой
 * в десятки миллисекунд, а буквы идут чаще. Здесь же один раз раскодированный
 * буфер запускается сколько угодно раз и накладывается сам на себя.
 */
import tone01 from '../content/sounds/tone_01.mp3';
import tone02 from '../content/sounds/tone_02.mp3';
import tone03 from '../content/sounds/tone_03.mp3';
import tone04 from '../content/sounds/tone_04.mp3';
import tone05 from '../content/sounds/tone_05.mp3';
import tone06 from '../content/sounds/tone_06.mp3';
import tone07 from '../content/sounds/tone_07.mp3';
import tone08 from '../content/sounds/tone_08.mp3';
import tone09 from '../content/sounds/tone_09.mp3';
import tone10 from '../content/sounds/tone_10.mp3';
import complete from '../content/sounds/word_complete.mp3';

const TONES = [tone01, tone02, tone03, tone04, tone05, tone06, tone07, tone08, tone09, tone10];

const KEY = 'wordblocks.sound.v1';

let context: AudioContext | null = null;
let tones: (AudioBuffer | null)[] = [];
let win: AudioBuffer | null = null;
let muted = stored();

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

/**
 * Байты из строки data:. Через fetch было бы короче, но он асинхронный, а на
 * file:// в части браузеров закрыт совсем — игра же открывается с диска.
 */
function bytes(source: string): ArrayBuffer {
  const binary = atob(source.slice(source.indexOf(',') + 1));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

function decodeWith(where: BaseAudioContext, source: string): Promise<AudioBuffer | null> {
  return new Promise((resolve) => {
    // Форма с колбэками, а не с промисом: в Safari до 15 промис-форма молча
    // не делает ничего, а колбэки работают везде.
    try {
      const maybe = where.decodeAudioData(
        bytes(source),
        (buffer) => resolve(buffer),
        () => resolve(null),
      );
      if (maybe && typeof maybe.then === 'function') {
        void maybe.then(
          (buffer) => resolve(buffer),
          () => resolve(null),
        );
      }
    } catch {
      resolve(null);
    }
  });
}

/*
 * Раскодировать звуки заранее, ещё до первого касания. Играть без касания
 * браузер не даёт, а вот раскодировать — даёт, если делать это в offline-контексте.
 * Разница слышна: первая буква первого свайпа иначе уходит в тишину, потому что
 * на касании декодирование только начинается. Буферы потом играются в обычном
 * контексте — частоту дискретизации он пересчитает сам, если она не совпала.
 *
 * Запускаем не сразу, а после первой отрисовки: одиннадцать файлов — это пара
 * десятков миллисекунд, и они не нужны игре в тот момент, когда она открывается.
 */
function warm(): void {
  const Offline =
    window.OfflineAudioContext ??
    (window as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Offline) return;
  let oven: BaseAudioContext;
  try {
    oven = new Offline(1, 1, 48000);
  } catch {
    return;
  }
  void Promise.all(TONES.map((source) => decodeWith(oven, source))).then((list) => {
    tones = list;
  });
  void decodeWith(oven, complete).then((buffer) => {
    win = buffer;
  });
}
if (typeof window !== 'undefined') setTimeout(warm, 400);

/**
 * Разбудить звук: завести контекст воспроизведения. Браузер разрешает это только
 * из обработчика касания, поэтому зовётся из нажатия. Сами буферы к этому
 * моменту обычно уже готовы (см. warm), но если нет — досчитаются здесь.
 */
export function primeSound(): void {
  if (context) {
    // Вкладку свернули и вернули — контекст просыпается не сам.
    if (context.state === 'suspended') void context.resume();
    return;
  }
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    context = new Ctor();
  } catch {
    return;
  }
  void context.resume();
  if (tones.length === 0) warm();
}

function play(buffer: AudioBuffer | null, volume: number): void {
  if (muted || !context || !buffer) return;
  if (context.state === 'suspended') void context.resume();
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  gain.gain.value = volume;
  source.connect(gain).connect(context.destination);
  source.start();
}

/**
 * Тон буквы по её месту в слове. Слова бывают длиннее, чем тонов: дальше звучит
 * самый верхний — гамма упирается в потолок, но не начинается заново, иначе
 * длинное слово на середине звучало бы как начало нового.
 */
export function playTone(place: number): void {
  play(tones[Math.min(place, tones.length - 1)] ?? null, 0.7);
}

/** Слово собрано. Тише — когда слово не из темы и ушло в копилку. */
export function playWin(volume = 1): void {
  play(win, volume);
}

export function soundMuted(): boolean {
  return muted;
}

export function muteSound(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(KEY, next ? 'off' : 'on');
  } catch {
    // Приватный режим: настройка не переживёт перезагрузку, и это не беда.
  }
}

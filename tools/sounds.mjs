/**
 * Пережать звуки из wav в mp3 для сборки.
 *
 * Игра — один html-файл, и звук запекается в него строкой base64. Исходные wav
 * на это не годятся: одиннадцать файлов по 48 кГц стерео — это 1,1 МБ, в base64
 * полтора мегабайта, то есть сборка выросла бы вдвое. Тоны почти моно (разница
 * каналов около трёх процентов), поэтому они сводятся в один канал; награда
 * остаётся стерео, там разница слышна. Хвост тишины отрезается.
 *
 * Результат — 92 КБ на все звуки, и он лежит в репозитории рядом с wav: mp3
 * нужен сборке, wav остаётся исходником. Скрипт нужен только когда звуки
 * заменили, и требует ffmpeg.
 *
 *   node tools/sounds.mjs
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'sounds');
const wavs = readdirSync(dir).filter((name) => name.endsWith('.wav')).sort();
if (wavs.length === 0) {
  console.error('в src/content/sounds нет ни одного wav');
  process.exit(1);
}

let total = 0;
for (const name of wavs) {
  const out = name.replace(/\.wav$/, '.mp3');
  // Тон — моно и короткий, награда — стерео и подлиннее.
  const tone = name.startsWith('tone');
  execFileSync('ffmpeg', [
    '-loglevel', 'error', '-y',
    '-i', join(dir, name),
    ...(tone ? ['-ac', '1', '-t', '0.37', '-b:a', '80k'] : ['-t', '0.75', '-b:a', '112k']),
    '-codec:a', 'libmp3lame',
    join(dir, out),
  ]);
  const size = statSync(join(dir, out)).size;
  total += size;
  console.log(`${out} — ${(size / 1024).toFixed(1)} КБ`);
}
console.log(`всего ${(total / 1024).toFixed(0)} КБ; пересоберите игру: npm run build`);

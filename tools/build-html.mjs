/**
 * Сборка одного самодостаточного HTML-файла.
 *
 * Весь код и словарь запекаются внутрь, внешних запросов нет — файл открывается
 * двойным кликом с диска и работает без установки чего-либо.
 *
 *   node tools/build-html.mjs             — wordblocks.html (запуск с диска) и docs/index.html (GitHub Pages)
 *   node tools/build-html.mjs --artifact  — плюс dist/artifact.html для публикации ссылкой в Claude
 *
 * Вариант для публикации отличается только обёрткой: страницу-скелет там добавляет
 * хостинг, поэтому в файле остаются лишь заголовок, корневой div и скрипт.
 */
import { build } from 'esbuild';
import { writeFileSync, statSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Метка сборки в часовом поясе автора — она же показывается в игре.
const stamp = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Minsk',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

const result = await build({
  entryPoints: [join(root, 'src/main.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', __BUILD__: JSON.stringify(stamp) },
  loader: { '.json': 'json' },
  write: false,
  logLevel: 'warning',
});

const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
<meta name="theme-color" content="#3f7f68">
<meta http-equiv="Cache-Control" content="no-cache, must-revalidate">
<title>WordBlocks</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23f7f3dd'/><text x='16' y='23' font-size='20' font-family='sans-serif' font-weight='bold' text-anchor='middle' fill='%232c4a3d'>W</text></svg>">
</head>
<body>
<div id="root"></div>
<script>${script}</script>
</body>
</html>
`;

const out = join(root, 'wordblocks.html');
writeFileSync(out, html, 'utf8');
console.log(`wordblocks.html — ${(statSync(out).size / 1024).toFixed(0)} КБ, сборка ${stamp}`);

// Та же игра под именем index.html — это то, что раздаёт GitHub Pages из папки docs.
mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'index.html'), html, 'utf8');
writeFileSync(join(root, 'docs', '.nojekyll'), '', 'utf8');
console.log('docs/index.html — та же сборка для GitHub Pages');

if (process.argv.includes('--artifact')) {
  mkdirSync(join(root, 'dist'), { recursive: true });
  const artifact = `<title>WordBlocks</title>
<div id="root"></div>
<script>${script}</script>
`;
  const artifactPath = join(root, 'dist', 'artifact.html');
  writeFileSync(artifactPath, artifact, 'utf8');
  console.log(`dist/artifact.html — ${(statSync(artifactPath).size / 1024).toFixed(0)} КБ`);
}

import { createRoot } from 'react-dom/client';
import { pickPack } from './content/index.js';
import { createContent } from './core/content.js';
import { App } from './ui/App.js';
import { ContentProvider } from './ui/content.js';
import { css } from './ui/styles.js';

const style = document.createElement('style');
style.textContent = css;
document.head.append(style);

// Язык выбирается до первой отрисовки: от него зависят и словарь, и тексты.
const pack = pickPack();
document.documentElement.lang = pack.htmlLang;
const content = createContent(pack);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <ContentProvider content={content}>
      <App />
    </ContentProvider>,
  );
}

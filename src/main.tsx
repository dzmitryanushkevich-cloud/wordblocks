import { createRoot } from 'react-dom/client';
import { App } from './ui/App.js';
import { css } from './ui/styles.js';

const style = document.createElement('style');
style.textContent = css;
document.head.append(style);

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);

import { createContext, useContext, type ReactNode } from 'react';
import type { GameContent } from '../core/content.js';
import type { UiStrings } from '../content/types.js';

const ContentContext = createContext<GameContent | null>(null);

/** Язык живёт в контексте: интерфейс не должен знать, какой пакет загружен. */
export function ContentProvider({
  content,
  children,
}: {
  content: GameContent;
  children: ReactNode;
}) {
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export function useContent(): GameContent {
  const content = useContext(ContentContext);
  if (!content) throw new Error('Языковой пакет не подключён');
  return content;
}

export function useUi(): UiStrings {
  return useContent().pack.ui;
}

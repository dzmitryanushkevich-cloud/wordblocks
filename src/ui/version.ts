declare const __BUILD__: string | undefined;

/**
 * Метка сборки: подставляется при сборке html. Видна на экране карты уровней
 * и в панели отладки — чтобы по скриншоту было понятно, у кого какая версия.
 */
export const BUILD: string = typeof __BUILD__ === 'undefined' ? 'dev' : __BUILD__;

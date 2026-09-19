/** Звуки запекаются в сборку строкой data: — такими их отдаёт загрузчик esbuild. */
declare module '*.mp3' {
  const source: string;
  export default source;
}

/** Русское склонение после числа: 1 буква, 2 буквы, 5 букв. */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function letters(count: number): string {
  return `${count} ${plural(count, 'буква', 'буквы', 'букв')}`;
}

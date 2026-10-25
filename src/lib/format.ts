const coinFormatter = new Intl.NumberFormat('ru-RU');

export const formatCoins = (value: number) => coinFormatter.format(Math.floor(value));

/** Компактный формат для больших чисел: 12,5K. */
export function formatCompact(value: number) {
  if (value < 10_000) return formatCoins(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 100_000 ? 1 : 0).replace('.', ',')}K`;
  return `${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
}

export function pluralize(n: number, forms: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export const coinWord = (n: number) => pluralize(Math.floor(n), ['нутрик', 'нутрика', 'нутриков']);

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

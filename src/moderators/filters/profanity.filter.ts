const WHITE_LIST = [
  'есть',
  'быть',
  'команда',
  'хотя',
  'тоже',
  'для',
  'оля',
  'хай',
  'хэй',
];

const BANNED_VOCABULARY = [
  'хуй',
  'хуя',
  'хуе',
  'хуи',
  'хул',
  'пизд',
  'пздц',
  'ебат',
  'ебан',
  'ёбан',
  'ебал',
  'еблан',
  'ебт',
  'сука',
  'суч',
  'бля',
  'блж',
  'хуйни',
  'хуйня',
  'заеб',
  'отъеб',
  'наху',
  'уеб',
];

const HOMOGLYPHS: Record<string, string> = {
  a: 'а',
  b: 'в',
  e: 'е',
  k: 'к',
  m: 'м',
  h: 'н',
  o: 'о',
  p: 'р',
  c: 'с',
  t: 'т',
  y: 'у',
  x: 'х',
  '0': 'о',
  '3': 'з',
  '4': 'ч',
  '6': 'б',
  '@': 'a',
  u: 'у',
};

export const profanityFilter = (text: string): boolean => {
  // Проверка 1: Весь текст без пробелов (против "н а х у й")
  const collapsedTotal = normalizeAndCollapse(text);

  for (const banned of BANNED_VOCABULARY) {
    if (collapsedTotal.includes(banned)) {
      // Проверяем, не является ли это слово частью белого списка
      const isWhiteListed = WHITE_LIST.some(
        (white) =>
          collapsedTotal.includes(white) &&
          white.length >= collapsedTotal.length - 1,
      );
      if (!isWhiteListed) return true;
    }
  }

  // Проверка 2: По словам (Левенштейн для опечаток)
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    const cleanWord = normalizeAndCollapse(word);
    if (cleanWord.length < 3 || WHITE_LIST.includes(cleanWord)) continue;

    for (const banned of BANNED_VOCABULARY) {
      const distance = getLevenshteinDistance(cleanWord, banned);

      // Более строгие пороги: только 1 опечатка для коротких матов
      const threshold = banned.length > 5 ? 2 : 1;
      if (distance <= threshold) return true;
    }
  }

  return false;
};

const getLevenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const normalizeAndCollapse = (text: string): string => {
  let normalized = text.toLowerCase();

  for (const [latin, cyrillic] of Object.entries(HOMOGLYPHS)) {
    normalized = normalized.replace(new RegExp(latin, 'g'), cyrillic);
  }

  // Оставляем только буквы
  const clean = normalized.replace(/[^а-яё]/g, '');

  // Схлопываем повторы: "ахуееееено" -> "ахуено"
  return clean.replace(/(.)\1+/g, '$1');
};

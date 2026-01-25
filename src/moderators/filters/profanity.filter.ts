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
  // 'хуя',
  // 'хуе',
  // 'хуи',
  // 'хул',
  'пизд',
  'пздц',
  'ебат',
  'ебан',
  'ёбан',
  'ебал',
  'еблан',
  // 'ебт',
  'сука',
  // 'суч',
  // 'бля',
  // 'блж',
  'хуйни',
  'хуйня',
  'заеб',
  'отъеб',
  'наху',
  'блят',
  // 'уеб',
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
const BANNED_ROOTS = ['хуй', 'пизд', 'ебл', 'бля', 'сук', 'хуя', 'хуе'];

export const profanityFilter = (text: string): boolean => {
  // 1. Сначала проверяем слова по отдельности (как было раньше)
  // Это защищает "сэкономлю", так как "экон" — слишком длинный префикс
  const words = normalizeAndSplit(text);
  for (const word of words) {
    if (checkWord(word)) return true;
  }

  // 2. ТЕПЕРЬ ЛОВИМ "РАЗРЯДКУ" (н а х у й, н.а.х.у.й)
  // Удаляем ВООБЩЕ всё, кроме букв
  const fullCollapsed = text
    .toLowerCase()
    .replace(/[^а-яёa-z]/g, '') // удаляем точки, пробелы, спецсимволы
    // заменяем латиницу на кириллицу (гомоглифы)
    .split('')
    .map((char) => HOMOGLYPHS[char] || char)
    .join('');

  for (const root of BANNED_ROOTS) {
    if (fullCollapsed.includes(root)) {
      // Чтобы не забанить "не будет" (небудет) или "с экономлю",
      // проверяем: если корень найден, является ли он САМИМ текстом
      // или в тексте почти нет других букв.

      const index = fullCollapsed.indexOf(root);
      const prefix = fullCollapsed.substring(0, index);
      const suffix = fullCollapsed.substring(index + root.length);

      // Если общая длина "мусора" вокруг корня очень мала (например, "н а х у й" -> "нахуй")
      // то есть префикс и суффикс короткие (как типичные приставки) — это бан.
      if (prefix.length <= 2 && suffix.length <= 3) {
        // Проверяем, не является ли это "небудет" (префикс "н", суффикс "дет")
        if (root === 'еба' && prefix === 'н' && suffix.startsWith('дет'))
          continue;

        return true;
      }
    }
  }

  return false;
};

function checkWord(word: string): boolean {
  if (word.length < 3) return false;
  const collapsed = word.replace(/(.)\1+/g, '$1');

  for (const root of BANNED_ROOTS) {
    const index = collapsed.indexOf(root);
    if (index !== -1) {
      const prefix = collapsed.substring(0, index);

      if (prefix.length > 4) continue;

      const russianPrefixes = [
        '',
        'а',
        'за',
        'на',
        'по',
        'вы',
        'пере',
        'об',
        'до',
        'у',
        'при',
        'от',
        'с',
        'раз',
        'рас',
      ];
      if (prefix.length > 0 && !russianPrefixes.includes(prefix)) continue;

      return true;
    }
  }
  return false;
}

const normalizeAndSplit = (text: string): string[] => {
  let res = text.toLowerCase();
  for (const [lat, cyr] of Object.entries(HOMOGLYPHS)) {
    res = res.replace(new RegExp(lat, 'g'), cyr);
  }
  return res.replace(/[^а-яё\s]/g, '').split(/\s+/);
};

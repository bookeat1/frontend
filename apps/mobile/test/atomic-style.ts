/**
 * Чтение НАСТОЯЩЕГО стиля элемента, отрисованного react-native-web в jsdom.
 *
 * `getComputedStyle` здесь врёт. react-native-web раскладывает стиль по
 * атомарным классам (`r-fontFamily-…`, `r-fontSize-…`, `r-backgroundColor-…`),
 * а каскад jsdom не доводит их до конца: он отдаёт значения базового класса
 * `css-text-…` — одинаковые и для регулярного, и для полужирного текста
 * (проверено 2026-09-01: font-family обоих узлов приходит системной, размер
 * обоих 14px, хотя в макете 14 и 16). Отступы и высоты `getComputedStyle`
 * при этом отдаёт верно, поэтому старые тесты им пользуются.
 *
 * Здесь мы собираем объявления всех правил, чей селектор — класс с этого
 * элемента, в порядке таблицы стилей. Это ровно то, что react-native-web
 * положил в документ.
 */
export function atomicStyle(element: HTMLElement): Record<string, string> {
  const classes = new Set(Array.from(element.classList));
  const result: Record<string, string> = {};
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      if (!classes.has(rule.selectorText.replace(/^\./, ""))) continue;
      for (const property of Array.from(rule.style)) {
        result[property] = rule.style.getPropertyValue(property);
      }
    }
  }
  // Значение, вычисленное на лету (цвет полосы статуса зависит от брони),
  // react-native-web кладёт не в атомарный класс, а в inline-стиль — и оно
  // перебивает классы, как и положено по каскаду.
  for (const property of Array.from(element.style)) {
    result[property] = element.style.getPropertyValue(property);
  }
  return result;
}

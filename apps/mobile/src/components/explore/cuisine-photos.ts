/**
 * ЗАПАСНЫЕ снимки для кругов «Выберите кухню» — те, что лежат в самой сборке.
 *
 * Основной источник теперь справочник: `GET /cuisines` отдаёт `image_url`, и
 * круг рисует его. Вшитые картинки НЕ УДАЛЕНЫ и удалять их пока нельзя — на
 * бою 2026-08-25 справочник не прислал `image_url` НИ У ОДНОЙ из 14 кухонь
 * (сами файлы в R2 уже лежат, но в записях справочника ссылка не проставлена).
 * Убери их сейчас — и ряд, где вчера были картинки, станет рядом серых кругов.
 * Поэтому порядок такой:
 *
 *   1. `cuisine.imageUrl` из справочника;
 *   2. вшитый снимок по коду кухни — если ссылки нет ИЛИ она не загрузилась
 *      (см. onError в CuisineChip: битая ссылка выглядит для гостя ровно так
 *      же, как её отсутствие, и лечится тем же);
 *   3. фотография реального заведения этой кухни (useCuisinePhotos);
 *   4. кухни без всякой картинки в ряду не показываются.
 *
 * Ключи — КОДЫ справочника (латиница, `european`), потому что теперь именно
 * код является `Cuisine.id`. Кириллические ключи оставлены рядом: у заведения
 * без набора кухонь id остаётся casefold от старой строки `cuisine_type`, и
 * такому чипу тоже нужна картинка. Пересечься наборы не могут — латиница и
 * кириллица.
 *
 * Файлы — 3x-экспорты из макета (node 3106:12265), те же, что загружены в R2.
 * Своего снимка нет у четырёх кухонь справочника: `authors`, `japanese`,
 * `georgian`, `pan_asian` — в макете их картинок нет, и в R2 их тоже нет.
 */
// Ресурс Metro подключается только через require, и именно ВНУТРИ литерала:
// вынесенный в переменную `const x = require(...)` линтер запрещает
// (@typescript-eslint/no-var-requires).
const photos: Record<string, number> = {
  // Коды справочника.
  european: require("../../../assets/cuisines/european.png"),
  mediterranean: require("../../../assets/cuisines/mediterranean.png"),
  seafood: require("../../../assets/cuisines/seafood.png"),
  kazakh: require("../../../assets/cuisines/kazakh.png"),
  italian: require("../../../assets/cuisines/italian.png"),
  turkish: require("../../../assets/cuisines/turkish.png"),
  french: require("../../../assets/cuisines/french.png"),
  greek: require("../../../assets/cuisines/greek.png"),
  // В справочнике «Восточная» — это код `oriental`, а файл называется eastern.
  oriental: require("../../../assets/cuisines/eastern.png"),
  vegan: require("../../../assets/cuisines/vegan.png"),
  // Старые текстовые кухни: заведение, которому набор из справочника ещё не
  // проставили, приходит с id вида casefold(cuisine_type). Повторный require
  // того же файла — тот же ресурс, второй копии в сборке не появляется.
  европейская: require("../../../assets/cuisines/european.png"),
  средиземноморская: require("../../../assets/cuisines/mediterranean.png"),
  морепродукты: require("../../../assets/cuisines/seafood.png"),
  казахская: require("../../../assets/cuisines/kazakh.png"),
  итальянская: require("../../../assets/cuisines/italian.png"),
  турецкая: require("../../../assets/cuisines/turkish.png"),
  французская: require("../../../assets/cuisines/french.png"),
  греческая: require("../../../assets/cuisines/greek.png"),
  восточная: require("../../../assets/cuisines/eastern.png"),
  веганская: require("../../../assets/cuisines/vegan.png"),
  // «Пекарня» — только старый текст: кухни с таким кодом в справочнике нет.
  пекарня: require("../../../assets/cuisines/bakery.png"),
};

export function cuisinePhoto(cuisineId: string): number | undefined {
  return photos[cuisineId];
}

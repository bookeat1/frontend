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
 * ОТКУДА ФАЙЛЫ. Десять снимков — 3x-экспорты из макета (node 3106:12265), те
 * же, что загружены в R2. Ещё пять добавлены 2026-09-01 по правке владельца
 * («у части кухонь вместо фото рисуется буква»): картинок для `indian`,
 * `georgian`, `japanese`, `pan_asian` и `authors` нет ни в макете, ни в R2, ни
 * в справочнике, поэтому они взяты со стороны.
 *
 * ВСЕ ПЯТЬ — CC0 с Викисклада, то есть общественное достояние: снимок в
 * бинарнике приложения не должен требовать ни разрешения, ни подписи под
 * кругом, которой в макете нет. Лицензия проверена по `extmetadata`
 * (`LicenseShortName`), а не по виду страницы. Кадр квадратный 288×288 (3x от
 * круга 96), обрезан по центру блюда — как у соседних файлов.
 *
 *   indian.png    Chicken Tikka Masala — Mohammed — Spice Of Life.jpg, Andy Li
 *   georgian.png  Adjarian Khachapuri. Saint Petersburg, 2024-07-24.jpg, Bestalex
 *   japanese.png  Sushi Plate in Organic Sushi Prague 4.jpg, Mojmir Churavy
 *   pan-asian.png Pad Thai Noodles — Little Thai, Brighton 2024-03-21.jpg, Andy Li
 *   authors.png   Gourmet meal and white wine (Unsplash).jpg, Jay Wennington
 *
 * Все пять лежат на commons.wikimedia.org под теми же именами.
 *
 * ЭТО ЗАПЛАТКА, А НЕ РЕШЕНИЕ. Правильное место для снимка кухни — справочник:
 * тогда новая кухня получает круг без новой сборки. Пока `GET /cuisines` не
 * отдаёт `image_url` ни у одной из пятнадцати записей (проверено на тесте
 * 2026-09-01), выбор стоит между вшитым файлом и монограммой.
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
  indian: require("../../../assets/cuisines/indian.png"),
  georgian: require("../../../assets/cuisines/georgian.png"),
  japanese: require("../../../assets/cuisines/japanese.png"),
  pan_asian: require("../../../assets/cuisines/pan-asian.png"),
  authors: require("../../../assets/cuisines/authors.png"),
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
  индийская: require("../../../assets/cuisines/indian.png"),
  грузинская: require("../../../assets/cuisines/georgian.png"),
  японская: require("../../../assets/cuisines/japanese.png"),
  паназиатская: require("../../../assets/cuisines/pan-asian.png"),
  авторская: require("../../../assets/cuisines/authors.png"),
  // «Пекарня» — только старый текст: кухни с таким кодом в справочнике нет.
  пекарня: require("../../../assets/cuisines/bakery.png"),
};

export function cuisinePhoto(cuisineId: string): number | undefined {
  return photos[cuisineId];
}

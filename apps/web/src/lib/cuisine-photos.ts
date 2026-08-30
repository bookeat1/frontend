/**
 * ЗАПАСНЫЕ снимки для кругов «Выберите кухню».
 *
 * Основной источник — справочник: `GET /cuisines` отдаёт `image_url`, и круг
 * рисует его. Но поле необязательное, и на тестовом стенде 2026-08-30 его нет
 * НИ У ОДНОЙ из 14 записей (проверено запросом), а на бою — у четырёх из
 * четырнадцати. Без запасного снимка ряд превращается в строй пустых серых
 * кругов, что владелец и увидел на стенде.
 *
 * Порядок источников (см. CuisineTile):
 *   1. `cuisine.imageUrl` из справочника;
 *   2. снимок отсюда по КОДУ кухни — если ссылки нет ИЛИ она не загрузилась
 *      (битая ссылка для гостя выглядит ровно как отсутствующая);
 *   3. монограмма — первая буква названия на фирменной подложке.
 *
 * Файлы — те же экспорты из макета (Figma node 3106:12265), что лежат в
 * `apps/mobile/assets/cuisines`, уменьшенные до 208×208 (2× круга 104) и
 * переведённые в webp: 176 КБ на все одиннадцать вместо 1,5 МБ исходников.
 * ДОЛГ: сейчас это ВТОРАЯ копия одних и тех же картинок в репозитории. Общего
 * места для бинарных ассетов у монорепозитория нет (`design-tokens` — чистый
 * TypeScript), заводить его ради одиннадцати файлов в рамках правки вёрстки
 * не стали.
 *
 * Ключи — коды справочника: `mapCuisine` кладёт в `Cuisine.id` именно `code`
 * (латиница). Своего снимка нет у четырёх кодов справочника — `pan_asian`,
 * `georgian`, `authors`, `japanese`: их нет ни в макете, ни в R2. Им достаётся
 * монограмма.
 */

/**
 * Префикс, под которым раздаётся сайт. Нужен руками: `next/image` со СВОИМ
 * загрузчиком (`images.loader: "custom"`) отдаёт адрес как есть и basePath к
 * нему не приписывает — на стенде `/web-preview` ссылка `/cuisines/…`
 * вернула бы 404 бэкенда.
 */
const ASSET_PREFIX = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/** Имя файла отличается от кода только у «Восточной»: `oriental` → eastern. */
const FILES: Record<string, string> = {
  european: "european",
  mediterranean: "mediterranean",
  seafood: "seafood",
  kazakh: "kazakh",
  italian: "italian",
  turkish: "turkish",
  french: "french",
  greek: "greek",
  oriental: "eastern",
  vegan: "vegan",
  // Кода `bakery` в справочнике нет, но файл из макета есть: заведению со
  // старой текстовой кухней «Пекарня» id считается как casefold названия.
  bakery: "bakery",
  пекарня: "bakery",
};

export function cuisinePhoto(cuisineId: string): string | undefined {
  const file = FILES[cuisineId.trim().toLowerCase()];
  return file ? `${ASSET_PREFIX}/cuisines/${file}.webp` : undefined;
}

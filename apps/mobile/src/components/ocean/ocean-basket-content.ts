import type { MenuDish, MenuSection, RestaurantSummary } from "@bookeat/api";
import dishFullDeckPlatter from "../../../assets/ocean-basket/dish-full-deck-platter.jpg";
import dishKingPrawns from "../../../assets/ocean-basket/dish-king-prawns.jpg";
import letteringExpedition from "../../../assets/ocean-basket/lettering-expedition.png";
import letteringSeafood from "../../../assets/ocean-basket/lettering-seafood.png";
import mapAlmaty from "../../../assets/ocean-basket/map-almaty.png";
import storyChapter1 from "../../../assets/ocean-basket/story-chapter-1.png";
import storyChapter2 from "../../../assets/ocean-basket/story-chapter-2.jpg";
import storyChapter3 from "../../../assets/ocean-basket/story-chapter-3.jpg";
import storyChapter4 from "../../../assets/ocean-basket/story-chapter-4.jpg";

/**
 * ЗАШИТОЕ СОДЕРЖИМОЕ фирменной страницы Ocean Basket — макет
 * 3z0f6dgev4HMwBAHPjTjPo, node 3424:3927 («Ocean Basket / Mobile / 390»).
 *
 * ПОЧЕМУ ЗАШИТО. У бэкенда нет ручки «блоки фирменной страницы»: ответ
 * `GET /gastroguide/collections/:slug` несёт ровно `{title, subtitle,
 * description, coverImageUrl, venueCount, categorySlugs, venues[]}` — ни
 * фирменной графики, ни блюд, ни глав истории (разбор — в спеке
 * `specs/bookeat-gastroguide-brand-pages.md`). Решение владельца 2026-09-01:
 * собрать страницу вёрсткой, живыми оставить только точки. Он знает и принял,
 * что править эти строки сможет только разработчик.
 *
 * ЖИВОГО на экране ДВА: карточки точек с переходом на экран заведения и —
 * с 2026-09-03 — блок «Фирменный улов», где название и цена блюда приходят
 * из меню первой точки (см. `OCEAN_SIGNATURE_DISHES`). Всё остальное здесь.
 */

/** Слаг страницы. По нему же собран маршрут `/brand/ocean-basket`. */
export const OCEAN_BASKET_SLUG = "ocean-basket";

/**
 * Строка поиска, которой ищутся живые точки бренда.
 *
 * Идентификаторы заведений НЕ ЗАШИТЫ намеренно: на тесте и на проде это разные
 * записи с разными UUID, и зашитый id молча показал бы пустую страницу в одной
 * из сред. `GET /restaurants/search?q=Ocean Basket` отвечает ровно точками
 * бренда (проверено на тесте 2026-09-01: три заведения — Panfilova,
 * Dostyk Plaza, Mega Center).
 */
export const OCEAN_BASKET_SEARCH_TEXT = "Ocean Basket";

/**
 * Инстаграм бренда (node 3443:12579) — открывается по стрелке блока.
 *
 * С ТОЧКОЙ: настоящий аккаунт — instagram.com/oceanbasket.kz. В макете ник
 * написан «oceanbasketkz», и до 2026-09-03 ссылка вела на несуществующую
 * страницу. Подпись в словаре (`oceanBasket.instagramHandle`) обязана
 * совпадать с этой константой — держится тестом.
 */
export const OCEAN_BASKET_INSTAGRAM = "oceanbasket.kz";

/**
 * Отбор точек бренда из ответа поиска.
 *
 * Поиск сервера ищет и по меню (`matched_dish`), поэтому на запрос про
 * морепродукты в выдачу может попасть чужое заведение. Страница бренда обязана
 * показывать ТОЛЬКО его точки, поэтому имя проверяется здесь: сравнение по
 * началу названия, без учёта регистра и лишних пробелов.
 */
export function isOceanBasketVenue(venue: RestaurantSummary): boolean {
  return venue.name.trim().toLocaleLowerCase("ru-RU").startsWith("ocean basket");
}

/**
 * Имя точки на карточке.
 *
 * В каталоге заведение называется «Ocean Basket Dostyk Plaza», а в макете на
 * карточке написано «Dostyk Plaza» (node 3441:12293): внутри фирменной
 * страницы имя бренда повторять незачем. Отрезается ТОЛЬКО ведущее имя бренда
 * и только если после него что-то осталось: заведение, названное ровно
 * «Ocean Basket», сохраняет своё имя целиком, а не превращается в пустую
 * строку.
 */
export function oceanPointName(name: string): string {
  const trimmed = name.trim();
  const rest = trimmed.slice(OCEAN_BASKET_SEARCH_TEXT.length).trim();
  const startsWithBrand = trimmed
    .toLocaleLowerCase("ru-RU")
    .startsWith(OCEAN_BASKET_SEARCH_TEXT.toLocaleLowerCase("ru-RU"));
  return startsWithBrand && rest ? rest : trimmed;
}

/**
 * Разрядка надписи пробелами — «ГОТОВЫ К УЛОВУ?» → «Г О Т О В Ы   К   У Л О В У ?».
 *
 * В макете разрядка набрана ПРОБЕЛАМИ внутри самой строки (узлы 3443:12463,
 * 3443:12571, 3443:12584), а не свойством `letterSpacing`. Повторяем приём, но
 * держим в словаре обычную строку: иначе переводчику пришлось бы расставлять
 * пробелы руками на каждом языке. Скринридеру при этом отдаётся ИСХОДНАЯ
 * строка (`accessibilityLabel`), иначе он читает надпись по буквам.
 */
export function spacedOut(text: string): string {
  return [...text].join(" ");
}

/**
 * Картинки страницы — экспорт из макета (заливки узлов 3426:9633, 3441:12385,
 * 3441:12390, 3443:12597 и надписи 3425:3940, 3425:3941).
 *
 * Ресурс Metro подключается только через `require` и именно ВНУТРИ литерала —
 * то же правило, что у снимков кухонь (`explore/cuisine-photos.ts`).
 */
/**
 * Картинки страницы подключены СТАТИЧЕСКИМ ИМПОРТОМ, а не `require`, — тем же
 * способом, что снимки в `packages/api/src/mock-data.ts`. Metro понимает оба,
 * но `require` внутри модуля, который импортирует экран гастрогида, роняет
 * тестовый прогон: Node не умеет требовать .png во время выполнения, а импорт
 * Vite разбирает на этапе сборки.
 */
export const oceanAssets = {
  /** «Seafood» шрифтом Lobster (node 3425:3940). Шрифта в приложении нет и не
   * будет — надпись приезжает картинкой, как её нарисовал дизайнер. */
  letteringSeafood,
  /** «Expedition» (node 3425:3941). */
  letteringExpedition,
  /** НАРИСОВАННАЯ карта точек (node 3426:9633). Не живая карта: прокси
   * статических карт на проде выключен, а координаты есть у меньшинства
   * заведений — см. раздел 9 спеки фирменных страниц. */
  map: mapAlmaty,
  /** Фотографии блюд (узлы 3441:12385, 3441:12390). Кадрированы ТАК ЖЕ, как
   * в макете (`imageTransform` заливки): у первой видны верхние 77 % снимка —
   * ниже на нём впечатано название блюда, и в макете оно обрезано. */
  dishFullDeckPlatter,
  dishKingPrawns,
  /** Фотография под текстом первой главы (node 3443:12597). Тоже кадрирована
   * по макету: снимок сдвинут вправо, слева остаётся прозрачное поле, сквозь
   * которое видно синюю подложку главы. Поэтому PNG, а не JPEG. */
  storyChapter1,
  /** Фотографии глав 2–4 — заливки тел вариантов 5012:5196, 5012:5211,
   * 5012:5227 (`scaleMode FILL`, то есть `cover`). Ужаты до 700 по ширине из
   * исходников по 2–2,7 МБ; прозрачности у них нет, поэтому JPEG. */
  storyChapter2,
  storyChapter3,
  storyChapter4,
} as const;

/** Фотография главы истории по индексу словарного массива `chapters`. */
export const oceanChapterPhotos: readonly number[] = [
  oceanAssets.storyChapter1,
  oceanAssets.storyChapter2,
  oceanAssets.storyChapter3,
  oceanAssets.storyChapter4,
];

/**
 * «ФИРМЕННЫЙ УЛОВ» — привязка карточек макета к настоящим блюдам меню.
 *
 * Название и цена НЕ ЗАШИТЫ: они читаются из `GET /restaurants/:id/menu`
 * первой точки бренда в выдаче, иначе разъехались бы с меню при первой же
 * смене прайса. Здесь только то, чего в меню нет, — фотография из макета и
 * ИМЯ, по которому блюдо ищется (сверено с меню всех трёх точек 2026-09-03:
 * «Full Deck Platter» 37 990 и «King Креветки 6 шт» 15 090, в макете эти же
 * два блюда, узлы 3441:12384 и 3441:12389).
 *
 * Почему первая точка, а не каждая: блок общий для бренда, а цена и фото у
 * трёх точек совпадают (решение владельца 2026-09-03). Почему полное меню,
 * а не лента «Лучшие позиции»: лента отдаёт восемь блюд по отметке
 * заведения, и стоит ему снять отметку — блюдо пропадает, хотя в меню оно
 * есть.
 */
export const OCEAN_SIGNATURE_DISHES: readonly { menuName: string; photo: number }[] = [
  { menuName: "Full Deck Platter", photo: oceanAssets.dishFullDeckPlatter },
  { menuName: "King Креветки 6 шт", photo: oceanAssets.dishKingPrawns },
];

/**
 * Имя блюда в виде, пригодном для сравнения: без регистра, лишних пробелов и
 * разницы «ё/е» — так же, как сравнивает подписи кухонь `cuisineIdFor`.
 * Заведение правит меню руками, и «King креветки  6 шт» — то же блюдо.
 */
export function normalizeDishName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е");
}

/**
 * Блюдо по имени из всех разделов меню. `undefined` — в меню такого нет
 * (переименовали, убрали): карточка остаётся нейтральной, а не падает и не
 * подставляет чужое блюдо. Первое совпадение — блюдо может лежать в двух
 * разделах («Платтеры» и «Хиты»), это одно и то же блюдо.
 */
export function findMenuDish(sections: readonly MenuSection[], menuName: string): MenuDish | undefined {
  const wanted = normalizeDishName(menuName);
  for (const section of sections) {
    const dish = section.dishes.find((item) => normalizeDishName(item.name) === wanted);
    if (dish) return dish;
  }
  return undefined;
}

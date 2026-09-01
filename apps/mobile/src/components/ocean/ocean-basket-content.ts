import type { RestaurantSummary } from "@bookeat/api";
import dishFullDeckPlatter from "../../../assets/ocean-basket/dish-full-deck-platter.jpg";
import dishKingPrawns from "../../../assets/ocean-basket/dish-king-prawns.jpg";
import letteringExpedition from "../../../assets/ocean-basket/lettering-expedition.png";
import letteringSeafood from "../../../assets/ocean-basket/lettering-seafood.png";
import mapAlmaty from "../../../assets/ocean-basket/map-almaty.png";
import storyChapter1 from "../../../assets/ocean-basket/story-chapter-1.png";

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
 * ЖИВОЕ на экране РОВНО ОДНО — карточки точек и переход с них на экран
 * заведения. Всё остальное здесь.
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

/** Инстаграм бренда (node 3443:12579) — открывается по стрелке блока. */
export const OCEAN_BASKET_INSTAGRAM = "oceanbasketkz";

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
} as const;

/** Фотографии блюд в порядке макета — по индексу словарного массива `dishes`. */
export const oceanDishPhotos = [
  oceanAssets.dishFullDeckPlatter,
  oceanAssets.dishKingPrawns,
] as const;

/**
 * Фотография главы истории по индексу.
 *
 * В макете раскрыта ОДНА глава — первая, и фотография нарисована только у неё
 * (node 3443:12597). У остальных трёх ни текста, ни картинки нет, поэтому
 * здесь `undefined`, а не подставленный чужой снимок.
 */
export const oceanChapterPhotos: readonly (number | undefined)[] = [
  oceanAssets.storyChapter1,
  undefined,
  undefined,
  undefined,
];

import type { MenuDish, MenuSection, RestaurantSummary } from "@bookeat/api/client";
import { assetUrl } from "@web/lib/asset";

/**
 * СОДЕРЖИМОЕ фирменной страницы Ocean Basket на сайте — `/brand/ocean-basket`,
 * Figma `qmMsg4jO1ggmyEHNIAD2ll`, кадр «WEB / 14 · Ocean Basket» (узел
 * 5115:9771). Копия того же приёма, что у мобильного экрана
 * (`apps/mobile/src/components/ocean/ocean-basket-content.ts`, PR #105,
 * решение владельца 2026-09-01): бэкенд не отдаёт блоки фирменной страницы
 * (`gastroguide_page_sections` из спеки `bookeat-gastroguide-brand-pages.md`
 * так и не реализован), поэтому текст и графика зашиты, а живые — только
 * точки бренда и «Фирменный улов» из настоящего меню.
 *
 * Тексты берутся из общего словаря `t.oceanBasket` (`@bookeat/i18n`), а не
 * дублируются здесь: словарь один на мобилку и веб, и правка для одной
 * платформы автоматически не разъезжается со второй.
 */

/** По этому слагу `GuideScreen` ведёт на `/brand/ocean-basket` вместо
 * несуществующей страницы подборки. */
export const OCEAN_BASKET_SLUG = "ocean-basket";

/** Строка поиска живых точек бренда — см. `use-ocean-basket-venues.ts`. */
export const OCEAN_BASKET_SEARCH_TEXT = "Ocean Basket";

/** Настоящий инстаграм бренда — с точкой (в макете без неё, ссылка вела бы в
 * никуда, см. `bugs/bookeat-frontend-ocean-instagram-handle-wrong.md`). */
export const OCEAN_BASKET_INSTAGRAM = "oceanbasket.kz";

/** Отбор точек бренда из ответа поиска — сервер ищет и по меню, чужое
 * заведение попадать на страницу бренда не должно. */
export function isOceanBasketVenue(venue: RestaurantSummary): boolean {
  return venue.name.trim().toLocaleLowerCase("ru-RU").startsWith("ocean basket");
}

/** Имя точки на карточке без повторения имени бренда («Dostyk Plaza», а не
 * «Ocean Basket Dostyk Plaza»). Заведение, названное ровно «Ocean Basket»,
 * сохраняет имя целиком. */
export function oceanPointName(name: string): string {
  const trimmed = name.trim();
  const rest = trimmed.slice(OCEAN_BASKET_SEARCH_TEXT.length).trim();
  const startsWithBrand = trimmed
    .toLocaleLowerCase("ru-RU")
    .startsWith(OCEAN_BASKET_SEARCH_TEXT.toLocaleLowerCase("ru-RU"));
  return startsWithBrand && rest ? rest : trimmed;
}

/** Разрядка надписи пробелами — «ГОТОВЫ К УЛОВУ?» → «Г О Т О В Ы …». Экрану
 * читателя отдаётся исходная строка через `aria-label`, разрядка — только
 * визуальная. */
export function spacedOut(text: string): string {
  return [...text].join(" ");
}

/** Локальные картинки страницы — скопированы из `apps/mobile/assets/ocean-basket`
 * (те же экспорты из макета) в `apps/web/public/ocean-basket`. */
export const oceanAssets = {
  map: assetUrl("/ocean-basket/map-almaty.png"),
  /** Фото витрины в шапке (`OceanHero`) — вечерний фасад с неоновой вывеской
   * «Ocean Basket» из макета (2026-09-09, найдено в Figma вместо случайного
   * `coverPhoto` первой точки бренда из бэкенда). */
  storefrontPhoto: assetUrl("/ocean-basket/storefront-night.png"),
  /** Фирменная надпись «Seafood Expedition» — леттеринг из макета (не
   * шрифт), те же PNG, что у мобильного `OceanHero`, скопированы 1:1 из
   * `apps/mobile/assets/ocean-basket`. */
  letteringSeafood: assetUrl("/ocean-basket/lettering-seafood.png"),
  letteringExpedition: assetUrl("/ocean-basket/lettering-expedition.png"),
  dishFullDeckPlatter: assetUrl("/ocean-basket/dish-full-deck-platter.jpg"),
  dishKingPrawns: assetUrl("/ocean-basket/dish-king-prawns.jpg"),
  storyChapter1: assetUrl("/ocean-basket/story-chapter-1.png"),
  storyChapter2: assetUrl("/ocean-basket/story-chapter-2.jpg"),
  storyChapter3: assetUrl("/ocean-basket/story-chapter-3.jpg"),
  storyChapter4: assetUrl("/ocean-basket/story-chapter-4.jpg"),
} as const;

/** Фотография главы истории по индексу словарного массива `chapters`. */
export const oceanChapterPhotos: readonly string[] = [
  oceanAssets.storyChapter1,
  oceanAssets.storyChapter2,
  oceanAssets.storyChapter3,
  oceanAssets.storyChapter4,
];

/**
 * «Фирменный улов» — привязка карточек макета к настоящим блюдам меню.
 * Название и цена НЕ зашиты: читаются из меню первой точки бренда
 * (`GET /restaurants/:id/menu`), сверено с меню 2026-09-03: «Full Deck
 * Platter» и «King Креветки 6 шт».
 */
export const OCEAN_SIGNATURE_DISHES: readonly { menuName: string; photo: string }[] = [
  { menuName: "Full Deck Platter", photo: oceanAssets.dishFullDeckPlatter },
  { menuName: "King Креветки 6 шт", photo: oceanAssets.dishKingPrawns },
];

/** Имя блюда в виде, пригодном для сравнения — без регистра, лишних пробелов
 * и разницы «ё/е». */
export function normalizeDishName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е");
}

/** Блюдо по имени из всех разделов меню. `undefined` — блюда с таким именем
 * в меню нет (переименовали, убрали). */
export function findMenuDish(sections: readonly MenuSection[], menuName: string): MenuDish | undefined {
  const wanted = normalizeDishName(menuName);
  for (const section of sections) {
    const dish = section.dishes.find((item) => normalizeDishName(item.name) === wanted);
    if (dish) return dish;
  }
  return undefined;
}

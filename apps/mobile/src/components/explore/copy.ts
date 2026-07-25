/**
 * Russian copy for the Explore screen.
 *
 * TEMPORARY HOME. Every other string in the app lives in `@bookeat/i18n`
 * (`packages/i18n/src/ru.ts`) and this block belongs there too — it is here
 * only because this task was scoped to `components/explore/**` and a shared
 * package edited by two agents at once is a merge conflict waiting to happen.
 * Moving it is a copy-paste under an `explore:` key plus an import swap.
 *
 * The Figma reference is in English ("Popular Restaurants", "Chef's Picks",
 * "Restaurant, cuisine, or dish"). The app's interface language is Russian
 * (owner's standing rule), so the section titles are translated rather than
 * transcribed; "Gastroguide" is kept as a proper name (Гастрогид).
 */
export const exploreCopy = {
  searchPlaceholder: "Заведение, кухня или блюдо",
  seeAll: "Смотреть все",

  popularTitle: "Популярные заведения",
  popularLoading: "Загружаем заведения…",
  popularEmptyTitle: "Пока нечего показать",
  popularEmptyDescription: "Загляните в поиск — там есть весь каталог",
  popularEmptyAction: "Открыть поиск",
  popularErrorTitle: "Заведения не загрузились",
  popularErrorDescription: "Проверьте соединение и попробуйте ещё раз",

  chefsPicksTitle: "Выбор шефа",
  gastroguideTitle: "Гастрогид",
  eventsTitle: "События",

  /** Line under the venue name on a Popular card: "Сегодня · 2 гостя". */
  todayGuests: (guests: number) => `Сегодня · ${guests} ${guestsWord(guests)}`,
  slotsUnavailable: "Сегодня свободного времени нет",
  slotsFailed: "Время не загрузилось",

  favoriteAdd: (name: string) => `Добавить «${name}» в избранное`,
  favoriteRemove: (name: string) => `Убрать «${name}» из избранного`,
  bookAt: (name: string, time: string) => `Забронировать в «${name}» на ${time}`,
  heroBanner: (index: number, total: number) => `Баннер ${index} из ${total}`,
  sectionSeeAll: (section: string) => `${section}: смотреть все`,
} as const;

function guestsWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return "гостей";
  if (mod10 === 1) return "гость";
  if (mod10 >= 2 && mod10 <= 4) return "гостя";
  return "гостей";
}

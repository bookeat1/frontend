/**
 * Справочник удобств заведения («Удобства»): чистая логика выбора, порядка и
 * фильтра — без DOM и без запросов.
 *
 * Почему отдельным модулем, а не внутри компонента: те же правила нужны трём
 * владельцам — форме заведения у суперадмина, карточке «Удобства» в настройках
 * самого заведения и экрану справочника. Ровно та же развилка, что у кухонь
 * (см. `cuisines.ts`), и разведена она так же.
 *
 * Контракт сервера (прочитан в `internal/usecase/venuefeatures/facade.go` и
 * `internal/transport/rest/venuefeatures/{handler,dto}.go`, ветка develop
 * бэкенда `7765c1c`, ручки УЖЕ на бою):
 *   • `GET /venue-features` — публично, активные записи в порядке справочника;
 *     `GET /admin/venue-features` — со скрытыми (только суперадмин);
 *   • набор удобств заведения пишется ЦЕЛИКОМ:
 *     `PUT /restaurants/:id/features` с `{feature_ids: [...]}`;
 *   • повторы сервер схлопывает (dedupe), и потолок `MaxFeaturesPerVenue = 15`
 *     считает ПОСЛЕ этого — клиент считает так же;
 *   • скрытую запись назначить нельзя (ErrValidation) — в выборе только
 *     активные, но уже выбранная скрытая из набора НЕ выбрасывается;
 *   • свободнотекстовая запись удобств через `PATCH /restaurants/:id` теперь
 *     ОТВЕРГАЕТСЯ (422): ключ `features` в теле заведения слать нельзя вовсе;
 *   • взаимоисключающих пар сервер не проверяет намеренно («Детские стульчики»
 *     и «Без детей» противоположны по смыслу, но не по технике) — клиент тоже
 *     не выдумывает таких правил.
 */

/** Потолок набора удобств у заведения — `MaxFeaturesPerVenue` на сервере. */
export const MAX_VENUE_FEATURES = 15;

/** Удобство внутри ответа о заведении: справочные поля, без служебных. */
export interface VenueFeature {
  id: string;
  /** Машинный ключ (`wifi`, `prayer_room`). В ответе о заведении поле
   * `omitempty` — на старых записях его может не быть. */
  code?: string;
  name: string;
  name_i18n?: Record<string, string>;
}

/** Запись справочника целиком — как её видит платформа
 * (`GET /admin/venue-features`). */
export interface VenueFeatureDictionaryEntry extends VenueFeature {
  code: string;
  display_order: number;
  is_active: boolean;
  /** У скольких заведений это удобство проставлено. Приходит ВСЕГДА (на
   * сервере поле без `omitempty`), потому что интересен здесь именно ноль:
   * это удобство, которое ещё никто не заполнил. */
  venue_count: number;
}

/** Тело POST/PATCH `/admin/venue-features`. Все поля необязательны: PATCH
 * меняет только присланные ключи (на сервере они указатели). */
export interface VenueFeatureSaveInput {
  code?: string;
  name?: string;
  name_i18n?: Record<string, string>;
  display_order?: number;
  is_active?: boolean;
}

/** Причина, по которой удобство не отметилось. Текст выбирает компонент. */
export type VenueFeatureSelectError = "limit_reached";

export type VenueFeatureSelectResult =
  | { ok: true; ids: string[] }
  | { ok: false; error: VenueFeatureSelectError };

/** id-шники набора в том порядке, в котором они пришли. */
export function venueFeatureIdsOf(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id);
}

/**
 * Ставит и снимает галочку.
 *
 * Снятие не может не получиться — оно всегда `ok`. Отказ бывает ровно один:
 * потолок в 15 удобств, и он проверяется ТОЛЬКО при постановке галочки. Иначе
 * заведение, у которого уже 15 (или, из старых данных, больше), не смогло бы
 * снять лишнее.
 */
export function toggleVenueFeature(
  selected: readonly string[],
  id: string,
): VenueFeatureSelectResult {
  if (selected.includes(id)) {
    return { ok: true, ids: selected.filter((item) => item !== id) };
  }
  if (selected.length >= MAX_VENUE_FEATURES) return { ok: false, error: "limit_reached" };
  return { ok: true, ids: [...selected, id] };
}

/**
 * Один и тот же набор, порядок не важен.
 *
 * У кухонь сравнение позиционное — там первая позиция это главная кухня и
 * порядок часть данных. Удобства — галочки: сервер хранит их в порядке
 * присылки, но ни один экран этим порядком не пользуется, а позиционное
 * сравнение здесь означало бы лишнюю запись каждый раз, когда набор пришёл
 * с сервера в другом порядке, чем его собрала форма.
 */
export function sameVenueFeatureSelection(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** Порядок справочника: сперва display_order, при равенстве — по названию.
 * Второй ключ обязателен: у свежих записей display_order совпадает, и без него
 * список прыгал бы между рендерами. */
export function sortVenueFeatures<T extends { display_order: number; name: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "ru"),
  );
}

/** Только то, что заведению разрешено выбирать: скрытую запись сервер
 * отвергнет с 422. */
export function activeVenueFeatures<T extends { is_active: boolean }>(items: readonly T[]): T[] {
  return items.filter((item) => item.is_active);
}

/**
 * Список для выбора: активный справочник плюс те удобства заведения, которых в
 * нём уже нет (скрыли после того, как заведение их выбрало). Показать такое
 * удобство честнее, чем молча выбросить его из набора при первом сохранении.
 */
export function mergeVenueFeatureOptions(
  dictionary: readonly VenueFeature[],
  current: readonly VenueFeature[],
): VenueFeature[] {
  const known = new Set(dictionary.map((item) => item.id));
  return [...dictionary, ...current.filter((item) => !known.has(item.id))];
}

/** Правка display_order одной записи справочника, которую нужно отправить. */
export interface VenueFeatureOrderPatch {
  id: string;
  display_order: number;
}

/**
 * Перестановка записи справочника на одну позицию.
 *
 * Отдельной ручки «поменять местами» у удобств нет (в отличие от городов, где
 * есть `PUT /admin/cities/order`), поэтому перестановка — это пачка PATCH-ей.
 * Возвращаются ТОЛЬКО реально меняющиеся правки; у боевого справочника
 * display_order идёт с шагом 10 (10, 20, 30…), поэтому первая же перестановка
 * перенумеровывает список целиком — иначе порядок «сохранился», а список не
 * сдвинулся.
 */
export function reorderVenueFeatures<
  T extends { id: string; display_order: number; name: string },
>(items: readonly T[], id: string, direction: "up" | "down"): VenueFeatureOrderPatch[] {
  const ordered = sortVenueFeatures(items);
  const from = ordered.findIndex((item) => item.id === id);
  if (from < 0) return [];
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ordered.length) return [];

  const moved = [...ordered];
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item);

  const patches: VenueFeatureOrderPatch[] = [];
  moved.forEach((entry, index) => {
    const next = index + 1;
    if (entry.display_order !== next) patches.push({ id: entry.id, display_order: next });
  });
  return patches;
}

/**
 * Раскладка галочек по колонкам.
 *
 * Удобств девятнадцать, и одним столбцом это экран прокрутки, в котором не
 * видно ни начала, ни конца. Раскладываем ПО КОЛОНКАМ (сверху вниз, потом
 * следующая колонка), а не построчно: справочник отсортирован, и человек ищет
 * в нём глазами по порядку — построчная раскладка («1 2 / 3 4») этот порядок
 * ломает, потому что читать приходится зигзагом.
 *
 * Функция чистая и живёт здесь, а не в компоненте, ровно для того, чтобы её
 * можно было проверить без рендера. На узком экране колонка одна — тогда это
 * просто исходный список.
 */
export function splitIntoColumns<T>(items: readonly T[], columns: number): T[][] {
  if (columns <= 1 || items.length === 0) return items.length ? [[...items]] : [];
  const perColumn = Math.ceil(items.length / columns);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += perColumn) {
    out.push(items.slice(i, i + perColumn));
  }
  return out;
}

/**
 * Значения фильтра, под которые подходит заведение.
 *
 * Значение — `code` записи справочника: он не зависит от языка и не меняется
 * при переименовании. У старых записей ответа `code` может отсутствовать
 * (`omitempty`) — такие в фильтр не попадают, и это честнее, чем матчить их
 * по названию.
 */
export function venueFeatureCodes(venue: { features?: readonly VenueFeature[] }): string[] {
  return (venue.features ?? []).map((item) => item.code ?? "").filter((code) => code !== "");
}

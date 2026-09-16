import { RepositoryError } from "../repository";
import { reorderCuisines, sortCuisines, type CuisineOrderPatch } from "./cuisines";
import { TRANSLATION_LOCALES, translationsChanged, type TranslationDraft } from "./translations";

/**
 * «Фуди-профиль» — справочник плиток визарда (кухни/диеты/аллергии/бюджет),
 * теперь платформенный, а не вшитый в код (спека
 * foodie-profile-admin-dictionaries-20260916.md, FE-A1).
 *
 * Модуль чистый (ни DOM, ни сети) — по образцу `./cuisines`, откуда
 * переиспользованы `sortCuisines`/`reorderCuisines` (уже дженерик по
 * `{id, display_order, name}`, свою копию заводить незачем).
 *
 * ВАЖНО ПРО ПЕРЕВОДЫ — РАСХОЖДЕНИЕ СО СПЕКОЙ. Критерий 17 спеки предлагает
 * вести kk/en «по образцу PromosView (`translationDraftFrom`/
 * `buildTranslationPatch`)». Это не подходит: на бэкенде
 * (`internal/transport/rest/foodieoptions/dto.go`) `name_i18n` и соседние
 * поля — это `map[string]string`, который usecase ЦЕЛИКОМ ЗАМЕЩАЕТ, когда он
 * не nil (`if in.NameI18n != nil { o.NameI18n = in.NameI18n }`) — ТА ЖЕ
 * старая конвенция, что у `/admin/cuisines`, НЕ `domain.I18nPatch` (частичный
 * патч с удалением по `null`), на который переехал остальной контент кабинета
 * (588c177/1252c4c, см. заголовок `translations.ts`). `buildTranslationPatch`
 * прислал бы ТОЛЬКО изменившийся язык — а сервер этим заменил бы ВЕСЬ объект,
 * молча стерев непереданный язык. Поэтому здесь свой билдер:
 * `buildFoodieI18nField` шлёт ПОЛНЫЙ черновик (а не дельту), и только когда
 * черновик действительно отличается от того, что вернул сервер.
 */

export type FoodieOptionKind = "cuisine" | "diet" | "allergy" | "budget";

export const FOODIE_OPTION_KINDS: readonly FoodieOptionKind[] = [
  "cuisine",
  "diet",
  "allergy",
  "budget",
];

/** Код диеты, которую нельзя скрыть никогда — единственный способ гостя
 * сказать «диеты нет», см. `domain.FoodieDietExclusiveID`. */
export const FOODIE_DIET_EXCLUSIVE_CODE = "no_diet";

/** Ярусы бюджета — те же значения, что `restaurants.price_category`. */
export const FOODIE_PRICE_CATEGORIES = ["₸", "₸₸", "₸₸₸"] as const;
export type FoodiePriceCategory = (typeof FOODIE_PRICE_CATEGORIES)[number];

/** Запись справочника, как её отдаёт `GET /admin/foodie-profile/options`
 * (`adminOptionResponse` в dto.go). */
export interface FoodieOptionEntry {
  id: string;
  kind: FoodieOptionKind;
  code: string;
  name: string;
  name_i18n?: Record<string, string>;
  image_url?: string | null;
  description?: string | null;
  description_i18n?: Record<string, string>;
  price_label?: string | null;
  price_label_i18n?: Record<string, string>;
  price_category?: string | null;
  /** Только у `kind === "cuisine"` — иначе всегда `[]` (сервер шлёт пустой
   * массив, не отсутствующее поле, см. dto.go). */
  cuisine_ids: string[];
  cuisine_codes: string[];
  display_order: number;
  is_active: boolean;
  /** Вычислено сервером: у кухни — есть связь, у бюджета — задан ярус, у
   * диеты — код входит в `dietAxes`, у аллергии — всегда `false`. Клиент это
   * не пересчитывает, только показывает. */
  affects_matching: boolean;
  created_at: string;
  updated_at: string;
}

/** Один и тот же бакет-контракт у публичной и админской ручки (спека §5). */
export interface FoodieOptionBuckets<T> {
  cuisines: T[];
  diets: T[];
  allergies: T[];
  budgets: T[];
}

export type FoodieOptionsAdminResponse = FoodieOptionBuckets<FoodieOptionEntry>;

/** Тело POST/PATCH. Все поля необязательны: PATCH меняет только присланные
 * ключи (на сервере — указатели), `code`/`kind` при PATCH с другим значением
 * — 422 «код неизменяем» (сервер проверяет сам, здесь не дублируется). */
export interface FoodieOptionSaveInput {
  kind?: FoodieOptionKind;
  code?: string;
  name?: string;
  name_i18n?: Record<string, string>;
  image_url?: string | null;
  description?: string | null;
  description_i18n?: Record<string, string>;
  price_label?: string | null;
  price_label_i18n?: Record<string, string>;
  /** `""` — явно снять ярус (только `kind: "budget"`); пропущено — не трогать. */
  price_category?: string;
  /** Только `kind: "cuisine"`: `undefined` — не трогать, `[]` — очистить связь. */
  cuisine_ids?: string[];
  display_order?: number;
  is_active?: boolean;
}

/** Все записи справочника одним плоским списком — удобно для сортировки,
 * перестановки и проверки «последний активный», которым бакет не важен. */
export function flattenFoodieOptions(buckets: FoodieOptionsAdminResponse): FoodieOptionEntry[] {
  return [...buckets.cuisines, ...buckets.diets, ...buckets.allergies, ...buckets.budgets];
}

/** Порядок справочника внутри вида — та же логика, что у кухонь. */
export function sortFoodieOptions<T extends { display_order: number; name: string }>(
  items: readonly T[],
): T[] {
  return sortCuisines(items);
}

/** Перестановка на одну позицию внутри своего вида. */
export function reorderFoodieOptions<
  T extends { id: string; display_order: number; name: string },
>(items: readonly T[], id: string, direction: "up" | "down"): CuisineOrderPatch[] {
  return reorderCuisines(items, id, direction);
}

/**
 * Последний ли активный вариант своего вида — то, что сервер откажется
 * скрыть (критерий 8). Считается по ВСЕМ записям вида (включая уже скрытые),
 * поэтому сюда передают полный список, не отфильтрованный по вкладке.
 */
export function isLastActiveOfKind(
  items: readonly FoodieOptionEntry[],
  target: FoodieOptionEntry,
): boolean {
  if (!target.is_active) return false;
  const activeSameKind = items.filter((item) => item.kind === target.kind && item.is_active);
  return activeSameKind.length <= 1;
}

/** Можно ли предложить кнопку «Скрыть» — клиентское предсказание отказа
 * сервера (3.6, 3.5): `no_diet` никогда, последний активный своего вида —
 * никогда. Сервер проверяет заново и остаётся источником истины; это только
 * чтобы не рисовать кнопку, которая гарантированно вернёт 422. */
export function canHideFoodieOption(
  items: readonly FoodieOptionEntry[],
  target: FoodieOptionEntry,
): boolean {
  if (target.kind === "diet" && target.code === FOODIE_DIET_EXCLUSIVE_CODE) return false;
  return !isLastActiveOfKind(items, target);
}

/**
 * `<поле>_i18n` для ЭТОГО справочника: сервер заменяет карту целиком, когда
 * она не nil (см. заголовок модуля), поэтому в отличие от
 * `buildTranslationPatch` здесь шлётся ПОЛНЫЙ черновик — оба языка сразу,
 * пустые опускаются — а не только тронутый. Возвращает `undefined`, когда
 * черновик не отличается от того, что вернул сервер: поле тогда в тело не
 * попадает и остаётся нетронутым.
 */
export function buildFoodieI18nField(
  draft: TranslationDraft,
  stored?: Record<string, string> | null,
): Record<string, string> | undefined {
  if (!translationsChanged(draft, stored)) return undefined;
  const map: Record<string, string> = {};
  for (const locale of TRANSLATION_LOCALES) {
    const value = draft[locale].trim();
    if (value) map[locale] = value;
  }
  return map;
}

// ---- Отказы сервера ---------------------------------------------------------

/**
 * Чем закончилась неудачная запись варианта. Никакого узкого кода сверх
 * обычных статусов сервер не заводит (проверено по ветке бэкенда
 * `feat/foodie-profile-admin-dictionaries`: и запрет скрыть последний/`no_diet`,
 * и «код неизменяем» — это один и тот же `domain.ErrValidation` → общий 422
 * `validation`, без различимого `code`; дубль `(kind, code)`/`(kind, name)` —
 * `domain.ErrAlreadyExists` → 409). Поэтому набор в точности как у
 * `classifyPlatformContentFailure`, плюс `duplicate`.
 */
export type FoodieOptionFailureKind =
  | "refused"
  | "duplicate"
  | "forbidden"
  | "unauthorized"
  | "not_found"
  | "unknown";

export interface FoodieOptionFailure {
  kind: FoodieOptionFailureKind;
  applied: false | "unknown";
}

export function classifyFoodieOptionFailure(error: unknown): FoodieOptionFailure {
  const status = error instanceof RepositoryError ? error.status : undefined;
  switch (status) {
    case 401:
      return { kind: "unauthorized", applied: false };
    case 403:
      return { kind: "forbidden", applied: false };
    case 404:
      return { kind: "not_found", applied: false };
    case 409:
      return { kind: "duplicate", applied: false };
    case 422:
      return { kind: "refused", applied: false };
    default:
      return { kind: "unknown", applied: "unknown" };
  }
}

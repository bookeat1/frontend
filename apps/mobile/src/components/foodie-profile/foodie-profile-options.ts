import { cuisinePhoto } from "../explore/cuisine-photos";

/**
 * Статичные списки плиток визарда «Фуди-профиль». Список задан задачей
 * словами (не приходит ни с одной ручки бэкенда — сохранения фуди-профиля
 * пока нет вовсе), поэтому id — свои, не коды справочника `GET /cuisines`.
 */
export interface FoodieProfileOption {
  id: string;
}

export const CUISINE_OPTIONS: readonly FoodieProfileOption[] = [
  { id: "kazakh" },
  { id: "asian" },
  { id: "european" },
  { id: "japanese" },
  { id: "italian" },
  { id: "korean" },
  { id: "seafood" },
  { id: "meat" },
  { id: "vegan" },
  { id: "desserts" },
  { id: "coffee" },
  { id: "healthy" },
  { id: "fastfood" },
  { id: "spicy" },
  { id: "bbq" },
];

export const DIET_OPTIONS: readonly FoodieProfileOption[] = [
  { id: "no_diet" },
  { id: "vegan" },
  { id: "pescetarian" },
  { id: "halal" },
  { id: "kosher" },
  { id: "keto" },
  { id: "low_carb" },
  { id: "paleo" },
  { id: "no_lactose" },
  { id: "no_gluten" },
];

export const ALLERGY_OPTIONS: readonly FoodieProfileOption[] = [
  { id: "nuts" },
  { id: "dairy" },
  { id: "eggs" },
  { id: "seafood" },
  { id: "soy" },
  { id: "wheat" },
  { id: "shellfish" },
  { id: "sesame" },
];

export const BUDGET_TIERS = ["budget", "mid", "premium"] as const;

/**
 * Реальных фотографий у этого списка нет — задача явно говорит «переиспользуй
 * вшитый набор кухонь, если он подходит». Ключи справа — коды из
 * `cuisine-photos.ts`. Совпадают ШЕСТЬ из пятнадцати: остальные девять пунктов
 * («Азиатская» — не то же самое, что «паназиатская», и трёх новых пунктов
 * — «Корейская», «Мясо», «Десерты», «Кофе», «Здоровая еда», «Фастфуд»,
 * «Острая», «Барбекю» — в вшитом наборе нет вовсе) рисуются существующей
 * плашкой «фото нет» (см. `PhotoView`/`SelectableTile`), а не гадаными
 * снимками.
 */
const CUISINE_PHOTO_CODE: Partial<Record<string, string>> = {
  kazakh: "kazakh",
  european: "european",
  japanese: "japanese",
  italian: "italian",
  seafood: "seafood",
  vegan: "vegan",
};

export function cuisineOptionPhoto(id: string): number | undefined {
  const code = CUISINE_PHOTO_CODE[id];
  return code ? cuisinePhoto(code) : undefined;
}

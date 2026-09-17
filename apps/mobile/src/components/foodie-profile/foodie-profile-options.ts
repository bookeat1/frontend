import { cuisinePhoto } from "../explore/cuisine-photos";

/**
 * Bundled fallback photo for the visard's cuisine tiles, BY CODE.
 *
 * Before `foodie-profile-admin-dictionaries-20260916` this file also held the
 * hardcoded id/order lists for all four steps (cuisines/diets/allergies/
 * budget) — those are gone now (`useFoodieOptions()` reads the live
 * dictionary, `GET /foodie-profile/options`, instead). This one function
 * stays: the dictionary's `image_url` is empty for most cuisine tiles today
 * (real photos are an admin-side follow-up, not this task), and falling back
 * to the app's existing bundled cuisine photos — the same ones the "Выберите
 * кухню" row on the home screen already uses — beats showing a "no photo"
 * placeholder for a tile the app actually has art for.
 *
 * Совпадают ШЕСТЬ кодов из пятнадцати сегодняшних кухонь: остальные девять
 * («Азиатская» ≠ «паназиатская», плюс «Корейская», «Мясо», «Десерты»,
 * «Кофе», «Здоровая еда», «Фастфуд», «Острая», «Барбекю» — их нет в
 * `cuisine-photos.ts` вовсе) рисуют существующую плашку «фото нет»
 * (`PhotoView`/`SelectableTile`), а не гаданные снимки.
 */
const CUISINE_PHOTO_CODE: Partial<Record<string, string>> = {
  kazakh: "kazakh",
  european: "european",
  japanese: "japanese",
  italian: "italian",
  seafood: "seafood",
  vegan: "vegan",
};

export function cuisineOptionPhoto(code: string): number | undefined {
  const photoCode = CUISINE_PHOTO_CODE[code];
  return photoCode ? cuisinePhoto(photoCode) : undefined;
}

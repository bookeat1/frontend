/**
 * Bundled photos for the «Выберите кухню» circles.
 *
 * The catalog has no per-cuisine image endpoint — a `Cuisine` is just
 * `{id, name}` derived from `cuisine_type` — so the pictures ship with the app
 * and are matched on the cuisine id, which is `cuisineIdFor(cuisine_type)`:
 * the trimmed, lower-cased type. Keys therefore MUST be lower case.
 *
 * A cuisine without a photo keeps the neutral placeholder circle, so adding a
 * new cuisine to the catalog never breaks this rail — it just stays grey until
 * a picture for it lands here.
 *
 * Pictures are the 3x exports from the design (node 3106:12265), the same files
 * that were uploaded to R2 for the coming cuisine dictionary — so the circles
 * look identical before and after the app switches over to it.
 *
 * Still without a picture, because the design has none: Авторская, Японская,
 * Грузинская, Паназиатская. Those circles stay grey until the design supplies
 * one; nothing breaks.
 */
const photos: Record<string, number> = {
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
  пекарня: require("../../../assets/cuisines/bakery.png"),
};

export function cuisinePhoto(cuisineId: string): number | undefined {
  return photos[cuisineId];
}

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
 * Keys checked against the live catalog on 2026-08-24: the distinct
 * `cuisine_type` values then were Европейская, Средиземноморская, Казахская,
 * Греческая, Французская, Восточная. Веганская has no venue yet — its picture
 * simply waits here until one is tagged with it.
 */
const photos: Record<string, number> = {
  казахская: require("../../../assets/cuisines/kazakh.jpg"),
  морепродукты: require("../../../assets/cuisines/seafood.jpg"),
  итальянская: require("../../../assets/cuisines/italian.jpg"),
  восточная: require("../../../assets/cuisines/eastern.png"),
  греческая: require("../../../assets/cuisines/greek.png"),
  средиземноморская: require("../../../assets/cuisines/mediterranean.png"),
  веганская: require("../../../assets/cuisines/vegan.png"),
};

export function cuisinePhoto(cuisineId: string): number | undefined {
  return photos[cuisineId];
}

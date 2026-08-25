/**
 * Сохранение заведения, у которого часть данных пишется ОТДЕЛЬНЫМИ ручками.
 *
 * Таких наборов уже два — кухни (`PUT /restaurants/:id/cuisines`) и удобства
 * (`PUT /restaurants/:id/features`), — и оба замещаются целиком. Значит одно
 * нажатие «Сохранить» это три записи подряд, а три записи подряд не бывают
 * атомарными. Поэтому здесь не «получилось/не получилось», а КАКАЯ половина
 * легла: у каждого исхода своё сообщение и своя кнопка повтора.
 */

/** Чем кончилось сохранение. Порядок членов союза повторяет порядок записей. */
export type VenueSaveOutcome<V> =
  | { status: "saved"; venue: V }
  | { status: "venue_failed"; error: unknown }
  | { status: "cuisines_failed"; venue: V; error: unknown }
  | { status: "features_failed"; venue: V; error: unknown };

/** Шаги сохранения. `null` в любом наборе значит «не трогаем»: набор либо не
 * прочитан, либо не менялся, а PUT замещает его целиком — отправить вслепую
 * значит стереть то, чего форма не показывала. */
export interface VenueSaveSteps<V extends { id: string }> {
  saveVenue: () => Promise<V>;
  cuisineIds?: readonly string[] | null;
  saveCuisines?: (venueId: string, ids: readonly string[]) => Promise<unknown>;
  featureIds?: readonly string[] | null;
  saveFeatures?: (venueId: string, ids: readonly string[]) => Promise<unknown>;
}

/**
 * Пишет заведение, затем его кухни, затем его удобства.
 *
 * Порядок не произволен:
 *   • у нового заведения id появляется только из ответа на создание — писать
 *     наборы раньше просто некуда;
 *   • сервер пересобирает legacy-строку `cuisine_type` при записи набора
 *     кухонь, а PATCH заведения её не трогает, поэтому набор кухонь обязан
 *     лечь ПОСЛЕ полей заведения;
 *   • удобства последними просто потому, что они ни от чего не зависят: если
 *     не легли они, всё остальное уже на месте и повторять надо только их.
 *
 * Не легло заведение — наборы даже не пробуем: писать их некуда. Не легли
 * кухни — удобства НЕ пробуем тоже: два разных «частично сохранилось» в одном
 * сообщении человек не разберёт, а повторить первый шаг он всё равно должен.
 */
export async function saveVenueWithDictionaries<V extends { id: string }>(
  steps: VenueSaveSteps<V>,
): Promise<VenueSaveOutcome<V>> {
  let venue: V;
  try {
    venue = await steps.saveVenue();
  } catch (error) {
    return { status: "venue_failed", error };
  }

  const cuisineIds = steps.cuisineIds ?? null;
  if (cuisineIds !== null && steps.saveCuisines) {
    try {
      await steps.saveCuisines(venue.id, cuisineIds);
    } catch (error) {
      return { status: "cuisines_failed", venue, error };
    }
  }

  const featureIds = steps.featureIds ?? null;
  if (featureIds !== null && steps.saveFeatures) {
    try {
      await steps.saveFeatures(venue.id, featureIds);
    } catch (error) {
      return { status: "features_failed", venue, error };
    }
  }

  return { status: "saved", venue };
}

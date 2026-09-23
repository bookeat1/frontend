/**
 * Сохранение заведения, у которого часть данных пишется ОТДЕЛЬНЫМИ ручками.
 *
 * Таких наборов уже три — кухни (`PUT /restaurants/:id/cuisines`), удобства
 * (`PUT /restaurants/:id/features`) и денежное окно бесплатной отмены
 * (`PUT /admin/restaurants/:id/payment-settings/free-cancel-window`) — первые
 * два замещаются целиком, третье — одно число, но общая причина шага та же:
 * ручка требует уже существующего id заведения. Значит одно нажатие
 * «Сохранить» — это четыре записи подряд, а четыре записи подряд не бывают
 * атомарными. Поэтому здесь не «получилось/не получилось», а КАКАЯ часть
 * легла: у каждого исхода своё сообщение и своя кнопка повтора.
 */

/** Чем кончилось сохранение. Порядок членов союза повторяет порядок записей. */
export type VenueSaveOutcome<V> =
  | { status: "saved"; venue: V }
  | { status: "venue_failed"; error: unknown }
  | { status: "cuisines_failed"; venue: V; error: unknown }
  | { status: "features_failed"; venue: V; error: unknown }
  | { status: "free_cancel_window_failed"; venue: V; error: unknown };

/** Шаги сохранения. `null` в любом наборе/значении значит «не трогаем»: оно
 * либо не прочитано, либо не менялось, а кухни/удобства PUT замещает целиком
 * — отправить вслепую значит стереть то, чего форма не показывала. Денежное
 * окно `null`-ом не «сбрасывается на дефолт» (в отличие от `hold_minutes`
 * PATCH-заведения) — это просто «шаг пропускаем», вызывающая сторона уже
 * разрешила пустое поле формы в конкретное число (см. `free-cancel-window.ts`
 * и `VenuesView.tsx`). */
export interface VenueSaveSteps<V extends { id: string }> {
  saveVenue: () => Promise<V>;
  cuisineIds?: readonly string[] | null;
  saveCuisines?: (venueId: string, ids: readonly string[]) => Promise<unknown>;
  featureIds?: readonly string[] | null;
  saveFeatures?: (venueId: string, ids: readonly string[]) => Promise<unknown>;
  freeCancelWindowMinutes?: number | null;
  saveFreeCancelWindow?: (venueId: string, minutes: number) => Promise<unknown>;
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
 * кухни — удобства и денежное окно НЕ пробуем тоже: два-три разных «частично
 * сохранилось» в одном сообщении человек не разберёт, а повторить первый шаг
 * он всё равно должен. Денежное окно — ПОСЛЕДНИЙ шаг: он ни от чего не
 * зависит, как и удобства, а порядок между собой у удобств и окна неважен.
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

  const freeCancelWindowMinutes = steps.freeCancelWindowMinutes ?? null;
  if (freeCancelWindowMinutes !== null && steps.saveFreeCancelWindow) {
    try {
      await steps.saveFreeCancelWindow(venue.id, freeCancelWindowMinutes);
    } catch (error) {
      return { status: "free_cancel_window_failed", venue, error };
    }
  }

  return { status: "saved", venue };
}

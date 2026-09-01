/**
 * Stand-in for expo-haptics.
 *
 * Настоящий модуль тянет `expo-modules-core`, который на первой же строке
 * читает `globalThis.expo.EventEmitter` — в jsdom этого глобала нет, и падает
 * не сам вибромотор, а ИМПОРТ: вместе с ним не поднимается ни один экран, где
 * стоит колесо выбора даты и гостей.
 *
 * Заглушка НЕ считает вызовы. Вибрация проверяется на своём уровне:
 * `src/lib/__tests__/haptics.test.ts` подменяет этот модуль своим шпионом и
 * смотрит, ЧТО зовётся на каждой платформе, а `WheelPickerHaptics.test.tsx`
 * подменяет обёртку `lib/haptics` и смотрит, КОГДА колесо её зовёт. Считать
 * ещё и здесь значило бы завести третье место, где живёт то же знание.
 *
 * Что заглушка не проверяет и проверить не может: дёрнулся ли телефон. Это
 * только рукой на устройстве.
 */

/** Подмножество `AndroidHaptics`, которым пользуется приложение. */
export const AndroidHaptics = {
  Clock_Tick: "clock-tick",
} as const;

export async function selectionAsync(): Promise<void> {}

export async function performAndroidHapticsAsync(_type: string): Promise<void> {}

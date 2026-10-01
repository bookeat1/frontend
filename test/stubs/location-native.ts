/**
 * Заглушка `apps/mobile/src/lib/geo/location-native.ts` под тестовым раннером:
 * настоящий файл импортирует `expo`, который в jsdom не загружается. «Нет
 * нативного модуля» — безопасное состояние по умолчанию для всех экранов,
 * которым геопозиция не нужна.
 */
export type LocationModule = never;

export function hasLocationModule(): boolean {
  return false;
}

export function importLocation(): Promise<never> {
  return Promise.reject(new Error("expo-location is not available in tests"));
}

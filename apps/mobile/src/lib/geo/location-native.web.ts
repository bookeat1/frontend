/**
 * Веб-экспорт мобильного приложения (`Platform.OS === "web"`): геопозиции здесь
 * нет намеренно (спека geolocation-permission.md, критерий 21). Двойник нужен,
 * чтобы Metro не затягивал `expo-location` в веб-бандл. Те же имена, что у
 * `location-native.ts`.
 */
import type { LocationModule } from "./location-native";

export type { LocationModule };

export function hasLocationModule(): boolean {
  return false;
}

export function importLocation(): Promise<LocationModule> {
  return Promise.reject(new Error("expo-location is not available on web"));
}

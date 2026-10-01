import { requireOptionalNativeModule } from "expo";

/**
 * ЕДИНСТВЕННОЕ место, где называется пакет `expo-location` (и его нативный
 * модуль `ExpoLocation`). Гейт выпуска спеки geolocation-permission.md,
 * критерий 20.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ИМПОРТ `expo-location` ЛЕНИВЫЙ. НЕ ВОЗВРАЩАТЬ ЕГО НАВЕРХ ФАЙЛА.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Причина та же, что у `src/lib/haptics.ts` (там она расписана полностью):
 * `expo-location` — новый нативный модуль, его нет в бинарях, которые сейчас
 * стоят у людей, а JS мы возим в них по воздуху под их старые рантаймы
 * (`BOOKEAT_RUNTIME_VERSION`). Пакет внутри зовёт `requireNativeModule(
 * 'ExpoLocation')`, который при отсутствии модуля БРОСАЕТ, и статический
 * импорт уронил бы запуск приложения сразу у всех, кто забрал обновление.
 *
 * Поэтому два шага:
 *  1. `hasLocationModule()` спрашивает нативный слой НЕ бросающим вызовом
 *     (`requireOptionalNativeModule` отдаёт `null`). `null` → геопозиции в
 *     этой сборке нет вовсе: ни карточки, ни строки в настройках.
 *  2. Только если модуль есть, `importLocation()` подтягивает пакет ленивым
 *     `import()`. На нативе Metro выполняет его синхронно (подробно в
 *     `haptics-native.ts`), поэтому вызывать только внутри `try/catch`.
 *
 * Платформенный двойник — `location-native.web.ts`: на вебе фичи нет.
 */

/** Ровно то, чем пользуемся. Тип берётся у настоящего пакета, но стирается. */
export type LocationModule = Pick<
  typeof import("expo-location"),
  | "getForegroundPermissionsAsync"
  | "requestForegroundPermissionsAsync"
  | "getLastKnownPositionAsync"
  | "getCurrentPositionAsync"
  | "hasServicesEnabledAsync"
  | "Accuracy"
>;

/** Есть ли нативная часть `ExpoLocation` в ЭТОМ бинаре. Не бросает. */
export function hasLocationModule(): boolean {
  try {
    return requireOptionalNativeModule("ExpoLocation") != null;
  } catch {
    return false;
  }
}

/** Подтянуть пакет. Может бросить синхронно — см. комментарий выше. */
export function importLocation(): Promise<LocationModule> {
  return import("expo-location");
}

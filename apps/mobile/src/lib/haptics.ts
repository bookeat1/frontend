import { AndroidHaptics, performAndroidHapticsAsync, selectionAsync } from "expo-haptics";
import { Platform } from "react-native";

/**
 * Короткий тактильный «щелчок» — тот, что даёт системный барабан выбора, когда
 * под центром проходит очередное значение.
 *
 * Правка владельца 2026-09-01: «добавь микровибрацию как в нативках при скроле
 * даты и количества гостей».
 *
 * ДВЕ ПЛАТФОРМЫ — ДВА РАЗНЫХ ВЫЗОВА, и это не перестраховка:
 *
 *   iOS — `selectionAsync()`, то есть `UISelectionFeedbackGenerator`. Ровно то,
 *   чем щёлкает `UIPickerView`; ничего короче и мягче в системе нет.
 *
 *   Android — `performAndroidHapticsAsync(Clock_Tick)`, то есть
 *   `View.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)` — тик
 *   часового барабана, которым система щёлкает в своих же выборах времени.
 *   НЕ `selectionAsync()`: на Android она уходит в `Vibrator` и играет волну
 *   50 мс амплитудой 30 (см. HapticsSelectionType.kt) — это уже жужжание, а на
 *   быстрой прокрутке несколько таких волн наложатся друг на друга.
 *   `CLOCK_TICK` вдобавок слушается системной настройки тактильного отклика и
 *   не требует разрешения VIBRATE (оно всё равно объявлено манифестом модуля).
 *
 *   `Segment_Frequent_Tick` подошёл бы ещё лучше по смыслу, но эта константа
 *   есть только с Android 14: на всём, что старше, модуль бросает
 *   `HapticsNotSupportedException`, и отклика не было бы вовсе.
 *
 * ТИХО ПАДАТЬ — ЧАСТЬ КОНТРАКТА. Нет вибромотора, выключен тактильный отклик в
 * системе, модуль не поднялся — обещание не выполняется, и это нормально:
 * вибрация здесь украшение, а не смысл. Поэтому `.catch()` стоит на каждом
 * вызове (иначе получаем unhandled rejection на пустом месте), и функция
 * ничего не возвращает — ждать её незачем, прокрутка не должна ждать мотор.
 *
 * На вебе (`expo start --web`, тесты) не делаем НИЧЕГО осознанно: браузерный
 * `navigator.vibrate` — это грубое дребезжание телефона, а не щелчок.
 */
export function hapticSelectionTick(): void {
  if (Platform.OS === "ios") {
    void selectionAsync().catch(() => {});
    return;
  }
  if (Platform.OS === "android") {
    void performAndroidHapticsAsync(AndroidHaptics.Clock_Tick).catch(() => {});
  }
}

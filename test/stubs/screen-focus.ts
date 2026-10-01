/**
 * Заглушка `apps/mobile/src/lib/screen-focus.ts` под тестовым раннером: настоящий
 * файл зовёт `useFocusEffect` из `expo-router`, которому нужен навигатор. Экран
 * в тесте получает фокус один раз, при монтировании. Тест, которому нужны
 * повторные фокусы, подменяет модуль через `vi.mock`.
 */
export function useScreenFocusCount(): number {
  return 1;
}

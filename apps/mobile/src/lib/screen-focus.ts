import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

/**
 * Сколько раз экран получал фокус. Первый фокус (при монтировании) даёт 1,
 * возврат с экрана заведения или из системных настроек даёт 2 и так далее.
 *
 * Отдельный модуль, чтобы экраны, которые лишь ПОДКЛЮЧАЮТ хук, не тянули
 * `expo-router` в свои тесты: под Vitest вместо него подставляется заглушка
 * `test/stubs/screen-focus.ts` (фокус всегда один). Сам хук проверяется
 * подменой этого модуля в тесте потребителя.
 */
export function useScreenFocusCount(): number {
  const [count, setCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setCount((c) => c + 1);
    }, []),
  );
  return count;
}

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Жест «потянуть вниз, чтобы обновить» — ОДНА реализация на приложение.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ХУК, А НЕ `isRefetching` ОДНОГО ЗАПРОСА. На экране с одним
 * запросом (`app/notifications.tsx`) хватало пары `isRefetching` + `refetch`:
 * ровно один ответ, ровно один индикатор. Главная так не устроена — она
 * складывается из шести независимых запросов, и `isRefetching` любого из них
 * гаснет, как только вернулся ИМЕННО ОН. Кружок при этом исчезает, а половина
 * экрана ещё едет: жест выглядит выполненным раньше, чем выполнен. Поэтому
 * состояние индикатора здесь СВОЁ, и оно живёт от начала жеста до того
 * момента, когда УЛЕГЛИСЬ ВСЕ переданные обновления.
 *
 * ПОВТОРНЫЙ ЖЕСТ ВО ВРЕМЯ ОБНОВЛЕНИЯ БЕЗВРЕДЕН: пока предыдущий круг не
 * закончился, новый не начинается (`inFlight`) — иначе два параллельных
 * `refetch` дали бы два конкурирующих ответа и мигающий индикатор.
 *
 * ОТКАЗ СЕТИ НЕ ЗАВЕШИВАЕТ КРУЖОК: обновление всё равно завершается, а про
 * ошибку рассказывает то состояние экрана, которое за неё отвечает (`error` у
 * запроса). Кружок — это индикатор жеста, а не второе место для ошибок.
 *
 * `enabled: false` — жест ИГНОРИРУЕТСЯ, а не отключается визуально: так экран
 * может запретить обновление, пока ещё не известен город (см. `useGuestCity`,
 * `isResolving`), и при этом не менять вёрстку.
 */
export function usePullToRefresh(
  refresh: () => Promise<unknown>,
  options?: { enabled?: boolean },
): { refreshing: boolean; onRefresh: () => void } {
  const enabled = options?.enabled ?? true;
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    void (async () => {
      try {
        await refresh();
      } catch {
        // Молча: ошибку показывает состояние экрана, а не индикатор жеста.
      } finally {
        inFlight.current = false;
        // Экран могли закрыть, не дождавшись ответа — тогда обновлять уже
        // нечего, и setState на размонтированном компоненте здесь был бы
        // предупреждением React, а не пользой.
        if (mounted.current) setRefreshing(false);
      }
    })();
  }, [enabled, refresh]);

  return { refreshing, onRefresh };
}

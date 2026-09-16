"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AnalyticsProvider } from "@web/components/AnalyticsProvider";
import { AuthProvider } from "@web/lib/auth";
import { captureCampaignFromUrl } from "@web/lib/campaign-attribution";
import { CityProvider } from "@web/lib/city";
import { LocaleProvider } from "@web/lib/locale";

/**
 * Читает `?promo=` из адресной строки РОВНО РАЗ, на монтаже — `Providers`
 * живёт в корневом layout и не размонтируется между клиентскими переходами
 * (App Router), так что это «при заходе на сайт», а не «на каждой странице».
 * `window.location.search`, а не `useSearchParams()`: последний требует
 * `<Suspense>` вокруг любого клиентского компонента, который его читает
 * (иначе падает `next build` — см. PR #168), а здесь достаточно значения на
 * момент первой загрузки документа.
 *
 * `onCaptured` уходит наверх, в `Providers`, а не бьёт по аналитике прямо
 * здесь: этот компонент — сосед `AuthProvider`, его эффект по порядку
 * монтирования срабатывает РАНЬШЕ, чем эффект `AnalyticsProvider` (тот стоит
 * внутри `AuthProvider`), а значит раньше, чем `initAnalytics()` успевает
 * включить `isEnabled()`. Вызов `trackEvent` отсюда напрямую тихо терял бы
 * событие при самом первом заходе на сайт — ровно тот риск, что описан в
 * спеке Amplitude (`web-amplitude-analytics-20260916.md`, критерий 9).
 */
function CampaignAttributionCapture({ onCaptured }: { onCaptured: (id: string) => void }) {
  useEffect(() => {
    const captured = captureCampaignFromUrl(window.location.search);
    if (captured) onCaptured(captured);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/**
 * Провайдеры сайта: кэш запросов, язык интерфейса и выбранный город.
 *
 * Он стоит здесь заранее и намеренно: данные веб берёт через `@bookeat/api`,
 * тем же клиентом, что мобилка и кабинет, и своего слоя запросов у него не
 * будет. Настройки повторяют apps/admin, чтобы поведение при ошибке и
 * возврате во вкладку было одинаковым во всём монорепозитории.
 *
 * `AuthProvider` держит сессию гостя и обработчик 401 (обновление пары по
 * refresh-токену). Он ВЫШЕ города и языка: обработчик ставится на общий
 * репозиторий один раз, до первого запроса.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 15_000,
          },
        },
      }),
  );
  /** Метка кампании, только что захваченная из адреса — см. комментарий у
   * `CampaignAttributionCapture`. `AnalyticsProvider` шлёт по ней
   * `deep_link_attributed` один раз, когда сам будет готов. */
  const [capturedCampaignId, setCapturedCampaignId] = useState<string | null>(null);
  const onCampaignCaptured = useCallback((id: string) => setCapturedCampaignId(id), []);

  return (
    <QueryClientProvider client={queryClient}>
      <CampaignAttributionCapture onCaptured={onCampaignCaptured} />
      {/* Язык ВЫШЕ города: город приходит запросом, а у запроса заголовок
          `Accept-Language` берётся из выбранного языка. */}
      <AuthProvider>
        <AnalyticsProvider campaignId={capturedCampaignId}>
          <LocaleProvider>
            <CityProvider>{children}</CityProvider>
          </LocaleProvider>
        </AnalyticsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

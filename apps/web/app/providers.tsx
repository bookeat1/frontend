"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@web/lib/auth";
import { CityProvider } from "@web/lib/city";
import { LocaleProvider } from "@web/lib/locale";

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

  return (
    <QueryClientProvider client={queryClient}>
      {/* Язык ВЫШЕ города: город приходит запросом, а у запроса заголовок
          `Accept-Language` берётся из выбранного языка. */}
      <AuthProvider>
        <LocaleProvider>
          <CityProvider>{children}</CityProvider>
        </LocaleProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

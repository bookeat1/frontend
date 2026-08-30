"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Единственный провайдер веба на этом этапе — кэш запросов.
 *
 * Он стоит здесь заранее и намеренно: данные веб берёт через `@bookeat/api`,
 * тем же клиентом, что мобилка и кабинет, и своего слоя запросов у него не
 * будет. Настройки повторяют apps/admin, чтобы поведение при ошибке и
 * возврате во вкладку было одинаковым во всём монорепозитории.
 *
 * Обработчика 401 здесь пока нет — авторизации в вебе тоже пока нет, а
 * выдумывать перенаправление на несуществующий /login значит заранее
 * зашить неверный маршрут.
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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

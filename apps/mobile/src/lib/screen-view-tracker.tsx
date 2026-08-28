import { useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { trackEvent } from "./analytics";

/**
 * Превращает сегменты маршрута expo-router в ШАБЛОН экрана — ровно то, что
 * уходит в аналитику: `["restaurant", "[id]", "book", "confirm"]` →
 * `/restaurant/[id]/book/confirm`.
 *
 * Именно шаблон, а не `usePathname()`. Путь несёт подставленные значения
 * (`/booking/6f0c…`, `/restaurant/15669c40…`), и это (а) сотни уникальных
 * значений вместо одного экрана в отчёте, (б) идентификаторы конкретной брони
 * в стороннем сервисе. Шаблон одинаков для всех гостей и не содержит ничего,
 * что относилось бы к человеку.
 *
 * Корень (пустой массив сегментов) — это `/`, главная.
 */
export function screenNameFromSegments(segments: readonly string[]): string {
  const path = segments.filter((segment) => segment.length > 0).join("/");
  return path.length > 0 ? `/${path}` : "/";
}

/**
 * Отправляет `screen_view` на каждый переход по навигации — ОДНО место на всё
 * приложение вместо вызова на каждом из 32 экранов (половину из которых
 * забыли бы, а новый экран приходил бы без события вовсе).
 *
 * Почему не автозахват SDK: `autocapture.screenViews` у React Native SDK
 * Amplitude ждёт свою интеграцию с навигацией и в этом приложении молчит, а
 * то, что он мог бы захватить сам, — это путь с подставленными id. Здесь
 * экран называется шаблоном маршрута, см. `screenNameFromSegments`.
 *
 * Компонент рисует `null` и стоит ОТДЕЛЬНО от AnalyticsProvider намеренно:
 * `useSegments` меняется на каждом переходе, и держи его провайдер — на каждый
 * переход перерисовывалось бы всё дерево под ним, включая сам навигатор.
 * Здесь перерисовывается только этот пустой узел.
 */
export function ScreenViewTracker(): null {
  const segments = useSegments();
  const screen = screenNameFromSegments(segments as readonly string[]);
  // Повтор того же экрана не событие: expo-router перерисовывает сегменты и
  // без смены маршрута (смена параметров, ре-рендер родителя), а два подряд
  // «открыл главную» без ухода с неё — это неправда в отчёте.
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (previous.current === screen) return;
    previous.current = screen;
    trackEvent("screen_view", { screen });
  }, [screen]);

  return null;
}

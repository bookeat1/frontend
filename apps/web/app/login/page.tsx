import { Suspense } from "react";
import type { Metadata } from "next";

import { LoginScreen } from "@web/components/auth/LoginScreen";

/**
 * Вход и регистрация — Figma 3272:2. Шапки и подвала на этом экране по макету
 * нет, поэтому страница НЕ обёрнута в `SiteChrome`: выход с неё — логотип в
 * карточке.
 */
export const metadata: Metadata = {
  title: "BookEat — вход",
  // Экран входа нечего показывать поисковику, и попадание его в выдачу вместо
  // главной — типовая неприятность.
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  // `useSearchParams` (адрес возврата в `?next=`) обязывает поставить границу
  // Suspense: без неё Next не может отрисовать страницу заранее и валит
  // сборку. Запасная разметка — фирменная подложка, а не пустой белый лист:
  // ровно то, что гость увидит долю секунды до выполнения JS.
  return (
    <Suspense fallback={<div className="min-h-screen bg-inverse" />}>
      <LoginScreen />
    </Suspense>
  );
}

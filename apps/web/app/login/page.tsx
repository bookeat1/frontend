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
  return <LoginScreen />;
}

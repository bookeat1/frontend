import type { Metadata } from "next";
import { Suspense } from "react";

import { ProfileScreen } from "@web/components/profile/ProfileScreen";
import { t } from "@web/lib/i18n";

/**
 * Страница гостя — Figma QovvuAoI9YxsLMwWkfgKN8, узел 3525:15153. Раздел
 * выбирается параметром `?section=`, а `useSearchParams` в клиентском дереве
 * требует границы Suspense — иначе Next не может отрисовать страницу заранее
 * и валит сборку (та же причина, что у `/venues`).
 */
export const metadata: Metadata = {
  title: t.web.profile.metaTitle,
  // Личная страница — поисковику здесь нечего индексировать.
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileScreen />
    </Suspense>
  );
}

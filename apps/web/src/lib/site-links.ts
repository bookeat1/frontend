import type { PlatformPageSlug } from "@bookeat/api/client";

/**
 * Пути семи текстовых страниц платформы (T4) по их слагу (`GET /pages/:slug`,
 * bookeat-backend PR #115). Один роут на слаг — `app/{slug}/page.tsx` —
 * а не catch-all `app/pages/[slug]`, чтобы посторонний адрес не уходил в API
 * (см. `apps/web/src/components/pages/SitePageScreen.tsx`).
 *
 * Полный `site-links.ts` из спеки `web-fixes-20260906.md` (T3: `BUSINESS_URL`,
 * `CABINET_URL`, `SUPPORT_URL` и т.д.) сюда НЕ входит — та задача не входит в
 * этот PR (см. память команды `bookeat-web-scope.md`: не заводить ссылки на
 * маршруты, которых ещё нет). Здесь — только то, что нужно T4.
 */
export const SITE_PAGE_PATHS: Record<PlatformPageSlug, string> = {
  about: "/about",
  jobs: "/jobs",
  contacts: "/contacts",
  "how-it-works": "/how-it-works",
  cancellation: "/cancellation",
  offer: "/offer",
  privacy: "/privacy",
};

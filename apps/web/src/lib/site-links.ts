import type { PlatformPageSlug } from "@bookeat/api/client";

/**
 * Внешние адреса сайта — одни и те же на тесте и на проде (по слову Дамира:
 * кабинет и лендинг для бизнеса — боевые даже со стенда, ADR-024).
 *
 * Ссылки блока «для бизнеса» (спека `specs/web-fixes-20260906.md`, задача T3).
 * Ссылка «Поддержка» (`SUPPORT_URL`) сюда сознательно не добавлена: номера
 * WhatsApp-бота ещё нет (владелец попросил отложить), а мёртвый `href="#"`
 * или заготовка `undefined` — это повод для будущей путаницы, а не для этого PR.
 */

/** Лендинг для ресторанов — узел 3549:5740 («Для бизнеса») и подвал
 * («Подключить заведение»). */
export const BUSINESS_URL = "https://book-eat.app/";

/** Якорь тарифов на том же лендинге (подвал, «Тарифы»). */
export const PRICING_URL = "https://book-eat.app/#pricing";

/** Боевой кабинет ресторана (подвал, «Кабинет ресторана»). */
export const CABINET_URL = "https://admin.book-eat.com/";

/**
 * Значки соцсетей в блоке марки подвала (узел Figma 3525:14318, порядок
 * WhatsApp · Instagram · Телефон). Данные — от владельца продукта
 * (2026-09-12), не из макета: сам макет несёт только иконки, а не адреса.
 */
export const SOCIAL_INSTAGRAM_URL = "https://www.instagram.com/bookeat_app/";
export const SOCIAL_PHONE_NUMBER = "+7 706 691 1392";
export const SOCIAL_WHATSAPP_URL = "https://wa.me/77066911392";

/**
 * Пути семи текстовых страниц платформы (T4) по их слагу (`GET /pages/:slug`,
 * bookeat-backend PR #115). Один роут на слаг — `app/{slug}/page.tsx` —
 * а не catch-all `app/pages/[slug]`, чтобы посторонний адрес не уходил в API
 * (см. `apps/web/src/components/pages/SitePageScreen.tsx`).
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

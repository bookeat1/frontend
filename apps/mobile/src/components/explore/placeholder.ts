/**
 * PLACEHOLDER SEAM FOR THE REBUILT HOME SCREEN — nothing here comes from the API.
 *
 * Two home sections have no backend endpoint the guest app can call today, so
 * their data source lives here, isolated in one file. The COMPONENTS that
 * render them are real and final; only the source is a stub, and each stub is
 * an EMPTY array on purpose — the sections hide themselves cleanly when there
 * is nothing to show (see PromotionsSection / ArticlesSection), so the home
 * screen looks finished on today's real data.
 *
 * Missing endpoints (checked against `packages/api/src/repository.ts` — the
 * guest-facing contract — and the backend conventions in team-memory):
 *
 *   promotions — no live GLOBAL promotions endpoint. Only per-restaurant
 *                `GET /restaurants/:id/promos` (a single venue, and its payload
 *                carries NO image field) and a unified `/feed` exist. TODO:
 *                wire `useExplorePromotions` to `GET /promotions` or
 *                `GET /feed?kind=promo` once the backend ships a cross-venue
 *                promo feed (backend branch `feat/promo-feed`, migration 0050).
 *
 *   articles   — no editorial/articles entity anywhere in the backend. TODO:
 *                wire `useExploreArticles` to `GET /articles` when it exists.
 */

/** One promo tile in the «Акции» strip. Shape the real feed is expected to
 * carry, so wiring it up later is a mapper change, not a component change. */
export interface PromoStripItem {
  id: string;
  /** Discount percentage shown in the red badge. */
  discountPercent: number;
  title: string;
  /** «Mongol Bar · 12:00–18:00» — venue name plus the promo's time window. */
  subtitle: string;
  imageUrl: string | null;
}

/** One editorial card in the «Статьи» strip. */
export interface ArticleCardData {
  id: string;
  title: string;
  /** Byline, e.g. «От BookEat» / «От ресторанного критика». */
  author: string;
  coverImageUrl: string | null;
}

/** MISSING ENDPOINT: GET /promotions (or /feed?kind=promo). Empty ⇒ section hidden. */
export const PLACEHOLDER_PROMOTIONS: readonly PromoStripItem[] = [];

/** MISSING ENDPOINT: GET /articles. Empty ⇒ section hidden. */
export const PLACEHOLDER_ARTICLES: readonly ArticleCardData[] = [];

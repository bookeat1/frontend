/**
 * Alias route: `/guide` → the same screen as `/gastroguide`.
 *
 * ADR-046 (mobile web behind UA split): the desktop dictionary (`apps/web`
 * uses `/guide`) and the mobile dictionary (`apps/mobile` uses `/gastroguide`,
 * a name that predates the desktop page and stays the app's own canonical
 * URL — see `app/gastroguide/index.tsx`) are reconciled with file aliases in
 * each app, not a proxy rewrite table. This file is that alias for the guide
 * root: same component, second path, no redirect. A guest whose phone gets
 * served this Expo-web build via `book-eat.com/guide` (from the footer,
 * sitemap, search results, or a shared link) lands on the real screen
 * instead of a 404 — the address bar keeps showing `/guide`.
 *
 * Do not add screen logic here. Everything belongs in
 * `app/gastroguide/index.tsx`; this file only re-exports it so it renders
 * under the second URL.
 */
export { default } from "../gastroguide/index";

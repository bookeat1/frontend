/**
 * Alias route: `/guide/rubric/:slug` → the same screen as
 * `/gastroguide/rubric/:slug`.
 *
 * Same reasoning as `app/guide/index.tsx` (ADR-046): the desktop dictionary
 * (`apps/web/app/guide/rubric/[slug]/page.tsx`) and the mobile one
 * (`app/gastroguide/rubric/[slug].tsx`) are reconciled with a file alias, not
 * a proxy rewrite. No logic here — just the re-export.
 */
export { default } from "../../gastroguide/rubric/[slug]";

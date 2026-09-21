import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * `/kit` — витрина компонентов для сверки с макетом, не продуктовая
 * страница. `page.tsx` сам — клиентский компонент и не может экспортировать
 * `metadata`, поэтому noindex ставится соседним `layout.tsx` (T3, критерий
 * B-17; `robots.txt` уже держит его в Disallow — `lib/sitemap-entries.ts`).
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function KitLayout({ children }: { children: ReactNode }) {
  return children;
}

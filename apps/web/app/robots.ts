import type { MetadataRoute } from "next";

import { absoluteUrl, isIndexable } from "@web/lib/site";
import { ROBOTS_DISALLOW } from "@web/lib/sitemap-entries";

/**
 * `/robots.txt`. Файловая конвенция Next: собирается на сборке, значения
 * приезжают из `NEXT_PUBLIC_*` (см. `lib/site.ts`).
 *
 * По ADR-046 роботы на book-eat.com ВСЕГДА получают ответ от Next, каким бы
 * ещё приложениям Caddy ни отдавал этот домен, поэтому robots и sitemap
 * живут здесь, а не в конфиге прокси.
 *
 * Стенд и любая сборка без `NEXT_PUBLIC_ROBOTS_INDEX=true` закрыты целиком.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...ROBOTS_DISALLOW],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

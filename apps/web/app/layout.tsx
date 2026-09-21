import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { JsonLdScript } from "@web/components/seo/JsonLdScript";
import { t } from "@web/lib/i18n";
import { graph, organizationGraph } from "@web/lib/seo/jsonld";
import { siteUrl } from "@web/lib/site";
import { Providers } from "./providers";
import "./globals.css";

/**
 * Макет подписан «Типографика · Noto Sans» — тот же шрифт, что в мобильном
 * приложении (`fontFamilies.notoSans*`). Берём его через `next/font`, а не
 * ссылкой на fonts.googleapis.com: файлы кладутся рядом со сборкой и едут с
 * того же домена. У аудитории связь плохая, и лишний DNS + TLS до чужого
 * хоста перед первой отрисовкой текста стоит дороже, чем несколько килобайт
 * в бандле. `display: swap` — текст читается ещё до приезда шрифта.
 *
 * Начертания ровно те, что использует кит: 400/500/600/700.
 * Кириллица обязательна, латиница нужна для названий заведений.
 */
const notoSans = Noto_Sans({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-sans",
});

/**
 * Слоган гастрогида (`GuideScreen`, узел 5039:10252) — Playfair Display
 * Italic 48. `next/font/google` тут не годится: сборка идёт без сети (см.
 * `apps/web/app/fonts/`), поэтому файл лежит в репозитории — это подсет
 * `hb-subset` из официального переменного шрифта (OFL, `PlayfairDisplay-OFL.txt`
 * рядом), урезанный до latin + весь блок U+0400–04FF (кириллица целиком, не
 * только базовый русский алфавит — заголовок берёт город из GET /cities, а
 * там есть Түркістан, Қарағанды и т.п.) и зафиксированный на начертании 400
 * italic. Это Modified Version по OFL §3: субсет не эквивалентен оригиналу
 * (урезаны глифы, снята вариативность), поэтому в name-таблице (1/4/6/16)
 * оригинальное имя заменено на нейтральное «BookEat Serif» — Reserved Font
 * Name «Playfair Display» там оставаться не может (OFL-FAQ 2.6/2.8); copyright
 * (name0) по-прежнему указывает на оригинальный проект. ~31 КБ, `display: swap`.
 */
const playfairDisplay = localFont({
  src: "./fonts/PlayfairDisplay-Italic.woff2",
  weight: "400",
  style: "italic",
  display: "swap",
  variable: "--font-playfair-display",
});

export const metadata: Metadata = {
  // Без metadataBase относительные canonical/OG-ссылки на страницах
  // резолвятся в localhost. Значение — из NEXT_PUBLIC_SITE_URL (lib/site.ts).
  metadataBase: new URL(siteUrl),
  // НЕ `title: { template }`: в таблице §5.2 ни у одного реального заголовка
  // (заведение, каталог, главная, статья) нет суффикса «| BookEat» — каждая
  // страница строит окончательную строку сама (см. `lib/seo/metadata.ts`).
  // Next применил бы шаблон КО ВСЕМ дочерним `title`, включая уже готовые —
  // получилось бы двойное дублирование бренда. Этот заголовок — только
  // запасной для страниц без своего <title> (сегодня таких нет).
  title: t.web.header.brand,
  description: t.web.footer.tagline,
};

/**
 * `Organization` + `WebSite` (T4, критерий C-19) — в `<head>` каждой
 * страницы сайта разом, а не по одной копии на экран: узел один и тот же
 * везде, `@id` у него ОДИН (`${siteUrl}/#organization`).
 */
const ORGANIZATION_JSON_LD = graph(organizationGraph());

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${notoSans.variable} ${playfairDisplay.variable}`}>
      <body>
        <JsonLdScript data={ORGANIZATION_JSON_LD} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

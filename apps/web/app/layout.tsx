import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { t } from "@web/lib/i18n";
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
  title: t.web.header.brand,
  description: t.web.footer.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${notoSans.variable} ${playfairDisplay.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

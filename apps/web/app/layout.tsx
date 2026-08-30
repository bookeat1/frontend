import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
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

export const metadata: Metadata = {
  title: t.web.header.brand,
  description: t.web.footer.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={notoSans.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

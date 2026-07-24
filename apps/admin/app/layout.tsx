import type { Metadata } from "next";
import type { ReactNode } from "react";

import { t } from "@/lib/i18n";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: t.admin.appName,
  description: t.admin.login.subtitle,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

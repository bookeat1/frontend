import type { Metadata } from "next";

import { SitePageScreen } from "@web/components/pages/SitePageScreen";
import { t } from "@web/lib/i18n";

/** «Как это работает» — T4, текст правит суперадмин в кабинете
 * (`GET /pages/how-it-works`). */
export const metadata: Metadata = {
  title: t.web.pages.tabTitle["how-it-works"],
};

export default function HowItWorksPage() {
  return <SitePageScreen slug="how-it-works" />;
}

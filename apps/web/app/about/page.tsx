import type { Metadata } from "next";

import { SitePageScreen } from "@web/components/pages/SitePageScreen";
import { t } from "@web/lib/i18n";

/** «О BookEat» — T4, текст правит суперадмин в кабинете (`GET /pages/about`). */
export const metadata: Metadata = {
  title: t.web.pages.tabTitle.about,
};

export default function AboutPage() {
  return <SitePageScreen slug="about" />;
}

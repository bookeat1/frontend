import type { Metadata } from "next";

import { SitePageScreen } from "@web/components/pages/SitePageScreen";
import { t } from "@web/lib/i18n";

/** «Политика данных» — T4, текст правит суперадмин в кабинете
 * (`GET /pages/privacy`). */
export const metadata: Metadata = {
  title: t.web.pages.tabTitle.privacy,
};

export default function PrivacyPage() {
  return <SitePageScreen slug="privacy" />;
}

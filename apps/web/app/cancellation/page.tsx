import type { Metadata } from "next";

import { SitePageScreen } from "@web/components/pages/SitePageScreen";
import { t } from "@web/lib/i18n";

/** «Отмена брони» — T4, текст правит суперадмин в кабинете
 * (`GET /pages/cancellation`). */
export const metadata: Metadata = {
  title: t.web.pages.tabTitle.cancellation,
};

export default function CancellationPage() {
  return <SitePageScreen slug="cancellation" />;
}

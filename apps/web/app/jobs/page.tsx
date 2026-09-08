import type { Metadata } from "next";

import { SitePageScreen } from "@web/components/pages/SitePageScreen";
import { t } from "@web/lib/i18n";

/** «Вакансии» — T4, текст правит суперадмин в кабинете (`GET /pages/jobs`). */
export const metadata: Metadata = {
  title: t.web.pages.tabTitle.jobs,
};

export default function JobsPage() {
  return <SitePageScreen slug="jobs" />;
}

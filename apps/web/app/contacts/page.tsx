import type { Metadata } from "next";

import { SitePageScreen } from "@web/components/pages/SitePageScreen";
import { t } from "@web/lib/i18n";

/** «Контакты» — T4, текст правит суперадмин в кабинете (`GET /pages/contacts`). */
export const metadata: Metadata = {
  title: t.web.pages.tabTitle.contacts,
};

export default function ContactsPage() {
  return <SitePageScreen slug="contacts" />;
}

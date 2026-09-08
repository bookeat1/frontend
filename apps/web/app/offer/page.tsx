import type { Metadata } from "next";

import { SitePageScreen } from "@web/components/pages/SitePageScreen";
import { t } from "@web/lib/i18n";

/** «Оферта» — T4, текст правит суперадмин в кабинете (`GET /pages/offer`). */
export const metadata: Metadata = {
  title: t.web.pages.tabTitle.offer,
};

export default function OfferPage() {
  return <SitePageScreen slug="offer" />;
}

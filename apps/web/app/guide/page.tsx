import type { Metadata } from "next";

import { GuideScreen } from "@web/components/guide/GuideScreen";
import { t } from "@web/lib/i18n";

/** Гастрогид — Figma «WEB / 08 · Гастрогид», узел 5033:7096. */
export const metadata: Metadata = {
  title: t.web.guide.metaTitle,
};

export default function GuidePage() {
  return <GuideScreen />;
}

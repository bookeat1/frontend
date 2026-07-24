"use client";

import { t } from "@/lib/i18n";

type PublishStatus = "draft" | "published" | "hidden";

const STYLES: Record<PublishStatus, string> = {
  draft: "bg-chip text-text-muted",
  published: "bg-emerald-100 text-emerald-800",
  hidden: "bg-rose-100 text-rose-700",
};

/** Draft / published / hidden pill, shared by the events and promos lists. */
export function PublishBadge({ status }: { status: PublishStatus }) {
  const label =
    status === "published"
      ? t.admin.events.badgePublished
      : status === "hidden"
        ? t.admin.events.badgeHidden
        : t.admin.events.badgeDraft;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-pill px-sm py-xxs text-[11px] font-medium ${STYLES[status]}`}
    >
      {label}
    </span>
  );
}

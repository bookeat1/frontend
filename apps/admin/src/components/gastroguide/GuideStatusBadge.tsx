"use client";

import type { GuideCollectionStatus } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";

const copy = t.admin.gastroguide;

/**
 * A collection's publication pill.
 *
 * Deliberately NOT PublishBadge. That one speaks the promo/event triple
 * (draft / published / hidden) and a guide collection's third state is
 * "archived", which is a different thing: it was live once and keeps its venue
 * links so it can be brought back. Rendering it through PublishBadge would mean
 * teaching that component a fourth status it has no business knowing, and
 * showing an editor "Скрыто" for something the guide calls "В архиве".
 */
const STYLES: Record<GuideCollectionStatus, string> = {
  draft: "bg-chip text-text-muted",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-amber-100 text-amber-800",
};

const LABELS: Record<GuideCollectionStatus, string> = {
  draft: copy.badgeDraft,
  published: copy.badgePublished,
  archived: copy.badgeArchived,
};

export function GuideStatusBadge({
  status,
  publishedAt,
  now = () => new Date(),
}: {
  status: GuideCollectionStatus;
  publishedAt?: string | null;
  /** Injectable so the "scheduled" branch is testable without freezing time. */
  now?: () => Date;
}) {
  // A collection published with a date in the FUTURE is live in the database
  // and invisible in the app until that moment. Showing it as plain
  // "Опубликована" is how an editor ends up asking why the app does not have it.
  const scheduled =
    status === "published" && !!publishedAt && new Date(publishedAt).getTime() > now().getTime();

  return (
    <span
      className={`inline-block whitespace-nowrap rounded-pill px-sm py-xxs text-[11px] font-medium ${
        scheduled ? "bg-sky-100 text-sky-800" : STYLES[status]
      }`}
    >
      {scheduled ? copy.scheduled : LABELS[status]}
    </span>
  );
}

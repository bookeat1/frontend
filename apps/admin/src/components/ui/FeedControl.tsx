"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FeedItemKind, FeedItemState, FeedStatus } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./Button";

/**
 * Badge label + pill tone for one item. Approved is special: `feed_status`
 * alone says the superadmin said yes, but the item is only actually ON Home
 * inside its active window — so we split it on `lifecycle` (live vs scheduled
 * vs expired) to avoid telling a venue "На главной" for an item that is not
 * showing yet or has already ended. When lifecycle is missing/unknown we fall
 * back to the plain approved label. The action button ignores all this and is
 * decided by feed_status alone (see below).
 */
function badge(state: FeedItemState | undefined): { label: string; className: string } {
  const status: FeedStatus = state?.feed_status ?? "not_submitted";
  switch (status) {
    case "pending_review":
      return { label: t.admin.feed.badgePending, className: "bg-amber-100 text-amber-800" };
    case "approved":
      switch (state?.lifecycle) {
        case "approved":
          return { label: t.admin.feed.badgeApprovedScheduled, className: "bg-chip text-text" };
        case "expired":
          return { label: t.admin.feed.badgeApprovedExpired, className: "bg-chip text-text-muted" };
        case "live":
        default:
          return { label: t.admin.feed.badgeApproved, className: "bg-emerald-100 text-emerald-800" };
      }
    case "rejected":
      return { label: t.admin.feed.badgeRejected, className: "bg-rose-100 text-rose-700" };
    default:
      return { label: t.admin.feed.badgeNotSubmitted, className: "bg-chip text-text-muted" };
  }
}

/**
 * The venue-side "put this on the app Home" control, shared by the promos and
 * events lists. It shows the item's moderation state as a pill and the one
 * action that state allows:
 *   - not_submitted | rejected → «Отправить на главную» (submit)
 *   - pending_review | approved → «Отозвать с главной» (withdraw)
 *
 * `state` comes from the parent's single listVenueFeed() call (mapped by
 * kind+id); while that query is still loading, or for an item the feed list has
 * not caught up to yet, it is undefined and we treat the item as not_submitted —
 * the safe default (an unsubmitted item is exactly what carries that status).
 *
 * On success both the shared feed query and the parent list are invalidated, so
 * the pill and any status-derived UI refresh together.
 */
export function FeedControl({
  restaurantId,
  kind,
  itemId,
  state,
  listQueryKey,
}: {
  restaurantId: string;
  kind: FeedItemKind;
  itemId: string;
  state: FeedItemState | undefined;
  /** The promos/events list query key, invalidated alongside the feed query. */
  listQueryKey: readonly unknown[];
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const status: FeedStatus = state?.feed_status ?? "not_submitted";
  const canSubmit = status === "not_submitted" || status === "rejected";
  const hint = kind === "promo" ? t.admin.feed.hintPromo : t.admin.feed.hintEvent;
  const { label: badgeText, className: badgeClassName } = badge(state);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["feed", restaurantId] }),
      queryClient.invalidateQueries({ queryKey: listQueryKey }),
    ]);

  const mutation = useMutation({
    mutationFn: () =>
      canSubmit
        ? apiClient.submitFeedItem(kind, itemId)
        : apiClient.withdrawFeedItem(kind, itemId),
    onSuccess: () => {
      setError(null);
      void refresh();
    },
    onError: () => setError(t.admin.feed.actionFailed),
  });

  return (
    <div className="flex flex-col gap-sm border-t border-hairline pt-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-xxs">
        <div className="flex flex-wrap items-center gap-sm">
          <span
            className={`inline-block whitespace-nowrap rounded-pill px-sm py-xxs text-[11px] font-medium ${badgeClassName}`}
          >
            {badgeText}
          </span>
          {status === "rejected" && state?.rejection_reason ? (
            <span className="break-words text-[12px] text-rose-700">
              {t.admin.feed.rejectionReason(state.rejection_reason)}
            </span>
          ) : null}
        </div>
        <p className="text-[12px] text-text-muted">{hint}</p>
        {error ? (
          <p role="alert" className="text-[12px] text-brand">
            {error}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 sm:pl-md">
        <Button
          size="sm"
          variant={canSubmit ? "primary" : "secondary"}
          disabled={mutation.isPending}
          loading={mutation.isPending}
          onClick={() => {
            setError(null);
            mutation.mutate();
          }}
        >
          {mutation.isPending
            ? canSubmit
              ? t.admin.feed.submitting
              : t.admin.feed.withdrawing
            : canSubmit
              ? t.admin.feed.submit
              : t.admin.feed.withdraw}
        </Button>
      </div>
    </div>
  );
}

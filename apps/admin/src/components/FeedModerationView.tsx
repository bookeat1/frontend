"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MAX_FEED_PLACEMENT_WEIGHT,
  type FeedItemState,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useIsPlatformAdmin } from "@/lib/use-platform-dashboard";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { Field, TextArea, TextInput } from "./ui/FormControls";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";

const QUEUE_KEY = ["feed-queue"] as const;
const DEFAULT_WEIGHT = 50;

/** Keep the placement weight a whole number inside 0..MAX, mirroring the
 * server's own clamp. An empty/garbage input falls back to 0 rather than NaN. */
function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const n = Math.round(value);
  if (n < 0) return 0;
  if (n > MAX_FEED_PLACEMENT_WEIGHT) return MAX_FEED_PLACEMENT_WEIGHT;
  return n;
}

/** The superadmin moderation queue for the app's Home rail. Lists items in
 * `pending_review` and lets an admin approve them (with a placement weight) or
 * reject them (with a reason). The role check is a UX guard only — the backend
 * gates every endpoint on the admin role regardless — so a venue manager who
 * lands here sees an explanation instead of a wall of 403s. */
export function FeedModerationView() {
  const isAdmin = useIsPlatformAdmin();

  const queueQuery = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: () => apiClient.listFeedQueue({ per_page: 100 }),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <EmptyState
        title={t.admin.feedModeration.notAdminTitle}
        description={t.admin.feedModeration.notAdminDescription}
      />
    );
  }

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <header className="flex flex-col gap-xs">
        <h1 className="text-2xl font-semibold text-text">{t.admin.feedModeration.title}</h1>
        <p className="max-w-2xl text-sm text-text-muted">{t.admin.feedModeration.subtitle}</p>
      </header>

      {queueQuery.isPending ? (
        <LoadingState title={t.admin.feedModeration.loading} />
      ) : queueQuery.isError ? (
        <ErrorState
          message={t.admin.feedModeration.errorTitle}
          onRetry={() => void queueQuery.refetch()}
        />
      ) : queueQuery.data.items.length === 0 ? (
        <EmptyState
          title={t.admin.feedModeration.emptyTitle}
          description={t.admin.feedModeration.emptyDescription}
        />
      ) : (
        <ul className="flex flex-col gap-md">
          {queueQuery.data.items.map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <QueueItemCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function KindBadge({ kind }: { kind: FeedItemState["kind"] }) {
  const label = kind === "promo" ? t.admin.feedModeration.kindPromo : t.admin.feedModeration.kindEvent;
  const tone = kind === "promo" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800";
  return (
    <span className={`inline-block whitespace-nowrap rounded-pill px-sm py-xxs text-[11px] font-medium ${tone}`}>
      {label}
    </span>
  );
}

/** One queued item. Local state (weight, reason, error/success) lives here so
 * each card acts independently. Mutations invalidate the whole queue — an
 * approved/rejected item leaves `pending_review` and disappears on refetch. */
function QueueItemCard({ item }: { item: FeedItemState }) {
  const queryClient = useQueryClient();
  const [weight, setWeight] = useState<number>(
    item.placement_weight > 0 ? item.placement_weight : DEFAULT_WEIGHT,
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUEUE_KEY });

  const approveMutation = useMutation({
    mutationFn: () =>
      apiClient.reviewFeedItem(item.kind, item.id, {
        approve: true,
        placement_weight: clampWeight(weight),
      }),
    onSuccess: () => {
      setError(null);
      setNotice(t.admin.feedModeration.approved);
      trackEvent("feed_review", { decision: "approve", kind: item.kind });
      void invalidate();
    },
    onError: () => setError(t.admin.feedModeration.actionFailed),
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      apiClient.reviewFeedItem(item.kind, item.id, {
        approve: false,
        rejection_reason: reason.trim(),
      }),
    onSuccess: () => {
      setError(null);
      setNotice(t.admin.feedModeration.rejected);
      trackEvent("feed_review", { decision: "reject", kind: item.kind });
      void invalidate();
    },
    onError: () => setError(t.admin.feedModeration.actionFailed),
  });

  const weightMutation = useMutation({
    mutationFn: () => apiClient.setFeedPlacementWeight(item.kind, item.id, clampWeight(weight)),
    onSuccess: () => {
      setError(null);
      setNotice(t.admin.feedModeration.weightSaved);
      void invalidate();
    },
    onError: () => setError(t.admin.feedModeration.actionFailed),
  });

  const busy = approveMutation.isPending || rejectMutation.isPending || weightMutation.isPending;
  const reasonEmpty = reason.trim().length === 0;
  // Already-approved items (defensive: the queue is pending_review only, but an
  // item can sit approved in-view between mutation and refetch) get a plain
  // weight adjuster instead of the approve/reject pair.
  const isApproved = item.feed_status === "approved";

  return (
    <article className="flex flex-col gap-md rounded-card border border-hairline bg-surface p-lg">
      <div className="flex min-w-0 flex-col gap-xs">
        <div className="flex flex-wrap items-center gap-sm">
          <KindBadge kind={item.kind} />
          <span className="break-words text-sm font-semibold text-text">{item.restaurant_name}</span>
        </div>
        <h2 className="break-words text-base font-semibold text-text">{item.title}</h2>
        <p className="text-[13px] text-text-muted">
          {t.admin.feedModeration.datesLabel}: {formatDateTime(item.starts_at)} —{" "}
          {formatDateTime(item.ends_at)}
        </p>
        {item.submitted_at ? (
          <p className="text-[12px] text-text-muted">
            {t.admin.feedModeration.submittedAt(formatDateTime(item.submitted_at))}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-sm border-t border-hairline pt-md">
        <Field
          label={t.admin.feedModeration.weightLabel}
          hint={t.admin.feedModeration.weightHint}
          htmlFor={`weight-${item.kind}-${item.id}`}
        >
          <TextInput
            id={`weight-${item.kind}-${item.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_FEED_PLACEMENT_WEIGHT}
            step={1}
            value={weight}
            disabled={busy}
            onChange={(e) => setWeight(clampWeight(Number(e.target.value)))}
            className="max-w-[140px]"
          />
        </Field>

        {isApproved ? (
          <div className="flex flex-col gap-xs">
            <p className="text-[12px] text-text-muted">
              {t.admin.feedModeration.currentWeight(item.placement_weight)}
            </p>
            <div>
              <Button
                variant="primary"
                loading={weightMutation.isPending}
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  weightMutation.mutate();
                }}
              >
                {weightMutation.isPending
                  ? t.admin.feedModeration.savingWeight
                  : t.admin.feedModeration.saveWeight}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Field
              label={t.admin.feedModeration.rejectionLabel}
              htmlFor={`reason-${item.kind}-${item.id}`}
            >
              <TextArea
                id={`reason-${item.kind}-${item.id}`}
                value={reason}
                disabled={busy}
                placeholder={t.admin.feedModeration.rejectionPlaceholder}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>

            <div className="flex flex-wrap gap-sm">
              <Button
                variant="primary"
                loading={approveMutation.isPending}
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  approveMutation.mutate();
                }}
              >
                {approveMutation.isPending
                  ? t.admin.feedModeration.approving
                  : t.admin.feedModeration.approve}
              </Button>
              <Button
                variant="danger"
                loading={rejectMutation.isPending}
                // Reject needs a reason (server enforces it too); disable until
                // one is typed so the admin gets the rule as a state, not a 422.
                disabled={busy || reasonEmpty}
                onClick={() => {
                  if (reasonEmpty) {
                    setError(t.admin.feedModeration.rejectionRequired);
                    return;
                  }
                  setError(null);
                  setNotice(null);
                  rejectMutation.mutate();
                }}
              >
                {rejectMutation.isPending
                  ? t.admin.feedModeration.rejecting
                  : t.admin.feedModeration.reject}
              </Button>
            </div>
          </>
        )}

        {error ? (
          <p role="alert" className="text-[13px] text-brand">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-[13px] text-emerald-700">
            {notice}
          </p>
        ) : null}
      </div>
    </article>
  );
}

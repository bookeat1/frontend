"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  isPushCampaignInFlight,
  type CreatePushCampaignInput,
  type CreatePushCampaignResult,
  type PushCampaignEstimate,
  type PushCampaignKind,
  type PushCampaignSummary,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { useIsPlatformAdmin } from "@/lib/use-venue-catalog";
import { formatShortDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { pushCampaignErrorText } from "../push-campaign-copy";
import { Button } from "./Button";
import { CheckboxRow } from "./FormControls";
import { Modal } from "./Modal";

/** The two calls the modal needs — injectable so tests never touch the real
 * `AdminApiClient`/network, same pattern as `PlatformEventClient`. */
export interface PushCampaignClient {
  estimatePushCampaign(kind: PushCampaignKind, subjectId: string): Promise<PushCampaignEstimate>;
  createPushCampaign(input: CreatePushCampaignInput): Promise<CreatePushCampaignResult>;
}

const PREVIEW_LOCALES = ["ru", "kk", "en"] as const;

/**
 * Manual push-campaign control shared by `EventsView`, `PromosView`,
 * `PlatformEventsView`, `PlatformPromosView` (spec §4 criteria 26-30). Renders
 * a status badge everyone sees plus, superadmin-only, the «Отправить пуш»
 * button and its confirmation modal.
 *
 * The badge/button read `campaign` — the row this subject's parent screen
 * already fetched with its ONE `listPushCampaigns` call (spec §4 criterion
 * 26: "одна выборка на экран, маппинг по subject_id", same shape as
 * `FeedControl`'s `state` prop). This component never lists campaigns itself.
 */
export function PushCampaignControl({
  client = apiClient,
  kind,
  subjectId,
  campaign,
  onSent,
}: {
  client?: PushCampaignClient;
  kind: PushCampaignKind;
  subjectId: string;
  /** Undefined while the parent's list query has not resolved yet, or when
   * there has never been a campaign for this subject — both render as "не
   * отправлялся", the safe default. */
  campaign: PushCampaignSummary | undefined;
  /** Called after a successful `POST` so the parent can invalidate/refetch
   * its push-campaigns query (and start polling — spec criterion 29). */
  onSent: () => void;
}) {
  const isAdmin = useIsPlatformAdmin();
  const [open, setOpen] = useState(false);
  const { label, className } = badge(campaign);
  const canSend = !campaign || !isPushCampaignInFlight(campaign.status);

  return (
    <div className="flex flex-wrap items-center gap-sm border-t border-hairline pt-md">
      <span
        className={`inline-block whitespace-nowrap rounded-pill px-sm py-xxs text-[11px] font-medium ${className}`}
      >
        {label}
      </span>
      {isAdmin ? (
        <Button size="sm" variant="secondary" disabled={!canSend} onClick={() => setOpen(true)}>
          {t.admin.pushCampaigns.send}
        </Button>
      ) : null}
      {open ? (
        <PushCampaignModal
          client={client}
          kind={kind}
          subjectId={subjectId}
          onClose={() => setOpen(false)}
          onSent={onSent}
        />
      ) : null}
    </div>
  );
}

function badge(campaign: PushCampaignSummary | undefined): { label: string; className: string } {
  const copy = t.admin.pushCampaigns;
  if (!campaign) return { label: copy.badgeNotSent, className: "bg-chip text-text-muted" };
  switch (campaign.status) {
    case "queued":
    case "sending":
      return { label: copy.badgeSending, className: "bg-amber-100 text-amber-800" };
    case "done":
      return {
        label: copy.badgeSent(
          formatShortDateTime(campaign.finished_at ?? campaign.created_at),
          campaign.sent_count,
        ),
        className: "bg-emerald-100 text-emerald-800",
      };
    case "failed":
      return {
        label: copy.badgeFailed(campaign.sent_count, campaign.estimated_recipients),
        className: "bg-rose-100 text-rose-700",
      };
    case "expired":
      return { label: copy.badgeExpired, className: "bg-chip text-text-muted" };
    case "cancelled":
      return {
        label: copy.badgeCancelled(cancelReasonText(campaign.cancel_reason)),
        className: "bg-chip text-text-muted",
      };
    default:
      return { label: copy.badgeNotSent, className: "bg-chip text-text-muted" };
  }
}

function cancelReasonText(reason: string | null): string {
  const copy = t.admin.pushCampaigns;
  if (reason === "subject_unpublished") return copy.cancelReasonSubjectUnpublished;
  if (reason === "subject_missing") return copy.cancelReasonSubjectMissing;
  return copy.cancelReasonUnknown;
}

function PushCampaignModal({
  client,
  kind,
  subjectId,
  onClose,
  onSent,
}: {
  client: PushCampaignClient;
  kind: PushCampaignKind;
  subjectId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const copy = t.admin.pushCampaigns;
  const [forceQuietHours, setForceQuietHours] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const estimateQuery = useQuery({
    queryKey: ["push-campaign-estimate", kind, subjectId],
    queryFn: () => client.estimatePushCampaign(kind, subjectId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      client.createPushCampaign({
        kind,
        subject_id: subjectId,
        force_quiet_hours: forceQuietHours || undefined,
      }),
    onSuccess: () => {
      onSent();
      onClose();
    },
    onError: (error) => setSubmitError(pushCampaignErrorText(error)),
  });

  const estimate = estimateQuery.data;
  const eligible = estimate?.eligible ?? 0;
  // Ночь блокирует подтверждение, пока не стоит явная галочка (§3.8) — как
  // только галочка стоит, кнопка снова читает обычные условия.
  const nightBlocked = Boolean(estimate?.quiet_hours_now) && !forceQuietHours;
  const canConfirm =
    !estimateQuery.isPending &&
    !estimateQuery.isError &&
    eligible > 0 &&
    !nightBlocked &&
    !createMutation.isPending;

  return (
    <Modal title={copy.modalTitle} onClose={onClose}>
      <div className="flex flex-col gap-md">
        {estimateQuery.isPending ? (
          <p className="text-sm text-text-muted" role="status" aria-live="polite">
            {copy.loadingEstimate}
          </p>
        ) : estimateQuery.isError ? (
          <p role="alert" className="text-sm text-brand">
            {copy.estimateFailed}
          </p>
        ) : estimate ? (
          <>
            <p className="break-words text-sm text-text">
              {estimate.city ? copy.cityLabel(estimate.city) : copy.cityEverywhere}
            </p>
            <p className="text-[13px] text-text-muted">{copy.inCityLabel(estimate.in_city)}</p>

            <div className="rounded-card bg-chip px-md py-sm">
              <p className="text-lg font-bold text-text">
                {copy.eligibleLabel}: {estimate.eligible}
              </p>
              {estimate.eligible === 0 ? (
                <p className="text-[13px] text-text-muted">{copy.eligibleZero}</p>
              ) : null}
            </div>

            <ul className="flex flex-col gap-xxs text-[13px] text-text-muted">
              <li>{copy.breakdownNoDevice(estimate.no_device)}</li>
              <li>{copy.breakdownOptedOut(estimate.opted_out)}</li>
              <li>{copy.breakdownCapped(estimate.capped)}</li>
              <li>{copy.breakdownAlreadyReceived(estimate.already_received)}</li>
            </ul>

            <div className="flex flex-col gap-xs">
              <span className="text-sm font-medium text-text">{copy.previewTitle}</span>
              {PREVIEW_LOCALES.map((locale) => (
                <div key={locale} className="rounded-card border border-hairline p-sm">
                  <p className="text-[11px] font-semibold uppercase text-text-muted">
                    {locale === "ru"
                      ? copy.previewLangRu
                      : locale === "kk"
                        ? copy.previewLangKk
                        : copy.previewLangEn}
                  </p>
                  <p className="break-words text-sm font-medium text-text">
                    {estimate.preview[locale].title}
                  </p>
                  <p className="break-words text-[13px] text-text-muted">
                    {estimate.preview[locale].body}
                  </p>
                </div>
              ))}
            </div>

            {estimate.last_campaign ? (
              <p role="note" className="break-words text-[13px] text-text-muted">
                {copy.lastCampaignNote(
                  formatShortDateTime(estimate.last_campaign.finished_at ?? ""),
                  estimate.last_campaign.sent_count,
                )}
              </p>
            ) : null}

            {estimate.campaigns_today_in_city >= 2 ? (
              <p role="alert" className="text-[13px] text-amber-800">
                {copy.campaignsTodayWarning(estimate.campaigns_today_in_city)}
              </p>
            ) : null}

            {estimate.quiet_hours_now ? (
              <div className="flex flex-col gap-xs rounded-card bg-rose-50 px-md py-sm">
                <p role="alert" className="text-[13px] text-rose-700">
                  {copy.quietHoursWarning}
                </p>
                <CheckboxRow
                  label={copy.quietHoursConfirm}
                  checked={forceQuietHours}
                  onChange={setForceQuietHours}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {submitError ? (
          <p role="alert" className="text-sm text-brand">
            {submitError}
          </p>
        ) : null}

        <div className="mt-sm flex justify-end gap-sm">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            disabled={!canConfirm}
            loading={createMutation.isPending}
            onClick={() => {
              setSubmitError(null);
              createMutation.mutate();
            }}
          >
            {createMutation.isPending ? copy.sending : copy.confirm(eligible)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AdminEvent, FeedStatus } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import {
  contentOverridesOf,
  describeRecurrence,
  describeRecurrencePeriod,
  eventToInput,
  formatDurationMinutes,
  recurrenceToInput,
  type EventSeriesRow,
} from "@/lib/event-series";
import { formatDateTime, formatMinorTenge } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { EventSeriesContentModal } from "./EventSeriesContentModal";
import { Modal } from "./ui/Modal";
import { PublishBadge } from "./ui/PublishBadge";

/**
 * Карточка СЕРИИ повторяющегося события.
 *
 * Главное здесь — не вёрстка, а разведение двух действий, которые до этого
 * выглядели одинаково. «Greek Party» рисовался восемнадцатью одинаковыми
 * карточками с красной кнопкой «Удалить»; человек нажимал её, чтобы убрать одну
 * дату, и не мог понять, почему событие осталось — или, наоборот, боялся, что
 * снесёт всё. Теперь:
 *
 *   • «эта дата» живёт ВНУТРИ развёрнутого списка дат, называется «Отменить
 *     дату» и в подтверждении явно пишет, сколько дат серии останется;
 *   • «вся серия» живёт в шапке, называется «Остановить серию…» и открывает
 *     диалог с двумя РАЗНЫМИ вариантами, где безобидный выбран по умолчанию.
 *
 * Одним нажатием серия не сносится ни при каком раскладе: остановка требует
 * открыть диалог, выбрать вариант и подтвердить.
 */
export function EventSeriesCard({
  row,
  onEdit,
  onInvalidate,
}: {
  row: EventSeriesRow;
  onEdit: (event: AdminEvent) => void;
  /** Перечитать список событий и правил после мутации. */
  onInvalidate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rule, upcoming, occurrences } = row;

  const ruleText = describeRecurrence(rule);
  const period = describeRecurrencePeriod(rule);

  /** Статус одной даты. Тело — полное (PUT заменяет запись целиком). */
  const dateStatusMutation = useMutation({
    mutationFn: ({ event, status }: { event: AdminEvent; status: AdminEvent["status"] }) =>
      apiClient.updateEvent(event.id, eventToInput(event, status)),
    onSuccess: onInvalidate,
    onError: () => setError(t.admin.common.saveFailed),
  });

  /** Отмена ОДНОЙ даты. Сервер при удалении сгенерированной даты записывает
   * tombstone в event_recurrence_skips (migration 0074), поэтому повтор её не
   * воскресит — так и написано в подтверждении. */
  const cancelDateMutation = useMutation({
    mutationFn: (event: AdminEvent) => apiClient.deleteEvent(event.id),
    onSuccess: onInvalidate,
    onError: () => setError(t.admin.events.series.cancelDateFailed),
  });

  /** Статус ВСЕЙ серии: правило (чтобы новые даты рождались таким же) и все
   * будущие даты. Прошедшие не трогаем — это история. */
  const bulkStatusMutation = useMutation({
    mutationFn: async (status: AdminEvent["status"]) => {
      if (rule) {
        await apiClient.updateEventRecurrence(
          rule.id,
          recurrenceToInput(rule, { occurrence_status: status }),
        );
      }
      for (const event of upcoming) {
        if (event.status !== status) {
          await apiClient.updateEvent(event.id, eventToInput(event, status));
        }
      }
    },
    onSuccess: onInvalidate,
    onError: () => setError(t.admin.events.series.bulkFailed),
  });

  const resumeMutation = useMutation({
    mutationFn: () => apiClient.activateEventRecurrence(row.recurrenceId),
    onSuccess: onInvalidate,
    onError: () => setError(t.admin.events.series.resumeFailed),
  });

  const busy =
    dateStatusMutation.isPending ||
    cancelDateMutation.isPending ||
    bulkStatusMutation.isPending ||
    resumeMutation.isPending;

  const seriesPublished = row.publishState === "published";

  return (
    <li className="flex flex-col gap-md rounded-card bg-surface p-lg">
      <div className="flex flex-col gap-md sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-sm">
            <span className="break-words text-sm font-semibold text-text">{row.title}</span>
            <span className="inline-block whitespace-nowrap rounded-pill bg-chip px-sm py-xxs text-[11px] font-medium text-text">
              {t.admin.events.series.chip}
            </span>
            {row.publishState === "mixed" ? (
              <span className="inline-block whitespace-nowrap rounded-pill bg-amber-100 px-sm py-xxs text-[11px] font-medium text-amber-800">
                {t.admin.events.series.badgeMixed}
              </span>
            ) : (
              <PublishBadge status={row.publishState} />
            )}
          </div>

          <p className="mt-xxs text-[13px] text-text-muted">{ruleText}</p>
          <p className="mt-xxs text-[13px] text-text-muted">
            {row.next
              ? `${t.admin.events.series.nextDate(formatDateTime(row.next.starts_at))} · ${t.admin.events.series.upcomingCount(upcoming.length)}`
              : t.admin.events.series.allPassed}
          </p>
          <p className="mt-xxs text-[12px] text-text-muted">
            {t.admin.events.series.datesCount(occurrences.length)}
            {rule ? ` · ${rule.is_active ? t.admin.events.series.active : t.admin.events.series.inactive}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-xs sm:justify-end">
          <Button size="sm" variant="secondary" onClick={() => setExpanded((v) => !v)}>
            {expanded ? t.admin.events.series.hideDates : t.admin.events.series.showDates}
          </Button>
          {/* Контент правится у СЕРИИ, а не у даты: одно название, одно
              описание, одна обложка на все даты (migration 0097). */}
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditingContent(true)}>
            {t.admin.events.series.editContent}
          </Button>
          {upcoming.length > 0 ? (
            <Button
              size="sm"
              variant={seriesPublished ? "secondary" : "primary"}
              disabled={busy}
              loading={bulkStatusMutation.isPending}
              onClick={() => {
                const next = seriesPublished ? "hidden" : "published";
                const ask = seriesPublished
                  ? t.admin.events.series.confirmHideAll(row.title, upcoming.length)
                  : t.admin.events.series.confirmPublishAll(row.title, upcoming.length);
                if (!window.confirm(ask)) return;
                setError(null);
                bulkStatusMutation.mutate(next);
              }}
            >
              {seriesPublished ? t.admin.events.series.hideAll : t.admin.events.series.publishAll}
            </Button>
          ) : null}
          {rule && rule.is_active ? (
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setStopping(true)}>
              {t.admin.events.series.stop}
            </Button>
          ) : null}
          {rule && !rule.is_active ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              loading={resumeMutation.isPending}
              onClick={() => {
                setError(null);
                resumeMutation.mutate();
              }}
            >
              {t.admin.events.series.resume}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-[12px] text-brand">
          {error}
        </p>
      ) : null}

      {expanded ? (
        <div className="flex flex-col gap-md border-t border-hairline pt-md">
          <RuleDetails row={row} ruleText={ruleText} period={period} />

          <div className="flex flex-col gap-sm">
            <p className="text-[13px] font-semibold text-text">
              {t.admin.events.series.datesTitle}
            </p>
            <p className="text-[12px] text-text-muted">{t.admin.events.series.datesHint}</p>
            <ul className="flex flex-col gap-xs">
              {occurrences.map((e) => {
                const isPast = !upcoming.includes(e);
                const rest = upcoming.length - 1;
                return (
                  <li
                    key={e.id}
                    className="flex flex-col gap-sm rounded-card bg-chip/40 px-md py-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-sm">
                        <span className="text-[13px] text-text">
                          {formatDateTime(e.starts_at)} — {formatDateTime(e.ends_at)}
                        </span>
                        <PublishBadge status={e.status} />
                        {isPast ? (
                          <span className="text-[11px] text-text-muted">
                            {t.admin.events.series.past}
                          </span>
                        ) : null}
                        {/* Дата, которая ведёт часть контента сама, обязана
                            отличаться на вид: иначе «почему у этой пятницы
                            другая афиша» выясняется только в форме. */}
                        {contentOverridesOf(e).length > 0 ? (
                          <span className="inline-block whitespace-nowrap rounded-pill bg-amber-100 px-sm py-xxs text-[11px] font-medium text-amber-800">
                            {t.admin.events.series.overrideChip(
                              contentOverridesOf(e)
                                .map((f) => t.admin.events.series.fieldName(f))
                                .join(", "),
                            )}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-xxs text-[12px] text-text-muted">
                        {e.ticketed
                          ? `${t.admin.events.ticketed} · ${formatMinorTenge(e.ticket_price_minor)}${
                              e.capacity != null ? ` · ${e.capacity}` : ""
                            }`
                          : t.admin.events.free}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-xs sm:justify-end">
                      <Button size="sm" variant="secondary" onClick={() => onEdit(e)}>
                        {t.admin.common.edit}
                      </Button>
                      {!isPast ? (
                        <>
                          <Button
                            size="sm"
                            variant={e.status === "published" ? "secondary" : "primary"}
                            disabled={busy}
                            loading={
                              dateStatusMutation.isPending &&
                              dateStatusMutation.variables?.event.id === e.id
                            }
                            onClick={() => {
                              setError(null);
                              dateStatusMutation.mutate({
                                event: e,
                                status: e.status === "published" ? "hidden" : "published",
                              });
                            }}
                          >
                            {e.status === "published"
                              ? t.admin.events.hide
                              : t.admin.events.publish}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            loading={
                              cancelDateMutation.isPending &&
                              cancelDateMutation.variables?.id === e.id
                            }
                            onClick={() => {
                              const ask = t.admin.events.series.confirmCancelDate(
                                formatDateTime(e.starts_at),
                                row.title,
                                rest,
                              );
                              if (!window.confirm(ask)) return;
                              setError(null);
                              cancelDateMutation.mutate(e);
                            }}
                          >
                            {t.admin.events.series.cancelDate}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}

      <SeriesFeedControl row={row} onInvalidate={onInvalidate} />

      {stopping ? (
        <StopSeriesModal row={row} onClose={() => setStopping(false)} onStopped={onInvalidate} />
      ) : null}

      {editingContent ? (
        <EventSeriesContentModal
          row={row}
          onClose={() => setEditingContent(false)}
          onSaved={() => {
            setEditingContent(false);
            onInvalidate();
          }}
        />
      ) : null}
    </li>
  );
}

/** Настройка повтора, показанная человеку — read-only. Правило правится
 * отдельным экраном/API; здесь оно объясняет, ОТКУДА берутся даты. */
function RuleDetails({
  row,
  ruleText,
  period,
}: {
  row: EventSeriesRow;
  ruleText: string;
  period: string;
}) {
  const { rule } = row;
  if (!rule) {
    return <p className="text-[12px] text-text-muted">{t.admin.events.series.ruleUnknown}</p>;
  }
  const rows: [string, string][] = [
    [t.admin.events.series.ruleRepeat, ruleText],
    [t.admin.events.series.ruleDuration, formatDurationMinutes(rule.duration_minutes)],
    [t.admin.events.series.rulePeriod, period],
    [
      t.admin.events.series.ruleTimezone,
      rule.timezone ? rule.timezone : t.admin.events.series.ruleTimezoneVenue,
    ],
  ];
  return (
    <div className="flex flex-col gap-xxs">
      <p className="text-[13px] font-semibold text-text">{t.admin.events.series.ruleTitle}</p>
      <dl className="grid grid-cols-1 gap-xxs sm:grid-cols-2">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex gap-xs text-[12px]">
              <dt className="text-text-muted">{label}:</dt>
              <dd className="text-text">{value}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

/**
 * «На главную» для СЕРИИ.
 *
 * Модерация умышленно живёт на правиле, а не на каждой дате (migration 0075):
 * восьминедельная ежедневная серия — это ~56 одинаковых карточек в очереди на
 * одно редакторское решение. Поэтому у дат серии кнопки «Отправить на главную»
 * нет вовсе, и подпись прямо это объясняет.
 */
function SeriesFeedControl({
  row,
  onInvalidate,
}: {
  row: EventSeriesRow;
  onInvalidate: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { rule } = row;

  const status: FeedStatus = rule?.occurrence_feed_status ?? "not_submitted";
  const canSubmit = status === "not_submitted" || status === "rejected";

  const mutation = useMutation({
    mutationFn: () =>
      canSubmit
        ? apiClient.submitRecurrenceToFeed(row.recurrenceId)
        : apiClient.withdrawRecurrenceFromFeed(row.recurrenceId),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      onInvalidate();
    },
    onError: () => setError(t.admin.feed.actionFailed),
  });

  const badge =
    status === "pending_review"
      ? { label: t.admin.feed.badgePending, className: "bg-amber-100 text-amber-800" }
      : status === "approved"
        ? { label: t.admin.feed.badgeApproved, className: "bg-emerald-100 text-emerald-800" }
        : status === "rejected"
          ? { label: t.admin.feed.badgeRejected, className: "bg-rose-100 text-rose-700" }
          : { label: t.admin.feed.badgeNotSubmitted, className: "bg-chip text-text-muted" };

  return (
    <div className="flex flex-col gap-sm border-t border-hairline pt-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-xxs">
        <div className="flex flex-wrap items-center gap-sm">
          <span
            className={`inline-block whitespace-nowrap rounded-pill px-sm py-xxs text-[11px] font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
          {status === "rejected" && rule?.feed_rejection_reason ? (
            <span className="break-words text-[12px] text-rose-700">
              {t.admin.feed.rejectionReason(rule.feed_rejection_reason)}
            </span>
          ) : null}
        </div>
        <p className="text-[12px] text-text-muted">{t.admin.events.series.feedHint}</p>
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
          disabled={!rule || mutation.isPending}
          loading={mutation.isPending}
          onClick={() => {
            setError(null);
            mutation.mutate();
          }}
        >
          {canSubmit ? t.admin.feed.submit : t.admin.feed.withdraw}
        </Button>
      </div>
    </div>
  );
}

/**
 * Диалог «остановить серию».
 *
 * Два ЯВНО разных исхода, и безобидный выбран по умолчанию: остановить только
 * генерацию — или остановить генерацию и отменить будущие даты. Ни один из них
 * недостижим одним нажатием: нужно открыть диалог, выбрать вариант и
 * подтвердить.
 */
function StopSeriesModal({
  row,
  onClose,
  onStopped,
}: {
  row: EventSeriesRow;
  onClose: () => void;
  onStopped: () => void;
}) {
  const [mode, setMode] = useState<"rule" | "rule_and_dates">("rule");
  const [error, setError] = useState<string | null>(null);
  const upcoming = row.upcoming;

  const mutation = useMutation({
    mutationFn: async () => {
      // Сначала выключаем правило: иначе между удалением дат и остановкой
      // генератор успел бы досоздать то, что человек только что убрал.
      await apiClient.deactivateEventRecurrence(row.recurrenceId);
      if (mode === "rule_and_dates") {
        for (const event of upcoming) {
          await apiClient.deleteEvent(event.id);
        }
      }
    },
    onSuccess: () => {
      onStopped();
      onClose();
    },
    onError: () => setError(t.admin.events.series.stopFailed),
  });

  return (
    <Modal title={t.admin.events.series.stopTitle(row.title)} onClose={onClose}>
      <div className="flex flex-col gap-md">
        <p className="text-[13px] text-text-muted">{t.admin.events.series.stopIntro}</p>

        <label className="flex cursor-pointer gap-sm rounded-card border border-hairline p-md">
          <input
            type="radio"
            name="stop-series-mode"
            className="mt-xxs"
            checked={mode === "rule"}
            onChange={() => setMode("rule")}
          />
          <span className="flex flex-col gap-xxs">
            <span className="text-sm font-medium text-text">
              {t.admin.events.series.stopOnlyRule}
            </span>
            <span className="text-[12px] text-text-muted">
              {t.admin.events.series.stopOnlyRuleHint(upcoming.length)}
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer gap-sm rounded-card border border-hairline p-md">
          <input
            type="radio"
            name="stop-series-mode"
            className="mt-xxs"
            checked={mode === "rule_and_dates"}
            onChange={() => setMode("rule_and_dates")}
          />
          <span className="flex flex-col gap-xxs">
            <span className="text-sm font-medium text-text">
              {t.admin.events.series.stopAndCancel}
            </span>
            <span className="text-[12px] text-text-muted">
              {t.admin.events.series.stopAndCancelHint(upcoming.length)}
            </span>
          </span>
        </label>

        {error ? (
          <p role="alert" className="text-sm text-brand">
            {error}
          </p>
        ) : null}

        <div className="mt-sm flex justify-end gap-sm">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.admin.common.cancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={mutation.isPending}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {mutation.isPending
              ? t.admin.events.series.stopping
              : t.admin.events.series.stopConfirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schedule, ScheduleOverride, WorkingHours } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatMinorTenge, minorToTenge, tengeToMinor, toHHMM } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { CheckboxRow, Field, TextArea, TextInput } from "./ui/FormControls";
import { Modal } from "./ui/Modal";
import { ErrorState, LoadingState } from "./StateViews";

/** Build a full Sunday..Saturday (0..6) working-hours array from whatever the
 * backend returned, so every day has an editable row. */
function normalizeWeek(rows: WorkingHours[]): WorkingHours[] {
  const byDay = new Map(rows.map((r) => [r.day_of_week, r]));
  return Array.from({ length: 7 }, (_, day) => {
    const row = byDay.get(day);
    return {
      day_of_week: day,
      is_open: row?.is_open ?? false,
      open_time: toHHMM(row?.open_time) || null,
      close_time: toHHMM(row?.close_time) || null,
    } satisfies WorkingHours;
  });
}

export function ScheduleView() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant!.id;
  const queryClient = useQueryClient();
  const queryKey = ["schedule", restaurantId] as const;

  const scheduleQuery = useQuery({
    queryKey,
    queryFn: () => apiClient.getSchedule(restaurantId),
  });

  if (scheduleQuery.isPending) return <LoadingState title={t.admin.schedule.loadingTitle} />;
  if (scheduleQuery.isError) return <ErrorState onRetry={() => void scheduleQuery.refetch()} />;

  return (
    <section className="mx-auto flex max-w-[900px] flex-col gap-xl">
      <h1 className="text-xl font-bold text-text">{t.admin.schedule.title}</h1>
      <WorkingHoursCard
        restaurantId={restaurantId}
        initial={scheduleQuery.data}
        onSaved={() => queryClient.invalidateQueries({ queryKey })}
      />
      <OverridesCard
        restaurantId={restaurantId}
        overrides={scheduleQuery.data.overrides}
        onChanged={() => queryClient.invalidateQueries({ queryKey })}
      />
    </section>
  );
}

function WorkingHoursCard({
  restaurantId,
  initial,
  onSaved,
}: {
  restaurantId: string;
  initial: Schedule;
  onSaved: () => void;
}) {
  const [week, setWeek] = useState<WorkingHours[]>(() => normalizeWeek(initial.working_hours));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep local edits in sync if the server data changes underneath us.
  useEffect(() => {
    setWeek(normalizeWeek(initial.working_hours));
  }, [initial]);

  const mutation = useMutation({
    mutationFn: (hours: WorkingHours[]) => apiClient.setWorkingHours(restaurantId, hours),
    onSuccess: () => {
      setNotice(t.admin.schedule.workingHoursSaved);
      setError(null);
      onSaved();
    },
    onError: () => setError(t.admin.common.saveFailed),
  });

  function patchDay(day: number, patch: Partial<WorkingHours>) {
    setWeek((prev) => prev.map((d) => (d.day_of_week === day ? { ...d, ...patch } : d)));
    setNotice(null);
  }

  function save() {
    setNotice(null);
    setError(null);
    // Send times only for open days; the backend clears them for closed ones.
    const payload = week.map((d) =>
      d.is_open
        ? { ...d, open_time: d.open_time || "", close_time: d.close_time || "" }
        : { ...d, open_time: null, close_time: null },
    );
    const invalid = payload.some((d) => d.is_open && (!d.open_time || !d.close_time));
    if (invalid) {
      setError(t.admin.common.required);
      return;
    }
    mutation.mutate(payload);
  }

  return (
    <div className="rounded-card bg-surface p-lg">
      <h2 className="text-base font-semibold text-text">{t.admin.schedule.workingHoursTitle}</h2>
      <p className="mt-xs text-[13px] text-text-muted">{t.admin.schedule.workingHoursHint}</p>

      <ul className="mt-lg flex flex-col divide-y divide-hairline">
        {week.map((d) => (
          <li
            key={d.day_of_week}
            className="flex flex-col gap-sm py-md sm:flex-row sm:items-center sm:gap-lg"
          >
            <span className="w-[130px] shrink-0 text-sm font-medium text-text">
              {t.admin.schedule.days[d.day_of_week]}
            </span>
            <div className="w-[130px] shrink-0">
              <CheckboxRow
                label={d.is_open ? t.admin.schedule.open : t.admin.schedule.closed}
                checked={d.is_open}
                onChange={(next) => patchDay(d.day_of_week, { is_open: next })}
              />
            </div>
            {d.is_open ? (
              <div className="flex flex-wrap items-center gap-sm">
                <label className="flex items-center gap-xs text-[13px] text-text-muted">
                  {t.admin.schedule.openTime}
                  <TextInput
                    type="time"
                    value={d.open_time ?? ""}
                    onChange={(e) => patchDay(d.day_of_week, { open_time: e.target.value })}
                    className="w-[120px]"
                  />
                </label>
                <label className="flex items-center gap-xs text-[13px] text-text-muted">
                  {t.admin.schedule.closeTime}
                  <TextInput
                    type="time"
                    value={d.close_time ?? ""}
                    onChange={(e) => patchDay(d.day_of_week, { close_time: e.target.value })}
                    className="w-[120px]"
                  />
                </label>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="mt-md text-sm text-brand">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-md text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      <div className="mt-lg flex justify-end">
        <Button onClick={save} loading={mutation.isPending}>
          {mutation.isPending ? t.admin.common.saving : t.admin.schedule.saveWorkingHours}
        </Button>
      </div>
    </div>
  );
}

function OverridesCard({
  restaurantId,
  overrides,
  onChanged,
}: {
  restaurantId: string;
  overrides: ScheduleOverride[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<ScheduleOverride | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (date: string) => apiClient.deleteScheduleOverride(restaurantId, date),
    onSuccess: onChanged,
    onError: () => setError(t.admin.common.deleteFailed),
  });

  const sorted = [...overrides].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="rounded-card bg-surface p-lg">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h2 className="text-base font-semibold text-text">{t.admin.schedule.overridesTitle}</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          {t.admin.schedule.addOverride}
        </Button>
      </div>
      <p className="mt-xs text-[13px] text-text-muted">{t.admin.schedule.overridesHint}</p>

      {error ? (
        <p role="alert" className="mt-md text-sm text-brand">
          {error}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <p className="mt-lg text-sm text-text-muted">{t.admin.schedule.overridesEmpty}</p>
      ) : (
        <ul className="mt-lg flex flex-col gap-sm">
          {sorted.map((o) => (
            <li
              key={o.date}
              className="flex flex-col gap-sm rounded-card border border-hairline p-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">{formatDate(o.date)}</p>
                <p className="mt-xxs text-[13px] text-text-muted">
                  {o.is_closed
                    ? t.admin.schedule.closed
                    : `${toHHMM(o.open_time)} — ${toHHMM(o.close_time)}`}
                  {o.booking_payment_required
                    ? ` · ${t.admin.schedule.paidBooking}: ${formatMinorTenge(o.deposit_amount_minor)}`
                    : ""}
                </p>
                {o.note ? <p className="mt-xxs break-words text-[12px] text-text-muted">{o.note}</p> : null}
              </div>
              <div className="flex shrink-0 gap-xs">
                <Button size="sm" variant="secondary" onClick={() => setEditing(o)}>
                  {t.admin.common.edit}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={deleteMutation.isPending && deleteMutation.variables === o.date}
                  onClick={() => {
                    if (!window.confirm(t.admin.common.confirmDelete)) return;
                    setError(null);
                    deleteMutation.mutate(o.date);
                  }}
                >
                  {t.admin.common.delete}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <OverrideFormModal
          restaurantId={restaurantId}
          override={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function OverrideFormModal({
  restaurantId,
  override,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  override?: ScheduleOverride;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!override;
  const [date, setDate] = useState(override?.date ?? "");
  const [closed, setClosed] = useState(override?.is_closed ?? false);
  const [openTime, setOpenTime] = useState(toHHMM(override?.open_time));
  const [closeTime, setCloseTime] = useState(toHHMM(override?.close_time));
  const [note, setNote] = useState(override?.note ?? "");
  const [paid, setPaid] = useState(override?.booking_payment_required ?? false);
  const [deposit, setDeposit] = useState(
    override?.deposit_amount_minor != null ? String(minorToTenge(override.deposit_amount_minor)) : "",
  );
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const depositNum = Number(deposit);
      return apiClient.setScheduleOverride(restaurantId, {
        date,
        is_closed: closed,
        open_time: closed ? null : openTime || null,
        close_time: closed ? null : closeTime || null,
        note: note.trim() || null,
        booking_payment_required: !closed && paid,
        deposit_amount_minor:
          !closed && paid && deposit.trim() && !Number.isNaN(depositNum)
            ? tengeToMinor(depositNum)
            : null,
      });
    },
    onSuccess: onSaved,
    onError: () => setFormError(t.admin.common.saveFailed),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;
    setFormError(null);
    if (!date) {
      setFormError(t.admin.schedule.dateRequired);
      return;
    }
    if (!closed && (!openTime || !closeTime)) {
      setFormError(t.admin.common.required);
      return;
    }
    if (!closed && paid) {
      const depositNum = Number(deposit);
      if (!deposit.trim() || Number.isNaN(depositNum) || depositNum <= 0) {
        setFormError(t.admin.common.required);
        return;
      }
    }
    mutation.mutate();
  }

  return (
    <Modal title={t.admin.schedule.addOverride} onClose={onClose}>
      <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
        <Field label={t.admin.schedule.overrideDate} required>
          <TextInput
            type="date"
            value={date}
            disabled={isEdit}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <CheckboxRow
          label={t.admin.schedule.overrideClosed}
          checked={closed}
          onChange={(next) => {
            setClosed(next);
            if (next) setPaid(false);
          }}
        />

        {!closed ? (
          <>
            <div className="grid grid-cols-2 gap-md">
              <Field label={t.admin.schedule.openTime} required>
                <TextInput
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                />
              </Field>
              <Field label={t.admin.schedule.closeTime} required>
                <TextInput
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                />
              </Field>
            </div>

            <CheckboxRow
              label={t.admin.schedule.paidBooking}
              checked={paid}
              onChange={setPaid}
            />
            {paid ? (
              <Field label={t.admin.schedule.depositAmount} hint={t.admin.schedule.depositHint} required>
                <TextInput
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                />
              </Field>
            ) : null}
          </>
        ) : null}

        <Field label={t.admin.schedule.overrideNote} hint={t.admin.schedule.overrideNoteHint}>
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {formError ? (
          <p role="alert" className="text-sm text-brand">
            {formError}
          </p>
        ) : null}

        <div className="mt-sm flex justify-end gap-sm">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.admin.common.cancel}
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {mutation.isPending ? t.admin.common.saving : t.admin.common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

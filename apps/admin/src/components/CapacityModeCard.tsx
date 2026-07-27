"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  classifyCapacitySwitchFailure,
  type BookingPolicy,
  type BookingPolicyPatch,
  type CapacityMode,
  type CapacitySwitchFailure,
  type CapacitySwitchFailureKind,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { Field, TextInput } from "./ui/FormControls";
import { ErrorState, LoadingState } from "./StateViews";

/**
 * Switching a venue between "по столикам" and "по общей вместимости".
 *
 * This is the one write in the cabinet that rewrites EXISTING reservations, so
 * its refusals are not interchangeable and the panel must not collapse them
 * into one "не удалось сохранить". Two of them arrive with their own
 * machine-readable code and mean opposite things for the staff member:
 *
 *   capacity_switch_conflict          → nothing happened, press the button again
 *   capacity_switch_too_many_bookings → nothing happened, and pressing it again
 *                                       will never help
 *
 * The classification itself lives in @bookeat/api/admin (testable without a
 * DOM); this file owns the wording and the affordance. The rule that decides
 * the affordance: offer «Повторить» ONLY when the server said nothing changed
 * and a retry can work; offer «Обновить данные» whenever the outcome is
 * unknown, so nobody switches twice on top of a change that may have landed.
 */

/** The two client methods this card needs. A prop rather than a hard import of
 * the singleton so the card can be rendered against a fake in a test — the
 * shared client reads its base URL from the environment at module load. */
export interface CapacityPolicyClient {
  getBookingPolicy(restaurantId: string): Promise<BookingPolicy>;
  updateBookingPolicy(restaurantId: string, patch: BookingPolicyPatch): Promise<BookingPolicy>;
}

const copy = t.admin.capacity;

/** Title + body for every outcome. Exhaustive by type: a new kind added in
 * @bookeat/api stops compiling here instead of silently reusing another one's
 * wording. */
const FAILURE_COPY: Record<CapacitySwitchFailureKind, { title: string; body: string }> = {
  conflict_retryable: { title: copy.failure.conflictTitle, body: copy.failure.conflictBody },
  too_many_bookings: { title: copy.failure.tooManyTitle, body: copy.failure.tooManyBody },
  refused: { title: copy.failure.refusedTitle, body: copy.failure.refusedBody },
  forbidden: { title: copy.failure.forbiddenTitle, body: copy.failure.forbiddenBody },
  unauthorized: { title: copy.failure.unauthorizedTitle, body: copy.failure.unauthorizedBody },
  not_found: { title: copy.failure.notFoundTitle, body: copy.failure.notFoundBody },
  unknown: { title: copy.failure.unknownTitle, body: copy.failure.unknownBody },
};

export function CapacityModeCard({
  restaurantId,
  client = apiClient,
}: {
  restaurantId: string;
  client?: CapacityPolicyClient;
}) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["booking-policy", restaurantId] as const, [restaurantId]);

  const policyQuery = useQuery({
    queryKey,
    queryFn: () => client.getBookingPolicy(restaurantId),
  });

  if (policyQuery.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (policyQuery.isError) return <ErrorState onRetry={() => void policyQuery.refetch()} />;

  return (
    <CapacityModeForm
      restaurantId={restaurantId}
      client={client}
      policy={policyQuery.data}
      onChanged={() => queryClient.invalidateQueries({ queryKey })}
      onRefresh={() => void policyQuery.refetch()}
    />
  );
}

function CapacityModeForm({
  restaurantId,
  client,
  policy,
  onChanged,
  onRefresh,
}: {
  restaurantId: string;
  client: CapacityPolicyClient;
  policy: BookingPolicy;
  onChanged: () => void;
  onRefresh: () => void;
}) {
  const current = policy.effective;
  const [mode, setMode] = useState<CapacityMode>(current.capacity_mode);
  const [seats, setSeats] = useState<string>(
    current.capacity_seats > 0 ? String(current.capacity_seats) : "",
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<CapacitySwitchFailure | null>(null);
  /** The exact body that failed, so «Повторить» resends THAT request and not
   * whatever the form happens to hold a minute later. */
  const [lastPatch, setLastPatch] = useState<BookingPolicyPatch | null>(null);

  // The server is the truth: after a successful switch (or a refetch) start
  // from what it now says, not from what was typed.
  useEffect(() => {
    setMode(current.capacity_mode);
    setSeats(current.capacity_seats > 0 ? String(current.capacity_seats) : "");
  }, [current.capacity_mode, current.capacity_seats]);

  const mutation = useMutation({
    mutationFn: (patch: BookingPolicyPatch) => client.updateBookingPolicy(restaurantId, patch),
    onSuccess: () => {
      setFailure(null);
      setLastPatch(null);
      setSaved(true);
      onChanged();
    },
    onError: (error: unknown) => {
      setSaved(false);
      setFailure(classifyCapacitySwitchFailure(error));
    },
  });

  function buildPatch(): BookingPolicyPatch | null {
    const patch: BookingPolicyPatch = {};
    if (mode !== current.capacity_mode) patch.booking_capacity_mode = mode;
    if (mode === "seats") {
      const parsed = Number(seats.trim());
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setLocalError(copy.seatsRequired);
        return null;
      }
      if (parsed !== current.capacity_seats) patch.booking_capacity_seats = parsed;
    }
    // The server rejects a body that would patch nothing (422), so say it here
    // instead of spending a request on it.
    if (patch.booking_capacity_mode === undefined && patch.booking_capacity_seats === undefined) {
      setLocalError(copy.noChanges);
      return null;
    }
    return patch;
  }

  function submit() {
    setLocalError(null);
    setSaved(false);
    setFailure(null);
    const patch = buildPatch();
    if (!patch) return;
    setLastPatch(patch);
    mutation.mutate(patch);
  }

  function retry() {
    if (!lastPatch) return;
    setSaved(false);
    setFailure(null);
    mutation.mutate(lastPatch);
  }

  const busy = mutation.isPending;

  return (
    <div className="rounded-card bg-surface p-lg">
      <h2 className="text-base font-semibold text-text">{copy.title}</h2>
      <p className="mt-xs max-w-prose text-[13px] text-text-muted">{copy.description}</p>

      <fieldset className="mt-lg flex flex-col gap-sm border-0 p-0" disabled={busy}>
        <legend className="text-sm font-medium text-text">{copy.modeLabel}</legend>
        <ModeRadio
          checked={mode === "tables"}
          onSelect={() => setMode("tables")}
          label={copy.modeTables}
          hint={copy.modeTablesHint}
        />
        <ModeRadio
          checked={mode === "seats"}
          onSelect={() => setMode("seats")}
          label={copy.modeSeats}
          hint={copy.modeSeatsHint}
        />
      </fieldset>

      {mode === "seats" ? (
        <div className="mt-md max-w-[220px]">
          <Field label={copy.seatsLabel} hint={copy.seatsHint} htmlFor="capacity-seats" required>
            <TextInput
              id="capacity-seats"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={seats}
              disabled={busy}
              onChange={(e) => {
                setSeats(e.target.value);
                setLocalError(null);
                setSaved(false);
              }}
            />
          </Field>
        </div>
      ) : null}

      <div className="mt-lg flex flex-wrap items-center gap-md">
        <Button onClick={submit} loading={busy}>
          {busy ? copy.saving : copy.save}
        </Button>
        {saved ? (
          <span role="status" className="text-sm text-text-muted">
            {copy.saved}
          </span>
        ) : null}
        {localError ? (
          <span role="alert" className="text-sm text-brand">
            {localError}
          </span>
        ) : null}
      </div>

      {failure ? (
        <FailureNotice
          failure={failure}
          onRetry={lastPatch ? retry : undefined}
          onRefresh={onRefresh}
          busy={busy}
        />
      ) : null}
    </div>
  );
}

/**
 * The refusal, said in one screen: what happened, whether anything changed,
 * and the single action worth taking.
 *
 * `role="alert"` because it appears after a button press and a staff member
 * using a screen reader must hear it without hunting for it.
 */
function FailureNotice({
  failure,
  onRetry,
  onRefresh,
  busy,
}: {
  failure: CapacitySwitchFailure;
  onRetry?: () => void;
  onRefresh: () => void;
  busy: boolean;
}) {
  const text = FAILURE_COPY[failure.kind];
  return (
    <div
      role="alert"
      className="mt-lg flex flex-col items-start gap-sm rounded-card border border-brand bg-[#fbeaea] p-md"
    >
      <p className="text-sm font-semibold text-text">{text.title}</p>
      <p className="max-w-prose text-[13px] text-text">{text.body}</p>
      {failure.retryable && onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} loading={busy}>
          {copy.retry}
        </Button>
      ) : null}
      {/* Offered for exactly one case: we do not know what the server did, so
          the only honest next step is to look at the current state. Never
          shown next to a retry — that would invite doing both. */}
      {failure.applied === "unknown" ? (
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={busy}>
          {copy.refresh}
        </Button>
      ) : null}
    </div>
  );
}

/** A real radio in a real fieldset: keyboard reachable, grouped for screen
 * readers, and the whole row is the 44px hit area. */
function ModeRadio({
  checked,
  onSelect,
  label,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-start gap-sm py-xs">
      <input
        type="radio"
        name="capacity-mode"
        checked={checked}
        onChange={onSelect}
        className="mt-xs h-5 w-5 shrink-0 accent-brand"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm text-text">{label}</span>
        <span className="text-[12px] text-text-muted">{hint}</span>
      </span>
    </label>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminApiError,
  type RestaurantKwaakaLink,
  type RestaurantPricePatch,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { useOptionalAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { isVenueUnavailableError } from "@/lib/venue-access";
import { Button } from "./ui/Button";
import { Field, TextInput } from "./ui/FormControls";
import { ErrorState, LoadingState, VenueUnavailableState } from "./StateViews";

/**
 * «Kwaaka POS» — the venue's warehouse/menu id in Kwaaka, used to sync this
 * venue's menu and stop-list. Superadmin-only, mirroring `is_premium`/
 * `display_order`: the backend strips `kwaaka_restaurant_id` from both the
 * read and the PATCH for a non-admin caller, so this card is only mounted for
 * a superadmin (see SettingsView) rather than trying to explain a 403 to a
 * venue manager who should never see the field at all.
 *
 * Reads/writes the SAME `GET`/`PATCH /restaurants/:id` as «Средний чек»
 * (PricingCard) — `getRestaurantKwaakaLink`/`patchRestaurant`, sharing
 * `RestaurantPricePatch` for the write. Clearing the field and saving sends
 * an explicit `null` to unlink, unlike the price tier's «Не выбрано» (which
 * omits the key): Kwaaka has no «leave alone» value to protect, an empty
 * field unambiguously means «not linked».
 */
const copy = t.admin.kwaaka;

export interface KwaakaLinkClient {
  getRestaurantKwaakaLink(restaurantId: string): Promise<RestaurantKwaakaLink>;
  patchRestaurant(restaurantId: string, input: RestaurantPricePatch): Promise<unknown>;
}

export function KwaakaLinkCard({
  restaurantId,
  client = apiClient,
}: {
  restaurantId: string;
  client?: KwaakaLinkClient;
}) {
  const queryClient = useQueryClient();
  const auth = useOptionalAuth();
  const queryKey = useMemo(() => ["restaurant-kwaaka-link", restaurantId] as const, [restaurantId]);

  const linkQuery = useQuery({
    queryKey,
    queryFn: () => client.getRestaurantKwaakaLink(restaurantId),
  });

  if (linkQuery.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (linkQuery.isError) {
    if (isVenueUnavailableError(linkQuery.error)) {
      return <VenueUnavailableState onPickAnother={auth ? () => auth.clearRestaurant() : undefined} />;
    }
    return <ErrorState onRetry={() => void linkQuery.refetch()} />;
  }

  return (
    <KwaakaLinkForm
      restaurantId={restaurantId}
      client={client}
      link={linkQuery.data}
      onChanged={() => queryClient.invalidateQueries({ queryKey })}
    />
  );
}

function KwaakaLinkForm({
  restaurantId,
  client,
  link,
  onChanged,
}: {
  restaurantId: string;
  client: KwaakaLinkClient;
  link: RestaurantKwaakaLink;
  onChanged: () => void;
}) {
  const current = link.kwaaka_restaurant_id;

  const [value, setValue] = useState(current ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The server is the truth: after a save (or refetch) start from what it now
  // says, not from what was typed.
  useEffect(() => {
    setValue(current ?? "");
  }, [current]);

  const mutation = useMutation({
    mutationFn: (patch: RestaurantPricePatch) => client.patchRestaurant(restaurantId, patch),
    onSuccess: (_data, patch) => {
      setLocalError(null);
      setNotice(patch.kwaaka_restaurant_id === null ? copy.unlinked : copy.saved);
      onChanged();
    },
    onError: (error: unknown) => {
      setNotice(null);
      setLocalError(saveErrorMessage(error));
    },
  });

  function submit() {
    setLocalError(null);
    setNotice(null);
    const trimmed = value.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next === (current ?? null)) {
      setLocalError(copy.noChanges);
      return;
    }
    mutation.mutate({ kwaaka_restaurant_id: next });
  }

  const busy = mutation.isPending;

  return (
    <div className="rounded-card bg-surface p-lg">
      <h2 className="text-base font-semibold text-text">{copy.title}</h2>
      <p className="mt-xs max-w-prose text-[13px] text-text-muted">{copy.description}</p>

      <p className="mt-sm text-[13px] text-text">
        {current ? copy.currentBinding(current) : copy.notLinked}
      </p>

      <fieldset className="mt-lg flex flex-col gap-lg border-0 p-0" disabled={busy}>
        <div className="max-w-[420px]">
          <Field label={copy.fieldLabel} hint={copy.fieldHint} htmlFor="kwaaka-restaurant-id">
            <TextInput
              id="kwaaka-restaurant-id"
              type="text"
              placeholder={copy.fieldPlaceholder}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setLocalError(null);
                setNotice(null);
              }}
            />
          </Field>
        </div>
      </fieldset>

      <div className="mt-lg flex flex-wrap items-center gap-md">
        <Button onClick={submit} loading={busy}>
          {busy ? copy.saving : copy.save}
        </Button>
        {notice ? (
          <span role="status" className="text-sm text-text-muted">
            {notice}
          </span>
        ) : null}
        {localError ? (
          <span role="alert" className="text-sm text-brand">
            {localError}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** 403 here means one thing: only a superadmin may change this link — the
 * same stance PaymentAcceptanceCard takes for its own superadmin-only PUT. */
function saveErrorMessage(error: unknown): string {
  const status = error instanceof AdminApiError ? error.status : undefined;
  return status === 403 ? copy.saveForbidden : copy.saveFailed;
}

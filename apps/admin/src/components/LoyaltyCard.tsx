"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminApiError,
  type RestaurantLoyaltySettings,
  type RestaurantPricePatch,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { useOptionalAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { isVenueUnavailableError } from "@/lib/venue-access";
import { Button } from "./ui/Button";
import { CheckboxRow } from "./ui/FormControls";
import { ErrorState, LoadingState, VenueUnavailableState } from "./StateViews";

/**
 * «Бонусная система» — включает/выключает кнопку «QR-код лояльности» на
 * экране этого заведения в мобильном приложении (`VenueHero`, prop
 * `onOpenLoyaltyQr`, PR #275). Заведение своей системы лояльности не имеет —
 * это платформенный декоративный виджет, поэтому показывать его гостю
 * решает платформа, не владелец заведения, mirroring `kwaaka_restaurant_id`/
 * `is_premium`: the backend strips `loyalty_enabled` from the PATCH for a
 * non-admin caller, so this card is only mounted for a superadmin (see
 * VenuesView, gated as a whole).
 *
 * Reads/writes the SAME `GET`/`PATCH /restaurants/:id` as «Kwaaka POS» —
 * `getRestaurantLoyalty`/`patchRestaurant()`, sharing `RestaurantPricePatch`
 * for the write. Unlike Kwaaka's text field, there is no "leave alone" value
 * to protect — the toggle always sends its current on/off state explicitly.
 */
const copy = t.admin.loyalty;

export interface LoyaltyClient {
  getRestaurantLoyalty(restaurantId: string): Promise<RestaurantLoyaltySettings>;
  patchRestaurant(restaurantId: string, input: RestaurantPricePatch): Promise<unknown>;
}

export function LoyaltyCard({
  restaurantId,
  client = apiClient,
  onDirtyChange,
}: {
  restaurantId: string;
  client?: LoyaltyClient;
  /** Карточка сохраняется своей кнопкой, отдельно от формы заведения (см.
   * VenuesView). Родитель должен знать, есть ли тут несохранённый переключатель,
   * чтобы форма не закрылась молча с ненажатым «Сохранить». */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const auth = useOptionalAuth();
  const queryKey = useMemo(() => ["restaurant-loyalty", restaurantId] as const, [restaurantId]);

  const settingsQuery = useQuery({
    queryKey,
    queryFn: () => client.getRestaurantLoyalty(restaurantId),
  });

  if (settingsQuery.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (settingsQuery.isError) {
    if (isVenueUnavailableError(settingsQuery.error)) {
      return <VenueUnavailableState onPickAnother={auth ? () => auth.clearRestaurant() : undefined} />;
    }
    return <ErrorState onRetry={() => void settingsQuery.refetch()} />;
  }

  return (
    <LoyaltyForm
      restaurantId={restaurantId}
      client={client}
      settings={settingsQuery.data}
      onChanged={() => queryClient.invalidateQueries({ queryKey })}
      onDirtyChange={onDirtyChange}
    />
  );
}

function LoyaltyForm({
  restaurantId,
  client,
  settings,
  onChanged,
  onDirtyChange,
}: {
  restaurantId: string;
  client: LoyaltyClient;
  settings: RestaurantLoyaltySettings;
  onChanged: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const current = settings.loyalty_enabled;

  const [enabled, setEnabled] = useState(current);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The server is the truth: after a save (or refetch) start from what it now
  // says, not from what was toggled.
  useEffect(() => {
    setEnabled(current);
  }, [current]);

  const mutation = useMutation({
    mutationFn: (patch: RestaurantPricePatch) => client.patchRestaurant(restaurantId, patch),
    onSuccess: () => {
      setLocalError(null);
      setNotice(copy.saved);
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
    if (enabled === current) {
      setLocalError(copy.noChanges);
      return;
    }
    mutation.mutate({ loyalty_enabled: enabled });
  }

  const busy = mutation.isPending;
  const dirty = enabled !== current;

  // Родитель (форма заведения) не должен закрыться, пока тут висит несохранённый
  // переключатель: общая кнопка «Сохранить» формы эту карточку не трогает.
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => onDirtyChangeRef.current?.(false), []);

  return (
    <div className="rounded-card bg-surface p-lg">
      <h2 className="text-base font-semibold text-text">{copy.title}</h2>
      <p className="mt-xs max-w-prose text-[13px] text-text-muted">{copy.description}</p>
      <p className="mt-xs max-w-prose text-[12px] text-text-muted">{copy.separateSaveHint}</p>

      <fieldset className="mt-lg flex flex-col gap-lg border-0 p-0" disabled={busy}>
        <CheckboxRow
          label={copy.toggleLabel}
          hint={enabled ? copy.toggleHintOn : copy.toggleHintOff}
          checked={enabled}
          onChange={(next) => {
            setEnabled(next);
            setLocalError(null);
            setNotice(null);
          }}
        />
      </fieldset>

      <div className="mt-lg flex flex-wrap items-center gap-md">
        <Button onClick={submit} loading={busy} disabled={!dirty}>
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

/** 403 here means one thing: only a superadmin may change this setting — the
 * same stance KwaakaLinkCard/PaymentAcceptanceCard take for their own
 * superadmin-only PATCH/PUT. */
function saveErrorMessage(error: unknown): string {
  const status = error instanceof AdminApiError ? error.status : undefined;
  return status === 403 ? copy.saveForbidden : copy.saveFailed;
}

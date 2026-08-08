"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  parsePriceRangeInput,
  type PriceRangeParseError,
  type RestaurantPricePatch,
  type RestaurantPricing,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { Field, Select, TextInput } from "./ui/FormControls";
import { ErrorState, LoadingState } from "./StateViews";

/**
 * «Средний чек» — the venue's categorical price tier (₸/₸₸/₸₸₸) and its numeric
 * average-check range in whole tenge.
 *
 * Both write through the SAME `PATCH /restaurants/:id` and the panel prefills
 * from `GET /restaurants/:id` (the only read carrying the numeric range).
 *
 * Two independent rules the card enforces before spending a request:
 *  - the range is both-or-neither (parsePriceRangeInput, tested DOM-free);
 *  - a body that would change nothing is a 422 on the server, so it is caught
 *    here as «менять нечего» instead — the same stance CapacityModeCard takes.
 *
 * The tier's empty option means "не менять": the backend rejects an empty
 * price_category (it is not one of the three valid tiers) and cannot clear it,
 * so selecting «Не выбрано» simply omits the field rather than sending "".
 */
const copy = t.admin.pricing;

/** The valid tiers, in order. Kept here (not in i18n) because the strings ARE
 * the wire values the backend validates — they are data, not copy. */
const PRICE_TIERS = ["₸", "₸₸", "₸₸₸"] as const;

const RANGE_ERROR_COPY: Record<PriceRangeParseError, string> = {
  incomplete: copy.errorIncomplete,
  invalid: copy.errorInvalid,
  inverted: copy.errorInverted,
};

export interface PricingClient {
  getRestaurantPricing(restaurantId: string): Promise<RestaurantPricing>;
  patchRestaurant(restaurantId: string, input: RestaurantPricePatch): Promise<RestaurantPricing>;
}

export function PricingCard({
  restaurantId,
  client = apiClient,
}: {
  restaurantId: string;
  client?: PricingClient;
}) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["restaurant-pricing", restaurantId] as const, [restaurantId]);

  const pricingQuery = useQuery({
    queryKey,
    queryFn: () => client.getRestaurantPricing(restaurantId),
  });

  if (pricingQuery.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (pricingQuery.isError) return <ErrorState onRetry={() => void pricingQuery.refetch()} />;

  return (
    <PricingForm
      restaurantId={restaurantId}
      client={client}
      pricing={pricingQuery.data}
      onChanged={() => queryClient.invalidateQueries({ queryKey })}
    />
  );
}

function PricingForm({
  restaurantId,
  client,
  pricing,
  onChanged,
}: {
  restaurantId: string;
  client: PricingClient;
  pricing: RestaurantPricing;
  onChanged: () => void;
}) {
  const currentCategory = pricing.price_category ?? "";
  const currentMin = pricing.price_range?.min ?? null;
  const currentMax = pricing.price_range?.max ?? null;

  const [category, setCategory] = useState(currentCategory);
  const [minStr, setMinStr] = useState(currentMin != null ? String(currentMin) : "");
  const [maxStr, setMaxStr] = useState(currentMax != null ? String(currentMax) : "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The server is the truth: after a save (or refetch) start from what it now
  // says, not from what was typed.
  useEffect(() => {
    setCategory(currentCategory);
    setMinStr(currentMin != null ? String(currentMin) : "");
    setMaxStr(currentMax != null ? String(currentMax) : "");
  }, [currentCategory, currentMin, currentMax]);

  const mutation = useMutation({
    mutationFn: (patch: RestaurantPricePatch) => client.patchRestaurant(restaurantId, patch),
    onSuccess: () => {
      setSaved(true);
      onChanged();
    },
    onError: () => {
      setSaved(false);
      setLocalError(copy.saveFailed);
    },
  });

  function buildPatch(): RestaurantPricePatch | null {
    const patch: RestaurantPricePatch = {};

    // Tier: send only a real, changed tier. "Не выбрано" ("") omits the field
    // (the backend rejects "" and cannot clear a tier through this route).
    if (category !== "" && category !== currentCategory) {
      patch.price_category = category;
    }

    // Range: both-or-neither, validated before the request.
    const range = parsePriceRangeInput(minStr, maxStr);
    if (!range.ok) {
      setLocalError(RANGE_ERROR_COPY[range.error]);
      return null;
    }
    if (range.min != null && range.max != null) {
      // A pair is only sent when it actually differs — always both together.
      if (range.min !== currentMin || range.max !== currentMax) {
        patch.price_min = range.min;
        patch.price_max = range.max;
      }
    }
    // Clearing an existing range is not supported by this endpoint (a null and
    // an omitted key are the same to the backend), so both-blank simply sends
    // nothing for the range — never a half-written pair.

    if (
      patch.price_category === undefined &&
      patch.price_min === undefined &&
      patch.price_max === undefined
    ) {
      setLocalError(copy.noChanges);
      return null;
    }
    return patch;
  }

  function submit() {
    setLocalError(null);
    setSaved(false);
    const patch = buildPatch();
    if (!patch) return;
    mutation.mutate(patch);
  }

  const busy = mutation.isPending;

  return (
    <div className="rounded-card bg-surface p-lg">
      <h2 className="text-base font-semibold text-text">{copy.title}</h2>
      <p className="mt-xs max-w-prose text-[13px] text-text-muted">{copy.description}</p>

      <fieldset className="mt-lg flex flex-col gap-lg border-0 p-0" disabled={busy}>
        <div className="max-w-[280px]">
          <Field label={copy.categoryLabel} hint={copy.categoryHint} htmlFor="pricing-category">
            <Select
              id="pricing-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setLocalError(null);
                setSaved(false);
              }}
            >
              <option value="">{copy.categoryNone}</option>
              {PRICE_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-col gap-xs">
          <span className="text-sm font-medium text-text">{copy.rangeLabel}</span>
          <div className="flex flex-wrap items-end gap-md">
            <div className="max-w-[160px]">
              <Field label={copy.minLabel} htmlFor="pricing-min">
                <TextInput
                  id="pricing-min"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder={copy.minPlaceholder}
                  value={minStr}
                  onChange={(e) => {
                    setMinStr(e.target.value);
                    setLocalError(null);
                    setSaved(false);
                  }}
                />
              </Field>
            </div>
            <div className="max-w-[160px]">
              <Field label={copy.maxLabel} htmlFor="pricing-max">
                <TextInput
                  id="pricing-max"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder={copy.maxPlaceholder}
                  value={maxStr}
                  onChange={(e) => {
                    setMaxStr(e.target.value);
                    setLocalError(null);
                    setSaved(false);
                  }}
                />
              </Field>
            </div>
          </div>
          <span className="text-[12px] text-text-muted">{copy.rangeHint}</span>
        </div>
      </fieldset>

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
    </div>
  );
}

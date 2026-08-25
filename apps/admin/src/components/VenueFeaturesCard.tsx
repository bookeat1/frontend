"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activeVenueFeatures,
  mergeVenueFeatureOptions,
  venueFeatureIdsOf,
  type VenueFeatureDictionaryEntry,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { VenueFeaturePicker } from "./ui/VenueFeaturePicker";
import { ErrorState, LoadingState } from "./StateViews";

/**
 * «Удобства» в настройках заведения — чтобы ресторан отмечал свои галочки сам.
 *
 * ПРАВА (прочитано, не предположено). `GET|PUT /restaurants/:id/features`
 * смонтированы на группе `restScoped` с `RequireRestaurantManager`
 * (bootstrap/app.go:386-387), а usecase дополнительно проверяет право
 * `restaurant.manage` у ЭТОГО заведения (`authorizeVenue` в
 * internal/usecase/venuefeatures/facade.go). Суперадмин проходит без проверки.
 * То есть управляющий заведения правит свои удобства без платформы — как
 * кухни и ссылки на соцсети. Сам СПРАВОЧНИК при этом только читается: заводить
 * и скрывать удобства может лишь платформа (`/admin/venue-features` под
 * RequireRole(RoleAdmin), плюс `requirePlatform` в usecase), и обходить это
 * здесь нечем и незачем.
 *
 * Набор сервер ЗАМЕЩАЕТ целиком (PUT, не PATCH), поэтому карточка сначала
 * читает текущий набор и только потом даёт сохранять.
 */

const copy = t.admin.venueFeatures;

export interface VenueFeaturesClient {
  listVenueFeatures(): Promise<VenueFeatureDictionaryEntry[]>;
  getRestaurantFeatures(restaurantId: string): Promise<VenueFeatureDictionaryEntry[]>;
  setRestaurantFeatures(
    restaurantId: string,
    ids: readonly string[],
  ): Promise<VenueFeatureDictionaryEntry[]>;
}

export function VenueFeaturesCard({
  restaurantId,
  client = apiClient,
}: {
  restaurantId: string;
  client?: VenueFeaturesClient;
}) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["venue-feature-set", restaurantId] as const, [restaurantId]);

  const dictionaryQuery = useQuery({
    queryKey: ["venue-features"],
    queryFn: () => client.listVenueFeatures(),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const venueQuery = useQuery({
    queryKey,
    queryFn: () => client.getRestaurantFeatures(restaurantId),
  });

  if (dictionaryQuery.isPending || venueQuery.isPending) {
    return <LoadingState title={copy.loadingTitle} />;
  }
  // Сохранять, не зная текущего набора, нельзя — PUT замещает его целиком.
  // Справочник нужен по той же причине с другой стороны: без него не из чего
  // выбирать, и пустой список выглядел бы как «удобств не бывает».
  if (venueQuery.isError || dictionaryQuery.isError) {
    return (
      <ErrorState
        message={copy.loadFailed}
        onRetry={() => {
          void venueQuery.refetch();
          void dictionaryQuery.refetch();
        }}
      />
    );
  }

  return (
    <VenueFeaturesForm
      restaurantId={restaurantId}
      client={client}
      dictionary={dictionaryQuery.data}
      current={venueQuery.data}
      onChanged={() => queryClient.invalidateQueries({ queryKey })}
    />
  );
}

function VenueFeaturesForm({
  restaurantId,
  client,
  dictionary,
  current,
  onChanged,
}: {
  restaurantId: string;
  client: VenueFeaturesClient;
  dictionary: VenueFeatureDictionaryEntry[];
  current: VenueFeatureDictionaryEntry[];
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => venueFeatureIdsOf(current));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Синхронизируемся только когда сервер ВПРАВДУ отдал другое: react-query
  // держит ту же ссылку, пока содержимое не менялось, а безусловный сброс на
  // каждом рендере затирал бы отмеченное человеком.
  const syncedRef = useRef(current);
  useEffect(() => {
    if (syncedRef.current === current) return;
    syncedRef.current = current;
    setSelected(venueFeatureIdsOf(current));
  }, [current]);

  const options = useMemo(
    () => mergeVenueFeatureOptions(activeVenueFeatures(dictionary), current),
    [dictionary, current],
  );

  const mutation = useMutation({
    mutationFn: (ids: readonly string[]) => client.setRestaurantFeatures(restaurantId, ids),
    onSuccess: () => {
      setSaved(true);
      onChanged();
    },
    onError: () => {
      setSaved(false);
      setSaveError(copy.saveFailed);
    },
  });

  const busy = mutation.isPending;

  return (
    <div className="rounded-card bg-surface p-lg">
      <h2 className="text-base font-semibold text-text">{copy.title}</h2>

      <div className="mt-lg">
        <VenueFeaturePicker
          options={options}
          selected={selected}
          onChange={(next) => {
            setSelected(next);
            setSaveError(null);
            setSaved(false);
          }}
          disabled={busy}
          showTitle={false}
          idPrefix="settings-feature"
        />
      </div>

      <div className="mt-lg flex flex-wrap items-center gap-md">
        <Button
          onClick={() => {
            setSaveError(null);
            setSaved(false);
            mutation.mutate(selected);
          }}
          loading={busy}
        >
          {busy ? copy.saving : copy.save}
        </Button>
        {saved ? (
          <span role="status" className="text-sm text-text-muted">
            {copy.saved}
          </span>
        ) : null}
        {saveError ? (
          <span role="alert" className="text-sm text-brand">
            {saveError}
          </span>
        ) : null}
      </div>
    </div>
  );
}

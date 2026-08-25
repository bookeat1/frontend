"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cuisineIdsOf, type CuisineDictionaryEntry } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { CuisinePicker, mergeCuisineOptions } from "./ui/CuisinePicker";
import { ErrorState, LoadingState } from "./StateViews";

/**
 * «Кухни» в настройках заведения — чтобы ресторан правил свой набор сам.
 *
 * ПРАВА (прочитано, не предположено). `GET|PUT /restaurants/:id/cuisines`
 * смонтированы на группе `restScoped` с `RequireRestaurantManager`
 * (bootstrap/app.go), а usecase дополнительно проверяет право
 * `restaurant.manage` у ЭТОГО заведения (`authorizeVenue`). Суперадмин проходит
 * без проверки. То есть управляющий заведения правит свои кухни без платформы —
 * как и ссылки на соцсети. Сам СПРАВОЧНИК при этом только читается: заводить и
 * скрывать кухни может лишь платформа (`/admin/cuisines` под
 * RequireRole(RoleAdmin)), и обходить это здесь нечем и незачем.
 *
 * Набор сервер ЗАМЕЩАЕТ целиком (PUT, не PATCH), поэтому карточка сначала
 * читает текущий набор и только потом даёт сохранять.
 */

const copy = t.admin.venueCuisines;

export interface VenueCuisinesClient {
  listCuisines(): Promise<CuisineDictionaryEntry[]>;
  getRestaurantCuisines(restaurantId: string): Promise<CuisineDictionaryEntry[]>;
  setRestaurantCuisines(
    restaurantId: string,
    ids: readonly string[],
  ): Promise<CuisineDictionaryEntry[]>;
}

export function CuisinesCard({
  restaurantId,
  client = apiClient,
}: {
  restaurantId: string;
  client?: VenueCuisinesClient;
}) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["venue-cuisines", restaurantId] as const, [restaurantId]);

  const dictionaryQuery = useQuery({
    queryKey: ["cuisines"],
    queryFn: () => client.listCuisines(),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const venueQuery = useQuery({
    queryKey,
    queryFn: () => client.getRestaurantCuisines(restaurantId),
  });

  if (dictionaryQuery.isPending || venueQuery.isPending) {
    return <LoadingState title={copy.loadingTitle} />;
  }
  // Сохранять, не зная текущего набора, нельзя — PUT замещает его целиком.
  // Справочник нужен по той же причине с другой стороны: без него не из чего
  // выбирать, и пустой список выглядел бы как «кухонь не бывает».
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
    <CuisinesForm
      restaurantId={restaurantId}
      client={client}
      dictionary={dictionaryQuery.data}
      current={venueQuery.data}
      onChanged={() => queryClient.invalidateQueries({ queryKey })}
    />
  );
}

function CuisinesForm({
  restaurantId,
  client,
  dictionary,
  current,
  onChanged,
}: {
  restaurantId: string;
  client: VenueCuisinesClient;
  dictionary: CuisineDictionaryEntry[];
  current: CuisineDictionaryEntry[];
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => cuisineIdsOf(current));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Синхронизируемся только когда сервер ВПРАВДУ отдал другое: react-query
  // держит ту же ссылку, пока содержимое не менялось, а безусловный сброс на
  // каждом рендере затирал бы набранное человеком.
  const syncedRef = useRef(current);
  useEffect(() => {
    if (syncedRef.current === current) return;
    syncedRef.current = current;
    setSelected(cuisineIdsOf(current));
  }, [current]);

  const options = useMemo(
    () => mergeCuisineOptions(dictionary.filter((item) => item.is_active), current),
    [dictionary, current],
  );

  const mutation = useMutation({
    mutationFn: (ids: readonly string[]) => client.setRestaurantCuisines(restaurantId, ids),
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
        <CuisinePicker
          options={options}
          selected={selected}
          onChange={(next) => {
            setSelected(next);
            setSaveError(null);
            setSaved(false);
          }}
          disabled={busy}
          showTitle={false}
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

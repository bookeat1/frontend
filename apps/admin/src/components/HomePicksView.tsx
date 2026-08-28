"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiPage, CityDictionaryEntry, HomePickVenue } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useCityDictionary } from "@/lib/use-cities";
import { useIsPlatformAdmin } from "@/lib/use-venue-catalog";

import { EmptyState, ErrorState, LoadingState } from "./StateViews";
import { Button } from "./ui/Button";
import { CitySelectField } from "./ui/CitySelectField";
import { OrderedVenueList, type OrderedVenueRow } from "./ui/OrderedVenueList";
import { VenuePickerModal } from "./ui/VenuePickerModal";

/**
 * «ВЫБРАЛИ ДЛЯ ВАС» — РУЧНОЙ СОСТАВ ПЕРВОГО БЛОКА ГЛАВНОЙ.
 *
 * Что этот экран делает и чего НЕ делает. Блок на главной живёт в двух
 * режимах, и решает это сервер: если для города есть ручной список — гость
 * видит его, в заданном здесь порядке; если нет — общий список «для всех
 * городов»; если нет и его — блок собирается автоматически (популярные
 * заведения в порядке каталога). Отсюда главное для владельца, и это сказано
 * на экране словами: ПУСТОЙ СПИСОК — не поломка, а осознанный автоматический
 * режим, и сохранение пустого списка — способ туда вернуться.
 *
 * ГОРОД — ключ списка, а не фильтр. У каждого города свой список, а пустой
 * город («Все города») — запасной для городов без своего. Поэтому смена
 * города здесь перечитывает ДРУГОЙ список, и несохранённый черновик при этом
 * пришлось бы выбросить — экран сначала спрашивает.
 *
 * ЗАПИСЬ — одна, целиком: `PUT /admin/restaurants/picks` заменяет и состав, и
 * порядок. Никаких пошаговых «добавить/переставить/удалить» по одному
 * запросу: половина применённых правок — это подборка, которую никто не
 * собирал. Отсюда же безвредность двойного нажатия «Сохранить» — второй
 * запрос описывает ровно тот же результат.
 *
 * ВЫКЛЮЧЕННЫЕ ЗАВЕДЕНИЯ остаются в списке и помечаются, как в гастрогиде:
 * админская ручка отдаёт их специально. Редактор, который не видит пометки,
 * полдня выясняет, почему в приложении заведений меньше, чем здесь.
 */

const copy = t.admin.homePicks;

/** Ровно те методы клиента, которые нужны экрану: так его можно рендерить в
 * тестах против фейка, не поднимая ни сети, ни авторизации. */
export interface HomePicksClient {
  listHomePicks(city?: string): Promise<ApiPage<HomePickVenue>>;
  replaceHomePicks(city: string, restaurantIds: string[]): Promise<void>;
  searchVenues(query: string, perPage?: number): Promise<{ items: HomePickVenue[] }>;
}

export function HomePicksView({ client = apiClient }: { client?: HomePicksClient }) {
  const isAdmin = useIsPlatformAdmin();
  const cityQuery = useCityDictionary();

  if (!isAdmin) {
    return (
      <EmptyState
        title={copy.adminOnlyTitle}
        description={copy.adminOnlyDescription}
      />
    );
  }

  return (
    <HomePicks
      client={client}
      cities={cityQuery.data ?? []}
      citiesLoading={cityQuery.isLoading}
      citiesFailed={cityQuery.isError}
    />
  );
}

/** Экран без обёрток доступа и без запроса справочника — то, что рендерят
 * тесты. Справочник приходит пропом ровно по той же причине, что и клиент. */
export function HomePicks({
  client,
  cities,
  citiesLoading = false,
  citiesFailed = false,
}: {
  client: HomePicksClient;
  cities: readonly CityDictionaryEntry[];
  citiesLoading?: boolean;
  citiesFailed?: boolean;
}) {
  const queryClient = useQueryClient();

  /** Пустая строка = список «для всех городов». Это ОСМЫСЛЕННОЕ значение, а не
   * «город ещё не выбран», поэтому у селектора есть свой пункт. */
  const [city, setCity] = useState("");
  /**
   * Черновик существует только пока владелец что-то менял: `null` означает
   * «показываем то, что на сервере». Так экран не может разъехаться с ответом
   * после сохранения или перечитывания — ему нечем.
   */
  const [draft, setDraft] = useState<HomePickVenue[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const queryKey = useMemo(() => ["home-picks", city] as const, [city]);
  const listQuery = useQuery({
    queryKey,
    queryFn: () => client.listHomePicks(city),
  });

  const serverVenues = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const venues = draft ?? serverVenues;
  const dirty =
    draft !== null &&
    (draft.length !== serverVenues.length ||
      draft.some((v, i) => v.id !== serverVenues[i]?.id));

  const saveMutation = useMutation({
    mutationFn: (restaurantIds: string[]) => client.replaceHomePicks(city, restaurantIds),
    onSuccess: () => {
      setSaveError(null);
      setSaved(true);
      // Черновик снимается, и экран снова показывает ответ сервера — включая
      // то, что сервер мог поправить (например убрать удалённое заведение).
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      setSaved(false);
      setSaveError(saveErrorText(error));
    },
  });

  function changeCity(next: string) {
    if (next === city) return;
    // Черновик принадлежит городу: у другого города СВОЙ список, и молча
    // перенести туда несохранённые правки — значит собрать подборку, которую
    // никто не собирал.
    if (dirty && !window.confirm(copy.confirmLeaveCity)) return;
    setCity(next);
    setDraft(null);
    setSaveError(null);
    setSaved(false);
  }

  function edit(next: HomePickVenue[]) {
    setDraft(next);
    setSaved(false);
  }

  function submit() {
    if (saveMutation.isPending) return;
    // Пустой список стирает ручную подборку. Это законное действие, но не то,
    // которое стоит совершать случайно последним «Убрать».
    if (venues.length === 0 && !window.confirm(copy.confirmClear)) return;
    saveMutation.mutate(venues.map((v) => v.id));
  }

  const rows: OrderedVenueRow[] = venues.map((v) => ({
    id: v.id,
    name: v.name,
    meta: [v.city, v.address, v.cuisine_type].filter(Boolean).join(" · "),
    isActive: v.is_active,
  }));

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <header className="min-w-0">
        <h1 className="break-words text-xl font-bold text-text">{copy.title}</h1>
        <p className="mt-xxs break-words text-[13px] text-text-muted">{copy.subtitle}</p>
      </header>

      <div className="flex flex-col gap-md rounded-card bg-surface p-lg">
        <div className="max-w-[360px]">
          <CitySelectField
            id="home-picks-city"
            label={copy.cityLabel}
            emptyOptionLabel={copy.cityAll}
            dictionary={cities}
            loading={citiesLoading}
            failed={citiesFailed}
            value={city}
            disabled={saveMutation.isPending}
            onChange={changeCity}
          />
        </div>
        <p className="break-words text-[13px] text-text-muted">{copy.cityHint}</p>
        {/* Главное объяснение экрана. Оно видно ВСЕГДА, а не только на пустом
            списке: владелец должен понимать, что делает пустой список, ещё до
            того, как удалит последнее заведение. */}
        <p className="break-words text-[13px] text-text-muted">{copy.autoHint}</p>
      </div>

      {listQuery.isPending ? (
        <LoadingState title={copy.loading} />
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : (
        <section className="flex flex-col gap-md">
          <div className="flex flex-wrap items-center justify-between gap-md">
            <p className="text-[13px] text-text-muted">{copy.total(venues.length)}</p>
            <div className="flex flex-wrap gap-xs">
              <Button
                variant="secondary"
                disabled={saveMutation.isPending}
                onClick={() => setPicking(true)}
              >
                {copy.venueAdd}
              </Button>
              <Button
                disabled={!dirty || saveMutation.isPending}
                loading={saveMutation.isPending}
                onClick={submit}
              >
                {saveMutation.isPending ? copy.saving : copy.save}
              </Button>
            </div>
          </div>

          {saveError ? (
            <p role="alert" className="break-words text-sm text-rose-700">
              {saveError}
            </p>
          ) : dirty ? (
            <p role="status" aria-live="polite" className="text-[13px] text-text-muted">
              {copy.dirty}
            </p>
          ) : saved ? (
            <p role="status" aria-live="polite" className="text-[13px] text-text-muted">
              {copy.saved}
            </p>
          ) : null}

          <OrderedVenueList
            rows={rows}
            reordering={saveMutation.isPending}
            disabled={saveMutation.isPending}
            copy={{
              dragHint: copy.venueDragHint,
              orderSaving: copy.saving,
              moveUp: copy.venueMoveUp,
              moveDown: copy.venueMoveDown,
              remove: copy.venueRemove,
              inactive: copy.venueInactive,
            }}
            empty={
              <EmptyState title={copy.venuesEmpty} description={copy.venuesEmptyDescription} />
            }
            onReorder={(ids) => {
              const byId = new Map(venues.map((v) => [v.id, v]));
              edit(ids.map((id) => byId.get(id)).filter((v): v is HomePickVenue => !!v));
            }}
            onRemove={(row) => edit(venues.filter((v) => v.id !== row.id))}
          />
        </section>
      )}

      {picking ? (
        <VenuePickerModal
          client={client}
          copy={{
            title: copy.venueAdd,
            searchLabel: copy.venueSearch,
            searchHint: copy.venueSearchHint,
            loading: copy.venueSearchLoading,
            empty: copy.venueSearchEmpty,
            alreadyAdded: copy.venueAlreadyAdded,
            inactive: copy.venueInactive,
          }}
          attachedIds={venues.map((v) => v.id)}
          attaching={false}
          onClose={() => setPicking(false)}
          onPick={(venue) => {
            // Добавление — правка ЧЕРНОВИКА, а не запрос: список уезжает на
            // сервер целиком по «Сохранить». Повтор невозможен и потому, что
            // уже добавленное заведение в окне выбора заблокировано, и потому,
            // что сервер отвергает список с дублем (422).
            if (!venues.some((v) => v.id === venue.id)) edit([...venues, venue]);
            setPicking(false);
          }}
        />
      ) : null}
    </section>
  );
}

/** Текст отказа. Дубль в списке — единственный случай, который владелец может
 * исправить сам, поэтому он назван отдельно; всё остальное — «не сохранилось». */
function saveErrorText(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === "picks_duplicate_restaurant" || code === "duplicate_restaurant") {
    return copy.errorDuplicate;
  }
  return copy.errorSaveFailed;
}

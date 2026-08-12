"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PlatformGuest, PlatformGuestSegment, PlatformGuestSort } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useIsPlatformAdmin } from "@/lib/use-platform-dashboard";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";

/**
 * «Гости» на уровне платформы.
 *
 * Отличается от одноимённого раздела внутри заведения тем, кого считает
 * гостем: там это люди ОДНОГО ресторана, здесь — все, кого платформа знает,
 * включая тех, кто бронировал без регистрации, и тех, кто зарегистрировался и
 * ни разу не дошёл. Ради вторых экран и сделан: это будущая аудитория акций.
 *
 * Фильтрация серверная. Клиентская отсекала бы по одной странице и врала бы в
 * счётчике: «нашлось 3» вместо «нашлось 3 на этой странице из 12».
 */

const SEGMENTS: { key: PlatformGuestSegment; label: string; hint?: string }[] = [
  { key: "all", label: "Все" },
  { key: "booked", label: "С бронями" },
  { key: "visited", label: "Дошли" },
  { key: "never_visited", label: "Не дошли", hint: "бронировали, но ни разу не пришли" },
  { key: "cancelled", label: "Отменяли" },
  { key: "registered", label: "С аккаунтом" },
  { key: "no_bookings", label: "Без броней", hint: "зарегистрировались и не бронировали" },
];

const SORTS: { key: PlatformGuestSort; label: string }[] = [
  { key: "last_booking", label: "По последней брони" },
  { key: "bookings", label: "По числу броней" },
  { key: "registered", label: "По дате регистрации" },
];

const PER_PAGE = 50;

export function PlatformGuestsView() {
  const isAdmin = useIsPlatformAdmin();
  const [segment, setSegment] = useState<PlatformGuestSegment>("all");
  const [sort, setSort] = useState<PlatformGuestSort>("last_booking");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["platform-guests", segment, sort, search, city, page],
    queryFn: () =>
      apiClient.listPlatformGuests({
        segment,
        sort,
        search: search.trim(),
        city: city.trim(),
        page,
        per_page: PER_PAGE,
      }),
    enabled: isAdmin,
    // Прошлая страница остаётся на экране, пока грузится следующая: иначе при
    // каждом нажатии таблица схлопывается в спиннер и список «прыгает».
    placeholderData: keepPreviousData,
  });

  if (!isAdmin) {
    return (
      <EmptyState
        title="Раздел только для администраторов платформы"
        description="Здесь гости всей платформы. Гости вашего заведения — в разделе «Гости» внутри заведения."
      />
    );
  }

  const total = query.data?.total ?? 0;
  const rows = query.data?.items ?? [];
  const pages = query.data?.pages ?? 0;

  // Любое изменение фильтра возвращает на первую страницу: остаться на седьмой
  // после смены сегмента — это пустой экран и ощущение, что «ничего не нашлось».
  const reset = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <section className="flex flex-col gap-lg p-6">
      <header className="flex flex-wrap items-end justify-between gap-md">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Гости платформы</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Все, кого мы знаем: и те, кто регистрировался, и те, кто бронировал без аккаунта.
          </p>
        </div>
        <div className="flex flex-wrap gap-sm">
          <input
            type="search"
            value={search}
            onChange={(e) => reset(setSearch)(e.target.value)}
            placeholder="Имя, телефон или почта"
            className="min-h-[40px] w-[240px] rounded-card border border-hairline bg-white px-md text-sm text-text outline-none focus:border-brand"
          />
          <input
            type="search"
            value={city}
            onChange={(e) => reset(setCity)(e.target.value)}
            placeholder="Город"
            className="min-h-[40px] w-[160px] rounded-card border border-hairline bg-white px-md text-sm text-text outline-none focus:border-brand"
          />
          <select
            value={sort}
            onChange={(e) => reset(setSort)(e.target.value as PlatformGuestSort)}
            className="min-h-[40px] rounded-card border border-hairline bg-white px-md text-sm text-text outline-none focus:border-brand"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex flex-wrap gap-xs">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            type="button"
            title={s.hint}
            onClick={() => reset(setSegment)(s.key)}
            className={`rounded-pill px-md py-sm text-sm font-medium transition-colors ${
              segment === s.key
                ? "bg-chip-active text-white"
                : "bg-chip text-text hover:bg-neutral-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <LoadingState title="Загружаем гостей…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : total === 0 ? (
        <EmptyState
          title="Под фильтры никто не подошёл"
          description="Смените сегмент или очистите поиск."
        />
      ) : (
        <>
          <p className="text-sm text-neutral-500">
            Найдено: {total}
            {pages > 1 ? ` · страница ${page} из ${pages}` : ""}
          </p>

          <GuestsTable rows={rows} />

          {pages > 1 ? (
            <div className="flex items-center justify-center gap-md">
              <button
                type="button"
                disabled={page <= 1 || query.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-card border border-hairline px-md py-sm text-sm disabled:opacity-40"
              >
                Назад
              </button>
              <span className="text-sm text-neutral-500">
                {page} / {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages || query.isFetching}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="rounded-card border border-hairline px-md py-sm text-sm disabled:opacity-40"
              >
                Вперёд
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function GuestsTable({ rows }: { rows: PlatformGuest[] }) {
  return (
    <div className="overflow-x-auto rounded-card bg-surface">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-hairline text-[12px] uppercase tracking-wide text-text-muted">
            <th className="px-md py-md font-medium">Гость</th>
            <th className="px-md py-md font-medium">Телефон</th>
            <th className="px-md py-md font-medium">Город</th>
            <th className="px-md py-md text-right font-medium">Броней</th>
            <th className="px-md py-md text-right font-medium">Дошёл</th>
            <th className="px-md py-md text-right font-medium">Отмен</th>
            <th className="px-md py-md text-right font-medium">Заведений</th>
            <th className="px-md py-md font-medium">Последняя бронь</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.phone} className="border-b border-hairline align-top last:border-0">
              <td className="px-md py-md">
                <span className="block max-w-[240px] break-words font-medium text-text">
                  {g.name || "Без имени"}
                </span>
                {/* Аккаунт — это не украшение: с ним человеку можно отправить
                    пуш, без него остаются только телефон и WhatsApp. */}
                <span className="text-[12px] text-text-muted">
                  {g.user_id ? "есть аккаунт" : "без аккаунта"}
                  {g.registered_at ? ` · с ${formatDate(g.registered_at)}` : ""}
                </span>
              </td>
              <td className="whitespace-nowrap px-md py-md text-text-muted">{g.phone}</td>
              <td className="px-md py-md text-text-muted">{g.city || "—"}</td>
              <td className="px-md py-md text-right text-text">{g.bookings_count}</td>
              <td className="px-md py-md text-right text-text">{g.visits_count}</td>
              <td className="px-md py-md text-right text-text">
                {g.cancelled_count + g.no_show_count}
              </td>
              <td className="px-md py-md text-right text-text">{g.venues_count}</td>
              <td className="whitespace-nowrap px-md py-md text-text-muted">
                {g.last_booking_at ? formatDate(g.last_booking_at) : "не бронировал"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

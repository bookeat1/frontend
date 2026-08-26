"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminMenuItem } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { ImageThumb } from "./ui/ImageThumb";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";

export function MenuView() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant!.id;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const queryKey = ["menu", restaurantId] as const;

  const menuQuery = useQuery({
    queryKey,
    queryFn: () => apiClient.listMenu(restaurantId),
  });

  const toggle = useMutation({
    mutationFn: ({ itemId, next }: { itemId: string; next: boolean }) =>
      apiClient.setMenuItemAvailability(restaurantId, itemId, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const stopList = useMutation({
    mutationFn: ({ ids, available }: { ids: string[]; available: boolean }) =>
      apiClient.setStopList(restaurantId, ids, available),
    onSuccess: (updated) => {
      setNotice(t.admin.menu.stopListDone(updated));
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: () => setNotice(t.admin.menu.stopListFailed),
  });

  const grouped = useMemo(() => groupByCategory(menuQuery.data ?? [], search), [menuQuery.data, search]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = [...selected];

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <header className="flex flex-wrap items-end justify-between gap-md">
        <h1 className="text-xl font-bold text-text">{t.admin.menu.title}</h1>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.admin.menu.searchPlaceholder}
          className="min-h-[40px] w-full max-w-[280px] rounded-card border border-hairline bg-white px-md text-sm text-text outline-none focus:border-brand"
        />
      </header>

      {notice ? (
        <p role="status" className="rounded-card bg-chip px-md py-sm text-sm text-text">
          {notice}
        </p>
      ) : null}

      {menuQuery.isPending ? (
        <LoadingState title={t.admin.menu.loadingTitle} />
      ) : menuQuery.isError ? (
        <ErrorState onRetry={() => void menuQuery.refetch()} />
      ) : (menuQuery.data?.length ?? 0) === 0 ? (
        <EmptyState title={t.admin.menu.emptyTitle} description={t.admin.menu.emptyDescription} />
      ) : (
        <>
          {grouped.map(([category, items]) => (
            <div key={category} className="rounded-card bg-surface">
              <h2 className="border-b border-hairline px-lg py-md text-sm font-semibold text-text">
                {category}
              </h2>
              <ul>
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-md border-b border-hairline px-lg py-md last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`${t.admin.menu.selected(0)} — ${item.name}`}
                      className="h-5 w-5 shrink-0 accent-[#B33036]"
                    />
                    {/* Фото блюда. Пунктирная плашка «Нет фото» занимает ровно
                        то же место, что и картинка, — по ней управляющий
                        глазами находит блюда без фотографии. */}
                    <ImageThumb
                      url={item.image_url}
                      alt={item.name}
                      emptyLabel={t.admin.menu.noPhoto}
                      className="h-12 w-12"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{item.name}</p>
                      {item.description ? (
                        <p className="truncate text-[12px] text-text-muted">{item.description}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-sm text-text-muted">
                      {formatPrice(item.price)}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggle.mutate({ itemId: item.id, next: !item.is_available })}
                      disabled={toggle.isPending && toggle.variables?.itemId === item.id}
                      aria-label={t.admin.menu.toggleAvailability}
                      className={`shrink-0 rounded-pill px-md py-xs text-[12px] font-medium transition-colors disabled:opacity-50 ${
                        item.is_available
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                      }`}
                    >
                      {item.is_available ? t.admin.menu.available : t.admin.menu.unavailable}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      {/* Bulk stop-list bar. */}
      {selectedIds.length > 0 ? (
        <div className="sticky bottom-lg z-10 flex flex-wrap items-center justify-between gap-md rounded-card bg-chip-active px-lg py-md text-white shadow-lg">
          <span className="text-sm font-medium">{t.admin.menu.selected(selectedIds.length)}</span>
          <div className="flex flex-wrap gap-sm">
            <Button
              size="sm"
              variant="danger"
              loading={stopList.isPending && stopList.variables?.available === false}
              onClick={() => stopList.mutate({ ids: selectedIds, available: false })}
            >
              {t.admin.menu.stopSelected}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={stopList.isPending && stopList.variables?.available === true}
              onClick={() => stopList.mutate({ ids: selectedIds, available: true })}
            >
              {t.admin.menu.returnSelected}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <span className="text-white">{t.admin.menu.clearSelection}</span>
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Group items by their category label (falling back to a shared bucket),
 * apply the name search filter, and drop now-empty groups. */
function groupByCategory(items: AdminMenuItem[], search: string): [string, AdminMenuItem[]][] {
  const needle = search.trim().toLowerCase();
  const map = new Map<string, AdminMenuItem[]>();
  for (const item of items) {
    if (needle && !item.name.toLowerCase().includes(needle)) continue;
    const key = item.category?.trim() || t.admin.menu.uncategorized;
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return [...map.entries()];
}

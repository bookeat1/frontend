"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GuideCollection,
  GuideCollectionInput,
  GuideCollectionKind,
  GuideCollectionStatus,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Button } from "../ui/Button";
import { Field, Select, TextInput } from "../ui/FormControls";
import { EmptyState, ErrorState, LoadingState } from "../StateViews";
import { GuideCollectionFormModal } from "./GuideCollectionFormModal";
import { GuideStatusBadge } from "./GuideStatusBadge";

const copy = t.admin.gastroguide;

const STATUS_OPTIONS: GuideCollectionStatus[] = ["draft", "published", "archived"];

/** The client methods this screen needs. A prop rather than a hard import of
 * the singleton so the screen can be rendered against a fake in a test — the
 * shared client reads its base URL from the environment at module load. */
export interface GuideCollectionsClient {
  listGuideCollections(params?: {
    status?: GuideCollectionStatus[];
    kind?: GuideCollectionKind;
    q?: string;
    per_page?: number;
  }): Promise<{ items: GuideCollection[]; total: number }>;
  createGuideCollection(input: GuideCollectionInput): Promise<GuideCollection>;
}

/** Куда ведёт «Открыть» и куда возвращает «← к списку» — у каждого вида свой
 * раздел панели. */
export const GUIDE_KIND_ROUTE: Record<GuideCollectionKind, string> = {
  collection: "/gastroguide",
  article: "/articles",
};

/**
 * Список редакционных записей — ОДИН экран на два раздела панели.
 *
 * `kind` решает всё: какой фильтр уходит на сервер (`?kind=`), какие подписи
 * стоят на экране, с каким видом создаётся новая запись и куда ведёт
 * «Открыть». `/gastroguide` — подборки, `/articles` — статьи. Второй почти
 * такой же экран не заводится нарочно (просьба владельца «сделай
 * единообразно»): расходиться начали бы уже на первой правке.
 *
 * ФИЛЬТР ПО ВИДУ ЖИВЁТ НА СЕРВЕРЕ, а не в `.filter()` по ответу: страница
 * выдачи одна на всю таблицу, и отбор на клиенте означал бы, что четыре
 * подборки вытесняют статьи с первой страницы и наоборот.
 *
 * Unlike every other screen in this panel it is NOT scoped to the selected
 * venue: the guide is platform editorial content and belongs to the superadmin.
 * The venue in the header switcher is irrelevant here, which is why nothing on
 * this screen reads it.
 */
export function GuideCollectionsView({
  kind = "collection",
  client = apiClient,
}: {
  kind?: GuideCollectionKind;
  client?: GuideCollectionsClient;
}) {
  const queryClient = useQueryClient();
  const kindCopy = copy.kinds[kind];
  const [status, setStatus] = useState<GuideCollectionStatus | "">("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const queryKey = ["guide-collections", kind, status, search] as const;
  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      client.listGuideCollections({
        status: status ? [status] : undefined,
        kind,
        q: search.trim() || undefined,
        per_page: 100,
      }),
  });

  const items = listQuery.data?.items ?? [];
  const filtered = !!status || !!search.trim();

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-text">{kindCopy.title}</h1>
          <p className="mt-xxs max-w-lg break-words text-[13px] text-text-muted">
            {kindCopy.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-sm">
          {/* Прогулки и рубрики — принадлежность ГАСТРОГИДА. На экране статей
              их нет: у статьи рубрик не бывает вовсе, а прогулка — третий вид
              контента, и кнопка на чужом экране только путает. */}
          {kind === "collection" ? (
            <>
          <Link
            href="/gastroguide/routes"
            className="inline-flex min-h-[44px] items-center rounded-pill bg-chip px-lg text-sm font-medium text-text hover:bg-[#e7e7e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t.admin.gastroRoutes.manage}
          </Link>
          <Link
            href="/gastroguide/categories"
            className="inline-flex min-h-[44px] items-center rounded-pill bg-chip px-lg text-sm font-medium text-text hover:bg-[#e7e7e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {copy.categoriesManage}
          </Link>
            </>
          ) : null}
          <Button onClick={() => setCreating(true)}>{kindCopy.create}</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-md rounded-card bg-surface p-lg sm:grid-cols-[1fr_200px]">
        <Field label={copy.search} htmlFor="guide-search">
          <TextInput
            id="guide-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label={copy.filterStatus} htmlFor="guide-status">
          <Select
            id="guide-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as GuideCollectionStatus | "")}
          >
            <option value="">{copy.filterAll}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "draft"
                  ? copy.badgeDraft
                  : s === "published"
                    ? copy.badgePublished
                    : copy.badgeArchived}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {listQuery.isPending ? (
        <LoadingState title={kindCopy.loadingTitle} />
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : items.length === 0 ? (
        // "Nothing matches your filter" and "there is nothing at all" are
        // different situations and get different text: the first one is fixed by
        // clearing a filter, the second by creating a collection.
        <EmptyState
          title={filtered ? copy.emptyFiltered : kindCopy.emptyTitle}
          description={filtered ? copy.emptyFilteredDescription : kindCopy.emptyDescription}
        />
      ) : (
        <>
          <p className="text-sm text-text-muted">{copy.total(listQuery.data.total)}</p>
          <ul className="flex flex-col gap-sm">
            {items.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-md rounded-card bg-surface p-lg sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-sm">
                    <span className="break-words text-sm font-semibold text-text">{c.title}</span>
                    <GuideStatusBadge status={c.status} publishedAt={c.published_at} />
                  </div>
                  {c.subtitle ? (
                    <p className="mt-xxs break-words text-[13px] text-text-muted">{c.subtitle}</p>
                  ) : null}
                  <p className="mt-xxs break-words text-[13px] text-text-muted">
                    {copy.venueCount(c.venue_count)}
                    {" · "}
                    {c.city ?? copy.cityAll}
                    {" · "}
                    <span className="font-mono text-[12px]">{c.slug}</span>
                  </p>
                  {c.status === "published" && c.published_at ? (
                    <p className="mt-xxs text-[13px] text-text-muted">
                      {new Date(c.published_at).getTime() > Date.now()
                        ? copy.willPublishAt(formatDateTime(c.published_at))
                        : copy.publishedAt(formatDateTime(c.published_at))}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-xs sm:justify-end">
                  <Link
                    href={`${GUIDE_KIND_ROUTE[kind]}?collection=${encodeURIComponent(c.id)}`}
                    className="inline-flex min-h-[36px] items-center rounded-pill bg-chip px-md text-[13px] font-medium text-text hover:bg-[#e7e7e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {copy.openCollection}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {creating ? (
        <GuideCollectionFormModal
          client={client}
          kind={kind}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void queryClient.invalidateQueries({ queryKey: ["guide-collections"] });
          }}
        />
      ) : null}
    </section>
  );
}

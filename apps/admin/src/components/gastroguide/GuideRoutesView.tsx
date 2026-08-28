"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GuideRoute,
  GuideRouteInput,
  GuideRouteStatus,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Button } from "../ui/Button";
import { Field, Select, TextInput } from "../ui/FormControls";
import { EmptyState, ErrorState, LoadingState } from "../StateViews";
import { GuideRouteFormModal } from "./GuideRouteFormModal";
import { GuideStatusBadge } from "./GuideStatusBadge";

const copy = t.admin.gastroRoutes;
const guideCopy = t.admin.gastroguide;

const STATUS_OPTIONS: GuideRouteStatus[] = ["draft", "published", "archived"];

/** То, что этот экран просит у API. Пропом, а не жёстким импортом синглтона:
 * общий клиент читает базовый адрес из окружения при загрузке модуля, и в
 * тесте экран рендерится против подделки. */
export interface GuideRoutesClient {
  listGuideRoutes(params?: {
    status?: GuideRouteStatus[];
    q?: string;
    per_page?: number;
  }): Promise<{ items: GuideRoute[]; total: number }>;
  createGuideRoute(input: GuideRouteInput): Promise<GuideRoute>;
}

/**
 * Список гастропрогулок.
 *
 * Как и статьи, это редакционный контент ПЛАТФОРМЫ, а не заведения: выбранное
 * в шапке заведение здесь ни при чём, и ничего на этом экране его не читает.
 */
export function GuideRoutesView({ client = apiClient }: { client?: GuideRoutesClient }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<GuideRouteStatus | "">("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const listQuery = useQuery({
    queryKey: ["guide-routes", status, search] as const,
    queryFn: () =>
      client.listGuideRoutes({
        status: status ? [status] : undefined,
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
          <h1 className="text-xl font-bold text-text">{copy.title}</h1>
          <p className="mt-xxs max-w-lg break-words text-[13px] text-text-muted">{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-sm">
          <Link
            href="/gastroguide"
            className="inline-flex min-h-[44px] items-center rounded-pill bg-chip px-lg text-sm font-medium text-text hover:bg-[#e7e7e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {copy.backToCollections}
          </Link>
          <Button onClick={() => setCreating(true)}>{copy.create}</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-md rounded-card bg-surface p-lg sm:grid-cols-[1fr_200px]">
        <Field label={copy.search} htmlFor="route-search">
          <TextInput
            id="route-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label={copy.filterStatus} htmlFor="route-status">
          <Select
            id="route-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as GuideRouteStatus | "")}
          >
            <option value="">{copy.filterAll}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "draft"
                  ? guideCopy.badgeDraft
                  : s === "published"
                    ? guideCopy.badgePublished
                    : guideCopy.badgeArchived}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {listQuery.isPending ? (
        <LoadingState title={copy.loadingTitle} />
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : items.length === 0 ? (
        // «Под фильтр ничего не подошло» и «нет вообще ничего» — разные
        // ситуации: первая лечится сбросом фильтра, вторая — созданием.
        <EmptyState
          title={filtered ? copy.emptyFiltered : copy.emptyTitle}
          description={filtered ? copy.emptyFilteredDescription : copy.emptyDescription}
        />
      ) : (
        <>
          <p className="text-sm text-text-muted">{copy.total(listQuery.data.total)}</p>
          <ul className="flex flex-col gap-sm">
            {items.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-md rounded-card bg-surface p-lg sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-sm">
                    <span className="break-words text-sm font-semibold text-text">{r.title}</span>
                    <GuideStatusBadge status={r.status} publishedAt={r.published_at} />
                  </div>
                  <p className="mt-xxs break-words text-[13px] text-text-muted">
                    {copy.pointCount(r.point_count)}
                    {" · "}
                    {r.city ?? copy.cityAll}
                    {r.duration_label ? ` · ${r.duration_label}` : ""}
                    {" · "}
                    <span className="font-mono text-[12px]">{r.slug}</span>
                  </p>
                  {r.status === "published" && r.published_at ? (
                    <p className="mt-xxs text-[13px] text-text-muted">
                      {new Date(r.published_at).getTime() > Date.now()
                        ? copy.willPublishAt(formatDateTime(r.published_at))
                        : copy.publishedAt(formatDateTime(r.published_at))}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-xs sm:justify-end">
                  <Link
                    href={`/gastroguide/routes?route=${encodeURIComponent(r.id)}`}
                    className="inline-flex min-h-[36px] items-center rounded-pill bg-chip px-md text-[13px] font-medium text-text hover:bg-[#e7e7e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {copy.open}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {creating ? (
        <GuideRouteFormModal
          client={client}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void queryClient.invalidateQueries({ queryKey: ["guide-routes"] });
          }}
        />
      ) : null}
    </section>
  );
}

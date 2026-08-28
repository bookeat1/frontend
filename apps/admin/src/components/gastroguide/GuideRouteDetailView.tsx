"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GuideRoute,
  GuideRouteDetail,
  GuideRouteInput,
  GuideRoutePoint,
  GuideRoutePointInput,
  GuideRoutePointKind,
  VenueSearchResult,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "../ui/Button";
import { ErrorState, LoadingState } from "../StateViews";
import { GuideRouteFormModal } from "./GuideRouteFormModal";
import { GuideRoutePointFormModal } from "./GuideRoutePointFormModal";
import { GuideRoutePointList } from "./GuideRoutePointList";
import { GuideStatusBadge } from "./GuideStatusBadge";
import { guideErrorMessage } from "./guide-copy";

const copy = t.admin.gastroRoutes;

/** Всё, что этот экран просит у API. Пропом, а не жёстким импортом синглтона,
 * чтобы экран можно было отрендерить против подделки в тесте. */
export interface GuideRouteDetailClient {
  getGuideRoute(routeId: string): Promise<GuideRouteDetail>;
  createGuideRoute(input: GuideRouteInput): Promise<GuideRoute>;
  updateGuideRoute(routeId: string, input: GuideRouteInput): Promise<GuideRoute>;
  publishGuideRoute(routeId: string, publishedAt?: string): Promise<GuideRoute>;
  unpublishGuideRoute(routeId: string): Promise<GuideRoute>;
  archiveGuideRoute(routeId: string): Promise<GuideRoute>;
  addGuideRoutePoint(routeId: string, input: GuideRoutePointInput): Promise<GuideRoutePoint>;
  updateGuideRoutePoint(
    routeId: string,
    pointId: string,
    input: GuideRoutePointInput,
  ): Promise<GuideRoutePoint>;
  deleteGuideRoutePoint(routeId: string, pointId: string): Promise<void>;
  reorderGuideRoutePoints(routeId: string, pointIds: string[]): Promise<void>;
  searchVenues(query: string, perPage?: number): Promise<{ items: VenueSearchResult[] }>;
}

/** Что сейчас правится в окне остановки: новая остановка известного вида или
 * уже существующая. */
type PointEditing =
  | { mode: "create"; kind: GuideRoutePointKind }
  | { mode: "edit"; point: GuideRoutePoint };

export function GuideRouteDetailView({
  routeId,
  client = apiClient,
}: {
  routeId: string;
  client?: GuideRouteDetailClient;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["guide-route", routeId] as const;

  const [editing, setEditing] = useState(false);
  const [pointEditing, setPointEditing] = useState<PointEditing | null>(null);
  const [actionError, setActionError] = useState<{ text: string; needsReload: boolean } | null>(
    null,
  );

  const detailQuery = useQuery({ queryKey, queryFn: () => client.getGuideRoute(routeId) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  function fail(error: unknown) {
    const message = guideErrorMessage(error);
    setActionError(message);
    // Когда экран заведомо расходится с сервером — или когда мы этого не
    // знаем, — список перечитывается. Оставленный на экране отвергнутый
    // порядок редактор «чинит» перетаскиванием поверх устаревших данных.
    if (message.needsReload) void invalidate();
  }

  function succeed() {
    setActionError(null);
    void invalidate();
  }

  const publishMutation = useMutation({
    mutationFn: () => client.publishGuideRoute(routeId),
    onSuccess: succeed,
    onError: fail,
  });
  const unpublishMutation = useMutation({
    mutationFn: () => client.unpublishGuideRoute(routeId),
    onSuccess: succeed,
    onError: fail,
  });
  const archiveMutation = useMutation({
    mutationFn: () => client.archiveGuideRoute(routeId),
    onSuccess: succeed,
    onError: fail,
  });
  const reorderMutation = useMutation({
    mutationFn: (pointIds: string[]) => client.reorderGuideRoutePoints(routeId, pointIds),
    onSuccess: succeed,
    onError: fail,
  });
  const removeMutation = useMutation({
    mutationFn: (pointId: string) => client.deleteGuideRoutePoint(routeId, pointId),
    onSuccess: succeed,
    onError: fail,
  });

  const [pointError, setPointError] = useState<string | null>(null);
  const savePointMutation = useMutation({
    mutationFn: (input: GuideRoutePointInput) =>
      pointEditing?.mode === "edit"
        ? client.updateGuideRoutePoint(routeId, pointEditing.point.id, input)
        : client.addGuideRoutePoint(routeId, input),
    onSuccess: () => {
      setPointError(null);
      setPointEditing(null);
      succeed();
    },
    // Ошибка остаётся В ОКНЕ: набранное описание остановки не выбрасывается
    // ради показа плашки на экране за ним.
    onError: (error) => setPointError(guideErrorMessage(error).text),
  });

  if (detailQuery.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (detailQuery.isError) return <ErrorState onRetry={() => void detailQuery.refetch()} />;

  const route = detailQuery.data;
  const busy =
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    archiveMutation.isPending ||
    reorderMutation.isPending ||
    removeMutation.isPending;

  function openPointForm(next: PointEditing) {
    setPointError(null);
    setPointEditing(next);
  }

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <Link
        href="/gastroguide/routes"
        className="self-start text-sm font-medium text-brand hover:underline"
      >
        ← {copy.back}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-sm">
            <h1 className="break-words text-xl font-bold text-text">{route.title}</h1>
            <GuideStatusBadge status={route.status} publishedAt={route.published_at} />
          </div>
          <p className="mt-xxs break-words text-[13px] text-text-muted">
            <span className="font-mono">{route.slug}</span>
            {" · "}
            {route.city ?? copy.cityAll}
            {" · "}
            {copy.pointCount(route.point_count)}
            {route.duration_label ? ` · ${route.duration_label}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-xs">
          <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
            {t.admin.common.edit}
          </Button>
          {route.status === "published" ? (
            <Button
              variant="secondary"
              loading={unpublishMutation.isPending}
              disabled={busy}
              onClick={() => unpublishMutation.mutate()}
            >
              {copy.unpublish}
            </Button>
          ) : (
            <Button
              loading={publishMutation.isPending}
              disabled={busy}
              onClick={() => publishMutation.mutate()}
            >
              {copy.publish}
            </Button>
          )}
          {route.status !== "archived" ? (
            <Button
              variant="danger"
              loading={archiveMutation.isPending}
              disabled={busy}
              onClick={() => {
                if (!window.confirm(copy.confirmArchive)) return;
                archiveMutation.mutate();
              }}
            >
              {copy.archive}
            </Button>
          ) : null}
        </div>
      </header>

      {actionError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-md rounded-card bg-rose-50 px-md py-sm"
        >
          <p className="min-w-0 break-words text-sm text-rose-700">{actionError.text}</p>
          {actionError.needsReload ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setActionError(null);
                void detailQuery.refetch();
              }}
            >
              {t.admin.gastroguide.refresh}
            </Button>
          ) : null}
        </div>
      ) : null}

      <section className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text">{copy.pointsTitle}</h2>
            <p className="mt-xxs break-words text-[13px] text-text-muted">{copy.pointsHint}</p>
          </div>
          <div className="flex flex-wrap gap-xs">
            <Button
              disabled={busy}
              onClick={() => openPointForm({ mode: "create", kind: "restaurant" })}
            >
              {copy.pointAddVenue}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => openPointForm({ mode: "create", kind: "place" })}
            >
              {copy.pointAddPlace}
            </Button>
          </div>
        </div>

        <GuideRoutePointList
          points={route.points}
          reordering={reorderMutation.isPending}
          disabled={busy && !reorderMutation.isPending}
          onReorder={(ids) => reorderMutation.mutate(ids)}
          onEdit={(point) => openPointForm({ mode: "edit", point })}
          onRemove={(point) => {
            if (!window.confirm(copy.pointConfirmRemove)) return;
            removeMutation.mutate(point.id);
          }}
        />
      </section>

      <GuideRouteGuestPreview route={route} />

      {editing ? (
        <GuideRouteFormModal
          client={client}
          route={route}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void invalidate();
          }}
        />
      ) : null}

      {pointEditing ? (
        <GuideRoutePointFormModal
          client={client}
          kind={pointEditing.mode === "edit" ? pointEditing.point.kind : pointEditing.kind}
          point={pointEditing.mode === "edit" ? pointEditing.point : undefined}
          saving={savePointMutation.isPending}
          error={pointError}
          onClose={() => {
            setPointError(null);
            setPointEditing(null);
          }}
          onSave={(input) => savePointMutation.mutate(input)}
        />
      ) : null}
    </section>
  );
}

/**
 * Что увидит гость.
 *
 * Правило у маршрута ДРУГОЕ, чем у статьи, и в этом весь смысл отдельного
 * блока: отключённое заведение не убирает остановку — маршрут проходится
 * целиком, — оно лишь оставляет остановку без карточки заведения. Поэтому
 * здесь показываются ВСЕ остановки, а «тёмная» помечается словами.
 *
 * Неопубликованный (или запланированный на будущее) маршрут гостю не виден
 * вовсе, и это сказано текстом: пустой предпросмотр читается как поломка.
 */
function GuideRouteGuestPreview({ route }: { route: GuideRouteDetail }) {
  const notLive =
    route.status !== "published" ||
    (!!route.published_at && new Date(route.published_at).getTime() > Date.now());

  return (
    <section className="flex flex-col gap-md rounded-card bg-surface p-lg">
      <div>
        <h2 className="text-base font-semibold text-text">{copy.previewTitle}</h2>
        <p className="mt-xxs break-words text-[13px] text-text-muted">{copy.previewHint}</p>
      </div>

      {notLive ? (
        <p className="rounded-card bg-amber-50 px-md py-sm text-[13px] text-amber-900">
          {copy.previewNotPublished}
        </p>
      ) : null}

      <div className="rounded-card bg-screen p-lg">
        {route.cover_image_url ? (
          // Обложка — произвольный внешний адрес, который вставил редактор, а
          // панель собирается с output: "export": загрузчику next/image нужен
          // сервер, а его списку разрешённых хостов — хост на этапе сборки.
          // Честный элемент здесь — обычный <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={route.cover_image_url}
            alt=""
            className="mb-md h-32 w-full rounded-card object-cover"
          />
        ) : null}
        <p className="break-words text-base font-bold text-text">{route.title}</p>
        {route.duration_label ? (
          <p className="mt-xxs break-words text-sm text-text-muted">{route.duration_label}</p>
        ) : null}
        {route.description ? (
          <p className="mt-sm break-words text-[13px] leading-snug text-text">
            {route.description}
          </p>
        ) : null}

        {route.points.length === 0 ? (
          <p className="mt-md rounded-card bg-rose-50 px-md py-sm text-[13px] text-rose-700">
            {copy.pointsEmpty}
          </p>
        ) : (
          <ol className="mt-md flex flex-col gap-sm">
            {route.points.map((p, i) => (
              <li key={p.id} className="flex gap-md rounded-card bg-surface p-md">
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-chip text-[12px] font-semibold text-text-muted"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-text">{p.title}</p>
                  {p.address ? (
                    <p className="break-words text-[13px] text-text-muted">{p.address}</p>
                  ) : null}
                  {p.description ? (
                    <p className="mt-xxs break-words text-[13px] text-text">{p.description}</p>
                  ) : null}
                  {p.kind === "restaurant" && !p.venue?.is_active ? (
                    <p className="mt-xxs break-words text-[13px] text-rose-700">
                      {copy.pointVenueInactive}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

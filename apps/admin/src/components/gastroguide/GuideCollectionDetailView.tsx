"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GuideCategory,
  GuideCollection,
  GuideCollectionDetail,
  GuideCollectionInput,
  GuideCollectionVenue,
  VenueSearchResult,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "../ui/Button";
import { CheckboxRow, Field, TextArea } from "../ui/FormControls";
import { Modal } from "../ui/Modal";
import { ErrorState, LoadingState } from "../StateViews";
import { GuideCollectionFormModal } from "./GuideCollectionFormModal";
import { GuideGuestPreview } from "./GuideGuestPreview";
import { GuideStatusBadge } from "./GuideStatusBadge";
import { GuideVenueList } from "./GuideVenueList";
import { VenuePickerModal } from "../ui/VenuePickerModal";
import { guideErrorMessage } from "./guide-copy";

const copy = t.admin.gastroguide;

/** Everything this screen asks of the API. A prop rather than a hard import of
 * the singleton so it can be rendered against a fake in a test. */
export interface GuideDetailClient {
  getGuideCollection(id: string): Promise<GuideCollectionDetail>;
  updateGuideCollection(id: string, input: GuideCollectionInput): Promise<GuideCollection>;
  createGuideCollection(input: GuideCollectionInput): Promise<GuideCollection>;
  publishGuideCollection(id: string, publishedAt?: string): Promise<GuideCollection>;
  unpublishGuideCollection(id: string): Promise<GuideCollection>;
  archiveGuideCollection(id: string): Promise<GuideCollection>;
  listGuideCategories(): Promise<GuideCategory[]>;
  setGuideCollectionCategories(id: string, categoryIds: string[]): Promise<void>;
  attachGuideVenue(id: string, restaurantId: string, note?: string): Promise<void>;
  detachGuideVenue(id: string, restaurantId: string): Promise<void>;
  setGuideVenueNote(id: string, restaurantId: string, note: string): Promise<void>;
  reorderGuideVenues(id: string, restaurantIds: string[]): Promise<void>;
  searchVenues(query: string, perPage?: number): Promise<{ items: VenueSearchResult[] }>;
}

export function GuideCollectionDetailView({
  collectionId,
  client = apiClient,
}: {
  collectionId: string;
  client?: GuideDetailClient;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["guide-collection", collectionId] as const;

  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [notingVenue, setNotingVenue] = useState<GuideCollectionVenue | null>(null);
  const [actionError, setActionError] = useState<{ text: string; needsReload: boolean } | null>(
    null,
  );

  const detailQuery = useQuery({ queryKey, queryFn: () => client.getGuideCollection(collectionId) });
  const categoriesQuery = useQuery({
    queryKey: ["guide-categories"],
    queryFn: () => client.listGuideCategories(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  function fail(error: unknown) {
    const message = guideErrorMessage(error);
    setActionError(message);
    // Whenever the screen is known to disagree with the server — or we cannot
    // tell — the list is re-read. Leaving a refused order on screen is how an
    // editor "fixes" it by dragging on top of stale data.
    if (message.needsReload) void invalidate();
  }

  const publishMutation = useMutation({
    mutationFn: () => client.publishGuideCollection(collectionId),
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: fail,
  });

  const unpublishMutation = useMutation({
    mutationFn: () => client.unpublishGuideCollection(collectionId),
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: fail,
  });

  const archiveMutation = useMutation({
    mutationFn: () => client.archiveGuideCollection(collectionId),
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: fail,
  });

  const reorderMutation = useMutation({
    mutationFn: (restaurantIds: string[]) =>
      client.reorderGuideVenues(collectionId, restaurantIds),
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: fail,
  });

  const attachMutation = useMutation({
    mutationFn: (restaurantId: string) => client.attachGuideVenue(collectionId, restaurantId),
    onSuccess: () => {
      setActionError(null);
      setPicking(false);
      void invalidate();
    },
    onError: fail,
  });

  const detachMutation = useMutation({
    mutationFn: (restaurantId: string) => client.detachGuideVenue(collectionId, restaurantId),
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: fail,
  });

  const noteMutation = useMutation({
    mutationFn: ({ restaurantId, note }: { restaurantId: string; note: string }) =>
      client.setGuideVenueNote(collectionId, restaurantId, note),
    onSuccess: () => {
      setActionError(null);
      setNotingVenue(null);
      void invalidate();
    },
    onError: fail,
  });

  const categoriesMutation = useMutation({
    mutationFn: (ids: string[]) => client.setGuideCollectionCategories(collectionId, ids),
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: fail,
  });

  if (detailQuery.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (detailQuery.isError) {
    return <ErrorState onRetry={() => void detailQuery.refetch()} />;
  }

  const collection = detailQuery.data;
  const attachedIds = collection.venues.map((v) => v.restaurant_id);
  const selectedCategoryIds = new Set(collection.categories.map((c) => c.id));
  const busy =
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    archiveMutation.isPending ||
    reorderMutation.isPending ||
    attachMutation.isPending ||
    detachMutation.isPending;

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <Link
        href="/gastroguide"
        className="self-start text-sm font-medium text-brand hover:underline"
      >
        ← {copy.back}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-sm">
            <h1 className="break-words text-xl font-bold text-text">{collection.title}</h1>
            <GuideStatusBadge status={collection.status} publishedAt={collection.published_at} />
          </div>
          <p className="mt-xxs break-words text-[13px] text-text-muted">
            <span className="font-mono">{collection.slug}</span>
            {" · "}
            {collection.city ?? copy.cityAll}
            {" · "}
            {copy.venueCount(collection.venue_count)}
          </p>
        </div>

        <div className="flex flex-wrap gap-xs">
          <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
            {t.admin.common.edit}
          </Button>
          {collection.status === "published" ? (
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
          {collection.status !== "archived" ? (
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
              {copy.refresh}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Rubrics */}
      <section className="flex flex-col gap-md rounded-card bg-surface p-lg">
        <div>
          <h2 className="text-base font-semibold text-text">{copy.categoriesTitle}</h2>
          <p className="mt-xxs break-words text-[13px] text-text-muted">{copy.categoriesHint}</p>
        </div>
        {categoriesQuery.isPending ? (
          <p className="text-[13px] text-text-muted">{t.admin.common.loading}</p>
        ) : categoriesQuery.isError ? (
          <ErrorState onRetry={() => void categoriesQuery.refetch()} />
        ) : categoriesQuery.data.length === 0 ? (
          <p className="text-[13px] text-text-muted">{copy.categoriesEmpty}</p>
        ) : (
          <div className="flex flex-col gap-xs">
            {categoriesQuery.data.map((cat) => (
              <CheckboxRow
                key={cat.id}
                label={cat.is_active ? cat.title : `${cat.title} — ${copy.categoryInactive}`}
                checked={selectedCategoryIds.has(cat.id)}
                disabled={categoriesMutation.isPending}
                onChange={(checked) => {
                  // The endpoint replaces the WHOLE set, so the current
                  // selection plus/minus this one is exactly the payload.
                  const next = checked
                    ? [...selectedCategoryIds, cat.id]
                    : [...selectedCategoryIds].filter((id) => id !== cat.id);
                  categoriesMutation.mutate(next);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Venues */}
      <section className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text">{copy.venuesTitle}</h2>
            <p className="mt-xxs break-words text-[13px] text-text-muted">{copy.venuesHint}</p>
          </div>
          <Button onClick={() => setPicking(true)} disabled={busy}>
            {copy.venueAdd}
          </Button>
        </div>

        <GuideVenueList
          venues={collection.venues}
          reordering={reorderMutation.isPending}
          disabled={busy && !reorderMutation.isPending}
          onReorder={(ids) => reorderMutation.mutate(ids)}
          onEditNote={(v) => setNotingVenue(v)}
          onRemove={(v) => {
            if (!window.confirm(copy.venueConfirmRemove)) return;
            detachMutation.mutate(v.restaurant_id);
          }}
        />
      </section>

      <GuideGuestPreview collection={collection} />

      {editing ? (
        <GuideCollectionFormModal
          client={client}
          collection={collection}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void invalidate();
          }}
        />
      ) : null}

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
          attachedIds={attachedIds}
          attaching={attachMutation.isPending}
          onClose={() => setPicking(false)}
          onPick={(v) => attachMutation.mutate(v.id)}
        />
      ) : null}

      {notingVenue ? (
        <VenueNoteModal
          venue={notingVenue}
          saving={noteMutation.isPending}
          onClose={() => setNotingVenue(null)}
          onSave={(note) =>
            noteMutation.mutate({ restaurantId: notingVenue.restaurant_id, note })
          }
        />
      ) : null}
    </section>
  );
}

function VenueNoteModal({
  venue,
  saving,
  onSave,
  onClose,
}: {
  venue: GuideCollectionVenue;
  saving: boolean;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState(venue.note);
  return (
    <Modal title={venue.name} onClose={onClose}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (saving) return;
          onSave(note.trim());
        }}
        noValidate
      >
        <Field label={copy.venueNote} htmlFor="guide-venue-note">
          <TextArea
            id="guide-venue-note"
            value={note}
            placeholder={copy.venueNotePlaceholder}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
          />
        </Field>
        <div className="flex justify-end gap-sm">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.admin.common.cancel}
          </Button>
          <Button type="submit" loading={saving}>
            {saving ? t.admin.common.saving : t.admin.common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

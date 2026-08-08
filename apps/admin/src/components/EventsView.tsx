"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminEvent, EventInput, FeedItemState } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  formatDateTime,
  formatMinorTenge,
  isoToLocalInput,
  localInputToIso,
  tengeToMinor,
} from "@/lib/format";
import { t } from "@/lib/i18n";
import { formatTags, parseTags } from "@/lib/tags";
import { Button } from "./ui/Button";
import { FeedControl } from "./ui/FeedControl";
import { CheckboxRow, Field, TextArea, TextInput } from "./ui/FormControls";
import { ImageUploadField } from "./ui/ImageUploadField";
import { Modal } from "./ui/Modal";
import { PublishBadge } from "./ui/PublishBadge";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";

/** Map an existing event to the create/update payload (used for publish/hide,
 * which are just a status flip on the full PUT body). */
function eventToInput(e: AdminEvent, status = e.status): EventInput {
  return {
    title: e.title,
    description: e.description,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    venue: e.venue ?? "",
    cover_image_url: e.cover_image_url ?? null,
    status,
    ticketed: e.ticketed,
    ticket_price_minor: e.ticket_price_minor ?? null,
    capacity: e.capacity ?? null,
    tags: e.tags ?? [],
  };
}

export function EventsView() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant!.id;
  const queryClient = useQueryClient();
  const queryKey = ["events", restaurantId] as const;

  const [editing, setEditing] = useState<AdminEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey,
    queryFn: () => apiClient.listEvents(restaurantId, { per_page: 100 }),
  });

  // One call for the whole venue's feed state; mapped by (kind, id) below so
  // each card reads its status without an extra per-item request.
  const feedQuery = useQuery({
    queryKey: ["feed", restaurantId] as const,
    queryFn: () => apiClient.listVenueFeed(restaurantId, { per_page: 100 }),
  });

  const feedByItemId = useMemo(() => {
    const map = new Map<string, FeedItemState>();
    for (const st of feedQuery.data?.items ?? []) {
      if (st.kind === "event") map.set(st.id, st);
    }
    return map;
  }, [feedQuery.data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const statusMutation = useMutation({
    mutationFn: ({ event, status }: { event: AdminEvent; status: AdminEvent["status"] }) =>
      apiClient.updateEvent(event.id, eventToInput(event, status)),
    onSuccess: invalidate,
    onError: () => setActionError(t.admin.common.saveFailed),
  });

  const deleteMutation = useMutation({
    mutationFn: (event: AdminEvent) => apiClient.deleteEvent(event.id),
    onSuccess: invalidate,
    onError: () => setActionError(t.admin.common.deleteFailed),
  });

  const items = listQuery.data?.items ?? [];

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <header className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="text-xl font-bold text-text">{t.admin.events.title}</h1>
        <Button onClick={() => setCreating(true)}>{t.admin.events.create}</Button>
      </header>

      {actionError ? (
        <p role="alert" className="rounded-card bg-rose-50 px-md py-sm text-sm text-rose-700">
          {actionError}
        </p>
      ) : null}

      {listQuery.isPending ? (
        <LoadingState title={t.admin.events.loadingTitle} />
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t.admin.events.emptyTitle}
          description={t.admin.events.emptyDescription}
        />
      ) : (
        <>
          <p className="text-sm text-text-muted">{t.admin.events.total(listQuery.data.total)}</p>
          <ul className="flex flex-col gap-sm">
            {items.map((e) => {
              const busy =
                (statusMutation.isPending && statusMutation.variables?.event.id === e.id) ||
                (deleteMutation.isPending && deleteMutation.variables?.id === e.id);
              return (
                <li key={e.id} className="flex flex-col gap-md rounded-card bg-surface p-lg">
                  <div className="flex flex-col gap-md sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-sm">
                      <span className="break-words text-sm font-semibold text-text">{e.title}</span>
                      <PublishBadge status={e.status} />
                    </div>
                    <p className="mt-xxs text-[13px] text-text-muted">
                      {formatDateTime(e.starts_at)} — {formatDateTime(e.ends_at)}
                    </p>
                    {e.venue ? (
                      <p className="mt-xxs text-[13px] text-text-muted">{e.venue}</p>
                    ) : null}
                    <p className="mt-xxs text-[12px] text-text-muted">
                      {e.ticketed
                        ? `${t.admin.events.ticketed} · ${formatMinorTenge(e.ticket_price_minor)}${
                            e.capacity != null ? ` · ${e.capacity}` : ""
                          }`
                        : t.admin.events.free}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-xs sm:justify-end">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(e)}>
                      {t.admin.common.edit}
                    </Button>
                    {e.status === "published" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        loading={statusMutation.isPending && statusMutation.variables?.event.id === e.id}
                        onClick={() => {
                          setActionError(null);
                          statusMutation.mutate({ event: e, status: "hidden" });
                        }}
                      >
                        {t.admin.events.hide}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busy}
                        loading={statusMutation.isPending && statusMutation.variables?.event.id === e.id}
                        onClick={() => {
                          setActionError(null);
                          statusMutation.mutate({ event: e, status: "published" });
                        }}
                      >
                        {t.admin.events.publish}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      loading={deleteMutation.isPending && deleteMutation.variables?.id === e.id}
                      onClick={() => {
                        if (!window.confirm(t.admin.common.confirmDelete)) return;
                        setActionError(null);
                        deleteMutation.mutate(e);
                      }}
                    >
                      {t.admin.common.delete}
                    </Button>
                  </div>
                  </div>

                  <FeedControl
                    restaurantId={restaurantId}
                    kind="event"
                    itemId={e.id}
                    state={feedByItemId.get(e.id)}
                    listQueryKey={queryKey}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}

      {creating ? (
        <EventFormModal
          restaurantId={restaurantId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void invalidate();
          }}
        />
      ) : null}

      {editing ? (
        <EventFormModal
          restaurantId={restaurantId}
          event={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void invalidate();
          }}
        />
      ) : null}
    </section>
  );
}

function EventFormModal({
  restaurantId,
  event,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  event?: AdminEvent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!event;
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startsAt, setStartsAt] = useState(isoToLocalInput(event?.starts_at));
  const [endsAt, setEndsAt] = useState(isoToLocalInput(event?.ends_at));
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [cover, setCover] = useState(event?.cover_image_url ?? "");
  const [ticketed, setTicketed] = useState(event?.ticketed ?? false);
  const [price, setPrice] = useState(
    event?.ticket_price_minor != null ? String(Math.round(event.ticket_price_minor / 100)) : "",
  );
  const [capacity, setCapacity] = useState(event?.capacity != null ? String(event.capacity) : "");
  const [tags, setTags] = useState(formatTags(event?.tags));
  const [publishNow, setPublishNow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: EventInput) =>
      isEdit ? apiClient.updateEvent(event!.id, input) : apiClient.createEvent(restaurantId, input),
    onSuccess: onSaved,
    onError: () => setFormError(t.admin.common.saveFailed),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;
    setFormError(null);

    const startsIso = localInputToIso(startsAt);
    const endsIso = localInputToIso(endsAt);
    if (!title.trim() || !startsIso || !endsIso) {
      setFormError(t.admin.common.required);
      return;
    }
    if (new Date(endsIso) <= new Date(startsIso)) {
      setFormError(t.admin.events.endBeforeStart);
      return;
    }

    // On edit keep the existing status; on create, publish-now or draft.
    const status = isEdit ? event!.status : publishNow ? "published" : "draft";
    const priceNum = Number(price);
    const capNum = Number(capacity);
    mutation.mutate({
      title: title.trim(),
      description: description.trim(),
      starts_at: startsIso,
      ends_at: endsIso,
      venue: venue.trim(),
      cover_image_url: cover.trim() || null,
      status,
      ticketed,
      ticket_price_minor: ticketed && price.trim() && !Number.isNaN(priceNum) ? tengeToMinor(priceNum) : null,
      capacity: ticketed && capacity.trim() && !Number.isNaN(capNum) ? Math.round(capNum) : null,
      tags: parseTags(tags),
    });
  }

  return (
    <Modal title={isEdit ? t.admin.events.editTitle : t.admin.events.createTitle} onClose={onClose}>
      <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
        <Field label={t.admin.events.fieldTitle} required>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </Field>
        <Field label={t.admin.events.fieldDescription}>
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <Field label={t.admin.events.fieldStartsAt} required>
            <TextInput
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
          <Field label={t.admin.events.fieldEndsAt} required>
            <TextInput
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t.admin.events.fieldVenue} hint={t.admin.events.fieldVenueHint}>
          <TextInput value={venue} onChange={(e) => setVenue(e.target.value)} />
        </Field>
        <Field label={t.admin.events.fieldTags} hint={t.admin.events.fieldTagsHint}>
          <TextInput value={tags} onChange={(e) => setTags(e.target.value)} maxLength={300} />
        </Field>
        <ImageUploadField
          label={t.admin.events.fieldCover}
          value={cover}
          onChange={setCover}
        />

        <CheckboxRow
          label={t.admin.events.fieldTicketed}
          checked={ticketed}
          onChange={setTicketed}
        />
        {ticketed ? (
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <Field label={t.admin.events.fieldTicketPrice}>
              <TextInput
                type="number"
                inputMode="numeric"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            <Field label={t.admin.events.fieldCapacity}>
              <TextInput
                type="number"
                inputMode="numeric"
                min={0}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {!isEdit ? (
          <CheckboxRow
            label={t.admin.events.publishNow}
            checked={publishNow}
            onChange={setPublishNow}
          />
        ) : null}

        {formError ? (
          <p role="alert" className="text-sm text-brand">
            {formError}
          </p>
        ) : null}

        <div className="mt-sm flex justify-end gap-sm">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.admin.common.cancel}
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {mutation.isPending ? t.admin.common.saving : t.admin.common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

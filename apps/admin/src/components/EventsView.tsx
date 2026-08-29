"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildTranslationPatch,
  translationDraftFrom,
  type AdminEvent,
  type EventContentField,
  type EventInput,
  type FeedItemState,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
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
import {
  contentOverridesOf,
  groupEventsIntoSeries,
  eventToInput,
  isSeriesDate,
} from "@/lib/event-series";
import { Button } from "./ui/Button";
import { EventSeriesCard } from "./EventSeriesCard";
import { FeedControl } from "./ui/FeedControl";
import { CheckboxRow, Field, TextInput } from "./ui/FormControls";
import { ImageGalleryField } from "./ui/ImageGalleryField";
import { ImageUploadField } from "./ui/ImageUploadField";
import { Modal } from "./ui/Modal";
import { PublishBadge } from "./ui/PublishBadge";
import { TranslatedField, TranslationCoverageNote } from "./ui/TranslatedField";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";
import { translationErrorMessage } from "./translation-copy";

export function EventsView() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant!.id;
  const queryClient = useQueryClient();
  const queryKey = ["events", restaurantId] as const;
  const recurrencesKey = ["event-recurrences", restaurantId] as const;

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

  // Правила повтора того же заведения. Без них 18 дат «Greek Party» —
  // 18 одинаковых карточек: сгруппировать их можно и по `recurrence_id` одному,
  // но название серии, её расписание и статус на главной живут на правиле.
  const recurrencesQuery = useQuery({
    queryKey: recurrencesKey,
    queryFn: () => apiClient.listEventRecurrences(restaurantId, { per_page: 100 }),
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: recurrencesKey }),
    ]);

  const statusMutation = useMutation({
    mutationFn: ({ event, status }: { event: AdminEvent; status: AdminEvent["status"] }) =>
      apiClient.updateEvent(event.id, eventToInput(event, status)),
    onSuccess: () => void invalidate(),
    onError: () => setActionError(t.admin.common.saveFailed),
  });

  const deleteMutation = useMutation({
    mutationFn: (event: AdminEvent) => apiClient.deleteEvent(event.id),
    onSuccess: () => void invalidate(),
    onError: () => setActionError(t.admin.common.deleteFailed),
  });

  const items = listQuery.data?.items ?? [];

  // Свёртка списка: даты одной серии — одна строка, разовые события как были.
  const rows = useMemo(
    () => groupEventsIntoSeries(listQuery.data?.items ?? [], recurrencesQuery.data?.items ?? []),
    [listQuery.data, recurrencesQuery.data],
  );

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
          <p className="text-sm text-text-muted">{t.admin.events.total(rows.length)}</p>
          <ul className="flex flex-col gap-sm">
            {rows.map((row) => {
              if (row.kind === "series") {
                return (
                  <EventSeriesCard
                    key={row.recurrenceId}
                    row={row}
                    onEdit={setEditing}
                    onInvalidate={() => void invalidate()}
                  />
                );
              }
              const e = row.event;
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
  // Дата серии наследует контент от правила (migration 0097). Форма та же, но
  // человек должен видеть, ЧТО он правит: общий текст серии или исключение
  // именно этой даты.
  const inSeries = isSeriesDate(event);
  const overrides = contentOverridesOf(event);
  const [resetError, setResetError] = useState<string | null>(null);
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startsAt, setStartsAt] = useState(isoToLocalInput(event?.starts_at));
  const [endsAt, setEndsAt] = useState(isoToLocalInput(event?.ends_at));
  const [venue, setVenue] = useState(event?.venue ?? "");
  // Черновики переводов: русский текст остаётся в полях выше, здесь только kk/en.
  const [titleI18n, setTitleI18n] = useState(() => translationDraftFrom(event?.title_i18n));
  const [descriptionI18n, setDescriptionI18n] = useState(() =>
    translationDraftFrom(event?.description_i18n),
  );
  const [venueI18n, setVenueI18n] = useState(() => translationDraftFrom(event?.venue_i18n));
  const [cover, setCover] = useState(event?.cover_image_url ?? "");
  const [gallery, setGallery] = useState<string[]>(event?.images ?? []);
  const [ticketed, setTicketed] = useState(event?.ticketed ?? false);
  const [price, setPrice] = useState(
    event?.ticket_price_minor != null ? String(Math.round(event.ticket_price_minor / 100)) : "",
  );
  const [capacity, setCapacity] = useState(event?.capacity != null ? String(event.capacity) : "");
  const [tags, setTags] = useState(formatTags(event?.tags));
  const [publishNow, setPublishNow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /** Сброс переопределения: поле (или все сразу) снова берётся у серии.
   * Сервер сам стирает пометку и переписывает поле контентом правила — тело
   * события для этого слать не надо. */
  const resetMutation = useMutation({
    mutationFn: (fields: EventContentField[]) => apiClient.resetEventContent(event!.id, fields),
    onSuccess: onSaved,
    onError: () => setResetError(t.admin.events.series.resetFailed),
  });

  const mutation = useMutation({
    mutationFn: (input: EventInput) =>
      isEdit ? apiClient.updateEvent(event!.id, input) : apiClient.createEvent(restaurantId, input),
    onSuccess: () => {
      if (!isEdit) trackEvent("content_created", { type: "event" });
      onSaved();
    },
    onError: (error) => setFormError(translationErrorMessage(error)),
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
      // Патчи переводов — единственные ЧАСТИЧНЫЕ поля этого тела: уходят только
      // изменённые языки, не тронули ничего — ключа не будет вовсе.
      title_i18n: buildTranslationPatch(titleI18n, event?.title_i18n),
      description: description.trim(),
      description_i18n: buildTranslationPatch(descriptionI18n, event?.description_i18n),
      starts_at: startsIso,
      ends_at: endsIso,
      venue: venue.trim(),
      venue_i18n: buildTranslationPatch(venueI18n, event?.venue_i18n),
      cover_image_url: cover.trim() || null,
      images: gallery,
      status,
      ticketed,
      ticket_price_minor: ticketed && price.trim() && !Number.isNaN(priceNum) ? tengeToMinor(priceNum) : null,
      capacity: ticketed && capacity.trim() && !Number.isNaN(capNum) ? Math.round(capNum) : null,
      tags: parseTags(tags),
      // Поля, которых в этой форме нет, но которые есть у записи. PUT
      // заменяет запись целиком, поэтому «не редактируем» и «не отправляем» —
      // разные вещи: второе стёрло бы город и кнопку. Правятся они на экране
      // «Афиша платформы» и в API.
      city: event?.city ?? null,
      // Кнопка — полная замена, а её переводы — патч поверх сохранённых.
      // Подпись кнопки правится на экране «Афиша платформы», сюда она едет как
      // была; патч переводов здесь не строим, чтобы не переписать чужую правку.
      action: event?.action ? { label: event.action.label, url: event.action.url ?? null } : null,
    });
  }

  return (
    <Modal title={isEdit ? t.admin.events.editTitle : t.admin.events.createTitle} onClose={onClose}>
      <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
        {inSeries ? (
          <div
            role="note"
            className="flex flex-col gap-xs rounded-card bg-chip px-md py-sm text-text"
          >
            <span className="text-[13px] font-semibold">
              {t.admin.events.series.dateContentTitle}
            </span>
            <span className="text-[12px] text-text-muted">
              {t.admin.events.series.dateContentHint}
            </span>
            {overrides.length > 0 ? (
              <>
                <span className="text-[12px] text-text">
                  {t.admin.events.series.overriddenList(
                    overrides.map((f) => t.admin.events.series.fieldName(f)).join(", "),
                  )}
                </span>
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={resetMutation.isPending && resetMutation.variables?.length === 0}
                    disabled={resetMutation.isPending}
                    onClick={() => {
                      if (!window.confirm(t.admin.events.series.resetAllConfirm)) return;
                      setResetError(null);
                      resetMutation.mutate([]);
                    }}
                  >
                    {t.admin.events.series.resetAll}
                  </Button>
                </div>
              </>
            ) : null}
            {resetError ? (
              <p role="alert" className="text-[12px] text-brand">
                {resetError}
              </p>
            ) : null}
          </div>
        ) : null}

        <TranslationCoverageNote
          fields={[
            { label: t.admin.events.fieldTitle, translations: titleI18n },
            { label: t.admin.events.fieldDescription, translations: descriptionI18n },
            { label: t.admin.events.fieldVenue, translations: venueI18n },
          ]}
        />
        <TranslatedField
          id="event-title"
          label={t.admin.events.fieldTitle}
          required
          maxLength={200}
          base={title}
          onBaseChange={setTitle}
          translations={titleI18n}
          onTranslationsChange={setTitleI18n}
          stored={event?.title_i18n}
        />
        <SeriesFieldNote
          field="title"
          inSeries={inSeries}
          overrides={overrides}
          busy={resetMutation.isPending}
          onReset={(f) => {
            setResetError(null);
            resetMutation.mutate([f]);
          }}
        />
        <TranslatedField
          id="event-description"
          label={t.admin.events.fieldDescription}
          multiline
          base={description}
          onBaseChange={setDescription}
          translations={descriptionI18n}
          onTranslationsChange={setDescriptionI18n}
          stored={event?.description_i18n}
        />
        <SeriesFieldNote
          field="description"
          inSeries={inSeries}
          overrides={overrides}
          busy={resetMutation.isPending}
          onReset={(f) => {
            setResetError(null);
            resetMutation.mutate([f]);
          }}
        />
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
        <TranslatedField
          id="event-venue"
          label={t.admin.events.fieldVenue}
          hint={t.admin.events.fieldVenueHint}
          base={venue}
          onBaseChange={setVenue}
          translations={venueI18n}
          onTranslationsChange={setVenueI18n}
          stored={event?.venue_i18n}
        />
        <SeriesFieldNote
          field="venue"
          inSeries={inSeries}
          overrides={overrides}
          busy={resetMutation.isPending}
          onReset={(f) => {
            setResetError(null);
            resetMutation.mutate([f]);
          }}
        />
        <Field label={t.admin.events.fieldTags} hint={t.admin.events.fieldTagsHint}>
          <TextInput value={tags} onChange={(e) => setTags(e.target.value)} maxLength={300} />
        </Field>
        <SeriesFieldNote
          field="tags"
          inSeries={inSeries}
          overrides={overrides}
          busy={resetMutation.isPending}
          onReset={(f) => {
            setResetError(null);
            resetMutation.mutate([f]);
          }}
        />
        <ImageUploadField
          label={t.admin.events.fieldCover}
          value={cover}
          onChange={setCover}
        />
        <SeriesFieldNote
          field="cover_image_url"
          inSeries={inSeries}
          overrides={overrides}
          busy={resetMutation.isPending}
          onReset={(f) => {
            setResetError(null);
            resetMutation.mutate([f]);
          }}
        />
        <ImageGalleryField
          label={t.admin.gallery.label}
          hint={t.admin.gallery.hint}
          value={gallery}
          onChange={setGallery}
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

/**
 * Подпись под полем формы даты серии: наследуется оно от серии или это
 * исключение именно у этой даты.
 *
 * Различие не косметическое. Поле, помеченное «своё», переживает правку общего
 * контента серии — а поле, которое наследуется, будет ею переписано. Человек
 * должен читать это ДО того, как что-то напишет, а не гадать потом, почему
 * половина дат сменила текст, а половина нет.
 */
function SeriesFieldNote({
  field,
  inSeries,
  overrides,
  busy,
  onReset,
}: {
  field: EventContentField;
  inSeries: boolean;
  overrides: EventContentField[];
  busy: boolean;
  onReset: (field: EventContentField) => void;
}) {
  if (!inSeries) return null;
  const own = overrides.includes(field);
  if (!own) {
    return (
      <p className="-mt-xs text-[12px] text-text-muted">
        {t.admin.events.series.inheritedHint}
      </p>
    );
  }
  return (
    <div className="-mt-xs flex flex-wrap items-center gap-xs">
      <span className="inline-block whitespace-nowrap rounded-pill bg-amber-100 px-sm py-xxs text-[11px] font-medium text-amber-800">
        {t.admin.events.series.overrideBadge}
      </span>
      <span className="text-[12px] text-text-muted">{t.admin.events.series.overrideHint}</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => onReset(field)}
        className="rounded-pill px-sm py-xxs text-[12px] font-medium text-brand underline disabled:opacity-60"
      >
        {`${t.admin.events.series.resetField}: ${t.admin.events.series.fieldName(field)}`}
      </button>
    </div>
  );
}

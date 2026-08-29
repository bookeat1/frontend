"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminEvent,
  AdminListParams,
  ApiPage,
  EventActionInput,
  EventInput,
} from "@bookeat/api/admin";
import {
  buildTranslationPatch,
  translationDraftFrom,
  validateActionUrl,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { formatDateTime, isoToLocalInput, localInputToIso } from "@/lib/format";
import { t } from "@/lib/i18n";
import { formatTags, parseTags } from "@/lib/tags";
import { useCityDictionary } from "@/lib/use-cities";
import { useIsPlatformAdmin } from "@/lib/use-venue-catalog";

import { EmptyState, ErrorState, LoadingState } from "../StateViews";
import { Button } from "../ui/Button";
import { CitySelectField } from "../ui/CitySelectField";
import { CheckboxRow, Field, Select, TextInput } from "../ui/FormControls";
import { TranslatedField, TranslationCoverageNote } from "../ui/TranslatedField";
import { ImageGalleryField } from "../ui/ImageGalleryField";
import { ImageUploadField } from "../ui/ImageUploadField";
import { Modal } from "../ui/Modal";
import { PublishBadge } from "../ui/PublishBadge";
import { CityChip } from "./PlatformPromosView";
import { actionUrlText, copy, platformContentErrorText } from "./copy";

/**
 * «Афиша платформы» — события, у которых НЕТ заведения (backend PR #103).
 *
 * Два правила этого экрана идут прямо из бэкенда, и оба видны в интерфейсе:
 *
 *  1. БИЛЕТОВ НЕТ. `validateEvent` отклоняет событие без заведения с
 *     `ticketed: true` (и то же самое стоит CHECK-ом в БД): деньги гостя
 *     некуда зачислять. Флажок нарисован, но выключен и объясняет причину —
 *     иначе редактор, который вчера заводил билетное событие заведения, будет
 *     искать пропавшее поле.
 *  2. КНОПКА КАРТОЧКИ — это выбор из трёх состояний, а не пустое поле ссылки.
 *     На проводе цель кнопки ВЫВОДИТСЯ из наличия `url` (поля `target` в
 *     запросе нет вовсе), и без явного выбора «пусто» читалось бы как «я ещё
 *     не заполнил», а означало бы «кнопка ведёт на страницу события».
 */
export interface PlatformEventClient {
  listPlatformEvents(params?: AdminListParams): Promise<ApiPage<AdminEvent>>;
  createPlatformEvent(input: EventInput): Promise<AdminEvent>;
  updateEvent(eventId: string, input: EventInput): Promise<AdminEvent>;
  deleteEvent(eventId: string): Promise<void>;
}

const QUERY_KEY = ["platform-events"] as const;

/** Что делает кнопка. Три состояния вместо «url пусто / url заполнено»: см.
 * комментарий к экрану. */
type ActionMode = "none" | "event" | "external";

/** Полный payload из существующего события — публикация и скрытие это тот же
 * PUT с другим статусом. Город, галерея и кнопка переносятся ЯВНО: запись
 * заменяет запись целиком, и поле, забытое здесь, сервер очистит. */
function eventToInput(e: AdminEvent, status: AdminEvent["status"] = e.status): EventInput {
  return {
    title: e.title,
    description: e.description,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    venue: e.venue ?? "",
    cover_image_url: e.cover_image_url ?? null,
    status,
    // Событие платформы билетов не продаёт, и переслать сюда true нельзя даже
    // случайно: сервер ответит 422.
    ticketed: false,
    ticket_price_minor: null,
    capacity: null,
    tags: e.tags ?? [],
    images: e.images ?? [],
    city: e.city ?? null,
    action: e.action ? { label: e.action.label, url: e.action.url ?? null } : null,
  };
}

export function PlatformEventsView({ client = apiClient }: { client?: PlatformEventClient }) {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) {
    return <EmptyState title={copy.adminOnlyTitle} description={copy.adminOnlyDescription} />;
  }
  return <PlatformEvents client={client} />;
}

function PlatformEvents({ client }: { client: PlatformEventClient }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => client.listPlatformEvents({ per_page: 100 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const statusMutation = useMutation({
    mutationFn: ({ event, status }: { event: AdminEvent; status: AdminEvent["status"] }) =>
      client.updateEvent(event.id, eventToInput(event, status)),
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: (error) => setActionError(platformContentErrorText(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (event: AdminEvent) => client.deleteEvent(event.id),
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: () => setActionError(copy.deleteFailed),
  });

  const items = listQuery.data?.items ?? [];

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-text">{copy.eventsTitle}</h1>
          <p className="mt-xxs max-w-[60ch] text-sm text-text-muted">{copy.eventsSubtitle}</p>
        </div>
        <Button onClick={() => setCreating(true)}>{copy.createEvent}</Button>
      </header>

      {actionError ? (
        <p role="alert" className="break-words text-sm text-brand">
          {actionError}
        </p>
      ) : null}

      {listQuery.isPending ? (
        <LoadingState title={copy.loadingEvents} />
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={copy.emptyEventsTitle} description={copy.emptyEventsDescription} />
      ) : (
        <>
          <p className="text-sm text-text-muted">{copy.total(listQuery.data.total)}</p>
          <ul className="flex flex-col gap-sm">
            {items.map((event) => {
              const pendingStatus =
                statusMutation.isPending && statusMutation.variables?.event.id === event.id;
              const pendingDelete =
                deleteMutation.isPending && deleteMutation.variables?.id === event.id;
              return (
                <li
                  key={event.id}
                  className="flex flex-col gap-md rounded-card bg-surface p-lg sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-sm">
                      <span className="break-words text-sm font-semibold text-text">
                        {event.title}
                      </span>
                      <PublishBadge status={event.status} />
                      <CityChip city={event.city} />
                    </div>
                    <p className="mt-xxs text-[13px] text-text-muted">
                      {formatDateTime(event.starts_at)} — {formatDateTime(event.ends_at)}
                    </p>
                    {/* Площадка — это СТРОКА адреса, а не заведение платформы:
                        заведения у такого события нет и колонки для него быть
                        не может. */}
                    {event.venue ? (
                      <p className="mt-xxs break-words text-[13px] text-text-muted">
                        {event.venue}
                      </p>
                    ) : null}
                    {event.action ? (
                      <p className="mt-xxs break-words text-[12px] text-text-muted">
                        {event.action.label} ·{" "}
                        {event.action.target === "external"
                          ? (event.action.url ?? copy.actionModeExternal)
                          : copy.actionModeEvent}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-xs sm:justify-end">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(event)}>
                      {t.admin.common.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant={event.status === "published" ? "secondary" : "primary"}
                      disabled={pendingStatus || pendingDelete}
                      loading={pendingStatus}
                      onClick={() => {
                        setActionError(null);
                        statusMutation.mutate({
                          event,
                          status: event.status === "published" ? "hidden" : "published",
                        });
                      }}
                    >
                      {event.status === "published" ? t.admin.events.hide : t.admin.events.publish}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pendingStatus || pendingDelete}
                      loading={pendingDelete}
                      onClick={() => {
                        if (!window.confirm(copy.confirmDelete)) return;
                        setActionError(null);
                        deleteMutation.mutate(event);
                      }}
                    >
                      {t.admin.common.delete}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {creating ? (
        <PlatformEventFormModal
          client={client}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void invalidate();
          }}
        />
      ) : null}

      {editing ? (
        <PlatformEventFormModal
          client={client}
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

export function PlatformEventFormModal({
  client,
  event,
  onClose,
  onSaved,
}: {
  client: Pick<PlatformEventClient, "createPlatformEvent" | "updateEvent">;
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
  const [city, setCity] = useState(event?.city ?? "");
  const [cover, setCover] = useState(event?.cover_image_url ?? "");
  const [gallery, setGallery] = useState<string[]>(event?.images ?? []);
  const [tags, setTags] = useState(formatTags(event?.tags));
  const [actionMode, setActionMode] = useState<ActionMode>(() => {
    if (!event?.action) return "none";
    return event.action.target === "external" ? "external" : "event";
  });
  const [actionLabel, setActionLabel] = useState(event?.action?.label ?? "");
  // Переводы. Русский текст остаётся в обычных полях; сюда едут только kk/en,
  // и только те, что человек тронул.
  const [titleI18n, setTitleI18n] = useState(() => translationDraftFrom(event?.title_i18n));
  const [descriptionI18n, setDescriptionI18n] = useState(() =>
    translationDraftFrom(event?.description_i18n),
  );
  const [venueI18n, setVenueI18n] = useState(() => translationDraftFrom(event?.venue_i18n));
  const [actionLabelI18n, setActionLabelI18n] = useState(() =>
    translationDraftFrom(event?.action?.label_i18n),
  );
  const [actionUrl, setActionUrl] = useState(event?.action?.url ?? "");
  const [publishNow, setPublishNow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const cityQuery = useCityDictionary();
  const cityDictionary = useMemo(() => cityQuery.data ?? [], [cityQuery.data]);

  const mutation = useMutation({
    mutationFn: (input: EventInput) =>
      isEdit ? client.updateEvent(event!.id, input) : client.createPlatformEvent(input),
    onSuccess: () => {
      if (!isEdit) trackEvent("content_created", { type: "event" });
      onSaved();
    },
    onError: (error) => setFormError(platformContentErrorText(error)),
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

    let action: EventActionInput | null = null;
    if (actionMode !== "none") {
      if (!actionLabel.trim()) {
        setFormError(copy.actionLabelRequired);
        return;
      }
      if (actionMode === "external") {
        // Проверка ДЛЯ УДОБСТВА, а не ради безопасности: сервер проверит
        // ссылку заново, и его отказ окончателен. Но общее «validation failed»,
        // которым он отвечает, не объясняет редактору, что именно не так.
        const problem = validateActionUrl(actionUrl);
        if (problem) {
          setFormError(actionUrlText(problem));
          return;
        }
      }
      action = {
        label: actionLabel.trim(),
        // Переводы подписи едут ОТДЕЛЬНО от самой кнопки и по другим правилам:
        // кнопка — полная замена, её переводы — патч поверх сохранённых.
        label_i18n: buildTranslationPatch(actionLabelI18n, event?.action?.label_i18n),
        // «Открывает страницу события» — это ОТСУТСТВИЕ url, а не пустая
        // строка: цель кнопки сервер выводит из наличия поля.
        url: actionMode === "external" ? actionUrl.trim() : null,
      };
    }

    mutation.mutate({
      title: title.trim(),
      title_i18n: buildTranslationPatch(titleI18n, event?.title_i18n),
      description: description.trim(),
      description_i18n: buildTranslationPatch(descriptionI18n, event?.description_i18n),
      starts_at: startsIso,
      ends_at: endsIso,
      venue: venue.trim(),
      venue_i18n: buildTranslationPatch(venueI18n, event?.venue_i18n),
      cover_image_url: cover.trim() || null,
      images: gallery,
      status: isEdit ? event!.status : publishNow ? "published" : "draft",
      ticketed: false,
      ticket_price_minor: null,
      capacity: null,
      tags: parseTags(tags),
      city: city.trim() || null,
      action,
    });
  }

  return (
    <Modal title={isEdit ? copy.editEventTitle : copy.createEventTitle} onClose={onClose}>
      <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
        <TranslationCoverageNote
          fields={[
            { label: t.admin.events.fieldTitle, translations: titleI18n },
            { label: t.admin.events.fieldDescription, translations: descriptionI18n },
            { label: t.admin.events.fieldVenue, translations: venueI18n },
            ...(actionMode !== "none"
              ? [{ label: copy.actionLabel, translations: actionLabelI18n }]
              : []),
          ]}
        />
        <TranslatedField
          id="platform-event-title"
          label={t.admin.events.fieldTitle}
          required
          maxLength={200}
          base={title}
          onBaseChange={setTitle}
          translations={titleI18n}
          onTranslationsChange={setTitleI18n}
          stored={event?.title_i18n}
        />
        <TranslatedField
          id="platform-event-description"
          label={t.admin.events.fieldDescription}
          multiline
          base={description}
          onBaseChange={setDescription}
          translations={descriptionI18n}
          onTranslationsChange={setDescriptionI18n}
          stored={event?.description_i18n}
        />
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <Field label={t.admin.events.fieldStartsAt} required htmlFor="platform-event-starts">
            <TextInput
              id="platform-event-starts"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
          <Field label={t.admin.events.fieldEndsAt} required htmlFor="platform-event-ends">
            <TextInput
              id="platform-event-ends"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
        </div>
        <CitySelectField
          id="platform-event-city"
          dictionary={cityDictionary}
          loading={cityQuery.isPending}
          failed={cityQuery.isError}
          value={city}
          onChange={setCity}
          emptyOptionLabel={copy.cityAll}
        />
        <TranslatedField
          id="platform-event-venue"
          label={t.admin.events.fieldVenue}
          hint={copy.fieldVenueHint}
          base={venue}
          onBaseChange={setVenue}
          translations={venueI18n}
          onTranslationsChange={setVenueI18n}
          stored={event?.venue_i18n}
        />
        <Field
          label={t.admin.events.fieldTags}
          hint={t.admin.events.fieldTagsHint}
          htmlFor="platform-event-tags"
        >
          <TextInput
            id="platform-event-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            maxLength={300}
          />
        </Field>
        <ImageUploadField label={t.admin.events.fieldCover} value={cover} onChange={setCover} />
        <ImageGalleryField
          label={t.admin.gallery.label}
          hint={t.admin.gallery.hint}
          value={gallery}
          onChange={setGallery}
        />

        <fieldset className="flex flex-col gap-md rounded-card border border-hairline p-md">
          <legend className="px-xs text-sm font-medium text-text">{copy.actionTitle}</legend>
          <Field label={copy.actionMode} htmlFor="platform-event-action-mode">
            <Select
              id="platform-event-action-mode"
              value={actionMode}
              onChange={(e) => setActionMode(e.target.value as ActionMode)}
            >
              <option value="none">{copy.actionModeNone}</option>
              <option value="event">{copy.actionModeEvent}</option>
              <option value="external">{copy.actionModeExternal}</option>
            </Select>
          </Field>
          {actionMode !== "none" ? (
            <TranslatedField
              id="platform-event-action-label"
              label={copy.actionLabel}
              hint={copy.actionLabelHint}
              required
              maxLength={64}
              base={actionLabel}
              onBaseChange={setActionLabel}
              translations={actionLabelI18n}
              onTranslationsChange={setActionLabelI18n}
              stored={event?.action?.label_i18n}
            />
          ) : null}
          {actionMode === "external" ? (
            <Field
              label={copy.actionUrl}
              hint={copy.actionUrlHint}
              required
              htmlFor="platform-event-action-url"
            >
              <TextInput
                id="platform-event-action-url"
                type="url"
                inputMode="url"
                spellCheck={false}
                autoCapitalize="none"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
              />
            </Field>
          ) : null}
        </fieldset>

        {/* Билеты выключены и объясняют почему. Спрятать флажок целиком было бы
            честно по данным, но редактор, который заводил билетное событие
            заведения, искал бы пропавшее поле. */}
        <CheckboxRow
          label={copy.ticketedLabel}
          hint={copy.ticketedDisabledReason}
          checked={false}
          disabled
          onChange={() => {}}
        />

        {!isEdit ? (
          <CheckboxRow label={copy.publishNow} checked={publishNow} onChange={setPublishNow} />
        ) : null}

        {formError ? (
          <p role="alert" className="break-words text-sm text-brand">
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

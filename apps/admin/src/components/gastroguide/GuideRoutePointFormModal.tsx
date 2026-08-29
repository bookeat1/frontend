"use client";

import { useState } from "react";
import {
  buildTranslationPatch,
  translationDraftFrom,
  type GuideRoutePoint,
  type GuideRoutePointInput,
  type GuideRoutePointKind,
  type VenueSearchResult,
} from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/FormControls";
import { Modal } from "../ui/Modal";
import { TranslatedField, TranslationCoverageNote } from "../ui/TranslatedField";
import { VenuePickerModal, type VenueSearchClient } from "../ui/VenuePickerModal";
import { coordinateFieldValue, parsePointCoordinates } from "./route-point";

const copy = t.admin.gastroRoutes;

/** Заведение, привязанное к остановке, — минимум, который нужен форме, чтобы
 * его показать. Общий вид для того, что пришло из каталога (VenueSearchResult)
 * и что уже лежит в остановке (GuideRoutePoint.venue). */
interface ChosenVenue {
  id: string;
  name: string;
  address: string;
}

/**
 * Создание и правка ОДНОЙ остановки маршрута.
 *
 * Вид остановки (`kind`) задаётся при открытии и здесь НЕ меняется. Так решено
 * не из лени: на сервере `restaurant` без `restaurant_id` и `place` с ним —
 * оба отказ, то есть переключатель посреди формы означал бы форму, половина
 * состояний которой заведомо неотправляема. Ошибиться видом дешевле, чем
 * кажется — остановку можно удалить и добавить заново.
 *
 * Заведение выбирается ОБЩИМ окном каталога (`VenuePickerModal`) — тем же, что
 * у статьи и у блока «Выбрали для вас»: вопрос один и тот же, поэтому и поиск
 * один.
 */
export function GuideRoutePointFormModal({
  client,
  kind,
  point,
  saving,
  error,
  onSave,
  onClose,
}: {
  client: VenueSearchClient;
  kind: GuideRoutePointKind;
  /** Есть — правим существующую остановку; нет — добавляем новую. */
  point?: GuideRoutePoint;
  saving: boolean;
  /** Сообщение от сервера. Прокидывается снаружи, потому что записывает
   * остановку экран маршрута — там же, где живут все его мутации. */
  error?: string | null;
  onSave: (input: GuideRoutePointInput) => void;
  onClose: () => void;
}) {
  const [venue, setVenue] = useState<ChosenVenue | null>(
    point?.venue
      ? { id: point.venue.id, name: point.venue.name, address: point.venue.address }
      : null,
  );
  const [picking, setPicking] = useState(false);
  const [title, setTitle] = useState(point?.title ?? "");
  const [description, setDescription] = useState(point?.description ?? "");
  const [address, setAddress] = useState(point?.address ?? "");
  const [photo, setPhoto] = useState(point?.photo_url ?? "");
  // Переводы остановки — тот же частичный патч, что у всего контента.
  const [titleI18n, setTitleI18n] = useState(() => translationDraftFrom(point?.title_i18n));
  const [descriptionI18n, setDescriptionI18n] = useState(() =>
    translationDraftFrom(point?.description_i18n),
  );
  const [addressI18n, setAddressI18n] = useState(() => translationDraftFrom(point?.address_i18n));
  const [latitude, setLatitude] = useState(coordinateFieldValue(point?.latitude));
  const [longitude, setLongitude] = useState(coordinateFieldValue(point?.longitude));
  const [formError, setFormError] = useState<string | null>(null);

  function chooseVenue(picked: VenueSearchResult) {
    setVenue({ id: picked.id, name: picked.name, address: picked.address });
    setPicking(false);
    // Заголовок и адрес подставляются из каталога только пока редактор их не
    // написал сам: перезаписывать набранное — худшее, что может сделать форма.
    setTitle((current) => current || picked.name);
    setAddress((current) => current || picked.address);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);

    if (kind === "restaurant" && !venue) {
      setFormError(copy.pointVenueRequired);
      return;
    }
    if (!title.trim()) {
      setFormError(copy.pointTitleRequired);
      return;
    }

    const coords = parsePointCoordinates(latitude, longitude);
    if (coords.kind === "incomplete") {
      setFormError(copy.pointCoordsIncomplete);
      return;
    }
    if (coords.kind === "invalid") {
      setFormError(copy.pointCoordsInvalid);
      return;
    }

    onSave({
      kind,
      // У «места» заведения нет и быть не должно — сервер откажет, если оно
      // приедет.
      restaurant_id: kind === "restaurant" && venue ? venue.id : undefined,
      title: title.trim(),
      title_i18n: buildTranslationPatch(titleI18n, point?.title_i18n),
      description: description.trim(),
      description_i18n: buildTranslationPatch(descriptionI18n, point?.description_i18n),
      address: address.trim(),
      address_i18n: buildTranslationPatch(addressI18n, point?.address_i18n),
      photo_url: photo.trim() || null,
      latitude: coords.kind === "ok" ? coords.latitude : null,
      longitude: coords.kind === "ok" ? coords.longitude : null,
    });
  }

  const message = formError ?? error ?? null;

  return (
    <>
      <Modal
        title={kind === "place" ? copy.pointFormPlaceTitle : copy.pointFormVenueTitle}
        onClose={onClose}
      >
        <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
          {kind === "restaurant" ? (
            <div className="flex flex-wrap items-center justify-between gap-sm rounded-card bg-screen p-md">
              <div className="min-w-0">
                <p className="text-[13px] text-text-muted">{copy.pointVenueChosen}</p>
                <p className="break-words text-sm font-medium text-text">
                  {venue ? venue.name : copy.pointVenueRequired}
                </p>
                {venue?.address ? (
                  <p className="break-words text-[13px] text-text-muted">{venue.address}</p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={saving}
                onClick={() => setPicking(true)}
              >
                {venue ? copy.pointVenueChange : copy.pointVenuePick}
              </Button>
            </div>
          ) : null}

          <TranslationCoverageNote
            fields={[
              { label: copy.pointFieldTitle, translations: titleI18n },
              { label: copy.pointFieldDescription, translations: descriptionI18n },
              { label: copy.pointFieldAddress, translations: addressI18n },
            ]}
          />
          <TranslatedField
            id="route-point-title"
            label={copy.pointFieldTitle}
            hint={copy.pointFieldTitleHint}
            required
            maxLength={200}
            base={title}
            onBaseChange={setTitle}
            translations={titleI18n}
            onTranslationsChange={setTitleI18n}
            stored={point?.title_i18n}
          />
          <TranslatedField
            id="route-point-description"
            label={copy.pointFieldDescription}
            multiline
            base={description}
            onBaseChange={setDescription}
            translations={descriptionI18n}
            onTranslationsChange={setDescriptionI18n}
            stored={point?.description_i18n}
          />
          <TranslatedField
            id="route-point-address"
            label={copy.pointFieldAddress}
            maxLength={300}
            base={address}
            onBaseChange={setAddress}
            translations={addressI18n}
            onTranslationsChange={setAddressI18n}
            stored={point?.address_i18n}
          />
          <Field label={copy.pointFieldPhoto} htmlFor="route-point-photo">
            <TextInput
              id="route-point-photo"
              type="url"
              value={photo}
              onChange={(e) => setPhoto(e.target.value)}
              spellCheck={false}
            />
          </Field>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <Field
              label={copy.pointFieldLatitude}
              hint={copy.pointCoordsHint}
              htmlFor="route-point-lat"
            >
              <TextInput
                id="route-point-lat"
                inputMode="decimal"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </Field>
            <Field label={copy.pointFieldLongitude} htmlFor="route-point-lng">
              <TextInput
                id="route-point-lng"
                inputMode="decimal"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </Field>
          </div>

          {message ? (
            <p role="alert" className="break-words text-sm text-brand">
              {message}
            </p>
          ) : null}

          <div className="mt-sm flex justify-end gap-sm">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t.admin.common.cancel}
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? t.admin.common.saving : t.admin.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      {picking ? (
        <VenuePickerModal
          client={client}
          copy={{
            title: copy.pointVenuePick,
            searchLabel: copy.venueSearch,
            searchHint: copy.venueSearchHint,
            loading: copy.venueSearchLoading,
            empty: copy.venueSearchEmpty,
            alreadyAdded: copy.venueAlreadyAdded,
            inactive: copy.venueInactive,
          }}
          // Ничего не блокируем: одно и то же заведение может честно
          // встречаться в маршруте дважды — например, завтрак и ужин там же.
          attachedIds={[]}
          attaching={false}
          onClose={() => setPicking(false)}
          onPick={chooseVenue}
        />
      ) : null}
    </>
  );
}

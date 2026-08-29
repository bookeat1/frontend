"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  buildTranslationPatch,
  translationDraftFrom,
  type GuideRoute,
  type GuideRouteInput,
} from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { useCityDictionary } from "@/lib/use-cities";
import { Button } from "../ui/Button";
import { CitySelectField } from "../ui/CitySelectField";
import { Field, TextInput } from "../ui/FormControls";
import { Modal } from "../ui/Modal";
import { TranslatedField, TranslationCoverageNote } from "../ui/TranslatedField";
import { guideErrorMessage } from "./guide-copy";

const copy = t.admin.gastroRoutes;

/** То же правило, что на сервере (usecase/gastroguide slugPattern): строчная
 * латиница, цифры, одиночные дефисы. Проверяем здесь ради сообщения, но не
 * доверяем — сервер отвергнет в любом случае. */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface GuideRouteWriteClient {
  createGuideRoute(input: GuideRouteInput): Promise<GuideRoute>;
  updateGuideRoute?(routeId: string, input: GuideRouteInput): Promise<GuideRoute>;
}

/**
 * Создание и правка ТЕКСТА прогулки.
 *
 * Публикации здесь нет намеренно — ровно как у статьи: сервер держит её
 * отдельными ручками, чтобы исправление опечатки не могло вывести маршрут в
 * приложение. Остановок здесь тоже нет: у новой прогулки их ещё некуда
 * складывать, а у существующей они правятся на её экране.
 */
export function GuideRouteFormModal({
  client,
  route,
  onClose,
  onSaved,
}: {
  client: GuideRouteWriteClient;
  route?: GuideRoute;
  onClose: () => void;
  onSaved: (saved: GuideRoute) => void;
}) {
  const isEdit = !!route;
  const [slug, setSlug] = useState(route?.slug ?? "");
  const [title, setTitle] = useState(route?.title ?? "");
  const [description, setDescription] = useState(route?.description ?? "");
  const [duration, setDuration] = useState(route?.duration_label ?? "");
  const [cover, setCover] = useState(route?.cover_image_url ?? "");
  const [city, setCity] = useState(route?.city ?? "");
  const [position, setPosition] = useState(String(route?.position ?? 0));
  // Переводы — частичный патч, как у остального контента: уходят только
  // изменённые языки, `ru` не уходит никогда.
  const [titleI18n, setTitleI18n] = useState(() => translationDraftFrom(route?.title_i18n));
  const [descriptionI18n, setDescriptionI18n] = useState(() =>
    translationDraftFrom(route?.description_i18n),
  );
  const [durationI18n, setDurationI18n] = useState(() =>
    translationDraftFrom(route?.duration_label_i18n),
  );
  const [formError, setFormError] = useState<string | null>(null);

  // Города — из справочника платформы, а не из списка в коде: тот же урок, что
  // и на форме статьи, где зашитый «Шымкент» делал сохранение невозможным.
  const cityDictionaryQuery = useCityDictionary();
  const cityDictionary = useMemo(() => cityDictionaryQuery.data ?? [], [cityDictionaryQuery.data]);

  const mutation = useMutation({
    mutationFn: (input: GuideRouteInput) =>
      isEdit && client.updateGuideRoute
        ? client.updateGuideRoute(route!.id, input)
        : client.createGuideRoute(input),
    onSuccess: onSaved,
    // Набранное не выбрасывается: окно остаётся открытым со всеми полями,
    // меняется только сообщение.
    onError: (error) => setFormError(guideErrorMessage(error).text),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Второе нажатие, пока первое в полёте, создало бы вторую прогулку с тем
    // же слагом и превратило успех в 409.
    if (mutation.isPending) return;
    setFormError(null);

    const cleanSlug = slug.trim().toLowerCase();
    if (!SLUG_RE.test(cleanSlug)) {
      setFormError(copy.slugInvalid);
      return;
    }
    if (!title.trim()) {
      setFormError(copy.titleRequired);
      return;
    }

    mutation.mutate({
      slug: cleanSlug,
      title: title.trim(),
      title_i18n: buildTranslationPatch(titleI18n, route?.title_i18n),
      description: description.trim(),
      description_i18n: buildTranslationPatch(descriptionI18n, route?.description_i18n),
      duration_label: duration.trim(),
      duration_label_i18n: buildTranslationPatch(durationI18n, route?.duration_label_i18n),
      // Пустое поле — «обложки нет», а не обложка с пустым адресом: на второе
      // приложение отрисует битую картинку.
      cover_image_url: cover.trim() || null,
      city: city || null,
      position: Number.parseInt(position, 10) || 0,
    });
  }

  return (
    <Modal title={isEdit ? copy.editTitle : copy.createTitle} onClose={onClose}>
      <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
        <TranslationCoverageNote
          fields={[
            { label: copy.fieldTitle, translations: titleI18n },
            { label: copy.fieldDescription, translations: descriptionI18n },
            { label: copy.fieldDuration, translations: durationI18n },
          ]}
        />
        <TranslatedField
          id="route-form-title"
          label={copy.fieldTitle}
          required
          maxLength={200}
          base={title}
          onBaseChange={setTitle}
          translations={titleI18n}
          onTranslationsChange={setTitleI18n}
          stored={route?.title_i18n}
        />
        <Field label={copy.fieldSlug} hint={copy.fieldSlugHint} required htmlFor="route-form-slug">
          <TextInput
            id="route-form-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={120}
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
        <TranslatedField
          id="route-form-description"
          label={copy.fieldDescription}
          multiline
          base={description}
          onBaseChange={setDescription}
          translations={descriptionI18n}
          onTranslationsChange={setDescriptionI18n}
          stored={route?.description_i18n}
        />
        <TranslatedField
          id="route-form-duration"
          label={copy.fieldDuration}
          hint={copy.fieldDurationHint}
          maxLength={60}
          base={duration}
          onBaseChange={setDuration}
          translations={durationI18n}
          onTranslationsChange={setDurationI18n}
          stored={route?.duration_label_i18n}
        />
        <Field label={copy.fieldCover} hint={copy.fieldCoverHint} htmlFor="route-form-cover">
          <TextInput
            id="route-form-cover"
            type="url"
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            spellCheck={false}
          />
        </Field>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <CitySelectField
            id="route-form-city"
            label={copy.fieldCity}
            dictionary={cityDictionary}
            loading={cityDictionaryQuery.isPending}
            failed={cityDictionaryQuery.isError}
            value={city}
            onChange={setCity}
            emptyOptionLabel={copy.cityAll}
          />
          <Field
            label={copy.fieldPosition}
            hint={copy.fieldPositionHint}
            htmlFor="route-form-position"
          >
            <TextInput
              id="route-form-position"
              type="number"
              inputMode="numeric"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </Field>
        </div>

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

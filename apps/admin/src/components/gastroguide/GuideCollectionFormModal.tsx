"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  buildTranslationPatch,
  translationDraftFrom,
  type GuideCollection,
  type GuideCollectionInput,
  type GuideCollectionKind,
} from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { useCityDictionary } from "@/lib/use-cities";
import { Button } from "../ui/Button";
import { CitySelectField } from "../ui/CitySelectField";
import { Field, TextInput } from "../ui/FormControls";
import { Modal } from "../ui/Modal";
import { TranslatedField, TranslationCoverageNote } from "../ui/TranslatedField";
import { guideErrorMessage } from "./guide-copy";

const copy = t.admin.gastroguide;

/** Same rule the server applies (usecase/gastroguide slugPattern): lowercase
 * latin, digits, single hyphens. Checked here for the message, never trusted —
 * the server refuses it anyway. */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface GuideCollectionWriteClient {
  createGuideCollection(input: GuideCollectionInput): Promise<GuideCollection>;
  updateGuideCollection?(id: string, input: GuideCollectionInput): Promise<GuideCollection>;
}

/**
 * Create / edit a collection's text.
 *
 * Publication is NOT here, on purpose: the server models it as separate
 * operations so fixing a typo can never take a collection live, and a form with
 * a status dropdown would put that decision back where it does not belong.
 *
 * ВИД ЗАПИСИ (`kind`) ТОЖЕ НЕ ВЫБИРАЕТСЯ РЕДАКТОРОМ. Он приходит с экрана, на
 * котором форма открыта: `/gastroguide` создаёт подборку, `/articles` —
 * статью. Выпадающий список означал бы «статью можно случайно создать в
 * гастрогиде», а именно эту путаницу разделение и убирает. При РЕДАКТИРОВАНИИ
 * берётся собственный вид записи, а не вид экрана: править запись с чужого
 * раздела нельзя, но переносить её между сущностями формой — тем более.
 */
export function GuideCollectionFormModal({
  client,
  collection,
  kind = "collection",
  onClose,
  onSaved,
}: {
  client: GuideCollectionWriteClient;
  collection?: GuideCollection;
  /** Вид создаваемой записи. При редактировании игнорируется в пользу
   * `collection.kind`. */
  kind?: GuideCollectionKind;
  onClose: () => void;
  onSaved: (saved: GuideCollection) => void;
}) {
  const isEdit = !!collection;
  const effectiveKind = collection?.kind ?? kind;
  const kindCopy = copy.kinds[effectiveKind];
  const [slug, setSlug] = useState(collection?.slug ?? "");
  const [title, setTitle] = useState(collection?.title ?? "");
  const [subtitle, setSubtitle] = useState(collection?.subtitle ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [cover, setCover] = useState(collection?.cover_image_url ?? "");
  const [city, setCity] = useState(collection?.city ?? "");
  const [position, setPosition] = useState(String(collection?.position ?? 0));
  // Переводы. Ручки гида принимают тот же ЧАСТИЧНЫЙ формат, что и остальной
  // контент (бэкенд `1252c4c`): уходят только изменённые языки, чужие локали
  // (`ko`/`zh` из старого импорта) в патч не попадают вовсе, и сервер сохраняет
  // их сам.
  const [titleI18n, setTitleI18n] = useState(() => translationDraftFrom(collection?.title_i18n));
  const [subtitleI18n, setSubtitleI18n] = useState(() =>
    translationDraftFrom(collection?.subtitle_i18n),
  );
  const [descriptionI18n, setDescriptionI18n] = useState(() =>
    translationDraftFrom(collection?.description_i18n),
  );
  const [formError, setFormError] = useState<string | null>(null);

  // Города — из справочника платформы, а не из списка в коде: пока он был
  // зашит здесь, добавленный на бэкенде город редактор увидеть не мог, а
  // лишний (когда-то «Шымкент») делал сохранение невозможным — 422 на
  // неизвестный город, без сообщения в панели. Справочник не ответил —
  // CitySelectField сам откатывается на ввод текстом, форма не запирается.
  const cityDictionaryQuery = useCityDictionary();
  const cityDictionary = useMemo(
    () => cityDictionaryQuery.data ?? [],
    [cityDictionaryQuery.data],
  );

  const mutation = useMutation({
    mutationFn: (input: GuideCollectionInput) =>
      isEdit && client.updateGuideCollection
        ? client.updateGuideCollection(collection!.id, input)
        : client.createGuideCollection(input),
    onSuccess: onSaved,
    // The editor's typing is never thrown away on a failure: the modal stays
    // open with every field as they left it, and only the message changes.
    onError: (error) => setFormError(guideErrorMessage(error).text),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Guard against the double submit: a second press while the first is in
    // flight would create a second collection with the same slug and turn a
    // successful action into a 409.
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
      kind: effectiveKind,
      title: title.trim(),
      title_i18n: buildTranslationPatch(titleI18n, collection?.title_i18n),
      subtitle: subtitle.trim(),
      subtitle_i18n: buildTranslationPatch(subtitleI18n, collection?.subtitle_i18n),
      description: description.trim(),
      description_i18n: buildTranslationPatch(descriptionI18n, collection?.description_i18n),
      // An empty box means "no cover", not a cover whose address is the empty
      // string — the app would render a broken image for the latter.
      cover_image_url: cover.trim() || null,
      city: city || null,
      position: Number.parseInt(position, 10) || 0,
    });
  }

  return (
    <Modal title={isEdit ? kindCopy.editTitle : kindCopy.createTitle} onClose={onClose}>
      <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
        <TranslationCoverageNote
          fields={[
            { label: copy.fieldTitle, translations: titleI18n },
            { label: copy.fieldSubtitle, translations: subtitleI18n },
            { label: copy.fieldDescription, translations: descriptionI18n },
          ]}
        />
        <TranslatedField
          id="guide-form-title"
          label={copy.fieldTitle}
          required
          maxLength={200}
          base={title}
          onBaseChange={setTitle}
          translations={titleI18n}
          onTranslationsChange={setTitleI18n}
          stored={collection?.title_i18n}
        />
        <Field label={copy.fieldSlug} hint={copy.fieldSlugHint} required htmlFor="guide-form-slug">
          <TextInput
            id="guide-form-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={120}
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
        <TranslatedField
          id="guide-form-subtitle"
          label={copy.fieldSubtitle}
          maxLength={200}
          base={subtitle}
          onBaseChange={setSubtitle}
          translations={subtitleI18n}
          onTranslationsChange={setSubtitleI18n}
          stored={collection?.subtitle_i18n}
        />
        <TranslatedField
          id="guide-form-description"
          label={copy.fieldDescription}
          multiline
          base={description}
          onBaseChange={setDescription}
          translations={descriptionI18n}
          onTranslationsChange={setDescriptionI18n}
          stored={collection?.description_i18n}
        />
        <Field label={copy.fieldCover} hint={copy.fieldCoverHint} htmlFor="guide-form-cover">
          <TextInput
            id="guide-form-cover"
            type="url"
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            spellCheck={false}
          />
        </Field>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <CitySelectField
            id="guide-form-city"
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
            htmlFor="guide-form-position"
          >
            <TextInput
              id="guide-form-position"
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

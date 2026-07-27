"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { GuideCollection, GuideCollectionInput } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { Button } from "../ui/Button";
import { Field, Select, TextArea, TextInput } from "../ui/FormControls";
import { Modal } from "../ui/Modal";
import { guideErrorMessage } from "./guide-copy";

const copy = t.admin.gastroguide;

/** Cities the platform knows (domain.City). Kept as a literal list because the
 * catalog stores the city as a VARCHAR and there is no cities endpoint the panel
 * could read them from — GET /cities returns the guest-facing city cards, not
 * the enum. */
const CITIES = ["Астана", "Алматы", "Шымкент"];

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
 */
export function GuideCollectionFormModal({
  client,
  collection,
  onClose,
  onSaved,
}: {
  client: GuideCollectionWriteClient;
  collection?: GuideCollection;
  onClose: () => void;
  onSaved: (saved: GuideCollection) => void;
}) {
  const isEdit = !!collection;
  const [slug, setSlug] = useState(collection?.slug ?? "");
  const [title, setTitle] = useState(collection?.title ?? "");
  const [subtitle, setSubtitle] = useState(collection?.subtitle ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [cover, setCover] = useState(collection?.cover_image_url ?? "");
  const [city, setCity] = useState(collection?.city ?? "");
  const [position, setPosition] = useState(String(collection?.position ?? 0));
  const [formError, setFormError] = useState<string | null>(null);

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
      title: title.trim(),
      subtitle: subtitle.trim(),
      description: description.trim(),
      // An empty box means "no cover", not a cover whose address is the empty
      // string — the app would render a broken image for the latter.
      cover_image_url: cover.trim() || null,
      city: city || null,
      position: Number.parseInt(position, 10) || 0,
    });
  }

  return (
    <Modal title={isEdit ? copy.editTitle : copy.createTitle} onClose={onClose}>
      <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
        <Field label={copy.fieldTitle} required htmlFor="guide-form-title">
          <TextInput
            id="guide-form-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </Field>
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
        <Field label={copy.fieldSubtitle} htmlFor="guide-form-subtitle">
          <TextInput
            id="guide-form-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label={copy.fieldDescription} htmlFor="guide-form-description">
          <TextArea
            id="guide-form-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
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
          <Field label={copy.fieldCity} htmlFor="guide-form-city">
            <Select id="guide-form-city" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">{copy.cityAll}</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
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

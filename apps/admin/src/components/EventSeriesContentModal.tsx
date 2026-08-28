"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { recurrenceToInput, seriesContentDiff, type EventSeriesRow } from "@/lib/event-series";
import { t } from "@/lib/i18n";
import { formatTags, parseTags } from "@/lib/tags";
import { Button } from "./ui/Button";
import { Field, TextArea, TextInput } from "./ui/FormControls";
import { ImageUploadField } from "./ui/ImageUploadField";
import { Modal } from "./ui/Modal";

/**
 * Общий контент СЕРИИ: название, описание, место, обложка, метки — один раз на
 * все её даты (migration 0097).
 *
 * ЗАЧЕМ. «Афиша Greek Party» — восемнадцать строк в `events`, и до 0097 хозяин
 * выбирал ту же картинку и вставлял тот же текст восемнадцать раз. Теперь это
 * одна форма: `PUT /admin/event-recurrences/:id` правит правило и разливает
 * контент по всем незакончившимся датам.
 *
 * ЦЕНА, которую человек обязан видеть ДО нажатия, а не узнавать постфактум:
 * правка контента снимает уже одобренные даты с главной (approved →
 * not_submitted), и серию придётся отправить на одобрение заново. Поэтому
 * предупреждение висит в форме постоянно, а не всплывает в подтверждении —
 * подтверждение только повторяет его, и только когда контент реально изменён.
 *
 * Расписания здесь нет намеренно: «когда» и «что написано» — разные решения с
 * разными последствиями, и первое дат с главной не снимает.
 */
export function EventSeriesContentModal({
  row,
  onClose,
  onSaved,
}: {
  row: EventSeriesRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const rule = row.rule;
  const [title, setTitle] = useState(rule?.title ?? row.title);
  const [description, setDescription] = useState(rule?.description ?? "");
  const [venue, setVenue] = useState(rule?.venue ?? "");
  const [cover, setCover] = useState(rule?.cover_image_url ?? "");
  const [tags, setTags] = useState(formatTags(rule?.tags));
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      // PUT правила — ПОЛНАЯ ЗАМЕНА: тело собирает `recurrenceToInput`, иначе
      // расписание, билеты и правила возврата будут стёрты этим сохранением.
      apiClient.updateEventRecurrence(
        rule!.id,
        recurrenceToInput(rule!, {
          title: title.trim(),
          description: description.trim(),
          venue: venue.trim(),
          cover_image_url: cover.trim() || null,
          tags: parseTags(tags),
        }),
      ),
    onSuccess: onSaved,
    onError: () => setFormError(t.admin.events.series.contentSaveFailed),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending || !rule) return;
    setFormError(null);
    if (!title.trim()) {
      setFormError(t.admin.common.required);
      return;
    }
    const changed = seriesContentDiff(rule, {
      title: title.trim(),
      description: description.trim(),
      venue: venue.trim(),
      cover_image_url: cover.trim() || null,
      tags: parseTags(tags),
    });
    // Ничего не изменилось — не пугаем человека последствиями, которых не будет.
    if (changed.length > 0 && !window.confirm(t.admin.events.series.contentConfirm(row.title))) {
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal title={t.admin.events.series.contentModalTitle(row.title)} onClose={onClose}>
      {!rule ? (
        <div className="flex flex-col gap-md">
          <p className="text-sm text-text-muted">{t.admin.events.series.contentNoRule}</p>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t.admin.common.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
          <p className="text-[13px] text-text-muted">{t.admin.events.series.contentHint}</p>

          <Field label={t.admin.events.fieldTitle} required>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </Field>
          <Field label={t.admin.events.fieldDescription}>
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label={t.admin.events.fieldVenue} hint={t.admin.events.fieldVenueHint}>
            <TextInput value={venue} onChange={(e) => setVenue(e.target.value)} />
          </Field>
          <Field label={t.admin.events.fieldTags} hint={t.admin.events.fieldTagsHint}>
            <TextInput value={tags} onChange={(e) => setTags(e.target.value)} maxLength={300} />
          </Field>
          <ImageUploadField label={t.admin.events.fieldCover} value={cover} onChange={setCover} />

          {/* Предупреждение видно ВСЕГДА, ещё до нажатия «Сохранить». */}
          <div
            role="note"
            className="flex flex-col gap-xxs rounded-card bg-amber-50 px-md py-sm text-amber-900"
          >
            <span className="text-[13px] font-semibold">
              {t.admin.events.series.contentWarningTitle}
            </span>
            <span className="text-[12px]">{t.admin.events.series.contentWarning}</span>
          </div>

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
      )}
    </Modal>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildTranslationPatch,
  translationDraftFrom,
  type AdminListParams,
  type AdminPromo,
  type ApiPage,
  type PromoInput,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { formatDateTime, isoToLocalInput, localInputToIso } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useCityDictionary } from "@/lib/use-cities";
import { useIsPlatformAdmin } from "@/lib/use-venue-catalog";

import { EmptyState, ErrorState, LoadingState } from "../StateViews";
import { Button } from "../ui/Button";
import { CitySelectField } from "../ui/CitySelectField";
import { CheckboxRow, Field, TextInput } from "../ui/FormControls";
import { TranslatedField, TranslationCoverageNote } from "../ui/TranslatedField";
import { ImageGalleryField } from "../ui/ImageGalleryField";
import { ImageUploadField } from "../ui/ImageUploadField";
import { Modal } from "../ui/Modal";
import { PublishBadge } from "../ui/PublishBadge";
import { copy, platformContentErrorText } from "./copy";

/**
 * «Акции платформы» — акции, у которых НЕТ заведения (backend PR #103,
 * migration 0085).
 *
 * Почему отдельный экран, а не флажок в «Акциях» заведения: тот экран целиком
 * висит на `restaurant.id` из контекста авторизации, а здесь заведения нет по
 * определению. Совмещать их значило бы завести в форме ветку «а если заведения
 * нет» в каждом втором поле.
 *
 * Разъезд ручек, который стоит помнить: СОЗДАНИЕ идёт в
 * `POST /admin/platform/promos` (без id заведения в пути — подделать владельца
 * нечем), а правка, публикация и удаление — в обычные `/admin/promos/:id`,
 * которые сначала находят запись и авторизуют по её владельцу.
 *
 * Колонки с заведением в списке нет и быть не может.
 */
export interface PlatformPromoClient {
  listPlatformPromos(params?: AdminListParams): Promise<ApiPage<AdminPromo>>;
  createPlatformPromo(input: PromoInput): Promise<AdminPromo>;
  updatePromo(promoId: string, input: PromoInput): Promise<AdminPromo>;
  deletePromo(promoId: string): Promise<void>;
}

const QUERY_KEY = ["platform-promos"] as const;

/** Полный payload из существующей акции — публикация и скрытие это тот же
 * PUT, у которого поменян только статус. Город и галерея переносятся ЯВНО:
 * запись полностью заменяет запись, и потерянное здесь поле сервер очистит. */
function promoToInput(p: AdminPromo, status: AdminPromo["status"] = p.status): PromoInput {
  return {
    title: p.title,
    description: p.description,
    starts_at: p.starts_at,
    ends_at: p.ends_at,
    terms: p.terms ?? "",
    cover_image_url: p.cover_image_url ?? null,
    discount_percent: p.discount_percent ?? null,
    status,
    images: p.images ?? [],
    city: p.city ?? null,
  };
}

export function PlatformPromosView({ client = apiClient }: { client?: PlatformPromoClient }) {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) {
    return <EmptyState title={copy.adminOnlyTitle} description={copy.adminOnlyDescription} />;
  }
  return <PlatformPromos client={client} />;
}

function PlatformPromos({ client }: { client: PlatformPromoClient }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminPromo | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => client.listPlatformPromos({ per_page: 100 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const statusMutation = useMutation({
    mutationFn: ({ promo, status }: { promo: AdminPromo; status: AdminPromo["status"] }) =>
      client.updatePromo(promo.id, promoToInput(promo, status)),
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: (error) => setActionError(platformContentErrorText(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (promo: AdminPromo) => client.deletePromo(promo.id),
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
          <h1 className="text-xl font-bold text-text">{copy.promosTitle}</h1>
          <p className="mt-xxs max-w-[60ch] text-sm text-text-muted">{copy.promosSubtitle}</p>
        </div>
        <Button onClick={() => setCreating(true)}>{copy.createPromo}</Button>
      </header>

      {actionError ? (
        <p role="alert" className="break-words text-sm text-brand">
          {actionError}
        </p>
      ) : null}

      {listQuery.isPending ? (
        <LoadingState title={copy.loadingPromos} />
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={copy.emptyPromosTitle} description={copy.emptyPromosDescription} />
      ) : (
        <>
          <p className="text-sm text-text-muted">{copy.total(listQuery.data.total)}</p>
          <ul className="flex flex-col gap-sm">
            {items.map((promo) => {
              const pendingStatus =
                statusMutation.isPending && statusMutation.variables?.promo.id === promo.id;
              const pendingDelete =
                deleteMutation.isPending && deleteMutation.variables?.id === promo.id;
              return (
                <li
                  key={promo.id}
                  className="flex flex-col gap-md rounded-card bg-surface p-lg sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-sm">
                      <span className="break-words text-sm font-semibold text-text">
                        {promo.title}
                      </span>
                      <PublishBadge status={promo.status} />
                      <CityChip city={promo.city} />
                    </div>
                    <p className="mt-xxs text-[13px] text-text-muted">
                      {formatDateTime(promo.starts_at)} — {formatDateTime(promo.ends_at)}
                    </p>
                    {promo.discount_percent != null ? (
                      <p className="mt-xxs text-[12px] text-text-muted">
                        −{promo.discount_percent}%
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-xs sm:justify-end">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(promo)}>
                      {t.admin.common.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant={promo.status === "published" ? "secondary" : "primary"}
                      disabled={pendingStatus || pendingDelete}
                      loading={pendingStatus}
                      onClick={() => {
                        setActionError(null);
                        statusMutation.mutate({
                          promo,
                          status: promo.status === "published" ? "hidden" : "published",
                        });
                      }}
                    >
                      {promo.status === "published" ? t.admin.promos.hide : t.admin.promos.publish}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pendingStatus || pendingDelete}
                      loading={pendingDelete}
                      onClick={() => {
                        if (!window.confirm(copy.confirmDelete)) return;
                        setActionError(null);
                        deleteMutation.mutate(promo);
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
        <PlatformPromoFormModal
          client={client}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void invalidate();
          }}
        />
      ) : null}

      {editing ? (
        <PlatformPromoFormModal
          client={client}
          promo={editing}
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

/** Город записи одной строкой. Пусто — это не «не заполнено», а «во всех
 * городах», и молчать об этом нельзя: разница видна гостю. */
export function CityChip({ city }: { city?: string | null }) {
  return (
    <span className="rounded-pill bg-chip px-sm py-xxs text-[11px] text-text-muted">
      {city && city.trim() ? city : copy.cityAllBadge}
    </span>
  );
}

export function PlatformPromoFormModal({
  client,
  promo,
  onClose,
  onSaved,
}: {
  client: Pick<PlatformPromoClient, "createPlatformPromo" | "updatePromo">;
  promo?: AdminPromo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!promo;
  const [title, setTitle] = useState(promo?.title ?? "");
  const [description, setDescription] = useState(promo?.description ?? "");
  const [startsAt, setStartsAt] = useState(isoToLocalInput(promo?.starts_at));
  const [endsAt, setEndsAt] = useState(isoToLocalInput(promo?.ends_at));
  const [terms, setTerms] = useState(promo?.terms ?? "");
  // Переводы: русский текст остаётся в обычных полях, сюда едут kk/en.
  const [titleI18n, setTitleI18n] = useState(() => translationDraftFrom(promo?.title_i18n));
  const [descriptionI18n, setDescriptionI18n] = useState(() =>
    translationDraftFrom(promo?.description_i18n),
  );
  const [termsI18n, setTermsI18n] = useState(() => translationDraftFrom(promo?.terms_i18n));
  const [cover, setCover] = useState(promo?.cover_image_url ?? "");
  const [gallery, setGallery] = useState<string[]>(promo?.images ?? []);
  const [discount, setDiscount] = useState(
    promo?.discount_percent != null ? String(promo.discount_percent) : "",
  );
  const [city, setCity] = useState(promo?.city ?? "");
  const [publishNow, setPublishNow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const cityQuery = useCityDictionary();
  const cityDictionary = useMemo(() => cityQuery.data ?? [], [cityQuery.data]);

  const mutation = useMutation({
    mutationFn: (input: PromoInput) =>
      isEdit ? client.updatePromo(promo!.id, input) : client.createPlatformPromo(input),
    onSuccess: () => {
      if (!isEdit) trackEvent("content_created", { type: "promo" });
      onSaved();
    },
    // Введённое редактором не выбрасывается: модалка остаётся открытой со
    // всеми полями, меняется только сообщение.
    onError: (error) => setFormError(platformContentErrorText(error)),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Второе нажатие, пока летит первое, создало бы вторую акцию.
    if (mutation.isPending) return;
    setFormError(null);

    const startsIso = localInputToIso(startsAt);
    const endsIso = localInputToIso(endsAt);
    if (!title.trim() || !startsIso || !endsIso) {
      setFormError(t.admin.common.required);
      return;
    }
    if (new Date(endsIso) <= new Date(startsIso)) {
      setFormError(t.admin.promos.endBeforeStart);
      return;
    }

    const trimmedDiscount = discount.trim();
    let discountValue: number | null = null;
    if (trimmedDiscount) {
      const parsed = Number(trimmedDiscount);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        setFormError(t.admin.promos.discountRange);
        return;
      }
      discountValue = parsed;
    }

    mutation.mutate({
      title: title.trim(),
      title_i18n: buildTranslationPatch(titleI18n, promo?.title_i18n),
      description: description.trim(),
      description_i18n: buildTranslationPatch(descriptionI18n, promo?.description_i18n),
      starts_at: startsIso,
      ends_at: endsIso,
      terms: terms.trim(),
      terms_i18n: buildTranslationPatch(termsI18n, promo?.terms_i18n),
      cover_image_url: cover.trim() || null,
      images: gallery,
      discount_percent: discountValue,
      status: isEdit ? promo!.status : publishNow ? "published" : "draft",
      // Пустой выбор — осмысленное «во всех городах», а не «не заполнено».
      city: city.trim() || null,
    });
  }

  return (
    <Modal title={isEdit ? copy.editPromoTitle : copy.createPromoTitle} onClose={onClose}>
      <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
        <TranslationCoverageNote
          fields={[
            { label: t.admin.promos.fieldTitle, translations: titleI18n },
            { label: t.admin.promos.fieldDescription, translations: descriptionI18n },
            { label: t.admin.promos.fieldTerms, translations: termsI18n },
          ]}
        />
        <TranslatedField
          id="platform-promo-title"
          label={t.admin.promos.fieldTitle}
          required
          maxLength={200}
          base={title}
          onBaseChange={setTitle}
          translations={titleI18n}
          onTranslationsChange={setTitleI18n}
          stored={promo?.title_i18n}
        />
        <TranslatedField
          id="platform-promo-description"
          label={t.admin.promos.fieldDescription}
          multiline
          base={description}
          onBaseChange={setDescription}
          translations={descriptionI18n}
          onTranslationsChange={setDescriptionI18n}
          stored={promo?.description_i18n}
        />
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <Field label={t.admin.promos.fieldStartsAt} required htmlFor="platform-promo-starts">
            <TextInput
              id="platform-promo-starts"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
          <Field label={t.admin.promos.fieldEndsAt} required htmlFor="platform-promo-ends">
            <TextInput
              id="platform-promo-ends"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
        </div>
        <CitySelectField
          id="platform-promo-city"
          dictionary={cityDictionary}
          loading={cityQuery.isPending}
          failed={cityQuery.isError}
          value={city}
          onChange={setCity}
          emptyOptionLabel={copy.cityAll}
        />
        <TranslatedField
          id="platform-promo-terms"
          label={t.admin.promos.fieldTerms}
          hint={t.admin.promos.fieldTermsHint}
          multiline
          base={terms}
          onBaseChange={setTerms}
          translations={termsI18n}
          onTranslationsChange={setTermsI18n}
          stored={promo?.terms_i18n}
        />
        <ImageUploadField
          label={t.admin.promos.fieldCover}
          hint={t.admin.promos.fieldCoverHint}
          value={cover}
          onChange={setCover}
        />
        <ImageGalleryField
          label={t.admin.gallery.label}
          hint={t.admin.gallery.hint}
          value={gallery}
          onChange={setGallery}
        />
        <Field
          label={t.admin.promos.fieldDiscount}
          hint={t.admin.promos.fieldDiscountHint}
          htmlFor="platform-promo-discount"
        >
          <TextInput
            id="platform-promo-discount"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </Field>

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

"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminPromo, FeedItemState, PromoInput } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, isoToLocalInput, localInputToIso } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { FeedControl } from "./ui/FeedControl";
import { Field, TextArea, TextInput, CheckboxRow } from "./ui/FormControls";
import { ImageUploadField } from "./ui/ImageUploadField";
import { Modal } from "./ui/Modal";
import { PublishBadge } from "./ui/PublishBadge";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";

function promoToInput(p: AdminPromo, status = p.status): PromoInput {
  return {
    title: p.title,
    description: p.description,
    starts_at: p.starts_at,
    ends_at: p.ends_at,
    terms: p.terms ?? "",
    cover_image_url: p.cover_image_url ?? null,
    discount_percent: p.discount_percent ?? null,
    status,
  };
}

export function PromosView() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant!.id;
  const queryClient = useQueryClient();
  const queryKey = ["promos", restaurantId] as const;

  const [editing, setEditing] = useState<AdminPromo | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey,
    queryFn: () => apiClient.listPromos(restaurantId, { per_page: 100 }),
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
      if (st.kind === "promo") map.set(st.id, st);
    }
    return map;
  }, [feedQuery.data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const statusMutation = useMutation({
    mutationFn: ({ promo, status }: { promo: AdminPromo; status: AdminPromo["status"] }) =>
      apiClient.updatePromo(promo.id, promoToInput(promo, status)),
    onSuccess: invalidate,
    onError: () => setActionError(t.admin.common.saveFailed),
  });

  const deleteMutation = useMutation({
    mutationFn: (promo: AdminPromo) => apiClient.deletePromo(promo.id),
    onSuccess: invalidate,
    onError: () => setActionError(t.admin.common.deleteFailed),
  });

  const items = listQuery.data?.items ?? [];

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <header className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="text-xl font-bold text-text">{t.admin.promos.title}</h1>
        <Button onClick={() => setCreating(true)}>{t.admin.promos.create}</Button>
      </header>

      {actionError ? (
        <p role="alert" className="rounded-card bg-rose-50 px-md py-sm text-sm text-rose-700">
          {actionError}
        </p>
      ) : null}

      {listQuery.isPending ? (
        <LoadingState title={t.admin.promos.loadingTitle} />
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t.admin.promos.emptyTitle}
          description={t.admin.promos.emptyDescription}
        />
      ) : (
        <>
          <p className="text-sm text-text-muted">{t.admin.promos.total(listQuery.data.total)}</p>
          <ul className="flex flex-col gap-sm">
            {items.map((p) => {
              const busy =
                (statusMutation.isPending && statusMutation.variables?.promo.id === p.id) ||
                (deleteMutation.isPending && deleteMutation.variables?.id === p.id);
              return (
                <li key={p.id} className="flex flex-col gap-md rounded-card bg-surface p-lg">
                  <div className="flex flex-col gap-md sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-sm">
                      <span className="break-words text-sm font-semibold text-text">{p.title}</span>
                      <PublishBadge status={p.status} />
                    </div>
                    {p.description ? (
                      <p className="mt-xxs break-words text-[13px] text-text-muted">
                        {p.description}
                      </p>
                    ) : null}
                    <p className="mt-xxs text-[13px] text-text-muted">
                      {formatDateTime(p.starts_at)} — {formatDateTime(p.ends_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-xs sm:justify-end">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>
                      {t.admin.common.edit}
                    </Button>
                    {p.status === "published" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        loading={statusMutation.isPending && statusMutation.variables?.promo.id === p.id}
                        onClick={() => {
                          setActionError(null);
                          statusMutation.mutate({ promo: p, status: "hidden" });
                        }}
                      >
                        {t.admin.promos.hide}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busy}
                        loading={statusMutation.isPending && statusMutation.variables?.promo.id === p.id}
                        onClick={() => {
                          setActionError(null);
                          statusMutation.mutate({ promo: p, status: "published" });
                        }}
                      >
                        {t.admin.promos.publish}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      loading={deleteMutation.isPending && deleteMutation.variables?.id === p.id}
                      onClick={() => {
                        if (!window.confirm(t.admin.common.confirmDelete)) return;
                        setActionError(null);
                        deleteMutation.mutate(p);
                      }}
                    >
                      {t.admin.common.delete}
                    </Button>
                  </div>
                  </div>

                  <FeedControl
                    restaurantId={restaurantId}
                    kind="promo"
                    itemId={p.id}
                    state={feedByItemId.get(p.id)}
                    listQueryKey={queryKey}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}

      {creating ? (
        <PromoFormModal
          restaurantId={restaurantId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void invalidate();
          }}
        />
      ) : null}

      {editing ? (
        <PromoFormModal
          restaurantId={restaurantId}
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

function PromoFormModal({
  restaurantId,
  promo,
  onClose,
  onSaved,
}: {
  restaurantId: string;
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
  const [coverImageUrl, setCoverImageUrl] = useState(promo?.cover_image_url ?? "");
  const [discountPercent, setDiscountPercent] = useState(
    promo?.discount_percent != null ? String(promo.discount_percent) : "",
  );
  const [publishNow, setPublishNow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: PromoInput) =>
      isEdit ? apiClient.updatePromo(promo!.id, input) : apiClient.createPromo(restaurantId, input),
    onSuccess: () => {
      if (!isEdit) trackEvent("content_created", { type: "promo" });
      onSaved();
    },
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
      setFormError(t.admin.promos.endBeforeStart);
      return;
    }

    const discountTrimmed = discountPercent.trim();
    let discount: number | null = null;
    if (discountTrimmed) {
      const parsed = Number(discountTrimmed);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        setFormError(t.admin.promos.discountRange);
        return;
      }
      discount = parsed;
    }

    const cover = coverImageUrl.trim();
    const status = isEdit ? promo!.status : publishNow ? "published" : "draft";
    mutation.mutate({
      title: title.trim(),
      description: description.trim(),
      starts_at: startsIso,
      ends_at: endsIso,
      terms: terms.trim(),
      cover_image_url: cover || null,
      discount_percent: discount,
      status,
    });
  }

  return (
    <Modal title={isEdit ? t.admin.promos.editTitle : t.admin.promos.createTitle} onClose={onClose}>
      <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
        <Field label={t.admin.promos.fieldTitle} required>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </Field>
        <Field label={t.admin.promos.fieldDescription}>
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <Field label={t.admin.promos.fieldStartsAt} required>
            <TextInput
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
          <Field label={t.admin.promos.fieldEndsAt} required>
            <TextInput
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t.admin.promos.fieldTerms} hint={t.admin.promos.fieldTermsHint}>
          <TextArea value={terms} onChange={(e) => setTerms(e.target.value)} />
        </Field>
        <ImageUploadField
          label={t.admin.promos.fieldCover}
          hint={t.admin.promos.fieldCoverHint}
          value={coverImageUrl}
          onChange={setCoverImageUrl}
        />
        <Field label={t.admin.promos.fieldDiscount} hint={t.admin.promos.fieldDiscountHint}>
          <TextInput
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
          />
        </Field>

        {!isEdit ? (
          <CheckboxRow
            label={t.admin.promos.publishNow}
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

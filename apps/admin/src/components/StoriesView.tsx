"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Story, StoryInput } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { moveItem } from "@/lib/reorder";
import { Button } from "./ui/Button";
import { CheckboxRow, Field, TextArea } from "./ui/FormControls";
import { ImageUploadField } from "./ui/ImageUploadField";
import { Modal } from "./ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";

function StoryBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-pill px-md py-xxs text-[12px] font-medium ${
        active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
      }`}
    >
      {active ? t.admin.stories.badgeActive : t.admin.stories.badgeInactive}
    </span>
  );
}

export function StoriesView() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant!.id;
  const queryClient = useQueryClient();
  const queryKey = ["stories", restaurantId] as const;

  const [editing, setEditing] = useState<Story | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey,
    queryFn: () => apiClient.listStories(restaurantId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  // Always render in the server's intended order, whatever order the array
  // arrives in, so the «выше/ниже» arrows act on what the operator sees.
  const items = useMemo(
    () => [...(listQuery.data ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [listQuery.data],
  );
  const orderedIds = useMemo(() => items.map((s) => s.id), [items]);

  const toggleMutation = useMutation({
    mutationFn: (story: Story) =>
      apiClient.updateStory(story.id, { is_active: !story.is_active }),
    onSuccess: invalidate,
    onError: () => setActionError(t.admin.common.saveFailed),
  });

  const deleteMutation = useMutation({
    mutationFn: (story: Story) => apiClient.deleteStory(story.id),
    onSuccess: invalidate,
    onError: () => setActionError(t.admin.common.deleteFailed),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => apiClient.reorderStories(restaurantId, ids),
    onSuccess: invalidate,
    onError: () => setActionError(t.admin.stories.reorderFailed),
  });

  function move(index: number, direction: -1 | 1) {
    if (reorderMutation.isPending) return;
    const next = moveItem(orderedIds, index, direction);
    // moveItem returns an unchanged copy at the edges — don't fire a no-op call.
    if (next.every((id, i) => id === orderedIds[i])) return;
    setActionError(null);
    reorderMutation.mutate(next);
  }

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <header className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="text-xl font-bold text-text">{t.admin.stories.title}</h1>
        <Button onClick={() => setCreating(true)}>{t.admin.stories.create}</Button>
      </header>

      <p className="rounded-card bg-surface px-md py-sm text-sm text-text-muted">
        {t.admin.stories.hint}
      </p>

      {actionError ? (
        <p role="alert" className="rounded-card bg-rose-50 px-md py-sm text-sm text-rose-700">
          {actionError}
        </p>
      ) : null}

      {listQuery.isPending ? (
        <LoadingState title={t.admin.stories.loadingTitle} />
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t.admin.stories.emptyTitle}
          description={t.admin.stories.emptyDescription}
        />
      ) : (
        <>
          <p className="text-sm text-text-muted">{t.admin.stories.total(items.length)}</p>
          <ul className="flex flex-col gap-sm">
            {items.map((s, index) => {
              const busy =
                (toggleMutation.isPending && toggleMutation.variables?.id === s.id) ||
                (deleteMutation.isPending && deleteMutation.variables?.id === s.id) ||
                reorderMutation.isPending;
              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-md rounded-card bg-surface p-lg sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex min-w-0 gap-md">
                    {/* Operator-pasted/uploaded URL is not a build-time asset — a
                        plain <img> with a graceful fallback is the right tool. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.image_url}
                      alt=""
                      className="h-20 w-16 shrink-0 rounded-card border border-hairline bg-chip object-cover"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-sm">
                        <span className="text-sm font-semibold text-text">#{s.sort_order}</span>
                        <StoryBadge active={s.is_active} />
                      </div>
                      {s.caption ? (
                        <p className="mt-xxs break-words text-[13px] text-text-muted">
                          {s.caption}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-xs sm:justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy || index === 0}
                      aria-label={t.admin.stories.moveUpLabel}
                      onClick={() => move(index, -1)}
                    >
                      {t.admin.stories.moveUp}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy || index === items.length - 1}
                      aria-label={t.admin.stories.moveDownLabel}
                      onClick={() => move(index, 1)}
                    >
                      {t.admin.stories.moveDown}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>
                      {t.admin.common.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant={s.is_active ? "ghost" : "primary"}
                      disabled={busy}
                      loading={toggleMutation.isPending && toggleMutation.variables?.id === s.id}
                      onClick={() => {
                        setActionError(null);
                        toggleMutation.mutate(s);
                      }}
                    >
                      {s.is_active ? t.admin.stories.deactivate : t.admin.stories.activate}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      loading={deleteMutation.isPending && deleteMutation.variables?.id === s.id}
                      onClick={() => {
                        if (!window.confirm(t.admin.common.confirmDelete)) return;
                        setActionError(null);
                        deleteMutation.mutate(s);
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
        <StoryFormModal
          restaurantId={restaurantId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void invalidate();
          }}
        />
      ) : null}

      {editing ? (
        <StoryFormModal
          restaurantId={restaurantId}
          story={editing}
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

function StoryFormModal({
  restaurantId,
  story,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  story?: Story;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!story;
  const [imageUrl, setImageUrl] = useState(story?.image_url ?? "");
  const [caption, setCaption] = useState(story?.caption ?? "");
  const [isActive, setIsActive] = useState(story?.is_active ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: StoryInput) =>
      isEdit
        ? apiClient.updateStory(story!.id, input)
        : apiClient.createStory(restaurantId, input),
    onSuccess: onSaved,
    onError: () => setFormError(t.admin.common.saveFailed),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;
    setFormError(null);

    const image = imageUrl.trim();
    if (!image) {
      setFormError(t.admin.stories.imageRequired);
      return;
    }

    const trimmedCaption = caption.trim();
    mutation.mutate({
      image_url: image,
      caption: trimmedCaption || null,
      is_active: isActive,
    });
  }

  return (
    <Modal
      title={isEdit ? t.admin.stories.editTitle : t.admin.stories.createTitle}
      onClose={onClose}
    >
      <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
        <ImageUploadField
          label={t.admin.stories.fieldImage}
          hint={t.admin.stories.fieldImageHint}
          value={imageUrl}
          onChange={setImageUrl}
        />
        <Field label={t.admin.stories.fieldCaption} hint={t.admin.stories.fieldCaptionHint}>
          <TextArea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} />
        </Field>
        <CheckboxRow
          label={t.admin.stories.fieldActive}
          checked={isActive}
          onChange={setIsActive}
        />

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

"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GuideCategory, GuideCategoryInput } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "../ui/Button";
import { CheckboxRow, Field, TextInput } from "../ui/FormControls";
import { Modal } from "../ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "../StateViews";
import { guideErrorMessage } from "./guide-copy";

const copy = t.admin.gastroguide;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface GuideCategoriesClient {
  listGuideCategories(): Promise<GuideCategory[]>;
  createGuideCategory(input: GuideCategoryInput): Promise<GuideCategory>;
  updateGuideCategory(id: string, input: GuideCategoryInput): Promise<GuideCategory>;
}

/**
 * The guide's rubrics.
 *
 * There is no delete: a rubric is switched OFF, never removed. Removing it would
 * take its links to every collection with it, and a rubric is usually turned off
 * because it is out of season, not because it was a mistake. The list therefore
 * shows inactive rubrics too — an editor who cannot see one cannot switch it
 * back on.
 *
 * Order is a plain number typed into the form rather than a drag: rubric
 * positions carry no uniqueness constraint on the server, so there is no
 * "rewrite the whole order" operation to drag against, and pretending otherwise
 * would need an endpoint that does not exist.
 */
export function GuideCategoriesView({ client = apiClient }: { client?: GuideCategoriesClient }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<GuideCategory | null>(null);
  const [creating, setCreating] = useState(false);

  const listQuery = useQuery({
    queryKey: ["guide-categories"],
    queryFn: () => client.listGuideCategories(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["guide-categories"] });
  const items = listQuery.data ?? [];

  return (
    <section className="mx-auto flex max-w-[800px] flex-col gap-lg">
      <Link
        href="/gastroguide"
        className="self-start text-sm font-medium text-brand hover:underline"
      >
        ← {copy.back}
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="text-xl font-bold text-text">{copy.categoriesManage}</h1>
        <Button onClick={() => setCreating(true)}>{copy.categoryCreate}</Button>
      </header>

      {listQuery.isPending ? (
        <LoadingState />
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={copy.categoriesEmpty} />
      ) : (
        <ul className="flex flex-col gap-sm">
          {items.map((cat) => (
            <li
              key={cat.id}
              className="flex flex-wrap items-center justify-between gap-md rounded-card bg-surface p-lg"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-sm">
                  <span className="break-words text-sm font-semibold text-text">{cat.title}</span>
                  {!cat.is_active ? (
                    <span className="whitespace-nowrap rounded-pill bg-chip px-sm py-xxs text-[11px] text-text-muted">
                      {copy.categoryInactive}
                    </span>
                  ) : null}
                </div>
                <p className="mt-xxs break-words text-[13px] text-text-muted">
                  <span className="font-mono">{cat.slug}</span> · {copy.fieldPosition}:{" "}
                  {cat.position}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setEditing(cat)}>
                {t.admin.common.edit}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {creating || editing ? (
        <CategoryFormModal
          client={client}
          category={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void invalidate();
          }}
        />
      ) : null}
    </section>
  );
}

function CategoryFormModal({
  client,
  category,
  onClose,
  onSaved,
}: {
  client: GuideCategoriesClient;
  category?: GuideCategory;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!category;
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [title, setTitle] = useState(category?.title ?? "");
  const [position, setPosition] = useState(String(category?.position ?? 0));
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: GuideCategoryInput) =>
      isEdit ? client.updateGuideCategory(category!.id, input) : client.createGuideCategory(input),
    onSuccess: onSaved,
    onError: (error) => setFormError(guideErrorMessage(error).text),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
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
      position: Number.parseInt(position, 10) || 0,
      is_active: isActive,
    });
  }

  return (
    <Modal title={copy.categoryEditTitle} onClose={onClose}>
      <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
        <Field label={copy.fieldTitle} required htmlFor="guide-cat-title">
          <TextInput
            id="guide-cat-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label={copy.fieldSlug} hint={copy.fieldSlugHint} required htmlFor="guide-cat-slug">
          <TextInput
            id="guide-cat-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={120}
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
        <Field
          label={copy.fieldPosition}
          hint={copy.fieldPositionHint}
          htmlFor="guide-cat-position"
        >
          <TextInput
            id="guide-cat-position"
            type="number"
            inputMode="numeric"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </Field>
        <CheckboxRow label={copy.categoryActive} checked={isActive} onChange={setIsActive} />

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

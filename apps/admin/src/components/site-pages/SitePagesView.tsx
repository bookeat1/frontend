"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PLATFORM_PAGE_SLUGS,
  type PlatformPageAdmin,
  type PlatformPageInput,
  type PlatformPageSlug,
} from "@bookeat/api/admin";
import { Markdown } from "@bookeat/markdown";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useIsPlatformAdmin } from "@/lib/use-venue-catalog";
import { Button } from "../ui/Button";
import { Field, TextArea, TextInput } from "../ui/FormControls";
import { EmptyState, ErrorState, LoadingState } from "../StateViews";
import { PublishBadge } from "../ui/PublishBadge";
import { copy, sitePageErrorText } from "./copy";

/**
 * «Страницы сайта» (T4) — семь текстовых страниц футера (about/jobs/
 * contacts/how-it-works/cancellation/offer/privacy). Аллоулист слагов
 * фиксирован на бэкенде (bookeat-backend PR #115) — создать восьмую или
 * удалить одну из семи нельзя, и в этом экране такой кнопки нет.
 *
 * ПРОСТОЙ РЕДАКТОР, БЕЗ ЧЕРНОВИКА. `PUT` сохраняет `title`/`body` сразу —
 * ни версий, ни отдельного шага публикации в этом контракте нет (см.
 * `PlatformPageAdmin` в `@bookeat/api/admin`: `published_at` в списке —
 * ТОЛЬКО информация, править его отсюда нельзя). Кнопка «Сохранить» поэтому
 * одна и делает ровно одно действие, а не «сохранить черновик» /
 * «опубликовать».
 *
 * Список и редактор — один экран, выбор записи через `?page=<slug>`, а не
 * `[slug]`: кабинет собирается статикой (`output: "export"`), у него нет
 * процесса Node за спиной, а набор слагов известен на этапе сборки ровно
 * настолько же плохо, насколько и у гастрогида — та же причина, тот же приём
 * (`apps/admin/app/(panel)/gastroguide/routes/page.tsx`).
 */
export interface SitePagesClient {
  listPlatformPages(): Promise<PlatformPageAdmin[]>;
  getPlatformPage(slug: PlatformPageSlug): Promise<PlatformPageAdmin>;
  updatePlatformPage(slug: PlatformPageSlug, input: PlatformPageInput): Promise<PlatformPageAdmin>;
}

export function SitePagesView({
  slug,
  client = apiClient,
}: {
  /** `null` — список; конкретный слаг — редактор этой страницы. */
  slug: PlatformPageSlug | null;
  client?: SitePagesClient;
}) {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) {
    return <EmptyState title={copy.adminOnlyTitle} description={copy.adminOnlyDescription} />;
  }
  return slug ? <SitePageEditor slug={slug} client={client} /> : <SitePagesList client={client} />;
}

const LIST_QUERY_KEY = ["site-pages"] as const;

function SitePagesList({ client }: { client: SitePagesClient }) {
  const listQuery = useQuery({
    queryKey: LIST_QUERY_KEY,
    queryFn: () => client.listPlatformPages(),
  });

  return (
    <section className="mx-auto flex max-w-[800px] flex-col gap-lg">
      <header>
        <h1 className="text-xl font-bold text-text">{copy.title}</h1>
        <p className="mt-xxs max-w-[60ch] text-sm text-text-muted">{copy.subtitle}</p>
      </header>

      {listQuery.isPending ? (
        <LoadingState title={copy.loading} />
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : (
        <ul className="flex flex-col gap-sm">
          {PLATFORM_PAGE_SLUGS.map((s) => {
            // Строка рисуется ДЛЯ ВСЕХ СЕМИ слагов всегда, даже если ответ
            // сервера почему-то не содержит один из них: аллоулист — это то,
            // что панель обещает суперадмину, а не то, что вернул сервер в
            // этот раз.
            const page = listQuery.data.find((p) => p.slug === s);
            return (
              <li
                key={s}
                className="flex flex-wrap items-center justify-between gap-md rounded-card bg-surface p-lg"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-sm">
                    <span className="break-words text-sm font-semibold text-text">
                      {copy.slugLabel[s]}
                    </span>
                    <PublishBadge status={page?.published_at ? "published" : "draft"} />
                  </div>
                  <p className="mt-xxs font-mono text-[12px] text-text-muted">/{s}</p>
                </div>
                <Link
                  href={`/site-pages?page=${s}`}
                  className="inline-flex min-h-[36px] items-center rounded-pill bg-chip px-md text-[13px] font-medium text-text hover:bg-[#e7e7e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {copy.openEditor}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SitePageEditor({ slug, client }: { slug: PlatformPageSlug; client: SitePagesClient }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ["site-page", slug],
    queryFn: () => client.getPlatformPage(slug),
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Форма заполняется ОДИН РАЗ, когда данные приезжают — а не на каждый
  // рендер `detailQuery.data`, иначе набор текста сбрасывался бы фоновым
  // рефетчем (TanStack Query может перечитать запрос при возврате фокуса на
  // вкладку прямо во время правки).
  useEffect(() => {
    if (detailQuery.data) {
      setTitle(detailQuery.data.title);
      setBody(detailQuery.data.body);
    }
  }, [detailQuery.data]);

  const mutation = useMutation({
    mutationFn: (input: PlatformPageInput) => client.updatePlatformPage(slug, input),
    onSuccess: (saved) => {
      setSaveError(null);
      queryClient.setQueryData(["site-page", slug], saved);
      void queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });
    },
    // Введённый текст НЕ сбрасывается при отказе — форма остаётся как была,
    // меняется только сообщение под кнопкой (hard rule: форма не теряет ввод
    // при неудаче).
    onError: (error) => setSaveError(sitePageErrorText(error)),
  });

  if (detailQuery.isPending) return <LoadingState title={copy.loading} />;
  if (detailQuery.isError) {
    return <ErrorState message={sitePageErrorText(detailQuery.error)} onRetry={() => void detailQuery.refetch()} />;
  }

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <Link href="/site-pages" className="self-start text-sm font-medium text-brand hover:underline">
        {copy.back}
      </Link>

      <header className="flex flex-wrap items-center gap-sm">
        <h1 className="text-xl font-bold text-text">{copy.slugLabel[slug]}</h1>
        <PublishBadge status={detailQuery.data.published_at ? "published" : "draft"} />
        <span className="font-mono text-[12px] text-text-muted">/{slug}</span>
      </header>

      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          // Второе нажатие, пока летит первое, безвредно (тот же PUT), но
          // отправлять его незачем.
          if (mutation.isPending) return;
          if (!title.trim()) {
            setSaveError(t.admin.common.required);
            return;
          }
          setSaveError(null);
          mutation.mutate({ title: title.trim(), body });
        }}
        noValidate
      >
        <Field label={copy.fieldTitle} required htmlFor="site-page-title">
          <TextInput
            id="site-page-title"
            value={title}
            maxLength={200}
            disabled={mutation.isPending}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
          <Field label={copy.fieldBody} hint={copy.fieldBodyHint} htmlFor="site-page-body">
            <TextArea
              id="site-page-body"
              value={body}
              rows={24}
              disabled={mutation.isPending}
              className="font-mono text-[13px]"
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>

          <div className="flex flex-col gap-xs">
            <span className="text-sm font-medium text-text">{copy.previewLabel}</span>
            <div className="min-h-[88px] flex-1 overflow-y-auto rounded-card border border-hairline bg-white px-md py-sm">
              {body.trim() ? (
                <div className="flex flex-col gap-sm text-sm text-text [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_table]:w-full [&_td]:border [&_td]:border-hairline [&_td]:p-xs [&_th]:border [&_th]:border-hairline [&_th]:p-xs">
                  <Markdown>{body}</Markdown>
                </div>
              ) : (
                <p className="text-[13px] text-text-muted">{copy.previewEmpty}</p>
              )}
            </div>
          </div>
        </div>

        <p className="text-[12px] text-text-muted">{copy.publishHint}</p>

        {saveError ? (
          <p role="alert" className="break-words text-sm text-brand">
            {saveError}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" loading={mutation.isPending}>
            {mutation.isPending ? copy.saving : copy.save}
          </Button>
        </div>
      </form>
    </section>
  );
}

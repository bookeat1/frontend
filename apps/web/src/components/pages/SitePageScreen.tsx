"use client";

import type { PlatformPageSlug } from "@bookeat/api/client";
import { Markdown } from "@bookeat/markdown";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { isApiConfigured } from "@web/lib/api";
import { useT } from "@web/lib/locale";
import { isNotFound } from "@web/lib/not-found";
import { useSitePage } from "@web/lib/queries";

/**
 * Один из семи редактируемых текстовых страниц платформы (T4): «О BookEat»,
 * «Вакансии», «Контакты», «Как это работает», «Отмена брони», «Оферта»,
 * «Политика данных». Один шаблон на все семь — каждый роут
 * (`app/{slug}/page.tsx`) рендерит `<SitePageScreen slug="…" />`, отличается
 * только слаг.
 *
 * Геометрии отдельного макета текстовой страницы нет (спека
 * `web-fixes-20260906.md`, T4, 🟡) — колонка 760 по центру взята со страницы
 * статьи (`5033:7466`), как решено там же.
 *
 * Данные — `GET /pages/:slug`: неопубликованная страница отвечает 404, и это
 * НЕ ошибка сети — «страница не найдена», без повтора запроса (как у статьи,
 * `useArticle`/`isNotFound`).
 *
 * Тело — Markdown, рендерится через `@bookeat/markdown`'s `<Markdown>` — тот
 * же компонент, которым в кабинете суперадмина рисуется предпросмотр
 * редактора (критерий 31 спеки: предпросмотр обязан совпадать с сайтом
 * буквально, одним и тем же импортом, а не «похожим» рендером).
 */
export function SitePageScreen({ slug }: { slug: PlatformPageSlug }) {
  const t = useT();
  const query = useSitePage(slug);

  return (
    <SiteChrome>
      <Container className="pb-24 pt-4">
        <div className="mx-auto flex w-full max-w-article-body flex-col gap-6">
          {!isApiConfigured ? (
            <StateMessage
              title={t.web.states.notConfiguredTitle}
              text={t.web.states.notConfiguredText}
              tone="danger"
            />
          ) : query.isError ? (
            isNotFound(query.error) ? (
              <StateMessage title={t.web.pages.notFoundTitle} text={t.web.pages.notFoundDescription}>
                <Button size="m" variant="secondary" asLink href="/">
                  {t.web.pages.backHome}
                </Button>
              </StateMessage>
            ) : (
              <StateMessage title={t.web.states.errorTitle} text={t.web.states.errorText} tone="danger">
                <Button size="m" variant="secondary" onClick={() => query.refetch()}>
                  {t.web.states.retry}
                </Button>
              </StateMessage>
            )
          ) : query.isPending || query.data === undefined ? (
            <div role="status" aria-live="polite" aria-busy="true">
              <span className="sr-only">{t.web.states.loading}</span>
              <SitePageSkeleton />
            </div>
          ) : (
            <article className="flex flex-col gap-6">
              <h1 className="break-words text-[24px] font-bold leading-8 tracking-[-0.2px] text-ink">
                {query.data.title}
              </h1>
              <div className="flex flex-col gap-4 break-words text-bodyM text-ink-secondary [&_a]:text-brand [&_a]:underline [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:leading-7 [&_h2]:text-ink [&_h3]:text-[17px] [&_h3]:font-semibold [&_h3]:leading-6 [&_h3]:text-ink [&_h4]:text-[15px] [&_h4]:font-semibold [&_h4]:leading-6 [&_h4]:text-ink [&_hr]:border-line [&_li]:ml-5 [&_ol]:list-decimal [&_table]:w-full [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:p-2 [&_ul]:list-disc">
                <Markdown>{query.data.body}</Markdown>
              </div>
            </article>
          )}
        </div>
      </Container>
    </SiteChrome>
  );
}

function SitePageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-2/3" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

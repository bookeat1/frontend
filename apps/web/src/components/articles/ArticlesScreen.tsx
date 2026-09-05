"use client";

import { ArticleCard, ArticleCardSkeleton } from "@web/components/articles/ArticleCard";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, StateMessage } from "@web/components/state/AsyncBlock";
import { useT } from "@web/lib/locale";
import { useArticles } from "@web/lib/queries";

/**
 * Список статей — Figma «BookEat (Copy) (Copy)», кадр 5033:7382
 * («WEB / 09 · Статьи»). Шапка страницы (узел 5033:7386): заголовок 24/32
 * Bold и подзаголовок 16/24, паддинг 16 сверху и 24 снизу. Секция
 * (5033:7389): ряды по три карточки 384 с просветом 24, 64 снизу.
 *
 * Данные — `GET /articles`, тот же запрос, что у приложения
 * (`apps/mobile/app/articles.tsx`): только `kind: "article"`, без подборок
 * гастрогида. Пустой ответ — норма («пока не опубликовали»), а не ошибка.
 *
 * Ниже `lg` порядок задаёт приложение: одна колонка карточек, на планшете
 * две (`md:grid-cols-2`), с `lg` — три, как в макете.
 */
export function ArticlesScreen() {
  const t = useT();
  const articles = useArticles();

  return (
    <SiteChrome active="articles">
      <Container className="flex flex-col gap-2 pb-6 pt-4">
        <h1 className="text-[24px] font-bold leading-8 tracking-[-0.2px] text-ink">
          {t.web.articles.title}
        </h1>
        <p className="max-w-[488px] text-bodyM text-ink-secondary">{t.web.articles.subtitle}</p>
      </Container>

      <Container className="pb-16">
        <AsyncBlock
          query={articles}
          emptyText={t.articles.emptyTitle}
          empty={
            <StateMessage title={t.articles.emptyTitle} text={t.articles.emptyDescription} />
          }
          skeleton={<ArticlesGridSkeleton />}
        >
          {(items) => (
            <ul className={ARTICLES_GRID}>
              {items.map((article) => (
                <li key={article.slug} className="flex">
                  <ArticleCard article={article} />
                </li>
              ))}
            </ul>
          )}
        </AsyncBlock>
      </Container>
    </SiteChrome>
  );
}

/** Одна константа на сетку и её скелет: высота и колонки обязаны совпадать. */
const ARTICLES_GRID = "grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3";

/** Шесть заглушек — два ряда макета (узлы 5033:7390 и 5033:7406). */
function ArticlesGridSkeleton() {
  return (
    <div className={ARTICLES_GRID}>
      {Array.from({ length: 6 }, (_, index) => (
        <ArticleCardSkeleton key={index} />
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import type { GuideCollection } from "@bookeat/api/client";

import { RemoteImage } from "@web/components/ui/RemoteImage";
import { Skeleton } from "@web/components/state/AsyncBlock";
import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";

/**
 * Карточка списка статей — Figma «BookEat (Copy) (Copy)», узел 5033:7391
 * («Card / Article»): обложка 384×260 радиус 20, ниже через 12 — заголовок
 * 16/24 SemiBold и через 4 — подпись автора 14/20 SemiBold третичным.
 *
 * Автора в данных НЕТ (`GuideCollection` без поля author), подпись
 * постоянная — `t.explore.articleAuthorDefault` («От BookEat»), как в
 * приложении. Карточка без подложки и тени: в макете это голое фото с
 * текстом под ним, а не `Card`.
 *
 * Обложка ниже `lg` держит пропорцию мобильной карточки статьи 256×148
 * (`aspect-home-cover`), число макета 260 живёт только под `lg:`
 * (`docs/responsive.md`). Скелет собран из тех же классов.
 */
export const ARTICLE_CARD_IMAGE = "aspect-home-cover w-full lg:aspect-auto lg:h-article-image";

/** Ниже `md` карточка во всю колонку, на планшете — половина, от `lg` — треть 1200. */
const ARTICLE_CARD_SIZES = "(min-width: 1024px) 384px, (min-width: 768px) 50vw, 100vw";

export const articleHref = (slug: string) => `/articles/${encodeURIComponent(slug)}`;

export function ArticleCard({ article }: { article: GuideCollection }) {
  const t = useT();

  return (
    <article className="relative flex w-full flex-col gap-3">
      <div className={cx("relative overflow-hidden rounded-xl bg-muted", ARTICLE_CARD_IMAGE)}>
        <RemoteImage src={article.coverImageUrl} alt="" sizes={ARTICLE_CARD_SIZES} />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="break-words text-[16px] font-semibold leading-6 text-ink">
          <Link
            href={articleHref(article.slug)}
            className="after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {article.title}
          </Link>
        </h2>
        <p className="text-[14px] font-semibold leading-5 text-ink-tertiary">
          {t.explore.articleAuthorDefault}
        </p>
      </div>
    </article>
  );
}

export function ArticleCardSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3">
      <Skeleton className={cx("rounded-xl", ARTICLE_CARD_IMAGE)} />
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-5 w-24" />
      </div>
    </div>
  );
}

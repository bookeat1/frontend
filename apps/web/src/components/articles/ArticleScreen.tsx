"use client";

import Link from "next/link";
import type { GuideCollectionDetail, GuideCollectionVenue } from "@bookeat/api/client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { isApiConfigured } from "@web/lib/api";
import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";
import { isNotFound } from "@web/lib/not-found";
import { useArticle } from "@web/lib/queries";

/**
 * Страница статьи — Figma «BookEat (Copy) (Copy)», кадр 5033:7466
 * («WEB / 09b · Страница статьи»). Всё содержимое лежит в колонке 760 по
 * центру (паддинг кадра 340): ссылка «Все статьи» (5047:10518), фото героя
 * 760×440 радиус 20 (5033:7471), чип вида записи, заголовок 24/32 и подпись
 * автора (5048:10526), затем блоки заведений (5033:7485, 5033:7497).
 *
 * Данные — `GET /articles/:slug`. Автора в данных нет — подпись постоянная
 * («От BookEat»), как в приложении и на карточке списка. Блок заведения —
 * ссылка на `/venues/:restaurantId`: у страницы события/акции на сайте
 * роута нет, поэтому «→» ведёт к заведению-хозяину (тот же приём, что у
 * карточек главной, `home/Cards.tsx`).
 *
 * Состояния: скелет той же геометрии, «не найдено» на 404 (снята с
 * публикации или чужая ссылка — честное «нет», не ошибка сети), ошибка сети
 * с повтором, статья без блоков — только шапка и описание плюс кнопка к
 * каталогу, чтобы материал не заканчивался в никуда (`t.articles.browseVenues`).
 */
export function ArticleScreen({ slug }: { slug: string }) {
  const t = useT();
  const query = useArticle(slug);

  return (
    <SiteChrome active="articles">
      <Container className="pb-24 pt-4">
        <div className="mx-auto flex w-full max-w-article-body flex-col gap-6">
          <Link
            href="/articles"
            className="inline-flex h-article-back w-fit items-center gap-1 rounded-lg bg-canvas px-3 py-2 text-[16px] font-semibold leading-[22px] text-brand shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span aria-hidden="true">←</span>
            {t.web.articles.all}
          </Link>

          {!isApiConfigured ? (
            <StateMessage
              title={t.web.states.notConfiguredTitle}
              text={t.web.states.notConfiguredText}
              tone="danger"
            />
          ) : query.isError ? (
            isNotFound(query.error) ? (
              <StateMessage title={t.articles.notFoundTitle} text={t.articles.notFoundDescription}>
                <Button size="m" variant="secondary" asLink href="/articles">
                  {t.web.articles.all}
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
              <ArticleSkeleton />
            </div>
          ) : (
            <ArticleBody article={query.data} />
          )}
        </div>
      </Container>
    </SiteChrome>
  );
}

/** Фото героя: 760×440 под `lg:`, ниже — пропорция мобильной обложки. */
const HERO_IMAGE = "aspect-home-cover w-full lg:aspect-auto lg:h-article-hero";
const HERO_SIZES = "(min-width: 1024px) 760px, 100vw";
/** Фото блока заведения: 374×240 под `lg:`, два в ряд с просветом 12. */
const VENUE_PHOTO = "aspect-home-cover w-full lg:aspect-auto lg:h-article-photo";
const VENUE_PHOTO_SIZES = "(min-width: 1024px) 374px, 50vw";

function ArticleBody({ article }: { article: GuideCollectionDetail }) {
  const t = useT();

  return (
    <article className="flex flex-col gap-6">
      <div className={cx("relative overflow-hidden rounded-xl bg-muted", HERO_IMAGE)}>
        <RemoteImage src={article.coverImageUrl} alt="" sizes={HERO_SIZES} />
      </div>

      <header className="flex flex-col gap-4">
        <span className="w-fit rounded-sm bg-brand-subtle px-3 py-[5px] text-[12px] font-medium leading-4 tracking-[0.1px] text-brand-text">
          {t.web.articles.kind[article.kind]}
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="break-words text-[24px] font-bold leading-8 tracking-[-0.2px] text-ink">
            {article.title}
          </h1>
          <p className="text-bodyM text-ink-secondary">{t.explore.articleAuthorDefault}</p>
        </div>
      </header>

      {article.description ? (
        <p className="whitespace-pre-line break-words text-bodyM text-ink-secondary">
          {article.description}
        </p>
      ) : null}

      {article.venues.length > 0 ? (
        <ul className="flex flex-col gap-6" aria-label={t.web.articles.venuesHeading}>
          {article.venues.map((venue) => (
            <li key={venue.restaurantId}>
              <ArticleVenueBlock venue={venue} />
            </li>
          ))}
        </ul>
      ) : (
        <Button size="m" variant="secondary" asLink href="/venues" className="w-fit">
          {t.articles.browseVenues}
        </Button>
      )}
    </article>
  );
}

/**
 * Блок заведения (узел 5033:7485): надзаголовок из двух строк («Еженедельное
 * событие» / «в Mongol Bar») со стрелкой, две фотографии, заголовок 16/24,
 * описание 14/20 и строка «адрес · @инстаграм» 12/16.
 *
 * Чем заполнять строки, диктуют данные (`GuideCollectionVenue`):
 *   • с подсветкой (событие/акция) — надзаголовок «Событие»/«Акция», фото
 *     обложка + галерея подсветки, заголовок и описание подсветки;
 *   • без подсветки — надзаголовок «кухня», фото заведения, заголовок —
 *     название, описание — редакторская заметка `note`.
 * Ровно так собирает блок приложение (`GuideVenueBlock.tsx`).
 */
export function ArticleVenueBlock({ venue }: { venue: GuideCollectionVenue }) {
  const t = useT();
  const highlight = venue.highlight;
  const photos = (highlight ? [highlight.coverImageUrl, ...highlight.images] : [venue.imageUrl])
    .filter((url): url is string => Boolean(url && url.trim()))
    .slice(0, 2);
  const eyebrow = highlight ? t.web.articles.highlight[highlight.kind] : venue.cuisineType;
  const title = highlight?.title || venue.name;
  const description = highlight?.description || venue.note;
  const footer = [venue.address.trim(), venue.instagram.trim()].filter(Boolean).join(" · ");

  return (
    <section className="relative flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          {eyebrow ? (
            <p className="text-[12px] font-medium leading-4 tracking-[0.1px] text-ink-tertiary">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="break-words text-[14px] font-semibold leading-5 text-ink">
            <Link
              href={`/venues/${encodeURIComponent(venue.restaurantId)}`}
              aria-label={t.web.articles.openVenue(venue.name)}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {highlight ? t.web.articles.atVenue(venue.name) : venue.name}
            </Link>
          </h2>
        </div>
        <span aria-hidden="true" className="text-[14px] font-semibold leading-5 text-ink-tertiary">
          →
        </span>
      </div>

      {photos.length > 0 ? (
        <div className={cx("grid gap-3", photos.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {photos.map((url) => (
            <div key={url} className={cx("relative overflow-hidden rounded-lg bg-muted", VENUE_PHOTO)}>
              <RemoteImage src={url} alt="" sizes={VENUE_PHOTO_SIZES} />
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="break-words text-[16px] font-semibold leading-6 text-ink">{title}</p>
          {description ? (
            <p className="break-words text-[14px] leading-5 text-ink-secondary">{description}</p>
          ) : null}
        </div>
        {footer ? (
          <p className="break-words text-[12px] leading-4 text-ink-tertiary">{footer}</p>
        ) : null}
      </div>
    </section>
  );
}

/** Скелет той же геометрии: герой, чип, две строки шапки, один блок. */
function ArticleSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className={cx("rounded-xl", HERO_IMAGE)} />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[26px] w-24 rounded-sm" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[38px] w-40" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className={cx("rounded-lg", VENUE_PHOTO)} />
          <Skeleton className={cx("rounded-lg", VENUE_PHOTO)} />
        </div>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

import { EVENT_CARD_IMAGE, EventCard } from "@web/components/home/Cards";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { Chip } from "@web/components/ui/Chip";
import { cx } from "@web/lib/cx";
import { useCity } from "@web/lib/city";
import { useT } from "@web/lib/locale";
import { EVENTS_PAGE_SIZE, useEventsFeed } from "@web/lib/queries";

/**
 * Страница афиши — узел 5033:6703 «WEB / 07 · Афиша» (1440×1541).
 *
 * Сверху «Page hero» (5033:6707): заголовок 40/48, подпись 17/26, ряд чипов
 * категорий (5033:6724). Ниже «Events grid» (5033:6737): три карточки в ряд с
 * просветом 24, под сеткой кнопка «Показать ещё» (5036:10035) на всю ширину.
 *
 * Расхождения с макетом — сознательные и записаны здесь, а не спрятаны:
 *   • чипы в макете — фиксированный набор («Живая музыка», «Дегустации»…), а
 *     у `GET /events` нет ни справочника категорий, ни фильтра по тегу; теги —
 *     свободный текст заведения. Поэтому чипы собираются из тегов УЖЕ
 *     загруженных событий и фильтруют на клиенте; «Все» сбрасывает;
 *   • селект «Сегодня» (5036:10026) не реализован: у API нет сортировки,
 *     кроме фиксированной по дате начала, и рисовать неработающий выбор нельзя;
 *   • подпись кнопки «Показать ещё 120 заведений» в макете — очевидная
 *     описка (это афиша), берём «Показать ещё»;
 *   • карточка — та же `EventCard`, что на главной (384×324 против 384×322 в
 *     этом кадре: второй компонент ради двух пикселей — дефект).
 *
 * Ниже `lg` — контракт `docs/responsive.md`: одна колонка до `md`, три от `md`,
 * заголовок 32/40, чипы прокручиваются по горизонтали.
 */

/** Общий каркас сетки для карточек и скелета: высоты обязаны совпадать. */
const GRID = "grid grid-cols-1 gap-gutter md:grid-cols-3";

/** Сетка на два ряда — столько же, сколько карточек в первой странице. */
const PLACEHOLDERS = Array.from({ length: EVENTS_PAGE_SIZE }, (_, index) => `s${index}`);

export function EventsGridSkeleton() {
  return (
    <div className={GRID}>
      {PLACEHOLDERS.map((key) => (
        <div key={key} className="overflow-hidden rounded-card lg:min-h-event-card">
          <Skeleton className={cx("rounded-none", EVENT_CARD_IMAGE)} />
          <Skeleton className="h-event-body rounded-none" />
        </div>
      ))}
    </div>
  );
}

export function EventsScreen() {
  const t = useT();
  const { city } = useCity();
  const feed = useEventsFeed(city);
  const [tag, setTag] = useState<string | null>(null);

  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const tags = useMemo(() => {
    const seen = new Set<string>();
    for (const event of items) for (const label of event.tags) seen.add(label);
    return [...seen];
  }, [items]);

  // Выбранный тег мог исчезнуть после смены города — тогда фильтр не действует.
  const activeTag = tag && tags.includes(tag) ? tag : null;
  const visible = activeTag ? items.filter((event) => event.tags.includes(activeTag)) : items;

  return (
    <SiteChrome active="events">
      <Container className="flex flex-col gap-6 py-6 lg:py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[32px] font-bold leading-10 tracking-[-0.6px] text-ink lg:text-[40px] lg:leading-[48px] lg:tracking-[-0.8px]">
            {t.web.events.title}
          </h1>
          <p className="text-[15px] leading-[22px] text-ink-secondary lg:text-[17px] lg:leading-[26px]">
            {t.web.events.subtitle}
          </p>
        </div>
        {tags.length > 0 ? (
          <div
            role="group"
            aria-label={t.web.events.tagsLabel}
            className="row-scrollbar -m-1 flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain p-1 lg:flex-wrap"
          >
            <Chip state={activeTag === null ? "active" : "default"} onClick={() => setTag(null)} className="shrink-0">
              {t.web.events.allTags}
            </Chip>
            {tags.map((label) => (
              <Chip
                key={label}
                state={activeTag === label ? "active" : "default"}
                onClick={() => setTag(label)}
                className="shrink-0"
              >
                {label}
              </Chip>
            ))}
          </div>
        ) : null}
      </Container>

      <Container className="flex flex-col gap-6 pb-16 lg:pb-24">
        <AsyncBlock
          query={feed}
          skeleton={<EventsGridSkeleton />}
          emptyText={t.web.events.empty}
          isEmpty={(data) => data.pages.every((page) => page.items.length === 0)}
        >
          {() => (
            <>
              {visible.length === 0 ? (
                <p className="text-bodyM text-ink-secondary">{t.web.events.empty}</p>
              ) : (
                <ul className={GRID}>
                  {visible.map((event) => (
                    <li key={event.id}>
                      <EventCard event={event} />
                    </li>
                  ))}
                </ul>
              )}
              {feed.hasNextPage ? (
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant="secondary"
                    block
                    loading={feed.isFetchingNextPage}
                    onClick={() => void feed.fetchNextPage()}
                    className="shadow-card"
                  >
                    {feed.isFetchingNextPage ? t.web.events.loadingMore : t.web.events.showMore}
                  </Button>
                  {feed.isFetchNextPageError ? (
                    <p role="alert" className="text-[14px] leading-5 text-danger-text">
                      {t.web.events.moreFailed}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </AsyncBlock>
      </Container>
    </SiteChrome>
  );
}

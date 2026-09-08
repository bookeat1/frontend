"use client";

import { useMemo } from "react";

import type { Promo } from "@bookeat/api/client";

import { PROMO_CARD_FRAME, PromoCard, type PromoCardData } from "@web/components/home/Cards";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { cx } from "@web/lib/cx";
import { useCity } from "@web/lib/city";
import { useT } from "@web/lib/locale";
import { PROMOS_PAGE_SIZE, usePromosFeed } from "@web/lib/queries";

/**
 * Листинг «Все акции» `/promos` — построен по образцу афиши (`EventsScreen`,
 * узел 5033:6703): та же обвязка (заголовок + подпись, сетка 3×N, «Показать
 * ещё»), тот же бесконечный запрос через `usePromosFeed`. Решение владельца
 * 2026-09-07: отменяет запись `docs/responsive.md` §8 от 2026-09-04 «Акции на
 * веб не переносим» — паритет с афишей.
 *
 * Расхождения с «Афишей» — сознательные:
 *   • без чипов-фильтров: `GET /promos` не отдаёт тегов/категорий (в отличие
 *     от `GET /events`), выдумывать фильтр не по чему;
 *   • карточка — `PromoCard` (`home/Cards.tsx`), та же, что в ленте главной
 *     и что рисует акцию на самой странице (фото с градиентом и бейджем
 *     скидки), а не карточка события: это ДРУГОЙ визуальный язык элемента
 *     «акция», уже устоявшийся на сайте (главная + `/venues/[id]#promos`), и
 *     задача явно просит переиспользовать его, а не собирать третий вид.
 */

const GRID = "grid grid-cols-1 gap-gutter md:grid-cols-3";

const PLACEHOLDERS = Array.from({ length: PROMOS_PAGE_SIZE }, (_, index) => `s${index}`);

export function PromosGridSkeleton() {
  return (
    <div className={GRID}>
      {PLACEHOLDERS.map((key) => (
        <Skeleton key={key} className={cx("rounded-card", PROMO_CARD_FRAME)} />
      ))}
    </div>
  );
}

/** `Promo` (листинг/детальная) и `HomePromo` (лента главной) — разные типы
 * (см. комментарий у `PromoCardData`); карточка листинга собирает узкий срез
 * сама, а не заводит третий тип ради одного поля `restaurant?.name`. */
function toCardData(promo: Promo): PromoCardData {
  return {
    id: promo.id,
    title: promo.title,
    coverImageUrl: promo.coverImageUrl,
    discountPercent: promo.discountPercent,
    restaurantName: promo.restaurant?.name ?? "",
  };
}

export function PromosScreen() {
  const t = useT();
  const { city } = useCity();
  const feed = usePromosFeed(city);

  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);

  return (
    <SiteChrome active="promos">
      <Container className="flex flex-col gap-6 py-6 lg:py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[32px] font-bold leading-10 tracking-[-0.6px] text-ink lg:text-[40px] lg:leading-[48px] lg:tracking-[-0.8px]">
            {t.web.promos.title}
          </h1>
          <p className="text-[15px] leading-[22px] text-ink-secondary lg:text-[17px] lg:leading-[26px]">
            {t.web.promos.subtitle}
          </p>
        </div>
      </Container>

      <Container className="flex flex-col gap-6 pb-16 lg:pb-24">
        <AsyncBlock
          query={feed}
          skeleton={<PromosGridSkeleton />}
          emptyText={t.web.promos.empty}
          isEmpty={(data) => data.pages.every((page) => page.items.length === 0)}
        >
          {() => (
            <>
              <ul className={GRID}>
                {items.map((promo) => (
                  <li key={promo.id}>
                    <PromoCard promo={toCardData(promo)} />
                  </li>
                ))}
              </ul>
              {feed.hasNextPage ? (
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant="secondary"
                    block
                    loading={feed.isFetchingNextPage}
                    onClick={() => void feed.fetchNextPage()}
                    className="shadow-card"
                  >
                    {feed.isFetchingNextPage ? t.web.promos.loadingMore : t.web.promos.showMore}
                  </Button>
                  {feed.isFetchNextPageError ? (
                    <p role="alert" className="text-[14px] leading-5 text-danger-text">
                      {t.web.promos.moreFailed}
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

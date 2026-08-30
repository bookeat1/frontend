"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { FiltersRail } from "@web/components/catalog/FiltersRail";
import { Pagination } from "@web/components/catalog/Pagination";
import { VenueWideCard } from "@web/components/catalog/VenueWideCard";
import { SearchPanel } from "@web/components/home/SearchPanel";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { useCity } from "@web/lib/city";
import { cx } from "@web/lib/cx";
import {
  EMPTY_CATALOG_STATE,
  buildSearchQuery,
  hasActiveFilters,
  pageCount,
  paginate,
  parseCatalogParams,
  serializeCatalogParams,
  sortVenues,
  toggleInList,
  type CatalogSort,
  type CatalogState,
} from "@web/lib/catalog-params";
import { INTL_TAG } from "@web/lib/format";
import { useLocale, useT } from "@web/lib/locale";
import { useAmenities, useCatalog, useCuisines } from "@web/lib/queries";

/**
 * Листинг заведений — Figma 3z0f6dgev4HMwBAHPjTjPo, кадр «WEB / 02 · Поиск и
 * фильтры» (узел 3258:2): строка поиска под шапкой, колонка фильтров 288
 * слева, выдача широкими карточками справа, снизу нумерация страниц.
 *
 * Состояние целиком в адресной строке (см. lib/catalog-params): ссылку на
 * выдачу можно отправить, кнопка «назад» возвращает прежние фильтры.
 *
 * Переключателя «Списком / На карте» из макета нет: карты выдачи в вебе не
 * существует, а вкладка, которая ничего не открывает, — это не заготовка, это
 * поломка.
 */
export function CatalogScreen() {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { city } = useCity();

  const state = useMemo(
    () => parseCatalogParams(new URLSearchParams(params.toString())),
    [params],
  );

  const query = useCatalog(buildSearchQuery(state, city));
  const cuisines = useCuisines();
  const amenities = useAmenities();

  function update(next: CatalogState) {
    const search = serializeCatalogParams(next);
    // `replace`, а не `push`: двадцать нажатий по чипам не должны превратить
    // кнопку «назад» в двадцать шагов обратно по собственным фильтрам.
    router.replace(search ? `/venues?${search}` : "/venues", { scroll: false });
  }

  const sorted = useMemo(
    () => (query.data ? sortVenues(query.data.items, state.sort, INTL_TAG[locale]) : []),
    [query.data, state.sort, locale],
  );
  const pages = pageCount(sorted.length);
  const visible = paginate(sorted, state.page);

  // Подписи активных фильтров: коды (`european`, `terrace`) гостю ничего не
  // говорят, поэтому чип показывает название из справочника, а если справочник
  // ещё едет — сам код, а не пустоту.
  const nameOfCuisine = (code: string) =>
    cuisines.data?.find((item) => item.id === code)?.name ?? code;
  const nameOfFeature = (code: string) =>
    amenities.data?.find((item) => item.id === code)?.name ?? code;

  return (
    <SiteChrome active="venues">
      <div className="w-full border-b border-line-strong bg-canvas py-4">
        <Container>
          <SearchPanel state={state} variant="bar" />
        </Container>
      </div>

      <Container className="flex flex-col gap-8 py-8 lg:flex-row">
        <FiltersRail state={state} onChange={update} />

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <nav aria-label={t.web.venue.breadcrumbLabel} className="text-[13px] leading-[18px] text-ink-tertiary">
            <Link href="/" className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {t.web.venue.breadcrumbHome}
            </Link>
            <span aria-hidden="true"> / </span>
            <span>{t.web.venue.breadcrumbVenues}</span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-[32px] font-bold leading-10 tracking-[-0.6px] text-ink">
                {t.web.catalog.title}
              </h1>
              <p className="text-bodyM text-ink-secondary">
                {t.web.catalog.subtitle(
                  city ?? "",
                  t.web.format.venues(query.data?.items.length ?? 0),
                )}
              </p>
            </div>

            <label className="flex items-center gap-2 text-[14px] font-medium leading-5 text-ink">
              <span className="text-ink-secondary">{t.web.catalog.sort.label}</span>
              <select
                value={state.sort}
                onChange={(event) =>
                  update({ ...state, sort: event.target.value as CatalogSort, page: 1 })
                }
                className="h-11 cursor-pointer rounded-md border border-line-strong bg-canvas px-3 text-[14px] font-medium leading-5 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <option value="recommended">{t.web.catalog.sort.recommended}</option>
                <option value="rating">{t.web.catalog.sort.rating}</option>
                <option value="name">{t.web.catalog.sort.name}</option>
              </select>
            </label>
          </div>

          {hasActiveFilters(state) ? (
            <ul aria-label={t.web.catalog.active.label} className="flex flex-wrap items-center gap-2">
              {state.cuisines.map((code) => (
                <li key={`cuisine-${code}`}>
                  <ActiveChip
                    label={nameOfCuisine(code)}
                    onClear={() =>
                      update({ ...state, cuisines: toggleInList(state.cuisines, code), page: 1 })
                    }
                  />
                </li>
              ))}
              {state.features.map((code) => (
                <li key={`feature-${code}`}>
                  <ActiveChip
                    label={nameOfFeature(code)}
                    onClear={() =>
                      update({ ...state, features: toggleInList(state.features, code), page: 1 })
                    }
                  />
                </li>
              ))}
              {state.price ? (
                <li>
                  <ActiveChip
                    label={state.price}
                    onClear={() => update({ ...state, price: undefined, page: 1 })}
                  />
                </li>
              ) : null}
              {state.date ? (
                <li>
                  <ActiveChip
                    label={state.date}
                    onClear={() => update({ ...state, date: undefined, page: 1 })}
                  />
                </li>
              ) : null}
              {state.time ? (
                <li>
                  <ActiveChip
                    label={state.time}
                    onClear={() => update({ ...state, time: undefined, page: 1 })}
                  />
                </li>
              ) : null}
              {state.openNow ? (
                <li>
                  <ActiveChip
                    label={t.web.catalog.filters.openNow}
                    onClear={() => update({ ...state, openNow: false, page: 1 })}
                  />
                </li>
              ) : null}
              {state.onlineOnly ? (
                <li>
                  <ActiveChip
                    label={t.web.catalog.filters.onlineBookable}
                    onClear={() => update({ ...state, onlineOnly: false, page: 1 })}
                  />
                </li>
              ) : null}
              <li>
                <button
                  type="button"
                  onClick={() => update({ ...EMPTY_CATALOG_STATE })}
                  className="px-2 text-[13px] font-medium leading-[18px] text-ink-tertiary hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {t.web.catalog.active.clearAll}
                </button>
              </li>
            </ul>
          ) : null}

          <AsyncBlock
            query={query}
            isEmpty={() => sorted.length === 0}
            emptyText={t.web.catalog.empty.text}
            empty={
              <StateMessage title={t.web.catalog.empty.title} text={t.web.catalog.empty.text}>
                <Button size="m" variant="secondary" onClick={() => update({ ...EMPTY_CATALOG_STATE })}>
                  {t.web.catalog.empty.reset}
                </Button>
              </StateMessage>
            }
            skeleton={
              <div className="flex flex-col gap-4">
                {["a", "b", "c", "d", "e"].map((key) => (
                  <Skeleton key={key} className="h-[229px] rounded-card" />
                ))}
              </div>
            }
          >
            {() => (
              <>
                {/* Пока едет новая выдача, старая гаснет, но остаётся: экран
                    не должен схлопываться в скелет от каждого клика по чипу. */}
                <ul className={cx("flex flex-col gap-4", query.isFetching && "opacity-70")}>
                  {visible.map((venue) => (
                    <li key={venue.id}>
                      <VenueWideCard venue={venue} />
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={Math.min(state.page, pages)}
                  pages={pages}
                  onChange={(page) => update({ ...state, page })}
                />
              </>
            )}
          </AsyncBlock>
        </div>
      </Container>
    </SiteChrome>
  );
}

/** Чип применённого фильтра с крестиком (узел «Chip / active» кадра 3258:2). */
function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  const t = useT();
  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-full border border-brand bg-brand-subtle py-2 pl-3.5 pr-2 text-[13px] font-medium leading-[18px] text-brand-text">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={t.web.catalog.active.clear(label)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-brand hover:text-ink-on-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <path
            d="M3 3l6 6M9 3l-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  );
}

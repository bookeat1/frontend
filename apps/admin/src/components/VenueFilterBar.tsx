"use client";

import { t } from "@/lib/i18n";
import {
  EMPTY_VENUE_FILTERS,
  hasActiveVenueFilters,
  type FilterOption,
  type VenueFilters,
  type VenueStatusFilter,
} from "@/lib/venue-filters";

import { Button } from "./ui/Button";
import { Field, Select, TextInput } from "./ui/FormControls";

/**
 * Панель фильтров каталога заведений: название, город, кухня, удобство,
 * показывается или скрыто. Работают вместе (И), сбрасываются одной кнопкой.
 *
 * Компонент НИЧЕГО не знает ни про запросы, ни про то, откуда взялись списки
 * города и кухни: ему передают готовые `FilterOption[]`. Это не украшение —
 * список кухонь сейчас собирается из данных (в базе свободный текст с 18
 * написаниями), а после справочника кухонь будет приходить оттуда; при такой
 * границе замена стоит одну функцию в `lib/venue-filters.ts`.
 *
 * Состояние не спрятано: выбранное видно и в самих полях, и отдельной строкой
 * пилюль, каждая из которых снимается по отдельности.
 */
const copy = t.admin.venueFilters;

const STATUS_OPTIONS: { value: VenueStatusFilter; label: string }[] = [
  { value: "all", label: copy.statusAll },
  { value: "active", label: copy.statusActive },
  { value: "hidden", label: copy.statusHidden },
];

export function VenueFilterBar({
  filters,
  onChange,
  cityOptions,
  cuisineOptions,
  featureOptions = [],
  shown,
  total,
}: {
  filters: VenueFilters;
  onChange: (next: VenueFilters) => void;
  cityOptions: FilterOption[];
  cuisineOptions: FilterOption[];
  /** Удобства из справочника. Пусто = справочник не ответил — поле тогда не
   * показывается вовсе: выпадающий список без вариантов ничего не отбирает и
   * читается как поломка. */
  featureOptions?: FilterOption[];
  /** Сколько строк осталось после фильтров и сколько было всего. */
  shown: number;
  total: number;
}) {
  const patch = (change: Partial<VenueFilters>) => onChange({ ...filters, ...change });
  const active = hasActiveVenueFilters(filters);

  const chips: { key: string; label: string; clear: Partial<VenueFilters> }[] = [];
  if (filters.search.trim()) {
    chips.push({
      key: "search",
      label: copy.chipSearch(filters.search.trim()),
      clear: { search: "" },
    });
  }
  if (filters.city) {
    chips.push({ key: "city", label: filters.city, clear: { city: "" } });
  }
  if (filters.cuisine) {
    const option = cuisineOptions.find((item) => item.value === filters.cuisine);
    chips.push({
      key: "cuisine",
      label: option?.label ?? filters.cuisine,
      clear: { cuisine: "" },
    });
  }
  if (filters.feature) {
    const option = featureOptions.find((item) => item.value === filters.feature);
    chips.push({
      key: "feature",
      label: option?.label ?? filters.feature,
      clear: { feature: "" },
    });
  }
  if (filters.status !== "all") {
    chips.push({
      key: "status",
      label: filters.status === "active" ? copy.chipStatusActive : copy.chipStatusHidden,
      clear: { status: "all" },
    });
  }

  return (
    <div className="mt-md flex flex-col gap-md">
      <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Field label={copy.searchLabel} htmlFor="venue-filter-search">
          <TextInput
            id="venue-filter-search"
            type="search"
            placeholder={copy.searchPlaceholder}
            value={filters.search}
            onChange={(e) => patch({ search: e.target.value })}
          />
        </Field>

        <Field label={copy.cityLabel} htmlFor="venue-filter-city">
          <Select
            id="venue-filter-city"
            value={filters.city}
            onChange={(e) => patch({ city: e.target.value })}
          >
            <option value="">{copy.cityAny}</option>
            {cityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={copy.cuisineLabel} htmlFor="venue-filter-cuisine">
          <Select
            id="venue-filter-cuisine"
            value={filters.cuisine}
            onChange={(e) => patch({ cuisine: e.target.value })}
          >
            <option value="">{copy.cuisineAny}</option>
            {cuisineOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        {featureOptions.length > 0 ? (
          <Field label={copy.featureLabel} htmlFor="venue-filter-feature">
            <Select
              id="venue-filter-feature"
              value={filters.feature}
              onChange={(e) => patch({ feature: e.target.value })}
            >
              <option value="">{copy.featureAny}</option>
              {featureOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label={copy.statusLabel} htmlFor="venue-filter-status">
          <Select
            id="venue-filter-status"
            value={filters.status}
            onChange={(e) => patch({ status: e.target.value as VenueStatusFilter })}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-sm">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-label={copy.removeChip(chip.label)}
            onClick={() => patch(chip.clear)}
            className="inline-flex min-h-[36px] items-center gap-xs rounded-pill bg-chip px-md text-[13px] text-text hover:bg-[#e7e7e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="max-w-[220px] truncate">{chip.label}</span>
            <span aria-hidden="true">×</span>
          </button>
        ))}
        {active ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(EMPTY_VENUE_FILTERS)}>
            {copy.reset}
          </Button>
        ) : null}
        <span className="text-[13px] text-text-muted" role="status">
          {copy.found(shown, total)}
        </span>
      </div>
    </div>
  );
}

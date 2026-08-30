"use client";

import { useState } from "react";

import { AsyncBlock, Skeleton } from "@web/components/state/AsyncBlock";
import { cx } from "@web/lib/cx";
import { PRICE_LEVELS, toggleInList, type CatalogState } from "@web/lib/catalog-params";
import { useT } from "@web/lib/locale";
import { useAmenities, useCuisines } from "@web/lib/queries";

/**
 * Колонка фильтров — Figma, узел «Card / Filters» кадра 3258:2: белая карточка
 * 288 шириной, паддинг 20, просвет 24 между группами, галочки 20×20 с
 * радиусом 4, ценовые пилюли 56×38.
 *
 * Списки кухонь и удобств приходят СПРАВОЧНИКАМИ с сервера, а не зашиты: их
 * состав меняет владелец в кабинете. Счётчиков рядом с кухнями в макете шесть
 * штук («32», «21»…), но `GET /cuisines` их не отдаёт — считать их на клиенте
 * значило бы показывать число заведений на текущей странице, а не в каталоге,
 * поэтому у кухонь счётчика нет. У удобств он есть и он серверный
 * (`venue_count`), но и его не показываем: справочник отдаёт одно число на всю
 * платформу, а колонка стоит рядом с выдачей по конкретному городу.
 *
 * Кнопки «Показать N мест» из макета здесь нет: фильтр применяется сразу, и
 * кнопка «применить» рядом с уже применённым фильтром — это обещание второго
 * шага, которого нет.
 */
export function FiltersRail({
  state,
  onChange,
}: {
  state: CatalogState;
  onChange: (next: CatalogState) => void;
}) {
  const t = useT();
  const cuisines = useCuisines();
  const amenities = useAmenities();
  const [expanded, setExpanded] = useState(false);

  const patch = (partial: Partial<CatalogState>) => onChange({ ...state, ...partial, page: 1 });

  return (
    <aside
      aria-label={t.web.catalog.filters.title}
      className="flex w-full flex-col gap-6 rounded-lg border border-line bg-canvas p-5 lg:w-[288px] lg:shrink-0"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[19px] font-bold leading-[26px] text-ink">
          {t.web.catalog.filters.title}
        </h2>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...state,
              text: state.text,
              cuisines: [],
              features: [],
              price: undefined,
              date: undefined,
              time: undefined,
              guests: undefined,
              openNow: false,
              onlineOnly: false,
              page: 1,
            })
          }
          className="text-[14px] font-medium leading-5 text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {t.web.catalog.filters.reset}
        </button>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-[15px] font-semibold leading-[22px] text-ink">
          {t.web.catalog.filters.cuisine}
        </legend>
        <AsyncBlock
          query={cuisines}
          emptyText={t.web.catalog.filters.empty}
          skeleton={
            <div className="flex flex-col gap-3">
              {["a", "b", "c", "d"].map((key) => (
                <Skeleton key={key} className="h-5 w-full" />
              ))}
            </div>
          }
        >
          {(items) => {
            const visible = expanded ? items : items.slice(0, VISIBLE_CUISINES);
            return (
              <div className="flex flex-col gap-3">
                {visible.map((cuisine) => (
                  <CheckboxRow
                    key={cuisine.id}
                    label={cuisine.name}
                    checked={state.cuisines.includes(cuisine.id)}
                    onChange={() => patch({ cuisines: toggleInList(state.cuisines, cuisine.id) })}
                  />
                ))}
                {items.length > VISIBLE_CUISINES ? (
                  <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className="self-start text-[14px] font-medium leading-5 text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {expanded
                      ? t.web.catalog.filters.collapse
                      : t.web.catalog.filters.showAll(items.length)}
                  </button>
                ) : null}
              </div>
            );
          }}
        </AsyncBlock>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-[15px] font-semibold leading-[22px] text-ink">
          {t.web.catalog.filters.price}
        </legend>
        <div className="flex flex-wrap gap-2">
          {PRICE_LEVELS.map((level) => {
            const active = state.price === level;
            return (
              <button
                key={level}
                type="button"
                aria-pressed={active}
                onClick={() => patch({ price: active ? undefined : level })}
                className={cx(
                  "inline-flex h-chip min-w-[56px] items-center justify-center rounded-slot px-3 text-[14px] font-semibold leading-5",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  active
                    ? "border border-brand bg-brand-subtle text-brand-text"
                    : "bg-subtle text-ink-secondary",
                )}
              >
                {level}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-[15px] font-semibold leading-[22px] text-ink">
          {t.web.catalog.filters.features}
        </legend>
        <AsyncBlock
          query={amenities}
          emptyText={t.web.catalog.filters.empty}
          skeleton={
            <div className="flex flex-col gap-3">
              {["a", "b", "c", "d"].map((key) => (
                <Skeleton key={key} className="h-5 w-full" />
              ))}
            </div>
          }
        >
          {(items) => (
            <div className="flex flex-col gap-3">
              {items.map((amenity) => (
                <CheckboxRow
                  key={amenity.id}
                  label={amenity.name}
                  checked={state.features.includes(amenity.id)}
                  onChange={() => patch({ features: toggleInList(state.features, amenity.id) })}
                />
              ))}
            </div>
          )}
        </AsyncBlock>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-[15px] font-semibold leading-[22px] text-ink">
          {t.web.catalog.filters.extra}
        </legend>
        <CheckboxRow
          label={t.web.catalog.filters.openNow}
          checked={state.openNow}
          onChange={() => patch({ openNow: !state.openNow })}
        />
        <CheckboxRow
          label={t.web.catalog.filters.onlineBookable}
          checked={state.onlineOnly}
          onChange={() => patch({ onlineOnly: !state.onlineOnly })}
        />
      </fieldset>
    </aside>
  );
}

/** Сколько кухонь видно до нажатия «Показать все» — как в макете (шесть). */
const VISIBLE_CUISINES = 6;

/**
 * Строка с галочкой. Настоящий `<input type="checkbox">` внутри `<label>`:
 * так по подписи можно кликать, а клавиатура и скринридер получают элемент,
 * который они умеют. Своя рамка нарисована поверх — макетная 20×20 с радиусом
 * 4, — а системная скрыта `appearance-none`.
 */
function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className={cx(
          "h-5 w-5 shrink-0 appearance-none rounded-sm border transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          checked
            ? "border-brand bg-brand bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22><path d=%22M5 10.5l3.2 3.2L15 7%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] bg-center bg-no-repeat"
            : "border-line-control bg-canvas",
        )}
      />
      <span className="min-w-0 break-words text-[14px] leading-5 text-ink-secondary">{label}</span>
    </label>
  );
}

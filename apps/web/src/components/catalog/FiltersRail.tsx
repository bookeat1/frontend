"use client";

import { useCallback, useState } from "react";
import { webCatalog } from "@bookeat/design-tokens";

import { AsyncBlock, Skeleton } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { Modal } from "@web/components/ui/Modal";
import { cx } from "@web/lib/cx";
import {
  PRICE_LEVELS,
  clearFilters,
  countActiveFilters,
  toggleInList,
  type CatalogState,
} from "@web/lib/catalog-params";
import { useT } from "@web/lib/locale";
import { useAmenities, useCuisines } from "@web/lib/queries";

/**
 * Колонка фильтров — Figma QovvuAoI9YxsLMwWkfgKN8, узел «Filters rail (sticky)»
 * 3525:14386: белая карточка 288 шириной, радиус 16, паддинг 20, просвет 24
 * между группами, галочки 20×20 с радиусом 4.
 *
 * ОБВОДКИ У КАРТОЧКИ НЕТ — под ней та же двойная тень, что под карточками
 * заведений. Раньше здесь стояла рамка `border/default` и тени не было вовсе:
 * колонка читалась как таблица, а не как карточка.
 *
 * ЦЕНОВЫЕ ПИЛЮЛИ делят строку поровну (`flex-1`, узел 3525:14424), а не
 * переносятся по мере надобности: в макете это ряд из четырёх равных долей.
 *
 * ДЛИННЫЕ СПРАВОЧНИКИ РАСКРЫВАЮТСЯ ПО КЛИКУ — и кухни, и особенности. У кухонь
 * так нарисовано (шесть флажков и ссылка «Показать все 14», узел 3525:14421),
 * у особенностей в макете нарисовано пять штук без ссылки, но справочник
 * отдаёт их больше, и требование владельца от 02.09.2026 — показывать их по
 * клику, а не списком целиком.
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
 *
 * НИЖЕ `lg` КОЛОНКИ НЕТ (`apps/web/docs/responsive.md`, § 5, дыра № 7).
 * Раньше `<aside>` стоял первым в `flex-col`, и на телефоне гость скроллил
 * мимо экрана галочек, чтобы увидеть первое заведение. Источник правды для
 * узких экранов — мобильное приложение (`apps/mobile/app/search.tsx`): на
 * экране только кнопка-ползунки со счётчиком выбранных фасетов и чипы
 * выбранного, сами фильтры — в шторке (`FilterSheet`). Здесь то же самое:
 * `FiltersRail` — `hidden lg:flex`, `FiltersSheetButton` — `lg:hidden`, а
 * группы флажков у них общие (`FiltersForm`), чтобы два набора фильтров не
 * разъехались в первую же правку.
 *
 * ШТОРКА — ЧЕРНОВИК, как в приложении: всё, что гость трогает внутри, живёт
 * в локальном состоянии и уходит в адрес только по «Применить»; крестик, Esc и
 * клик по затемнению — отмена; «Сбросить» очищает черновик, а не адрес.
 * Колонка `lg:` по-прежнему применяет каждую галочку сразу — на десктопе выдача
 * рядом и видна, второго шага там не нужно.
 *
 * Сама шторка — общий `Modal`, а не своя разметка снизу: контракт (§ 4) не
 * переносит компонент шторки, только поведение, а раскладку окна ниже `lg`
 * правит задача `chrome` (дыра № 11) — прямо в `Modal`, и фильтры получат её
 * автоматически.
 */

/**
 * Каркас колонки — общий с заглушкой `CatalogFallback`: у скелета и настоящего
 * блока одни и те же классы видимости и ширины, иначе заглушка на телефоне
 * снова показывала бы 560 px серого над выдачей (дыра № 9).
 */
export const FILTERS_RAIL_FRAME = "hidden w-full flex-col lg:flex lg:w-filters-rail lg:shrink-0";

/** Каркас кнопки «Фильтры» ниже `lg` — тоже общий с заглушкой. Высота чипа
 * (`h-chip`), как у мобильного `FilterButton`: он стоит в одном ряду с чипами
 * и не должен торчать над ними. */
export const FILTERS_BUTTON_FRAME = "h-chip shrink-0 rounded-full lg:hidden";

export function FiltersRail({
  state,
  onChange,
}: {
  state: CatalogState;
  onChange: (next: CatalogState) => void;
}) {
  const t = useT();

  return (
    <aside
      aria-label={t.web.catalog.filters.title}
      className={cx(FILTERS_RAIL_FRAME, "gap-6 rounded-lg bg-canvas p-5 shadow-card")}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[19px] font-bold leading-[26px] text-ink">
          {t.web.catalog.filters.title}
        </h2>
        <button
          type="button"
          onClick={() => onChange(clearFilters(state))}
          className="text-[14px] font-medium leading-5 text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {t.web.catalog.filters.reset}
        </button>
      </div>

      <FiltersForm state={state} onChange={onChange} />
    </aside>
  );
}

/**
 * Кнопка «Фильтры» со счётчиком и шторка за ней — то, что видно ниже `lg`
 * вместо колонки. Аналог `FilterButton` + `FilterSheet` приложения.
 *
 * Шторка МОНТИРУЕТСЯ при каждом открытии заново, поэтому её черновик всегда
 * заводится из применённого состояния, а не из остатков прошлой правки — тот
 * же эффект, что `useEffect` на `visible` в мобильном `FilterSheet`.
 */
export function FiltersSheetButton({
  state,
  onChange,
}: {
  state: CatalogState;
  onChange: (next: CatalogState) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const count = countActiveFilters(state);

  // Стабильная ссылка: `Modal` держит `onClose` в зависимостях эффекта, и
  // новая функция на каждый рендер переставляла бы фокус на первую галочку
  // при каждом тапе по черновику.
  const close = useCallback(() => setOpen(false), []);
  const apply = useCallback(
    (next: CatalogState) => {
      onChange(next);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        // Имя со счётчиком, как у мобильной кнопки: немой кружок с цифрой
        // скринридеру ничего не говорит.
        aria-label={count > 0 ? t.a11y.openFiltersWithCount(count) : t.a11y.openFilters}
        onClick={() => setOpen(true)}
        className={cx(
          FILTERS_BUTTON_FRAME,
          "inline-flex items-center gap-2 bg-subtle pl-3 pr-4 text-[14px] font-medium leading-5 text-ink",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        )}
      >
        {/* Ползунки 20×20 — тот же знак, что `FadersHorizontal` в приложении. */}
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path
            d="M3 6h9M15 6h2M3 14h2M8 14h9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="13.5" cy="6" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="6.5" cy="14" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        {t.web.catalog.filters.title}
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[12px] font-semibold leading-4 text-ink-on-brand"
          >
            {count}
          </span>
        ) : null}
      </button>

      {open ? <FiltersSheet state={state} onApply={apply} onClose={close} /> : null}
    </>
  );
}

function FiltersSheet({
  state,
  onApply,
  onClose,
}: {
  state: CatalogState;
  onApply: (next: CatalogState) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<CatalogState>(state);

  return (
    <Modal title={t.web.catalog.filters.title} onClose={onClose}>
      {/* Список прокручивается внутри окна, а кнопки остаются под рукой:
          иначе «Применить» уезжало бы под 14 кухонь и 19 удобств. Отступ
          `-mx-1 px-1` — место под рамку фокуса галочек, не поле. */}
      <div className="-mx-1 max-h-[min(60dvh,560px)] overflow-y-auto px-1">
        <FiltersForm state={draft} onChange={setDraft} />
      </div>
      <div className="flex flex-col gap-2">
        <Button size="l" block onClick={() => onApply(draft)}>
          {t.search.filters.apply}
        </Button>
        <Button size="l" variant="secondary" block onClick={() => setDraft(clearFilters(draft))}>
          {t.web.catalog.filters.reset}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Группы фильтров — одна разметка для колонки и для шторки. `onChange`
 * получает уже готовое состояние: колонка отправляет его в адрес, шторка — в
 * черновик.
 */
function FiltersForm({
  state,
  onChange,
}: {
  state: CatalogState;
  onChange: (next: CatalogState) => void;
}) {
  const t = useT();
  const cuisines = useCuisines();
  const amenities = useAmenities();
  const [cuisinesExpanded, setCuisinesExpanded] = useState(false);
  const [featuresExpanded, setFeaturesExpanded] = useState(false);

  const patch = (partial: Partial<CatalogState>) => onChange({ ...state, ...partial, page: 1 });

  return (
    <div className="flex flex-col gap-6">
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
          {(items) => (
            <CollapsibleRows
              items={items}
              visibleCount={VISIBLE_CUISINES}
              expanded={cuisinesExpanded}
              onToggleExpanded={() => setCuisinesExpanded((value) => !value)}
              isChecked={(item) => state.cuisines.includes(item.id)}
              onToggle={(item) => patch({ cuisines: toggleInList(state.cuisines, item.id) })}
            />
          )}
        </AsyncBlock>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-[15px] font-semibold leading-[22px] text-ink">
          {t.web.catalog.filters.price}
        </legend>
        {/* Ряд из четырёх РАВНЫХ долей (узел 3525:14424), а не переносимая
            россыпь: «₸₸₸₸» шире «₸», и без `flex-1` пилюли разной ширины. */}
        <div className="flex gap-2">
          {PRICE_LEVELS.map((level) => {
            const active = state.price === level;
            return (
              <button
                key={level}
                type="button"
                aria-pressed={active}
                onClick={() => patch({ price: active ? undefined : level })}
                className={cx(
                  "inline-flex h-chip flex-1 items-center justify-center rounded-slot px-3 text-[14px] font-semibold leading-5",
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
            <CollapsibleRows
              items={items}
              visibleCount={VISIBLE_FEATURES}
              expanded={featuresExpanded}
              onToggleExpanded={() => setFeaturesExpanded((value) => !value)}
              isChecked={(item) => state.features.includes(item.id)}
              onToggle={(item) => patch({ features: toggleInList(state.features, item.id) })}
            />
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
    </div>
  );
}

/** Сколько строк видно до нажатия «Показать все» — как в макете: шесть кухонь
 * (узел 3525:14421) и пять особенностей (узлы 3525:14435…14457). */
const VISIBLE_CUISINES = webCatalog.visibleRows.cuisines;
const VISIBLE_FEATURES = webCatalog.visibleRows.features;

/**
 * Группа флажков, которая раскрывается по клику.
 *
 * Одна на кухни и на особенности: две почти одинаковые группы разъехались бы в
 * первую же правку.
 *
 * ЛИМИТ СЧИТАЕТ ТОЛЬКО НЕОТМЕЧЕННЫЕ. Отмеченное показывается всегда — снять
 * фильтр, которого не видно, нельзя, — но занимать им места из лимита нечестно
 * в обе стороны:
 *
 *   • шесть особенностей, отмечена шестая: при счёте «первые пять плюс
 *     отмеченные» на экране все шесть, а кнопка всё равно предлагает
 *     «Показать все 6» и по нажатию только меняет надпись;
 *   • десять отмеченных из адресной строки съедали бы лимит целиком, и
 *     свёрнутый список переставал быть свёрнутым.
 *
 * КНОПКА ЕСТЬ ТОЛЬКО ТОГДА, КОГДА СВОРАЧИВАНИЕ ЧТО-ТО ПРЯЧЕТ. Условие
 * считается для СВЁРНУТОГО состояния независимо от текущего — иначе «Свернуть»
 * исчезала бы сразу после раскрытия и свернуть обратно было бы нечем.
 */
function CollapsibleRows<T extends { id: string; name: string }>({
  items,
  visibleCount,
  expanded,
  onToggleExpanded,
  isChecked,
  onToggle,
}: {
  items: T[];
  visibleCount: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  isChecked: (item: T) => boolean;
  onToggle: (item: T) => void;
}) {
  const t = useT();
  const collapsed = collapsedRows(items, visibleCount, isChecked);
  const visible = expanded ? items : collapsed;
  // Сколько строк прячет СВЁРНУТЫЙ вид — считается всегда, а не только пока
  // список свёрнут.
  const hidden = items.length - collapsed.length;

  return (
    <div className="flex flex-col gap-3">
      {visible.map((item) => (
        <CheckboxRow
          key={item.id}
          label={item.name}
          checked={isChecked(item)}
          onChange={() => onToggle(item)}
        />
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggleExpanded}
          className="self-start text-[14px] font-medium leading-5 text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {expanded ? t.web.catalog.filters.collapse : t.web.catalog.filters.showAll(items.length)}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Что видно в СВЁРНУТОМ виде: первые `visibleCount` НЕотмеченных плюс все
 * отмеченные, в исходном порядке справочника.
 */
function collapsedRows<T extends { id: string; name: string }>(
  items: T[],
  visibleCount: number,
  isChecked: (item: T) => boolean,
): T[] {
  let unchecked = 0;
  return items.filter((item) => {
    if (isChecked(item)) return true;
    if (unchecked < visibleCount) {
      unchecked += 1;
      return true;
    }
    return false;
  });
}

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
          // Радиус 4 из макета (узел «Card / Filters» кадра 3258:2), а не
          // `rounded-sm` кита: у того 8, и на квадрате 20 это уже почти круг —
          // галочка читалась как переключатель.
          "h-5 w-5 shrink-0 appearance-none rounded-checkbox border transition-colors",
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

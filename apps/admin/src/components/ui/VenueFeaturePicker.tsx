"use client";

import {
  MAX_VENUE_FEATURES,
  splitIntoColumns,
  toggleVenueFeature,
  type VenueFeature,
} from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { CheckboxRow } from "./FormControls";

/**
 * Удобства заведения — галочки из справочника платформы.
 *
 * Компонент БЕЗ запросов: грузят и сохраняют его два разных владельца — форма
 * заведения у суперадмина (VenuesView) и карточка «Удобства» в настройках
 * самого заведения. Ровно так же устроены CuisinePicker и SocialLinksField, и
 * по той же причине: иначе получились бы две почти одинаковые формы, которые
 * разъедутся на первой правке.
 *
 * ПРО РАСКЛАДКУ (удобств в справочнике девятнадцать).
 *   • Одним столбцом это полтора экрана прокрутки, в котором не видно ни
 *     начала, ни конца, — поэтому от `sm` (640 px) их два. Ниже 640 колонка
 *     одна: на 360 px две колонки галочек дают подписи в две-три строки, а
 *     «Спортивные трансляции» и «Детские стульчики» и так длинные.
 *   • Раскладка ПО КОЛОНКАМ (сверху вниз, потом следующая), а не построчно:
 *     справочник отсортирован платформой, и «одну длинную колонку разрезали
 *     пополам» читается по порядку, а построчная («1 2 / 3 4») заставляет
 *     читать зигзагом. Когда колонка схлопывается в одну, порядок остаётся тем
 *     же — колонки просто встают друг под друга.
 *   • ГРУППИРОВКИ ПО СМЫСЛУ НЕТ намеренно. У записи справочника нет ни поля
 *     группы, ни категории (см. featureResponse в
 *     internal/transport/rest/venuefeatures/dto.go) — «Еда», «Комфорт»,
 *     «Религия» пришлось бы придумать в панели и держать в ней вручную. Это
 *     ровно тот способ, которым в приложении однажды завёлся фильтр из семи
 *     удобств, о которых сервер не знал.
 */

const copy = t.admin.venueFeatures;

export function VenueFeaturePicker({
  options,
  selected,
  onChange,
  disabled = false,
  showTitle = true,
  idPrefix = "venue-feature",
}: {
  /** Что можно отметить. Должен содержать и уже отмеченное — иначе выбранному
   * удобству неоткуда взять название. */
  options: readonly VenueFeature[];
  /** id отмеченных удобств. */
  selected: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Заголовок «Удобства» рисует сам блок; в карточке настроек его уже даёт
   * заголовок карточки. */
  showTitle?: boolean;
  idPrefix?: string;
}) {
  const chosen = selected.filter((id) => options.some((item) => item.id === id));
  const limitReached = chosen.length >= MAX_VENUE_FEATURES;
  // Две колонки от sm; ниже — одна. Разбиение считается на две всегда, потому
  // что вторая колонка просто встаёт под первой и порядок не меняется.
  const columns = splitIntoColumns(options, 2);

  const toggle = (id: string) => {
    const result = toggleVenueFeature(chosen, id);
    if (result.ok) onChange(result.ids);
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-sm border-0 p-0">
      {showTitle ? (
        <legend className="text-sm font-medium text-text">{copy.title}</legend>
      ) : (
        <legend className="sr-only">{copy.title}</legend>
      )}
      <p className="max-w-prose text-[12px] text-text-muted">{copy.description}</p>

      {options.length === 0 ? (
        <p className="text-[13px] text-text-muted">{copy.dictionaryEmpty}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-lg sm:grid-cols-2">
            {columns.map((column, index) => (
              <ul key={index} className="flex min-w-0 flex-col">
                {column.map((item) => {
                  const checked = chosen.includes(item.id);
                  return (
                    <li key={item.id} className="min-w-0">
                      <CheckboxRow
                        label={item.name}
                        checked={checked}
                        // Потолок запрещает СТАВИТЬ галочку, но не снимать:
                        // иначе заведение с пятнадцатью удобствами не смогло бы
                        // убрать лишнее.
                        disabled={disabled || (!checked && limitReached)}
                        onChange={() => toggle(item.id)}
                      />
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>

          <p className="text-[12px] text-text-muted" data-testid={`${idPrefix}-counter`}>
            {copy.counter(chosen.length, MAX_VENUE_FEATURES)}
            {limitReached ? ` — ${copy.limitReached}` : ""}
          </p>
        </>
      )}
    </fieldset>
  );
}

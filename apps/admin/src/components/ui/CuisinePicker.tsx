"use client";

import {
  MAX_VENUE_CUISINES,
  deselectCuisine,
  makeMainCuisine,
  selectCuisine,
  type VenueCuisine,
} from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { Button } from "./Button";

/**
 * Выбор кухонь заведения из справочника: до пяти штук, порядок значим, первая —
 * главная.
 *
 * Компонент БЕЗ запросов — грузят и сохраняют его два разных владельца: форма
 * заведения у суперадмина (VenuesView) и карточка «Кухни» в настройках самого
 * заведения. Ровно так же устроен SocialLinksField, и по той же причине: иначе
 * получились бы две почти одинаковые формы, которые разъедутся на первой правке.
 *
 * Раскладка: сверху ВЫБРАННЫЕ по порядку (нумерованный список — порядок здесь
 * часть данных, а не оформление), снизу то, что можно добавить. Перенос кухни
 * на первое место — отдельная кнопка «Сделать главной»: перетаскивание мышью на
 * телефоне не работает, а главная кухня — единственная позиция, которая правда
 * что-то меняет (из неё собирается строка cuisine_type для старых клиентов).
 */

const copy = t.admin.venueCuisines;

/** Список для выбора: активный справочник плюс те кухни заведения, которых в
 * нём уже нет (скрыли после того, как заведение их выбрало). Показать такую
 * кухню как есть честнее, чем молча выбросить чужую запись из набора. */
export function mergeCuisineOptions(
  dictionary: readonly VenueCuisine[],
  current: readonly VenueCuisine[],
): VenueCuisine[] {
  const known = new Set(dictionary.map((item) => item.id));
  return [...dictionary, ...current.filter((item) => !known.has(item.id))];
}

export function CuisinePicker({
  options,
  selected,
  onChange,
  disabled = false,
  showTitle = true,
}: {
  /** Что можно выбрать. Должен содержать и уже выбранное — иначе выбранной
   * кухне неоткуда взять название. */
  options: readonly VenueCuisine[];
  /** id выбранных кухонь В ПОРЯДКЕ заведения. */
  selected: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Заголовок «Кухни» рисует сам блок; в карточке настроек его уже даёт
   * заголовок карточки. */
  showTitle?: boolean;
}) {
  const byId = new Map(options.map((item) => [item.id, item]));
  const chosen = selected.filter((id) => byId.has(id));
  const available = options.filter((item) => !selected.includes(item.id));
  const limitReached = chosen.length >= MAX_VENUE_CUISINES;

  const add = (id: string) => {
    const result = selectCuisine(chosen, id);
    if (result.ok) onChange(result.ids);
  };

  return (
    <div className="flex flex-col gap-sm">
      {showTitle ? <span className="text-sm font-medium text-text">{copy.title}</span> : null}
      <p className="max-w-prose text-[12px] text-text-muted">{copy.description}</p>

      {options.length === 0 ? (
        <p className="text-[13px] text-text-muted">{copy.dictionaryEmpty}</p>
      ) : (
        <>
          {chosen.length === 0 ? (
            <p className="text-[13px] text-text-muted">{copy.empty}</p>
          ) : (
            <ol className="flex flex-col gap-xs">
              {chosen.map((id, index) => {
                const item = byId.get(id)!;
                return (
                  <li
                    key={id}
                    className="flex flex-wrap items-center gap-sm rounded-card border border-hairline bg-white px-md py-sm"
                  >
                    <span className="text-[12px] text-text-muted">{index + 1}.</span>
                    <span className="min-w-0 break-words text-sm text-text">{item.name}</span>
                    {index === 0 ? (
                      <span className="rounded-pill bg-chip px-sm py-xxs text-[11px] uppercase tracking-wide text-text-muted">
                        {copy.mainBadge}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        aria-label={copy.makeMainAria(item.name)}
                        onClick={() => onChange(makeMainCuisine(chosen, id))}
                      >
                        {copy.makeMain}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      disabled={disabled}
                      aria-label={copy.removeAria(item.name)}
                      onClick={() => onChange(deselectCuisine(chosen, id))}
                    >
                      {copy.remove}
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}

          <p className="text-[12px] text-text-muted" role="status">
            {copy.counter(chosen.length, MAX_VENUE_CUISINES)}
            {limitReached ? ` — ${copy.limitReached}` : ""}
          </p>

          <span className="text-[13px] font-medium text-text">{copy.addTitle}</span>
          {available.length === 0 ? (
            <p className="text-[13px] text-text-muted">{copy.allChosen}</p>
          ) : (
            <ul className="flex flex-wrap gap-xs">
              {available.map((item) => (
                <li key={item.id}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={disabled || limitReached}
                    aria-label={copy.addAria(item.name)}
                    onClick={() => add(item.id)}
                  >
                    + {item.name}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

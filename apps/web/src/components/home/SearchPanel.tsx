"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@web/components/ui/Button";
import { cx } from "@web/lib/cx";
import { serializeCatalogParams, type CatalogState } from "@web/lib/catalog-params";
import { useT } from "@web/lib/locale";

/**
 * Панель поиска. Один компонент на два места макета:
 *   • «Search panel» героя главной (узел 3253:2) — белая плашка 1200×72;
 *   • «Search bar (sticky)» листинга (узел 3258:2) — та же четвёрка полей в
 *     строке под шапкой.
 * Второй экземпляр вместо копии — потому что поля, их порядок и то, во что
 * они превращаются в адресной строке, обязаны совпадать: гость, набравший
 * запрос в герое, попадает на листинг с теми же значениями в тех же полях.
 *
 * Дата и время ПУСТЫЕ по умолчанию. Фильтр доступности сервер применяет
 * только к паре «дата + гости», и подставить сегодняшнюю дату молча значило
 * бы спрятать половину каталога (17 заведений из 24 брони не принимают) без
 * единого признака, что фильтр включён.
 */
export function SearchPanel({
  state,
  variant = "hero",
}: {
  state: CatalogState;
  variant?: "hero" | "bar";
}) {
  const t = useT();
  const router = useRouter();
  const [text, setText] = useState(state.text);
  const [date, setDate] = useState(state.date ?? "");
  const [time, setTime] = useState(state.time ?? "");
  const [guests, setGuests] = useState(state.guests ?? 2);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = serializeCatalogParams({
      ...state,
      text,
      date: date || undefined,
      time: time || undefined,
      guests,
      // Любой новый поиск начинается с первой страницы: остаться на седьмой
      // после смены запроса значит показать пустоту.
      page: 1,
    });
    router.push(query ? `/venues?${query}` : "/venues");
  }

  const field = "flex flex-col gap-0.5 px-5 py-2";
  const label = "text-[12px] font-medium leading-4 tracking-[0.1px] text-ink-tertiary";
  const input =
    "w-full bg-transparent text-[16px] font-semibold leading-6 text-ink outline-none placeholder:font-normal placeholder:text-ink-tertiary";

  return (
    <form
      onSubmit={submit}
      className={cx(
        "flex w-full flex-wrap items-center gap-2 rounded-xl bg-canvas p-2",
        variant === "hero" ? "shadow-card" : "border border-line-strong",
      )}
    >
      <div className={cx(field, "min-w-[220px] flex-[3]")}>
        <label className={label} htmlFor="catalog-search-text">
          {t.web.home.hero.placeLabel}
        </label>
        <input
          id="catalog-search-text"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t.web.home.hero.placePlaceholder}
          className={input}
        />
      </div>

      <span aria-hidden="true" className="hidden h-10 w-px bg-line-strong lg:block" />

      <div className={cx(field, "min-w-[170px] flex-1")}>
        <label className={label} htmlFor="catalog-search-date">
          {t.web.home.hero.dateLabel}
        </label>
        <input
          id="catalog-search-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label={`${t.web.home.hero.dateLabel} — ${t.web.home.hero.anyDate}`}
          className={input}
        />
      </div>

      <span aria-hidden="true" className="hidden h-10 w-px bg-line-strong lg:block" />

      <div className={cx(field, "min-w-[130px]")}>
        <label className={label} htmlFor="catalog-search-time">
          {t.web.home.hero.timeLabel}
        </label>
        <input
          id="catalog-search-time"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          aria-label={`${t.web.home.hero.timeLabel} — ${t.web.home.hero.anyTime}`}
          className={input}
        />
      </div>

      <span aria-hidden="true" className="hidden h-10 w-px bg-line-strong lg:block" />

      <div className={cx(field, "min-w-[140px]")}>
        <label className={label} htmlFor="catalog-search-guests">
          {t.web.home.hero.guestsLabel}
        </label>
        <select
          id="catalog-search-guests"
          value={guests}
          onChange={(event) => setGuests(Number(event.target.value))}
          className={cx(input, "cursor-pointer appearance-none")}
        >
          {GUEST_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {t.web.format.guests(count)}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" className="ml-auto min-w-[140px]">
        {t.web.home.hero.submit}
      </Button>
    </form>
  );
}

/** До восьми гостей: дальше это уже банкет, который заведения принимают
 * отдельно (то же ограничение, что на экране брони в приложении). */
const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

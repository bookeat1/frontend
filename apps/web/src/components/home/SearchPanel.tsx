"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";

import { cx } from "@web/lib/cx";
import { serializeCatalogParams, type CatalogState } from "@web/lib/catalog-params";
import { nowTimeHhMm, searchDateLabel, todayIso } from "@web/lib/format";
import { useLocale } from "@web/lib/locale";

/**
 * Панель поиска. Один компонент на два места макета:
 *   • «Search panel» героя главной (узел 3253:36) — белая плашка 1200×72 с
 *     радиусом 20, паддингом 8 по горизонтали и просветом между полями 2;
 *   • строка поиска листинга (узел 3258:2) — та же четвёрка полей под шапкой.
 * Второй экземпляр вместо копии — потому что поля, их порядок и то, во что
 * они превращаются в адресной строке, обязаны совпадать: гость, набравший
 * запрос в герое, попадает на листинг с теми же значениями в тех же полях.
 *
 * ЧИСЛА ИЗ МАКЕТА, а не подобранные: панель 72 высотой, поля с радиусом 14 и
 * паддингом 8/20, разделители 1×72 (во всю высоту панели, не по высоте
 * текста), дата 190, время 130, гости 140, кнопка 168×48 с радиусом 14.
 * Всё это лежит в `webSearchPanel` (`packages/design-tokens/src/web.ts`).
 *
 * ДАТА И ВРЕМЯ ЗАПОЛНЕНЫ ПО УМОЛЧАНИЮ — сегодняшним днём и текущим временем
 * (замечание владельца 31.08.2026; в макете 3253:43/3253:47 поля тоже
 * заполнены). Прежнее решение было обратным, и у него была причина: пара
 * «дата + гости» включает серверный фильтр доступности, а он на тестовом
 * стенде отсекает большую часть каталога. Причина никуда не делась, поэтому
 * подставленные значения — это ЧЕРНОВИК формы: пока гость не нажал «Найти»,
 * ничего не отфильтровано, а на листинге применённые дата и время видны
 * отдельными чипами над выдачей.
 *
 * Оба значения появляются ПОСЛЕ гидратации: «сегодня» и «сейчас» знает только
 * браузер, у сервера свой часовой пояс, и посчитанное в разметке значение
 * разошлось бы с браузерным — это ошибка гидратации.
 */
export function SearchPanel({
  state,
  variant = "hero",
}: {
  state: CatalogState;
  variant?: "hero" | "bar";
}) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [text, setText] = useState(state.text);
  const [date, setDate] = useState(state.date ?? "");
  const [time, setTime] = useState(state.time ?? "");
  const [guests, setGuests] = useState(state.guests ?? 2);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const iso = todayIso();
    setToday(iso);
    // Черновые значения подставляем ОДИН раз и только в пустое поле: если
    // адрес принёс свою дату — она главнее, а если гость очистил поле руками,
    // эффект уже отработал и не вернёт значение обратно.
    setDate((current) => current || iso);
    setTime((current) => current || nowTimeHhMm());
  }, []);

  const dateLabel = date ? searchDateLabel(date, locale, t, today) : null;

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

  const label = "text-[12px] font-medium leading-4 tracking-[0.1px] text-ink-tertiary";
  const input =
    "w-full bg-transparent text-[16px] font-semibold leading-6 text-ink outline-none placeholder:font-normal placeholder:text-ink-tertiary";
  // Нативные поля даты и времени печатают значение в формате БРАУЗЕРА:
  // «mm/dd/yyyy» и «--:-- --» вместо «Сегодня, 25 авг» и «19:30» из макета.
  // Ни `lang`, ни `Intl` на это не влияют. Поэтому текст самого поля делаем
  // прозрачным и кладём поверх свою подпись, а поле остаётся нативным —
  // календарь, клавиатура и системный список часов достаются бесплатно.
  // Пока поле в фокусе, показываем родное содержимое: иначе гость правил бы
  // невидимые для себя цифры.
  const nativeValue =
    "search-native-picker peer col-start-1 row-start-1 cursor-pointer text-transparent focus:text-ink";
  // Места под значок календаря/часов здесь НЕ резервируется: значок скрыт
  // (см. .search-native-picker в globals.css), потому что в макете его нет, а
  // отведённые под него 28 px обрезали «Сегодня, 31 авг» многоточием.
  const shownValue =
    "pointer-events-none col-start-1 row-start-1 self-center truncate text-[16px] leading-6 peer-focus:invisible";
  const filled = "font-semibold text-ink";
  const placeholder = "font-normal text-ink-tertiary";

  return (
    <form
      onSubmit={submit}
      className={cx(
        "flex w-full flex-wrap items-center gap-panel-gap rounded-panel bg-canvas px-panel-x py-2 lg:h-panel lg:flex-nowrap lg:py-0",
        variant === "hero" ? "shadow-panel" : "border border-line-strong",
      )}
    >
      <Field className="min-w-[220px] flex-1">
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
      </Field>

      <Divider />

      <Field className="w-full lg:w-search-date">
        <label className={label} htmlFor="catalog-search-date">
          {t.web.home.hero.dateLabel}
        </label>
        <div className="grid">
          <input
            id="catalog-search-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            onClick={openPicker}
            className={cx(input, nativeValue)}
          />
          <span aria-hidden="true" className={cx(shownValue, date ? filled : placeholder)}>
            {dateLabel ?? t.web.home.hero.anyDate}
          </span>
        </div>
      </Field>

      <Divider />

      <Field className="w-full lg:w-search-time">
        <label className={label} htmlFor="catalog-search-time">
          {t.web.home.hero.timeLabel}
        </label>
        <div className="grid">
          <input
            id="catalog-search-time"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            onClick={openPicker}
            className={cx(input, nativeValue)}
          />
          <span aria-hidden="true" className={cx(shownValue, time ? filled : placeholder)}>
            {time || t.web.home.hero.anyTime}
          </span>
        </div>
      </Field>

      <Divider />

      <Field className="w-full lg:w-search-guests">
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
      </Field>

      {/* Кнопка панели поиска — НЕ `Button` кита: у той высота 54 и радиус 16,
          а макет 3253:52 рисует здесь 168×48 с радиусом 14. */}
      <button
        type="submit"
        className="ml-auto inline-flex h-submit w-full shrink-0 items-center justify-center rounded-field bg-brand text-[16px] font-semibold leading-6 text-ink-on-brand transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:w-submit"
      >
        {t.web.home.hero.submit}
      </button>
    </form>
  );
}

/**
 * Открыть родной календарь или список часов кликом по ЛЮБОМУ месту поля.
 *
 * Штатно в Chrome это делает только кнопка справа, а её мы прячем: в макете
 * её нет. `showPicker` есть не везде (и бросает, если браузер не считает
 * событие пользовательским) — отсюда проверка и `try`. Без него поле
 * остаётся обычным: клавиатурой оно работает всегда.
 */
function openPicker(event: MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  if (typeof input.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    // Браузер отказался — поле по-прежнему редактируется с клавиатуры.
  }
}

/** Ячейка панели: радиус 14, паддинг 8/20, просвет «подпись → значение» 2
 * (узлы 3253:37, 3253:41, 3253:45, 3253:49). */
function Field({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-0.5 rounded-field px-field-x py-field-y", className)}>
      {children}
    </div>
  );
}

/** Разделитель 1×72 — во всю высоту панели (узел 3253:40). На узком экране
 * поля стоят друг под другом, и вертикальная черта между ними бессмысленна. */
function Divider() {
  return <span aria-hidden="true" className="hidden w-px self-stretch bg-line-strong lg:block" />;
}

/** До восьми гостей: дальше это уже банкет, который заведения принимают
 * отдельно (то же ограничение, что на экране брони в приложении). */
const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

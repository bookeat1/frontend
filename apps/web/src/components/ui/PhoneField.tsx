"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Popover } from "@web/components/ui/Popover";
import { TextField, type TextFieldSize } from "@web/components/ui/TextField";
import { cx } from "@web/lib/cx";
import { useLocale } from "@web/lib/locale";
import {
  applyPhoneEdit,
  countriesByName,
  DEFAULT_COUNTRY,
  emptyPhone,
  formatNational,
  guessCountryByIp,
  isE164Complete,
  nationalLength,
  parsePhoneInput,
  phoneFromE164,
  toE164,
  type Country,
  type PhoneValue,
} from "@web/lib/phone";
import { useDismissable } from "@web/lib/use-dismissable";

/**
 * Поле телефона с выбором кода страны: «KZ +7 ▾ │ 777 123-45-67».
 *
 * Код страны — не текст, который гость правит, а выбор: он живёт в кнопке
 * слева, каретка в него попасть не может, стереть его нельзя. Справа —
 * только национальные цифры в маске страны.
 *
 * НАРУЖУ уходит E.164 («+77012345678») или пустая строка — никогда «+7» без
 * цифр и никогда строка в маске. `value` засевает поле (профиль, черновик) и
 * применяется заново, только когда называет ДРУГОЙ номер: иначе родитель,
 * возвращающий значение обратно, сбрасывал бы выбранную страну в момент,
 * когда гость стёр цифры.
 *
 * СТРАНА ПО УМОЛЧАНИЮ — догадка по IP (`guessCountryByIp`), и только для
 * ПУСТОГО поля, в котором гость ещё ничего не выбрал и не набрал. Догадка
 * приходит после гидратации, поэтому сервер и первая отрисовка всегда
 * показывают Казахстан; не пришла — Казахстан и остаётся.
 *
 * Список — по алфавиту названий на языке сайта. Вместо флагов — ISO-код:
 * эмодзи-флагов нет в шрифтах Windows, там они и так рисуются двумя буквами.
 */
export function PhoneField({
  label,
  value,
  onChange,
  onBlur,
  error,
  size = "m",
  disabled = false,
  autoFocus = false,
  placeholder,
}: {
  label: string;
  /** E.164 или "" для пустого поля. */
  value: string;
  onChange: (next: { e164: string; complete: boolean }) => void;
  onBlur?: () => void;
  error?: string;
  size?: TextFieldSize;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Образец из макета для казахстанского номера. Для остальных стран
   * образец строится из их собственной маски. */
  placeholder?: string;
}) {
  const { t, locale } = useLocale();
  const copy = t.phoneField;
  const listId = useId();

  const [phone, setPhone] = useState<PhoneValue>(() => phoneFromE164(value) ?? emptyPhone());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** Гость сам выбрал страну или начал набирать — догадка по IP опоздала. */
  const decided = useRef(phone.national !== "");

  const shown = formatNational(phone.national, phone.country);

  // Засев снаружи — только когда родитель называет другой номер.
  const lastEmitted = useRef(toE164(phone));
  if (value !== lastEmitted.current) {
    lastEmitted.current = value;
    const seeded = phoneFromE164(value) ?? emptyPhone(phone.country);
    if (toE164(seeded) !== toE164(phone)) {
      if (seeded.national !== "") decided.current = true;
      setPhone(seeded);
    }
  }

  const commit = useCallback(
    (next: PhoneValue) => {
      decided.current = true;
      setPhone(next);
      const e164 = toE164(next);
      lastEmitted.current = e164;
      onChange({ e164, complete: isE164Complete(e164) });
    },
    [onChange],
  );

  useEffect(() => {
    if (decided.current) return;
    let alive = true;
    void guessCountryByIp().then((country) => {
      if (!alive || !country || decided.current) return;
      setPhone((current) => (current.national === "" ? emptyPhone(country) : current));
    });
    return () => {
      alive = false;
    };
  }, []);

  const countries = useMemo(() => countriesByName(locale), [locale]);
  const selectedName =
    countries.find((country) => country.iso2 === phone.country.iso2)?.name ?? phone.country.name;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return countries;
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(q) ||
        country.dial.startsWith(q) ||
        country.iso2.toLowerCase() === q,
    );
  }, [countries, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  useDismissable(open, rootRef, close);

  function toggle() {
    if (open) {
      close();
      return;
    }
    setActive(Math.max(0, countries.findIndex((c) => c.iso2 === phone.country.iso2)));
    setOpen(true);
  }

  function choose(country: Country) {
    close();
    // Цифры остаются: ошибся страной и поправил — номер перенабирать не надо,
    // маска просто перегруппирует набранное.
    commit(parsePhoneInput(phone.national, country));
    buttonRef.current?.focus();
  }

  // Выбранная (или подсвеченная стрелками) строка видна без прокрутки.
  useEffect(() => {
    if (!open) return;
    const row = listRef.current?.children[active];
    if (row instanceof HTMLElement && typeof row.scrollIntoView === "function") {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [open, active]);

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      // Иначе Enter отправил бы форму входа с недовыбранной страной.
      event.preventDefault();
      const country = results[active];
      if (country) choose(country);
    }
  }

  const known = nationalLength(phone.country);
  const fieldPlaceholder =
    phone.country.iso2 === DEFAULT_COUNTRY.iso2 && placeholder
      ? placeholder
      : known === undefined
        ? copy.placeholder
        : formatNational("0".repeat(known), phone.country);

  const large = size === "l";

  return (
    <div ref={rootRef} className="relative w-full">
      <TextField
        label={label}
        size={size}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        autoFocus={autoFocus}
        disabled={disabled}
        value={shown}
        placeholder={fieldPlaceholder}
        error={error}
        onChange={(event) => commit(applyPhoneEdit(event.target.value, shown, phone))}
        onBlur={onBlur}
        leadingSlot={
          <>
            <button
              ref={buttonRef}
              type="button"
              disabled={disabled}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-label={copy.countryButtonLabel(selectedName, phone.country.dial)}
              onClick={toggle}
              className={cx(
                "flex shrink-0 items-center gap-1.5 rounded-sm text-ink disabled:cursor-not-allowed disabled:text-ink-disabled",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                large ? "text-[16px] font-semibold leading-6" : "text-[15px] font-medium leading-[22px]",
              )}
            >
              <span>{phone.country.iso2}</span>
              <span>{`+${phone.country.dial}`}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                <path
                  d="M2.5 4.5L6 8l3.5-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {large ? (
              <span aria-hidden="true" className="h-login-divider w-px shrink-0 bg-line-strong" />
            ) : null}
          </>
        }
      />

      {open ? (
        <Popover align="start" className="flex w-80 flex-col gap-2 p-2">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onSearchKey}
            placeholder={copy.pickerSearchPlaceholder}
            aria-label={copy.pickerSearchPlaceholder}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${results[active].iso2}` : undefined}
            autoComplete="off"
            className="h-input w-full rounded-md border border-line-control bg-canvas px-input-x text-[15px] font-medium leading-[22px] text-ink outline-none placeholder:text-ink-tertiary focus:border-brand"
          />
          {results.length === 0 ? (
            <p className="px-2 py-3 text-[13px] leading-[18px] text-ink-tertiary">{copy.pickerEmpty}</p>
          ) : (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={copy.pickerTitle}
              className="max-h-72 overflow-y-auto"
            >
              {results.map((country, index) => {
                const selected = country.iso2 === phone.country.iso2;
                return (
                  <li
                    key={country.iso2}
                    id={`${listId}-${country.iso2}`}
                    role="option"
                    aria-selected={selected}
                    // `mousedown` увёл бы фокус из поиска до клика.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(country)}
                    onMouseEnter={() => setActive(index)}
                    className={cx(
                      "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-[15px] leading-[22px] text-ink",
                      index === active && "bg-subtle",
                      selected && "font-semibold",
                    )}
                  >
                    <span className="min-w-0 flex-1">{country.name}</span>
                    <span className="shrink-0 text-ink-secondary">{`+${country.dial}`}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Popover>
      ) : null}
    </div>
  );
}

"use client";

import { useId, type ReactNode } from "react";
import type { Dictionary } from "@bookeat/i18n";
import type { AvailabilitySlot, DayAvailability } from "@bookeat/api/client";

import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Chip } from "@web/components/ui/Chip";
import { TextField } from "@web/components/ui/TextField";
import { TimeSlot } from "@web/components/ui/TimeSlot";
import { InlineDateField } from "@web/components/venue/BookingFields";
import type { AsyncBlockQuery } from "@web/components/state/AsyncBlock";
import { GUEST_OPTIONS } from "@web/lib/booking-options";
import { availableCount, emptyKind, groupSlots, slotAriaLabel } from "@web/lib/booking-slots";
import { cx } from "@web/lib/cx";
import { bookingDateLabel, slotTimeLabel } from "@web/lib/format";
import { formatNational, nationalDigits } from "@web/lib/phone";
import { useLocale } from "@web/lib/locale";

/**
 * Четыре карточки формы бронирования — узлы 3525:14819 / 14862 / 14898 /
 * 14923 файла QovvuAoI9YxsLMwWkfgKN8. Числа — в `webBookingFlow`
 * (`packages/design-tokens/src/web.ts`), там же у каждого номер узла.
 *
 * Карточки НЕ держат состояния: всё лежит на экране (`BookingScreen`), потому
 * что сводка справа читает те же значения, а отправка собирает из них тело
 * запроса. Здесь — только разметка и подписи.
 */

/** Оболочка карточки: радиус 24, паддинг 26 сверху и 28 с остальных сторон
 * (узел 3525:14819). Просвет внутри у четырёх карточек РАЗНЫЙ, поэтому его
 * задаёт вызывающий. */
export function FormCard({
  title,
  subtitle,
  gap,
  children,
}: {
  title: string;
  subtitle?: string;
  /** `gap-6` / `gap-4` / `gap-5` — 24 / 16 / 20 из макета. */
  gap: "gap-6" | "gap-4" | "gap-5";
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cx(
        "flex flex-col rounded-2xl bg-canvas px-flow-card-x pb-flow-card-b pt-flow-card-t shadow-card",
        gap,
      )}
    >
      <header className="flex flex-col gap-1">
        <h2 id={titleId} className="text-flow-title tracking-[-0.2px] text-ink">
          {title}
        </h2>
        {subtitle ? <p className="text-flow-subtitle text-ink-secondary">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------------ *
 * Карточка 1 — «Дата и время» (3525:14819)
 * ------------------------------------------------------------------------ */

export function WhenCard({
  date,
  today,
  slot,
  availability,
  disabled,
  onDateChange,
  onSlotChange,
}: {
  date: string | null;
  today: string | null;
  slot: string | null;
  availability: AsyncBlockQuery<DayAvailability>;
  /** Бронь в полёте: выбор заморожен. */
  disabled: boolean;
  onDateChange: (next: string) => void;
  onSlotChange: (next: string) => void;
}) {
  const { t, locale } = useLocale();
  const texts = t.web.booking.when;
  const slots = availability.data?.slots;
  const empty = slots ? emptyKind(slots) : null;
  const dateText = date ? bookingDateLabel(date, locale, "weekdayLong") : null;

  return (
    <FormCard title={texts.title} subtitle={texts.subtitle} gap="gap-6">
      {/* Узел 3525:14824: «строка даты → группы» через 14. */}
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-4">
          <InlineDateField
            id="booking-date"
            value={date}
            min={today}
            label={texts.dateLabel}
            shown={dateText}
            disabled={disabled}
            onChange={onDateChange}
          />
          {slots && empty === null ? (
            <span className="shrink-0 text-bodyS text-ink-tertiary">
              {texts.slotsAvailable(availableCount(slots))}
            </span>
          ) : null}
        </div>

        {date === "" ? (
          // Поле очищено — запрос выключен, и `AsyncBlock` показывал бы
          // загрузку вечно. Это ожидание гостя, а не загрузка.
          <StateMessage text={texts.pickDateText} />
        ) : (
          <AsyncBlock
            query={availability}
            emptyText={texts.emptyDay}
            isEmpty={(data) => emptyKind(data.slots) !== null}
            empty={<StateMessage text={texts[EMPTY_TEXT_KEY[empty ?? "day"]]} />}
            skeleton={<SlotsSkeleton />}
          >
            {(data) => (
              <div
                role="group"
                aria-label={texts.slotsLabel}
                className="flex flex-col gap-4"
              >
                {groupSlots(data.slots).map((group) => (
                  <div key={group.key} className="flex flex-col gap-1.5">
                    <p className="text-flow-slot-group text-ink-secondary">
                      {texts.groups[group.key]}
                    </p>
                    <div className="grid grid-cols-flow-slots gap-2">
                      {group.slots.map((item) => (
                        <SlotButton
                          key={item.startsAt}
                          slot={item}
                          selected={item.startsAt === slot}
                          disabled={disabled}
                          texts={texts}
                          onSelect={onSlotChange}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AsyncBlock>
        )}
      </div>
    </FormCard>
  );
}

/** Слот 3525:14832 — это в точности слот кита (`TimeSlot size="m"`): 42
 * высотой, радиус 12, обводка в покое, фирменная заливка у выбранного. */
function SlotButton({
  slot,
  selected,
  disabled,
  texts,
  onSelect,
}: {
  slot: AvailabilitySlot;
  selected: boolean;
  disabled: boolean;
  texts: Dictionary["web"]["booking"]["when"];
  onSelect: (startsAt: string) => void;
}) {
  return (
    <TimeSlot
      size="m"
      time={slotTimeLabel(slot.startsAt)}
      label={slotAriaLabel(slot, texts)}
      selected={selected}
      disabled={disabled || !slot.available}
      onSelect={() => onSelect(slot.startsAt)}
    />
  );
}

/** Скелет — три группы по четыре слота высоты живого слота, чтобы карточка не
 * прыгала, когда приедет ответ. */
function SlotsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }, (_, group) => (
        <div key={group} className="flex flex-col gap-1.5">
          <Skeleton className="h-[18px] w-16" />
          <div className="grid grid-cols-flow-slots gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-slot w-full rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const EMPTY_TEXT_KEY = {
  day: "emptyDay",
  capacity: "emptyCapacity",
  late: "emptyLate",
  taken: "emptyTaken",
} as const;

/* ------------------------------------------------------------------------ *
 * Карточка 2 — «Гости» (3525:14862)
 * ------------------------------------------------------------------------ */

export function PartyCard({
  guests,
  disabled,
  onGuestsChange,
}: {
  guests: number;
  disabled: boolean;
  onGuestsChange: (next: number) => void;
}) {
  const { t } = useLocale();
  const texts = t.web.booking.party;
  const labelId = useId();
  const min = GUEST_OPTIONS[0];
  const max = GUEST_OPTIONS[GUEST_OPTIONS.length - 1];

  return (
    <FormCard title={texts.title} gap="gap-4">
      <div className="flex flex-col gap-4">
        {/* Узел 3525:14866: подпись слева, степпер справа. */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p id={labelId} className="text-flow-row-title text-ink">
              {texts.guestsLabel}
            </p>
            <p className="text-bodyS text-ink-tertiary">{texts.guestsHint}</p>
          </div>
          {/* Степпер 3525:14870: 52 высотой, паддинг 6, радиус 14, подложка
              subtle; кнопки 40 радиуса 10; поле значения 56. Это группа,
              а не поле: значение меняется только кнопками. */}
          <div
            role="group"
            aria-labelledby={labelId}
            className="flex h-flow-stepper shrink-0 items-center rounded-field bg-subtle p-flow-stepper-p"
          >
            <StepperButton
              label={texts.fewer}
              disabled={disabled || guests <= min}
              onClick={() => onGuestsChange(guests - 1)}
            >
              −
            </StepperButton>
            <output
              aria-live="polite"
              className="flex w-flow-stepper-value items-center justify-center text-flow-stepper-value text-ink"
            >
              {guests}
            </output>
            <StepperButton
              label={texts.more}
              disabled={disabled || guests >= max}
              onClick={() => onGuestsChange(guests + 1)}
            >
              +
            </StepperButton>
          </div>
        </div>

        {/* Место трёх карточек зон (узел 3525:14879). Данных о зонах у сервера
            нет, и об этом сказано словами, а не пустотой. */}
        <StateMessage text={texts.zonesUnavailable} />
      </div>
    </FormCard>
  );
}

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex h-flow-stepper-btn w-flow-stepper-btn items-center justify-center rounded-stepper-btn bg-canvas text-flow-stepper-sign text-ink transition-colors",
        "hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:bg-disabled disabled:text-ink-disabled",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------------ *
 * Карточка 3 — «Контактные данные» (3525:14898)
 * ------------------------------------------------------------------------ */

export interface ContactsValue {
  name: string;
  /** Национальные цифры, см. `lib/phone.ts`. */
  phoneDigits: string;
  email: string;
  offer: boolean;
}

export interface ContactsErrors {
  name?: string;
  phone?: string;
  email?: string;
  offer?: string;
}

export function ContactsCard({
  value,
  errors,
  disabled,
  onChange,
  onBlur,
}: {
  value: ContactsValue;
  /** Только те ошибки, которые пора показывать: решает экран. */
  errors: ContactsErrors;
  disabled: boolean;
  onChange: (patch: Partial<ContactsValue>) => void;
  /** Поле потеряло фокус — с этого момента его ошибка показывается. */
  onBlur: (field: "name" | "phone" | "email") => void;
}) {
  const { t } = useLocale();
  const texts = t.web.booking.contacts;
  const offerId = useId();
  const offerErrorId = `${offerId}-error`;

  return (
    <FormCard title={texts.title} subtitle={texts.subtitle} gap="gap-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          {/* Узел 3525:14904: имя и телефон в ряд через 12, по 360. */}
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label={texts.nameLabel}
              placeholder={texts.namePlaceholder}
              autoComplete="name"
              value={value.name}
              error={errors.name}
              disabled={disabled}
              onChange={(event) => onChange({ name: event.target.value })}
              onBlur={() => onBlur("name")}
            />
            <TextField
              label={texts.phoneLabel}
              placeholder={texts.phonePlaceholder}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              leadingSlot={<PhonePrefix />}
              value={formatNational(value.phoneDigits)}
              error={errors.phone}
              disabled={disabled}
              onChange={(event) => onChange({ phoneDigits: nationalDigits(event.target.value) })}
              onBlur={() => onBlur("phone")}
            />
          </div>
          <TextField
            label={texts.emailLabel}
            placeholder={texts.emailPlaceholder}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={value.email}
            error={errors.email}
            disabled={disabled}
            onChange={(event) => onChange({ email: event.target.value })}
            onBlur={() => onBlur("email")}
          />
        </div>

        {/* Чекбокс оферты 3525:14918: квадрат 20 радиуса 4, до текста 12.
            Настоящий input спрятан визуально, а не убран: клавиатура и диктор
            видят именно его; квадрат — только вид. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={offerId} className="flex cursor-pointer items-start gap-3">
            <input
              id={offerId}
              type="checkbox"
              className="peer sr-only"
              checked={value.offer}
              disabled={disabled}
              aria-invalid={errors.offer ? true : undefined}
              aria-describedby={errors.offer ? offerErrorId : undefined}
              onChange={(event) => onChange({ offer: event.target.checked })}
            />
            <span
              aria-hidden="true"
              className={cx(
                "flex h-flow-checkbox w-flow-checkbox shrink-0 items-center justify-center rounded-checkbox border bg-canvas text-ink-on-brand transition-colors",
                "peer-checked:border-brand peer-checked:bg-brand peer-checked:[&>svg]:opacity-100",
                "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
                "peer-disabled:cursor-not-allowed peer-disabled:border-transparent peer-disabled:bg-disabled",
                errors.offer ? "border-danger-text" : "border-line-control",
              )}
            >
              <CheckMark className="opacity-0" />
            </span>
            <span className="text-[14px] leading-5 text-ink-secondary">{texts.offer}</span>
          </label>
          {errors.offer ? (
            <p id={offerErrorId} role="alert" className="text-[13px] leading-[18px] text-danger-text">
              {errors.offer}
            </p>
          ) : null}
        </div>
      </div>
    </FormCard>
  );
}

/** «+7» перед номером: страна на сайте одна (см. `lib/phone.ts`). */
function PhonePrefix() {
  return (
    <span className="shrink-0 text-[15px] font-medium leading-[22px] text-ink">+7</span>
  );
}

/** Галочка 10×7 из макета (узлы 3525:14889 и 3525:14921). */
export function CheckMark({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="7"
      viewBox="0 0 10 7"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M1 3.5L3.8 6L9 1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------------ *
 * Карточка 4 — «Пожелания к брони» (3525:14923)
 * ------------------------------------------------------------------------ */

export type WishKey = keyof Dictionary["web"]["booking"]["wishes"]["quick"];

/** Порядок чипов — порядок макета (узлы 3525:14930…14938). */
export const WISH_KEYS: readonly WishKey[] = ["window", "birthday", "highChair", "quiet", "terrace"];

export function WishesCard({
  notes,
  wishes,
  disabled,
  onNotesChange,
  onWishToggle,
}: {
  notes: string;
  wishes: ReadonlySet<WishKey>;
  disabled: boolean;
  onNotesChange: (next: string) => void;
  onWishToggle: (key: WishKey) => void;
}) {
  const { t } = useLocale();
  const texts = t.web.booking.wishes;
  const fieldId = useId();

  return (
    <FormCard title={texts.title} subtitle={texts.subtitle} gap="gap-5">
      <div className="flex flex-col gap-4">
        <div>
          {/* Подпись поля — заголовок карточки; визуально второй нет. */}
          <label htmlFor={fieldId} className="sr-only">
            {texts.title}
          </label>
          <textarea
            id={fieldId}
            value={notes}
            disabled={disabled}
            placeholder={texts.placeholder}
            maxLength={NOTES_MAX_LENGTH}
            onChange={(event) => onNotesChange(event.target.value)}
            className={cx(
              "block h-flow-textarea w-full resize-none rounded-md border border-transparent bg-subtle px-flow-textarea-x py-flow-textarea-y text-bodyM text-ink outline-none placeholder:text-ink-tertiary",
              "focus:border-brand focus:ring-1 focus:ring-inset focus:ring-brand",
              "disabled:cursor-not-allowed disabled:text-ink-disabled",
            )}
          />
        </div>
        {/* Быстрые пожелания 3525:14929: чипы 34 высотой через 8. */}
        <div className="flex flex-wrap gap-2">
          {WISH_KEYS.map((key) => (
            <Chip
              key={key}
              size="wish"
              state={wishes.has(key) ? "active" : "default"}
              disabled={disabled}
              onClick={() => onWishToggle(key)}
            >
              {texts.quick[key]}
            </Chip>
          ))}
        </div>
      </div>
    </FormCard>
  );
}

/** Потолок поля пожеланий. Сервер хранит `notes` как текст без ограничения,
 * но абзац на тысячу знаков заведению читать некогда. */
export const NOTES_MAX_LENGTH = 500;

import type { AvailabilityFilter } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import React, { useMemo } from "react";
import { dateChoices } from "../../lib/availability-label";
import { DEFAULT_GUESTS, guestOptions } from "../../lib/availability-options";
import { WheelSheet } from "./WheelSheet";

const t = getDictionary();

/** Какая половина подбора раскрыта колесом. `null` — шторки нет. */
export type AvailabilityHalf = "date" | "guests";

/**
 * Два колеса подбора «дата + гости» и ПРАВИЛО, которое держит их вместе.
 *
 * Сервер отвечает на вопрос «есть ли стол на N гостей в такой-то день» и
 * половину запроса молча игнорирует, поэтому наружу отсюда уходит ТОЛЬКО
 * полная пара: покрутили колесо дат — гости берутся из текущего значения, а
 * если его нет, из `DEFAULT_GUESTS`; покрутили гостей — дата берётся из
 * текущей, а если её нет, это сегодня (первый элемент колеса). Половинного
 * состояния тип `onChange` даже не выражает: `undefined` здесь не бывает,
 * снятие подбора — отдельное действие снаружи (крестик капсулы в шторке
 * фильтров и «Сбросить»).
 *
 * Отдельный компонент, потому что этих колёс теперь ДВА места: капсула внутри
 * шторки фильтров (`AvailabilityBar`) и чипы «Сегодня ⌄ / 2 гостя ⌄» над
 * выдачей поиска. Копия правила в каждом из них разъехалась бы ровно там, где
 * это дороже всего — в подстановке недостающей половины.
 */
export function AvailabilityWheels({
  open,
  value,
  today = new Date(),
  onChange,
  onClose,
}: {
  open: AvailabilityHalf | null;
  /** Что применено сейчас. `undefined` — подбора нет. */
  value: AvailabilityFilter | undefined;
  /** Точка отсчёта дат. Параметр — ради тестов, в приложении всегда «сегодня». */
  today?: Date;
  /** Выбор подтверждён «Готово». Всегда ПАРА, никогда половина. */
  onChange: (next: AvailabilityFilter) => void;
  /** Крестик, тап по затемнению или подтверждение — шторки больше нет. */
  onClose: () => void;
}) {
  // Подписи дней считает общий `dateChoices` — тот же, что рисует чип над
  // выдачей. Два расчёта разъехались бы на «Сегодня»/«12 августа».
  const dates = useMemo(() => dateChoices(today).options, [today]);
  const guests = useMemo(() => guestOptions((n) => t.booking.guestsCount(n)), []);

  return (
    <>
      <WheelSheet
        visible={open === "date"}
        title={t.booking.pickDateTitle}
        options={dates}
        value={value?.date ?? dates[0].value}
        submitLabel={t.search.availabilityDone}
        closeLabel={t.search.availabilityClose}
        onClose={onClose}
        onSubmit={(date) => {
          onClose();
          onChange({ date, guests: value?.guests ?? DEFAULT_GUESTS });
        }}
      />

      <WheelSheet
        visible={open === "guests"}
        title={t.booking.pickGuestsTitle}
        options={guests}
        value={String(value?.guests ?? DEFAULT_GUESTS)}
        submitLabel={t.search.availabilityDone}
        closeLabel={t.search.availabilityClose}
        onClose={onClose}
        onSubmit={(picked) => {
          onClose();
          onChange({ date: value?.date ?? dates[0].value, guests: Number(picked) });
        }}
      />
    </>
  );
}

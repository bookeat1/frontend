"use client";

import { normalizeCityKey, sortCities, type CityDictionaryEntry } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";

import { Field, Select, TextInput } from "./FormControls";

const copy = t.admin.venueCity;

/**
 * Выбор города — одно поле на всю панель.
 *
 * Два потребителя: карточка заведения (город обязателен) и форма подборки
 * гастрогида (пустой город = «во всех городах», см. `emptyOptionLabel`).
 * Второго такого select быть не должно: список городов, зашитый в код,
 * ровно один раз уже развалился — редактор гастрогида не видел добавленный
 * на бэкенде город и мог выбрать несуществующий.
 *
 * ЧТО ИМЕННО ПИШЕТСЯ ЗАВЕДЕНИЮ — строка `city`, значение поля `value` записи
 * справочника, а НЕ ссылка `city_id`. Два независимых основания:
 *   • в API заведения поля `city_id` нет вообще
 *     (`internal/transport/rest/restaurants/request.go` знает только
 *     `city *string`), так что отправить ссылку физически некуда;
 *   • оно и не нужно: триггер `trg_restaurants_sync_city` (миграция 0081) при
 *     записи строки сам перерезолвит ссылку по таблице синонимов и приведёт
 *     написание к каноническому. Писать одновременно и строку, и ссылку —
 *     лишний способ их рассинхронизировать.
 * `value`, а не `name`: `name` приходит на языке запроса, и каталог, который
 * сравнивает строку точно (`r.city = $1`), по переводу не нашёл бы ничего.
 *
 * Четыре состояния, и ни одно не тупик:
 *   • грузится — список заблокирован, но текущий город видно;
 *   • справочник не ответил или пуст — честный откат на ввод текстом с
 *     объяснением, потому что select без вариантов не даёт завести заведение;
 *   • город заведения справочнику неизвестен — он остаётся в списке отдельным
 *     пунктом с пометкой, иначе открытие формы молча переставило бы заведение
 *     в другой город;
 *   • обычный выбор из списка.
 */
export function CitySelectField({
  dictionary,
  loading = false,
  failed = false,
  value,
  onChange,
  disabled = false,
  id = "venue-city",
  label = copy.label,
  emptyOptionLabel,
}: {
  dictionary: readonly CityDictionaryEntry[];
  loading?: boolean;
  failed?: boolean;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** DOM id: два таких поля на одной странице обязаны различаться, иначе
   * подпись `<label for>` укажет на чужое поле. */
  id?: string;
  label?: string;
  /** Подпись пункта «город не выбран», когда пустое значение — это ОСМЫСЛЕННЫЙ
   * выбор, а не «ещё не заполнено» (у подборки гастрогида пустой город значит
   * «во всех городах»). Без неё пустой пункт — это заглушка «—», и она
   * исчезает, как только город выбран, чтобы поле заведения нельзя было
   * случайно очистить. */
  emptyOptionLabel?: string;
}) {
  const options = cityOptionsFor(dictionary, value);

  // Откат ровно на прежнее поведение: ручной ввод. Он хуже выбора из списка,
  // но «нельзя завести заведение, пока справочник лежит» — хуже обоих.
  if (failed || options.length === 0) {
    return (
      <Field label={label} hint={copy.fallbackHint} htmlFor={id}>
        <TextInput
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
    );
  }

  return (
    <Field label={label} hint={loading ? copy.loading : copy.hint} htmlFor={id}>
      <Select
        id={id}
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
      >
        {emptyOptionLabel !== undefined ? (
          <option value="">{emptyOptionLabel}</option>
        ) : value === "" ? (
          <option value="">—</option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/**
 * Пункты списка: активные записи справочника в его порядке плюс — отдельным
 * пунктом с пометкой — город, который сейчас записан у заведения, если
 * справочник его не знает или он скрыт.
 *
 * Без этого пункта select не нашёл бы своего значения, показал бы первый город
 * списка, и обычное «Сохранить» без единого касания поля переставило бы
 * заведение в чужой город.
 */
export function cityOptionsFor(
  dictionary: readonly CityDictionaryEntry[],
  current: string,
): { value: string; label: string }[] {
  const options = sortCities(dictionary.filter((entry) => entry.is_active)).map((entry) => ({
    value: entry.value,
    label: entry.name,
  }));

  const trimmed = current.trim();
  if (!trimmed) return options;
  const key = normalizeCityKey(trimmed);
  if (options.some((option) => normalizeCityKey(option.value) === key)) return options;
  return [...options, { value: current, label: copy.unknownOption(trimmed) }];
}

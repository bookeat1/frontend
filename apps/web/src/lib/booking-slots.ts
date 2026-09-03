import type { AvailabilitySlot, SlotUnavailableReason } from "@bookeat/api/client";

import { slotTimeLabel } from "@web/lib/format";

/**
 * Разбор выдачи доступности: чем занята пустота и как разложить слоты по
 * группам «День / Вечер / Поздний вечер».
 *
 * Лежит отдельным модулем, а не внутри экрана, по двум причинам: обе функции
 * нужны ДВУМ несвязанным местам (карточка брони в правой колонке страницы
 * заведения и страница бронирования), и обе — чистая арифметика над ответом
 * сервера, которую проще проверить тестом, чем через разметку.
 *
 * ГЛАВНОЕ ПРАВИЛО ДАННЫХ: бронируемость слота решает ТОЛЬКО `available`.
 * `freeTables` для этого не годится — у заведения без заведённых столиков он
 * равен нулю у каждого слота (проверено на тесте 2026-07-25, см.
 * `bugs/bookeat-frontend-slot-freetables-not-a-signal`).
 */

/**
 * ЧЕТЫРЕ РАЗНЫЕ ПУСТОТЫ, а не одна.
 *
 * Сервер отвечает по-разному, и совет гостю в каждом случае свой:
 *   • слотов нет вовсе — у заведения нет рабочих часов на этот день;
 *   • все слоты `capacity` — столика на такую компанию нет (в том числе когда
 *     столиков не заведено вообще), и «попробуйте другую дату» отправило бы
 *     гостя по кругу;
 *   • все слоты `too_soon` — день уже прошёл: до каждого оставшегося времени
 *     меньше, чем `BOOKING_DEFAULT_LEAD_MINUTES`. Именно так тестовый сервер
 *     отвечает вечером (проверено 02.09.2026 в 23:30 по Алматы: 28 слотов,
 *     все `too_soon`), и «всё занято» здесь было бы неправдой — не занято, а
 *     поздно;
 *   • иначе всё занято — другой день или другое число гостей.
 *
 * `null` — свободное время есть, пустотой это не является.
 */
export function emptyKind(
  slots: AvailabilitySlot[],
): "day" | "capacity" | "late" | "taken" | null {
  if (slots.length === 0) return "day";
  if (slots.some((item) => item.available)) return null;
  if (slots.every((item) => item.reason === "capacity")) return "capacity";
  if (slots.every((item) => item.reason === "too_soon")) return "late";
  return "taken";
}

/** Сколько слотов реально можно забронировать — строка «14 свободных слотов»
 * в шапке карточки времени (узел 3525:14827). Считаются ТОЛЬКО `available`:
 * серый слот в этом числе был бы обманом. */
export function availableCount(slots: AvailabilitySlot[]): number {
  return slots.reduce((count, item) => (item.available ? count + 1 : count), 0);
}

export type SlotGroupKey = "day" | "evening" | "late";

export interface SlotGroup {
  key: SlotGroupKey;
  slots: AvailabilitySlot[];
}

/** Порядок групп на экране. Он же порядок в макете (узлы 3525:14829, 14840,
 * 14851) и он же — порядок часов в сутках. */
const GROUP_ORDER: readonly SlotGroupKey[] = ["day", "evening", "late"];

/**
 * ГРАНИЦЫ ГРУПП. Их в макете НЕТ: там три подписи над готовыми рядами, и
 * подписи эти сами себе противоречат — «19:00» стоит в «Вечере», а «19:30»
 * уже в «Позднем вечере» (узлы 3525:14849 и 3525:14854). Читать из такого
 * правило нельзя, поэтому границы выбраны здесь и названы в отчёте владельцу
 * отдельной строкой:
 *
 *   день          06:00–16:59
 *   вечер         17:00–20:59
 *   поздний вечер 21:00–05:59 (включая ночные слоты уже следующих суток)
 *
 * Ночь принадлежит «позднему вечеру», а не «дню»: заведение, работающее до
 * 02:00, отдаёт для 25 августа старты вплоть до «26 августа 00:30», и такой
 * слот — это конец вечера, а не начало следующего дня.
 */
const DAY_FROM = 6;
const EVENING_FROM = 17;
const LATE_FROM = 21;

function groupOf(slot: AvailabilitySlot): SlotGroupKey {
  const time = slotTimeLabel(slot.startsAt);
  // Время не разобрали — слот всё равно показываем: серый прямоугольник хуже
  // строки, а потерять слот молча нельзя. Первая группа, потому что какая-то
  // группа быть обязана.
  if (!time) return "day";
  const hour = Number(time.slice(0, 2));
  if (!Number.isFinite(hour)) return "day";
  if (hour >= LATE_FROM || hour < DAY_FROM) return "late";
  if (hour >= EVENING_FROM) return "evening";
  return "day";
}

/**
 * Слоты по группам, в порядке макета. Пустые группы НЕ возвращаются: подпись
 * «Вечер» над пустотой читается как поломка.
 *
 * Порядок слотов внутри группы — серверный: выдача уже отсортирована по
 * времени, и пересортировка здесь была бы вторым мнением о том, что сервер уже
 * сказал.
 */
export function groupSlots(slots: AvailabilitySlot[]): SlotGroup[] {
  const buckets = new Map<SlotGroupKey, AvailabilitySlot[]>();
  for (const slot of slots) {
    const key = groupOf(slot);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(slot);
    else buckets.set(key, [slot]);
  }
  return GROUP_ORDER.flatMap((key) => {
    const bucket = buckets.get(key);
    return bucket && bucket.length > 0 ? [{ key, slots: bucket }] : [];
  });
}

/** Словарь причин недоступности — у карточки заведения и у страницы
 * бронирования он лежит в разных ветках словаря, поэтому передаётся сюда. */
export interface SlotReasonTexts {
  reason: Record<
    "tooSoon" | "beyondHorizon" | "occupied" | "capacity" | "unknown",
    string
  >;
  slotLabel: (time: string, reason: string) => string;
}

const REASON_KEY: Record<SlotUnavailableReason, keyof SlotReasonTexts["reason"]> = {
  too_soon: "tooSoon",
  beyond_horizon: "beyondHorizon",
  occupied: "occupied",
  capacity: "capacity",
  unknown: "unknown",
};

/**
 * Недоступный слот ПОКАЗЫВАЕТСЯ с причиной, а не прячется: серый
 * прямоугольник без объяснения читается как поломка вёрстки, а диктор
 * произносит его неотличимо от свободного. У свободного слота подписи нет —
 * его имя и есть время.
 */
export function slotAriaLabel(slot: AvailabilitySlot, texts: SlotReasonTexts): string | undefined {
  if (slot.available) return undefined;
  const time = slotTimeLabel(slot.startsAt);
  return texts.slotLabel(time, texts.reason[REASON_KEY[slot.reason ?? "unknown"]]);
}

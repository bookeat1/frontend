import type { AdminEvent, AdminEventRecurrence } from "@bookeat/api/admin";
import { describe, expect, it } from "vitest";

import {
  contentOverridesOf,
  describeRecurrence,
  describeRecurrencePeriod,
  formatDurationMinutes,
  groupEventsIntoSeries,
  isContentOverridden,
  isSeriesDate,
  recurrenceToInput,
  seriesContentDiff,
  seriesContentOf,
} from "../event-series";

/**
 * «Greek Party» на проде — 18 строк в `events` с ОДНИМ `recurrence_id`. Список
 * кабинета рисовал 18 одинаковых карточек, и это единственное, что было
 * сломано: данные в порядке, серия одна. Тесты ниже прибивают именно свёртку.
 */

const RECURRENCE_ID = "4663361f-0f0a-409b-ba14-4bed16dc9c76";

function occurrence(n: number, over: Partial<AdminEvent> = {}): AdminEvent {
  const day = String(n).padStart(2, "0");
  return {
    id: `e-${n}`,
    restaurant_id: "r-1",
    title: "Greek Party",
    description: "",
    starts_at: `2026-09-${day}T20:30:00+05:00`,
    ends_at: `2026-09-${day}T23:30:00+05:00`,
    status: "published",
    ticketed: false,
    recurrence_id: RECURRENCE_ID,
    created_at: "2026-08-01T10:00:00+05:00",
    updated_at: "2026-08-01T10:00:00+05:00",
    ...over,
  };
}

const rule: AdminEventRecurrence = {
  id: RECURRENCE_ID,
  restaurant_id: "r-1",
  title: "Greek Party",
  description: "Греческий вечер",
  tags: [],
  occurrence_status: "published",
  ticketed: false,
  tickets_refundable: false,
  ticket_refund_cutoff_minutes: 0,
  frequency: "weekly",
  weekdays: [5],
  start_time: "20:30",
  duration_minutes: 180,
  starts_on: "2026-08-01",
  is_active: true,
  occurrence_feed_status: "approved",
  created_at: "2026-08-01T10:00:00+05:00",
  updated_at: "2026-08-01T10:00:00+05:00",
};

describe("groupEventsIntoSeries — свёртка дат в одну карточку серии", () => {
  it("восемнадцать дат одной серии дают ОДНУ строку списка", () => {
    const events = Array.from({ length: 18 }, (_, i) => occurrence(i + 1));

    const rows = groupEventsIntoSeries(events, [rule], new Date("2026-09-04T12:00:00+05:00"));

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row!.kind).toBe("series");
    if (row!.kind !== "series") throw new Error("unreachable");
    expect(row!.recurrenceId).toBe(RECURRENCE_ID);
    expect(row!.occurrences).toHaveLength(18);
    expect(row!.title).toBe("Greek Party");
  });

  it("разовые события остаются отдельными карточками и не смешиваются с серией", () => {
    const single = occurrence(20, { id: "solo", title: "Вечер джаза", recurrence_id: undefined });
    const rows = groupEventsIntoSeries(
      [occurrence(1), single, occurrence(2)],
      [rule],
      new Date("2026-08-31T12:00:00+05:00"),
    );

    expect(rows.map((r) => r.kind)).toEqual(["series", "single"]);
    expect(rows[1]!.kind === "single" && rows[1]!.event.id).toBe("solo");
  });

  it("ближайшая дата и число будущих дат считаются от «сейчас», прошедшие не теряются", () => {
    const rows = groupEventsIntoSeries(
      [occurrence(1), occurrence(2), occurrence(3)],
      [rule],
      // Первая дата уже закончилась, вторая ещё нет.
      new Date("2026-09-02T10:00:00+05:00"),
    );
    const row = rows[0]!;
    if (row.kind !== "series") throw new Error("unreachable");

    expect(row.occurrences).toHaveLength(3);
    expect(row.upcoming.map((e) => e.id)).toEqual(["e-2", "e-3"]);
    expect(row.next?.id).toBe("e-2");
  });

  it("даты внутри серии отсортированы по возрастанию, как бы их ни прислал сервер", () => {
    const rows = groupEventsIntoSeries(
      [occurrence(3), occurrence(1), occurrence(2)],
      [rule],
      new Date("2026-08-31T12:00:00+05:00"),
    );
    const row = rows[0]!;
    if (row.kind !== "series") throw new Error("unreachable");
    expect(row.occurrences.map((e) => e.id)).toEqual(["e-1", "e-2", "e-3"]);
  });

  it("статус серии сводится по будущим датам: одна скрытая даёт «mixed»", () => {
    const rows = groupEventsIntoSeries(
      [occurrence(1), occurrence(2, { status: "hidden" })],
      [rule],
      new Date("2026-08-31T12:00:00+05:00"),
    );
    const row = rows[0]!;
    if (row.kind !== "series") throw new Error("unreachable");
    expect(row.publishState).toBe("mixed");
  });

  it("группирует и без правила — recurrence_id достаточно, чтобы не рисовать 18 карточек", () => {
    const rows = groupEventsIntoSeries(
      [occurrence(1), occurrence(2)],
      [],
      new Date("2026-08-31T12:00:00+05:00"),
    );
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    if (row.kind !== "series") throw new Error("unreachable");
    expect(row.rule).toBeNull();
    expect(row.title).toBe("Greek Party");
  });
});

describe("describeRecurrence — правило повтора по-русски", () => {
  it("одна неделя, один день: «по пятницам, 20:30»", () => {
    expect(describeRecurrence(rule)).toBe("по пятницам, 20:30");
  });

  it("несколько дней недели перечисляются коротко", () => {
    expect(describeRecurrence({ ...rule, weekdays: [3, 1, 5] })).toBe("по пн, ср, пт, 20:30");
  });

  it("ежедневно и ежемесячно", () => {
    expect(describeRecurrence({ ...rule, frequency: "daily", weekdays: [] })).toBe(
      "каждый день, 20:30",
    );
    expect(
      describeRecurrence({ ...rule, frequency: "monthly", weekdays: [], month_day: 15 }),
    ).toBe("каждое 15-е число, 20:30");
  });

  it("без правила говорит правду, а не выдумывает расписание", () => {
    expect(describeRecurrence(null)).toBe("Повторяющееся событие");
  });
});

describe("описание периода и длительности", () => {
  it("бессрочная серия читается как «с датой начала»", () => {
    expect(describeRecurrencePeriod(rule)).toBe("с 1 августа 2026");
  });

  it("серия с концом читается диапазоном", () => {
    expect(describeRecurrencePeriod({ ...rule, until_date: "2026-12-31" })).toBe(
      "1 августа 2026 — 31 декабря 2026",
    );
  });

  it("длительность в часах и минутах", () => {
    expect(formatDurationMinutes(180)).toBe("3 ч");
    expect(formatDurationMinutes(150)).toBe("2 ч 30 мин");
    expect(formatDurationMinutes(45)).toBe("45 мин");
  });
});

describe("recurrenceToInput — PUT правила это ПОЛНАЯ замена", () => {
  it("переносит все поля правила, а не только те, что рисует экран", () => {
    const input = recurrenceToInput({
      ...rule,
      title_i18n: { en: "Greek Party" },
      cover_image_url: "https://cdn/greek.jpg",
      tags: ["музыка"],
      capacity: 40,
      ticketed: true,
      ticket_price_minor: 500000,
      timezone: "Asia/Almaty",
      until_date: "2026-12-31",
      month_day: null,
    });

    // Переводы — ЕДИНСТВЕННОЕ, что сюда НЕ переносится, и это не пропуск.
    // Сервер принимает `<поле>_i18n` как ЧАСТИЧНОЕ обновление
    // (domain.I18nPatch): пропуск ключа сохраняет переводы, а переотправка
    // всей карты затирает правку, сделанную кем-то другим, пока форма была
    // открыта. Переводы кладёт форма, и только изменённые языки.
    expect(input.title_i18n).toBeUndefined();
    expect(input.description_i18n).toBeUndefined();
    expect(input.cover_image_url).toBe("https://cdn/greek.jpg");
    expect(input.tags).toEqual(["музыка"]);
    expect(input.capacity).toBe(40);
    expect(input.ticket_price_minor).toBe(500000);
    expect(input.timezone).toBe("Asia/Almaty");
    expect(input.until_date).toBe("2026-12-31");
    expect(input.start_time).toBe("20:30");
    expect(input.duration_minutes).toBe(180);
  });

  it("накладывает только то, что попросили изменить", () => {
    const input = recurrenceToInput(rule, { occurrence_status: "hidden" });
    expect(input.occurrence_status).toBe("hidden");
    expect(input.frequency).toBe("weekly");
    expect(input.is_active).toBe(true);
  });
});

/**
 * Общий контент серии и исключения отдельных дат (migration 0097).
 *
 * `content_overrides` считает СЕРВЕР (диффом с серией) — здесь только чтение:
 * «нет ключа» и «пустой массив» обязаны читаться одинаково, иначе кабинет
 * пометит наследуемое поле как своё и человек не поймёт, почему правка серии
 * его не изменила.
 */
describe("контент серии и переопределения даты", () => {
  it("общий контент берётся с правила; отсутствующее место — пустая строка, а не undefined", () => {
    expect(seriesContentOf(rule)).toEqual({
      title: "Greek Party",
      description: "Греческий вечер",
      venue: "",
      cover_image_url: null,
      tags: [],
    });
    expect(
      seriesContentOf({ ...rule, venue: "летняя терраса", cover_image_url: "https://cdn/g.jpg" }),
    ).toMatchObject({ venue: "летняя терраса", cover_image_url: "https://cdn/g.jpg" });
  });

  it("дата без ключа переопределений наследует всё", () => {
    const e = occurrence(4);
    expect(contentOverridesOf(e)).toEqual([]);
    expect(isContentOverridden(e, "title")).toBe(false);
    expect(isSeriesDate(e)).toBe(true);
  });

  it("свои поля читаются в порядке формы, а незнакомые сервером имена отбрасываются", () => {
    const e = occurrence(4, {
      content_overrides: ["cover_image_url", "title", "capacity"] as never,
    });
    expect(contentOverridesOf(e)).toEqual(["title", "cover_image_url"]);
    expect(isContentOverridden(e, "cover_image_url")).toBe(true);
    expect(isContentOverridden(e, "description")).toBe(false);
  });

  it("разовое событие серией не считается", () => {
    expect(isSeriesDate(occurrence(4, { recurrence_id: null }))).toBe(false);
    expect(contentOverridesOf(null)).toEqual([]);
  });

  it("дифф контента ловит правку и молчит, когда правки нет", () => {
    const same = seriesContentOf(rule);
    expect(seriesContentDiff(rule, same)).toEqual([]);
    expect(seriesContentDiff(rule, { ...same, title: "Greek Night" })).toEqual(["title"]);
    // Порядок меток виден гостю в ряду чипов — перестановка тоже правка.
    const tagged = { ...rule, tags: ["музыка", "18+"] };
    expect(seriesContentDiff(tagged, { ...seriesContentOf(tagged), tags: ["18+", "музыка"] })).toEqual([
      "tags",
    ]);
    // Пустая строка обложки и её отсутствие — одно и то же, а не изменение.
    expect(seriesContentDiff({ ...rule, cover_image_url: null }, { ...same, cover_image_url: "" }))
      .toEqual([]);
  });
});

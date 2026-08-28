import type {
  AdminEvent,
  AdminEventRecurrence,
  EventInput,
  EventRecurrenceInput,
} from "@bookeat/api/admin";

/**
 * Серии повторяющихся событий для списка кабинета.
 *
 * ЗАЧЕМ. «Greek Party» на проде — это 18 строк в `events` с ОДНИМ и тем же
 * `recurrence_id` (migration 0074). Список кабинета рисовал их как 18
 * одинаковых карточек, и красная кнопка «Удалить» на каждой из них выглядела
 * как удаление события целиком, хотя убирала ровно одну дату. Данные при этом
 * были в порядке — сломан был только показ.
 *
 * Здесь живёт ЧИСТАЯ часть починки: сворачивание списка в строки и перевод
 * правила повтора на человеческий русский. Ни запросов, ни React — чтобы и
 * группировку, и формулировки можно было проверить тестом.
 */

/** Разовое событие: как было, одна карточка — одно событие. */
export interface SingleEventRow {
  kind: "single";
  event: AdminEvent;
}

/** Публикационное состояние серии, сведённое по её датам. */
export type SeriesPublishState = "published" | "hidden" | "draft" | "mixed";

/** Одна серия: правило (если оно доехало) и все порождённые им даты. */
export interface EventSeriesRow {
  kind: "series";
  recurrenceId: string;
  /** null, если правило не пришло в списке (например, серия заведения, чьих
   * правил на этой странице нет). Даты всё равно группируются — они несут
   * `recurrence_id`, и этого достаточно, чтобы не рисовать 18 карточек. */
  rule: AdminEventRecurrence | null;
  title: string;
  /** Все даты серии по возрастанию `starts_at`. */
  occurrences: AdminEvent[];
  /** Даты, которые ещё не закончились. */
  upcoming: AdminEvent[];
  /** Ближайшая незавершившаяся дата, иначе null (серия целиком в прошлом). */
  next: AdminEvent | null;
  /** Сведённый статус: по будущим датам, а если их нет — по всем. */
  publishState: SeriesPublishState;
}

export type EventListRow = SingleEventRow | EventSeriesRow;

/** Дата ещё не закончилась. */
function isUpcoming(event: AdminEvent, now: number): boolean {
  const ends = Date.parse(event.ends_at);
  return Number.isNaN(ends) ? true : ends > now;
}

function publishStateOf(events: AdminEvent[]): SeriesPublishState {
  if (events.length === 0) return "draft";
  const first = events[0]!.status;
  return events.every((e) => e.status === first) ? first : "mixed";
}

/**
 * Сворачивает плоский список событий в строки списка: разовые остаются как
 * были, даты одной серии становятся одной строкой.
 *
 * Порядок исходного списка сохраняется — серия занимает место СВОЕЙ ПЕРВОЙ
 * встреченной даты, поэтому сортировка сервера («ближайшие сверху») не
 * перетасовывается. Внутри серии даты пересортированы по возрастанию: это
 * календарь, а не лента.
 */
export function groupEventsIntoSeries(
  events: readonly AdminEvent[],
  recurrences: readonly AdminEventRecurrence[] = [],
  now: Date = new Date(),
): EventListRow[] {
  const ruleById = new Map(recurrences.map((r) => [r.id, r]));
  const nowMs = now.getTime();

  const rows: EventListRow[] = [];
  const seriesByRecurrenceId = new Map<string, EventSeriesRow>();

  for (const event of events) {
    const recurrenceId = event.recurrence_id;
    if (!recurrenceId) {
      rows.push({ kind: "single", event });
      continue;
    }
    const existing = seriesByRecurrenceId.get(recurrenceId);
    if (existing) {
      existing.occurrences.push(event);
      continue;
    }
    const rule = ruleById.get(recurrenceId) ?? null;
    const row: EventSeriesRow = {
      kind: "series",
      recurrenceId,
      rule,
      // Название берём у правила: оно и есть источник, с которого копируется
      // каждая дата. Если правила нет — у первой даты, она его копия.
      title: rule?.title ?? event.title,
      occurrences: [event],
      upcoming: [],
      next: null,
      publishState: "draft",
    };
    seriesByRecurrenceId.set(recurrenceId, row);
    rows.push(row);
  }

  for (const row of seriesByRecurrenceId.values()) {
    row.occurrences.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    row.upcoming = row.occurrences.filter((e) => isUpcoming(e, nowMs));
    row.next = row.upcoming[0] ?? null;
    row.publishState = publishStateOf(row.upcoming.length > 0 ? row.upcoming : row.occurrences);
  }

  return rows;
}

/** ISO-дни недели, 1 = понедельник … 7 = воскресенье (как в payload и isodow). */
const WEEKDAY_PLURAL: Record<number, string> = {
  1: "понедельникам",
  2: "вторникам",
  3: "средам",
  4: "четвергам",
  5: "пятницам",
  6: "субботам",
  7: "воскресеньям",
};

const WEEKDAY_SHORT: Record<number, string> = {
  1: "пн",
  2: "вт",
  3: "ср",
  4: "чт",
  5: "пт",
  6: "сб",
  7: "вс",
};

/**
 * Правило повтора одной строкой по-русски: «по пятницам, 20:30».
 *
 * Правило хранит НАСТЕННОЕ время (`start_time` = "HH:MM"), а не мгновение, —
 * поэтому здесь нет ни часовых поясов, ни `Date`: печатаем ровно то, что
 * человек ввёл, и то, что увидит гость на часах.
 */
export function describeRecurrence(rule: AdminEventRecurrence | null | undefined): string {
  if (!rule) return "Повторяющееся событие";

  let when: string;
  switch (rule.frequency) {
    case "daily":
      when = "каждый день";
      break;
    case "monthly":
      when = rule.month_day ? `каждое ${rule.month_day}-е число` : "раз в месяц";
      break;
    case "weekly":
    default: {
      const days = [...rule.weekdays].sort((a, b) => a - b);
      if (days.length === 0) when = "раз в неделю";
      else if (days.length === 7) when = "каждый день";
      else if (days.length === 1) when = `по ${WEEKDAY_PLURAL[days[0]!] ?? "дням"}`;
      else when = `по ${days.map((d) => WEEKDAY_SHORT[d] ?? d).join(", ")}`;
      break;
    }
  }
  return `${when}, ${rule.start_time}`;
}

/** «с 1 августа 2026», «1 августа — 31 декабря 2026». Пустая строка, если дат нет. */
export function describeRecurrencePeriod(rule: AdminEventRecurrence | null | undefined): string {
  if (!rule) return "";
  const from = formatCalendarDate(rule.starts_on);
  if (!from) return "";
  const to = rule.until_date ? formatCalendarDate(rule.until_date) : "";
  return to ? `${from} — ${to}` : `с ${from}`;
}

/** "YYYY-MM-DD" → «1 августа 2026». Календарная дата, а не мгновение: разбираем
 * строку руками, чтобы `new Date("2026-08-01")` не сдвинул её на день назад в
 * зоне восточнее UTC. */
export function formatCalendarDate(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return value;
  const [, year, month, day] = m;
  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  const name = months[Number(month) - 1];
  if (!name) return value;
  return `${Number(day)} ${name} ${year}`;
}

/** «2 ч 30 мин» из минут. */
export function formatDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

/**
 * Правило → тело PUT.
 *
 * PUT правила — ПОЛНАЯ ЗАМЕНА (та же ловушка, что у `PUT /admin/events/:id`,
 * см. EventsFullReplace.test.tsx): поле, которого нет в теле, не «остаётся как
 * было», а стирается. Поэтому здесь перечислено ВСЁ, что есть в ответе, а не
 * только то, что правит экран.
 */
export function recurrenceToInput(
  rule: AdminEventRecurrence,
  overrides: Partial<EventRecurrenceInput> = {},
): EventRecurrenceInput {
  return {
    title: rule.title,
    title_i18n: rule.title_i18n,
    description: rule.description,
    description_i18n: rule.description_i18n,
    venue: rule.venue ?? "",
    cover_image_url: rule.cover_image_url ?? null,
    tags: rule.tags ?? [],
    occurrence_status: rule.occurrence_status,
    ticketed: rule.ticketed,
    ticket_price_minor: rule.ticket_price_minor ?? null,
    capacity: rule.capacity ?? null,
    tickets_refundable: rule.tickets_refundable,
    ticket_refund_cutoff_minutes: rule.ticket_refund_cutoff_minutes,
    frequency: rule.frequency,
    weekdays: rule.weekdays ?? [],
    month_day: rule.month_day ?? null,
    start_time: rule.start_time,
    duration_minutes: rule.duration_minutes,
    timezone: rule.timezone ?? "",
    starts_on: rule.starts_on,
    until_date: rule.until_date ?? null,
    is_active: rule.is_active,
    ...overrides,
  };
}

/**
 * Событие → тело PUT события.
 *
 * `PUT /admin/events/:id` — ПОЛНАЯ ЗАМЕНА (EventsFullReplace.test.tsx): поле,
 * которого нет в теле, стирается. Живёт здесь, а не в EventsView, потому что
 * карточка серии переключает статус тех же событий и обязана слать ровно то же
 * полное тело.
 */
export function eventToInput(e: AdminEvent, status: AdminEvent["status"] = e.status): EventInput {
  return {
    title: e.title,
    description: e.description,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    venue: e.venue ?? "",
    cover_image_url: e.cover_image_url ?? null,
    status,
    ticketed: e.ticketed,
    ticket_price_minor: e.ticket_price_minor ?? null,
    capacity: e.capacity ?? null,
    tags: e.tags ?? [],
    images: e.images ?? [],
    city: e.city ?? null,
    action: e.action ? { label: e.action.label, url: e.action.url ?? null } : null,
  };
}

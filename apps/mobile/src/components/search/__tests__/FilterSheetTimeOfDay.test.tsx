import { EMPTY_FILTERS, HttpRestaurantRepository, type SearchFilters } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toDateKey } from "../../../lib/format";
import { FilterSheet } from "../FilterSheet";

/**
 * ЧИП ВРЕМЕНИ СУТОК ДОЛЖЕН ДОЕХАТЬ ДО ЗАПРОСА.
 *
 * Компонент `TimeOfDayChips` был написан раньше, чем его смогли вставить в
 * шторку (файлы фильтров держал другой агент), и до 2026-08-27 не был
 * подключён НИКУДА: три готовых чипа, которых человек не видел.
 *
 * Здесь проверяется вся цепочка, а не отрисовка: тап по «Утро» → черновик
 * шторки → `onApply` → `searchRestaurants` → параметры HTTP-запроса. Обрыв в
 * любом звене превращает чип в украшение — выбранный вид, прежняя выдача.
 *
 * Отдельно проверяется главная ловушка: `timeOfDay` лежит ВНУТРИ
 * `availability`, а сервер применяет окно `time_from`/`time_to` только вместе
 * с датой и числом гостей. Поэтому чип, нажатый при пустом подборе, обязан
 * дослать вторую половину — иначе он выглядел бы работающим, ничего не делая.
 */

const t = getDictionary("ru");

vi.mock("../../../lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const BASE_URL = "https://api.example.test/api/v1";

function renderSheet(onApply: (filters: SearchFilters) => void, initial = EMPTY_FILTERS) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <FilterSheet
        visible
        initialFilters={initial}
        cuisines={[]}
        cuisinesFailed={false}
        onRetryCuisines={vi.fn()}
        amenities={[]}
        amenitiesLoading={false}
        amenitiesFailed={false}
        onRetryAmenities={vi.fn()}
        cities={[]}
        onApply={onApply}
        onClose={vi.fn()}
      />
    </SafeAreaProvider>,
  );
}

/** Применённые фильтры: тап по чипу, затем «Применить». */
function applyWith(chipLabel: string, initial = EMPTY_FILTERS): SearchFilters {
  const onApply = vi.fn();
  renderSheet(onApply, initial);
  fireEvent.click(screen.getByText(chipLabel));
  fireEvent.click(screen.getByText(t.search.filters.apply));
  expect(onApply).toHaveBeenCalledTimes(1);
  return onApply.mock.calls[0][0] as SearchFilters;
}

/** Настоящий запрос поиска с этими фильтрами — адрес, который ушёл в fetch. */
async function searchUrlFor(filters: SearchFilters): Promise<URL> {
  const seen: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ data: { items: [], total: 0 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  await new HttpRestaurantRepository({ baseUrl: BASE_URL }).searchRestaurants({
    text: "",
    filters,
  });
  return new URL(seen.find((u) => u.includes("/restaurants/search")) ?? "");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("время суток в шторке фильтров", () => {
  it("«Утро» доезжает до запроса окном до 12:00 — вместе с датой и гостями", async () => {
    const filters = applyWith(t.search.filters.timeOfDayMorning);

    expect(filters.availability?.timeOfDay).toBe("morning");

    const url = await searchUrlFor(filters);
    expect(url.searchParams.get("time_from")).toBe("00:00");
    expect(url.searchParams.get("time_to")).toBe("12:00");
    // Без этой пары сервер окно ИГНОРИРУЕТ, и чип не сузил бы ничего.
    expect(url.searchParams.get("date")).toBe(toDateKey(new Date()));
    expect(url.searchParams.get("guests")).toBe("2");
  });

  it("«Вечер» поверх уже выбранных даты и компании их не затирает", async () => {
    const filters = applyWith(t.search.filters.timeOfDayDinner, {
      ...EMPTY_FILTERS,
      availability: { date: "2026-09-01", guests: 6 },
    });

    const url = await searchUrlFor(filters);
    expect(url.searchParams.get("date")).toBe("2026-09-01");
    expect(url.searchParams.get("guests")).toBe("6");
    expect(url.searchParams.get("time_from")).toBe("18:00");
    expect(url.searchParams.get("time_to")).toBe("24:00");
  });

  it("повторный тап снимает время, но дату и компанию оставляет", async () => {
    const onApply = vi.fn();
    renderSheet(onApply, { ...EMPTY_FILTERS, availability: { date: "2026-09-01", guests: 6 } });

    fireEvent.click(screen.getByText(t.search.filters.timeOfDayLunch));
    fireEvent.click(screen.getByText(t.search.filters.timeOfDayLunch));
    fireEvent.click(screen.getByText(t.search.filters.apply));

    const filters = onApply.mock.calls[0][0] as SearchFilters;
    expect(filters.availability).toEqual({ date: "2026-09-01", guests: 6, timeOfDay: undefined });

    const url = await searchUrlFor(filters);
    expect(url.searchParams.get("time_from")).toBeNull();
    expect(url.searchParams.get("date")).toBe("2026-09-01");
  });

  it("рядом с чипами написано, что они работают вместе с датой и гостями", () => {
    renderSheet(vi.fn());
    // Не декоративная подпись: она объясняет, почему чип дослал дату и
    // компанию, — иначе капсула выше «сама» меняется на «Сегодня · 2 гостя».
    expect(screen.getByText(t.search.filters.timeOfDayNote)).toBeTruthy();
  });
});

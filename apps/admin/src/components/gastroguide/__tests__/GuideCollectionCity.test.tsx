import type { CityDictionaryEntry, GuideCollection } from "@bookeat/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Город подборки гастрогида берётся из СПРАВОЧНИКА, а не из списка в коде.
 *
 * Список был зашит прямо в файле формы (`const CITIES = ["Астана", "Алматы"]`)
 * с комментарием «когда город добавят на бэкенде, допишите и сюда». Цена этой
 * ручной синхронизации уже была уплачена один раз: в списке лежал «Шымкент»,
 * которого домен не знал, и выбор его делал сохранение невозможным (422 без
 * сообщения в панели).
 *
 * Пустое значение здесь — НЕ «не заполнено», а осмысленный выбор «во всех
 * городах», поэтому пункт остаётся в списке и после того, как город выбран.
 */

const dictionary: { value: CityDictionaryEntry[] } = { value: [] };
const state = { isPending: false, isError: false };

vi.mock("@/lib/use-cities", () => ({
  useCityDictionary: () => ({ data: dictionary.value, ...state }),
}));

const { GuideCollectionFormModal } = await import("../GuideCollectionFormModal");

function entry(over: Partial<CityDictionaryEntry> = {}): CityDictionaryEntry {
  return {
    id: "c-1",
    code: "astana",
    name: "Астана",
    value: "Астана",
    display_order: 1,
    is_active: true,
    ...over,
  };
}

function renderModal(collection?: GuideCollection) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuideCollectionFormModal
        client={{ createGuideCollection: vi.fn(), updateGuideCollection: vi.fn() }}
        collection={collection}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  dictionary.value = [];
  state.isPending = false;
  state.isError = false;
  cleanup();
});

describe("город подборки гастрогида", () => {
  it("предлагает города справочника — третий появляется без правки кода", () => {
    dictionary.value = [
      entry(),
      entry({ id: "c-2", code: "almaty", name: "Алматы", value: "Алматы", display_order: 2 }),
      entry({ id: "c-3", code: "shymkent", name: "Шымкент", value: "Шымкент", display_order: 3 }),
    ];

    renderModal();

    const select = screen.getByLabelText<HTMLSelectElement>(/^Город/);
    expect(select.tagName).toBe("SELECT");
    expect([...select.options].map((o) => o.value)).toEqual([
      "",
      "Астана",
      "Алматы",
      "Шымкент",
    ]);
    expect(select.options[0]?.textContent).toBe("Все города");
  });

  it("скрытый в справочнике город больше не предлагают", () => {
    dictionary.value = [
      entry(),
      entry({
        id: "c-3",
        code: "shymkent",
        name: "Шымкент",
        value: "Шымкент",
        display_order: 3,
        is_active: false,
      }),
    ];

    renderModal();

    const select = screen.getByLabelText<HTMLSelectElement>(/^Город/);
    expect([...select.options].map((o) => o.value)).toEqual(["", "Астана"]);
  });

  it("«Все города» остаётся доступным выбором, когда город уже проставлен", () => {
    dictionary.value = [entry()];

    renderModal();

    const select = screen.getByLabelText<HTMLSelectElement>(/^Город/);
    fireEvent.change(select, { target: { value: "Астана" } });
    expect(select.value).toBe("Астана");
    // Вернуть подборку во все города можно тем же полем, а не удалением.
    expect([...select.options].map((o) => o.value)).toContain("");
  });

  it("справочник не ответил — город вводится текстом, форма не запирается", () => {
    state.isError = true;

    renderModal();

    const field = screen.getByLabelText<HTMLInputElement>(/^Город/);
    expect(field.tagName).toBe("INPUT");
  });
});

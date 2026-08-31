import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";

import { renderScreen, repositoryStub } from "@web/test/harness";
import { EMPTY_CATALOG_STATE } from "@web/lib/catalog-params";

/**
 * Панель поиска. Проверяется поведение, а не разметка:
 *   • дата и время заполнены по умолчанию (замечание владельца 31.08.2026 —
 *     раньше оба поля были пусты);
 *   • значение из адресной строки СИЛЬНЕЕ подставленного по умолчанию, иначе
 *     ссылка на выдачу за конкретный день открывалась бы за сегодня;
 *   • «Найти» уносит на листинг обе величины.
 */

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { SearchPanel } = await import("@web/components/home/SearchPanel");

/** «YYYY-MM-DD» браузера — ровно то, что подставляет компонент. */
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
}

describe("панель поиска", () => {
  it("подставляет сегодняшнюю дату и текущее время в пустые поля", async () => {
    renderScreen(<SearchPanel state={EMPTY_CATALOG_STATE} />);

    const date = (await screen.findByLabelText("Дата")) as HTMLInputElement;
    const time = screen.getByLabelText("Время") as HTMLInputElement;

    expect(date.value).toBe(todayIso());
    expect(time.value).toMatch(/^\d{2}:\d{2}$/);
  });

  it("значение из адреса сильнее подставленного по умолчанию", async () => {
    renderScreen(
      <SearchPanel state={{ ...EMPTY_CATALOG_STATE, date: "2026-09-06", time: "19:30" }} />,
    );

    const date = (await screen.findByLabelText("Дата")) as HTMLInputElement;
    expect(date.value).toBe("2026-09-06");
    expect((screen.getByLabelText("Время") as HTMLInputElement).value).toBe("19:30");
  });

  /** Очистка поля — это осознанное «мне всё равно когда», и эффект не должен
   * возвращать значение обратно на следующей отрисовке. */
  it("не возвращает дату, которую гость стёр", async () => {
    renderScreen(<SearchPanel state={EMPTY_CATALOG_STATE} />);

    const date = (await screen.findByLabelText("Дата")) as HTMLInputElement;
    fireEvent.change(date, { target: { value: "" } });

    expect(date.value).toBe("");
  });

  it("«Найти» уносит дату, время и гостей на листинг", async () => {
    renderScreen(
      <SearchPanel state={{ ...EMPTY_CATALOG_STATE, date: "2026-09-06", time: "19:30" }} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Найти" }));

    expect(push).toHaveBeenCalledTimes(1);
    const target = String(push.mock.calls[0][0]);
    expect(target).toContain("date=2026-09-06");
    expect(target).toContain("time=19%3A30");
    expect(target).toContain("guests=2");
  });
});

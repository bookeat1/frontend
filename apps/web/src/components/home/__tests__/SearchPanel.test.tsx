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

  /**
   * Баг, найденный владельцем вживую 2026-09-06: гость печатает название
   * заведения и жмёт «Найти» — дата/время НИКЕМ не тронуты, это черновик
   * автозаполнения («сегодня» + «сейчас»). Раньше они всё равно уезжали в
   * запрос вместе с `q`, включая на сервере фильтр доступности «прямо
   * сейчас», и заведение, которое сейчас просто закрыто, пропадало из
   * выдачи по имени — хотя оно есть в каталоге (проверено на бою: `q=Abay`
   * без даты/времени — 1 совпадение, с автоподставленными — 0). Поиск по
   * названию не должен зависеть от того, открыто ли заведение в эту минуту.
   */
  it("поиск по названию без ручного выбора даты не уносит автозаполненные дату/время", async () => {
    renderScreen(<SearchPanel state={EMPTY_CATALOG_STATE} />);

    const textField = await screen.findByLabelText("Место или кухня");
    fireEvent.change(textField, { target: { value: "Abay" } });
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));

    expect(push).toHaveBeenCalledTimes(1);
    const target = String(push.mock.calls[0][0]);
    expect(target).toContain("q=Abay");
    expect(target).not.toContain("date=");
    expect(target).not.toContain("time=");
  });

  /** Но если гость САМ тронул дату или время, это уже не черновик, а выбор —
   * «покажи заведения по имени X, у которых есть стол в это время» законный
   * запрос, и фильтр доступности остаётся. */
  it("поиск по названию с руками выбранной датой сохраняет дату", async () => {
    renderScreen(<SearchPanel state={EMPTY_CATALOG_STATE} />);

    const textField = await screen.findByLabelText("Место или кухня");
    fireEvent.change(textField, { target: { value: "Abay" } });
    const date = screen.getByLabelText("Дата") as HTMLInputElement;
    fireEvent.change(date, { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));

    expect(push).toHaveBeenCalledTimes(1);
    const target = String(push.mock.calls[0][0]);
    expect(target).toContain("q=Abay");
    expect(target).toContain("date=2026-09-10");
  });
});

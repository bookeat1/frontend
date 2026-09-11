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

/**
 * Дата гарантированно НЕ «сегодня» — тест ниже проверяет, что руками
 * выбранная дата отличается от автоподставленной. Раньше здесь была
 * зашита буквальная строка "2026-09-10": она случайно совпала с
 * `todayIso()` (`vitest.setup.ts` держит `TZ=Asia/Almaty`) и тест начал
 * молча падать — при равных значениях jsdom/React не считают инпут
 * изменившимся и не зовут `onChange`, а значит и `availabilityTouched`
 * не взводится. Дата здесь всегда на N дней впереди «сегодня», без
 * привязки к конкретному календарному дню.
 */
function futureIso(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
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
    const chosenDate = futureIso(5);
    fireEvent.change(date, { target: { value: chosenDate } });
    fireEvent.click(screen.getByRole("button", { name: "Найти" }));

    expect(push).toHaveBeenCalledTimes(1);
    const target = String(push.mock.calls[0][0]);
    expect(target).toContain("q=Abay");
    expect(target).toContain(`date=${chosenDate}`);
  });

  /**
   * Календарь (попап поля «Дата»): клик по полю открывает сетку месяца,
   * клик по «сегодня» ставит дату и закрывает попап — тот же `date`, что и
   * у нативного поля (проверяется его значением, а не разметкой попапа).
   */
  it("календарь: клик по сегодняшнему дню ставит дату в поле и закрывает попап", async () => {
    renderScreen(<SearchPanel state={EMPTY_CATALOG_STATE} />);

    const date = (await screen.findByLabelText("Дата")) as HTMLInputElement;
    fireEvent.click(date);

    const iso = todayIso();
    const day = String(Number(iso.slice(8, 10)));
    const cell = await screen.findByRole("button", { name: iso });
    expect(cell.textContent).toBe(day);
    fireEvent.click(cell);

    expect(date.value).toBe(iso);
    // Попап закрылся — ячейки календаря больше нет в DOM.
    expect(screen.queryByRole("button", { name: iso })).toBeNull();
  });

  /**
   * Баг владельца 2026-09-11 (скриншот): клик по «Дате»/«Времени» открывал
   * СРАЗУ два календаря — кастомный попап и поверх него нативный
   * date/time-picker браузера. Причина — `input[type=date|time]` сам
   * оставался кликабельным для мыши: клик по нему открывает нативный picker
   * как встроенное поведение браузера, независимо от `onClick`-обработчика
   * в React (`preventDefault` в `onClick` этого не отменяет). Фикс —
   * `pointer-events: none` на самих полях: мышь до них не долетает, попап
   * открывает обёртка `Field`. jsdom не считает реальный hit-test по CSS, но
   * класс — это контракт: если он однажды пропадёт, поле снова станет
   * кликабельным для мыши и баг вернётся молча.
   */
  it("нативные поля даты и времени исключены из hit-теста мыши (pointer-events-none)", async () => {
    renderScreen(<SearchPanel state={EMPTY_CATALOG_STATE} />);

    const date = (await screen.findByLabelText("Дата")) as HTMLInputElement;
    const time = screen.getByLabelText("Время") as HTMLInputElement;

    expect(date.className).toContain("pointer-events-none");
    expect(time.className).toContain("pointer-events-none");
  });

  /**
   * Гости: колесо-пикер (`WheelPicker`) заменил степпер `−`/`+` (задача
   * «виджет выбора даты/времени/гостей», узел `5178:19173`). Диапазон
   * тот же 1…8 (`GUEST_OPTIONS`), но границы теперь ЗАЦИКЛЕНЫ, а не
   * клампятся — так ведёт себя колесо в макете (шеврон листает значение на
   * ±1 и оборачивается на границе), это не регрессия прежнего степпера.
   */
  it("гости: колесо меняет количество и зациклено на границах 1…8", async () => {
    renderScreen(<SearchPanel state={EMPTY_CATALOG_STATE} />);

    fireEvent.click(await screen.findByRole("button", { name: "Гости: 2 гостя" }));
    const output = screen.getByRole("status");
    const decrease = screen.getByRole("button", { name: "Гости: предыдущее значение" });
    fireEvent.click(decrease);
    expect(output.textContent).toBe("1");
    fireEvent.click(decrease); // граница снизу — оборот на 8, а не остановка на 1
    expect(output.textContent).toBe("8");

    const increase = screen.getByRole("button", { name: "Гости: следующее значение" });
    fireEvent.click(increase); // граница сверху — оборот на 1
    expect(output.textContent).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "Найти" }));
    expect(String(push.mock.calls[0][0])).toContain("guests=1");
  });

  /**
   * Время: колесо часов (0…23) и колесо минут (0…59), оба независимо
   * зациклены (узел `5178:19076` «select_hour_desktop») — заменили список
   * получасовых слотов первого захода. Начинаем с граничного значения
   * "23:59", чтобы одним кликом на каждый шеврон проверить оборот в обе
   * стороны у обеих колонок.
   */
  it("время: шеврон часов/минут листает значение и оборачивается на границах", async () => {
    renderScreen(
      <SearchPanel state={{ ...EMPTY_CATALOG_STATE, date: "2026-09-06", time: "23:59" }} />,
    );

    const time = (await screen.findByLabelText("Время")) as HTMLInputElement;
    fireEvent.click(time);

    const hourUp = await screen.findByRole("button", { name: "Часы: следующее значение" });
    fireEvent.click(hourUp);
    expect(time.value).toBe("00:59"); // 23 + 1 → 0, минуты не тронуты

    const minuteUp = screen.getByRole("button", { name: "Минуты: следующее значение" });
    fireEvent.click(minuteUp);
    expect(time.value).toBe("00:00"); // 59 + 1 → 0

    const hourDown = screen.getByRole("button", { name: "Часы: предыдущее значение" });
    fireEvent.click(hourDown);
    expect(time.value).toBe("23:00"); // 0 − 1 → 23

    const minuteDown = screen.getByRole("button", { name: "Минуты: предыдущее значение" });
    fireEvent.click(minuteDown);
    expect(time.value).toBe("23:59"); // 0 − 1 → 59
  });

  it("попап закрывается по Escape", async () => {
    renderScreen(<SearchPanel state={EMPTY_CATALOG_STATE} />);

    const time = (await screen.findByLabelText("Время")) as HTMLInputElement;
    fireEvent.click(time);
    expect(await screen.findByRole("group", { name: "Часы" })).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Часы" })).toBeNull();
  });
});

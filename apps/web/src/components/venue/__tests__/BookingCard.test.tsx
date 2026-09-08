import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { RepositoryError, type DayAvailability } from "@bookeat/api/client";

import { dayAvailability, pending, renderScreen, repositoryStub, slot, venueDetail } from "@web/test/harness";
import { todayIso } from "@web/lib/format";

/**
 * Карточка брони в правой колонке страницы заведения (Figma
 * QovvuAoI9YxsLMwWkfgKN8, узел 3525:14731).
 *
 * Карточка САМА БРОНЬ НЕ СОЗДАЁТ: она даёт выбрать день, компанию и время и
 * ведёт на страницу бронирования, унося выбор в адресе. Отправка, отказы
 * сервера, вход и идемпотентность проверяются в `BookingScreen.test.tsx`.
 *
 * Здесь проверяется то, что ломается молча и дорого:
 *   • четыре РАЗНЫЕ пустоты вместо одной («нет часов» ≠ «нет столика на
 *     компанию» ≠ «поздно» ≠ «всё занято») — совет гостю в каждом случае свой;
 *   • время слота печатается по стенным часам ЗАВЕДЕНИЯ, а не по поясу
 *     браузера;
 *   • ссылка на страницу бронирования несёт ровно тот выбор, что сделан, и
 *     не появляется, пока время не выбрано.
 */

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/venues/venue-1",
  useSearchParams: () => new URLSearchParams(""),
}));

const { BookingCard } = await import("@web/components/venue/BookingCard");

function renderCard(overrides = {}) {
  return renderScreen(<BookingCard venue={venueDetail(overrides)} />);
}

/** Дождаться, пока сетка слотов приедет: карточка спрашивает доступность
 * только после гидратации, когда браузер сообщит сегодняшнюю дату. */
async function slotsShown() {
  return screen.findByRole("group", { name: "Свободное время" });
}

/** Дата заведомо в будущем: черновик с прошедшим днём карточка отбрасывает. */
const FUTURE = todayIso(new Date(Date.now() + 3 * 86_400_000));

beforeEach(() => {
  // Заглушки, которые тест переназначил, переживают его: `restoreMocks`
  // возвращает реализацию, а не прежнее свойство объекта. Без этой строки
  // порядок тестов в файле становился бы частью их условий.
  repository.getAvailability = vi.fn(async () => dayAvailability());
  // Черновик выбора живёт в sessionStorage и пережил бы соседний тест.
  window.sessionStorage.clear();
});

describe("карточка брони — данные и пустоты", () => {
  it("пока доступность едет, показывает загрузку, а не пустую сетку", async () => {
    repository.getAvailability = vi.fn(() => pending<DayAvailability>());

    renderCard();

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Свободное время" })).toBeNull();
  });

  it("сбой связи — это ошибка с повтором, а не «мест нет»", async () => {
    repository.getAvailability = vi.fn(async () => {
      throw new RepositoryError("offline", undefined, undefined, undefined, undefined, undefined, true);
    });

    renderCard();

    expect(await screen.findByText("Не удалось загрузить")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
  });

  it("заведение не принимает онлайн-брони — говорим это словами и не ходим в сеть", async () => {
    renderCard({ acceptsOnlineBookings: false });

    expect(await screen.findByText("Онлайн-бронирование недоступно")).toBeTruthy();
    expect(repository.getAvailability).not.toHaveBeenCalled();
    // Поля даты и гостей вели бы в тупик, поэтому их нет вовсе.
    expect(screen.queryByLabelText("Дата")).toBeNull();
  });

  it("пустой день, отсутствие столика и «всё занято» — три РАЗНЫХ ответа", async () => {
    repository.getAvailability = vi.fn(async () => dayAvailability({ slots: [] }));
    const { unmount } = renderCard();
    expect(
      await screen.findByText("На этот день сервер не отдал ни одного времени. Попробуйте другую дату."),
    ).toBeTruthy();
    unmount();

    repository.getAvailability = vi.fn(async () =>
      dayAvailability({
        slots: [
          slot({ available: false, reason: "capacity", freeTables: 0 }),
          slot({ startsAt: "2026-08-25T20:00:00+05:00", available: false, reason: "capacity", freeTables: 0 }),
        ],
      }),
    );
    const second = renderCard();
    expect(
      await screen.findByText(
        "Столика на такую компанию у заведения нет. Попробуйте меньше гостей или позвоните напрямую.",
      ),
    ).toBeTruthy();
    second.unmount();

    repository.getAvailability = vi.fn(async () =>
      dayAvailability({
        slots: [
          slot({ available: false, reason: "occupied", freeTables: 0 }),
          slot({ startsAt: "2026-08-25T20:00:00+05:00", available: false, reason: "capacity", freeTables: 0 }),
        ],
      }),
    );
    renderCard();
    expect(
      await screen.findByText("Всё занято. Попробуйте другой день или другое число гостей."),
    ).toBeTruthy();
  });

  it("вечером «поздно» — это не «занято»: все слоты too_soon разбираются отдельно", async () => {
    // Ровно так тестовый сервер отвечает вечером: 24 слота, у всех
    // reason "too_soon" (проверено живым запросом 02.09.2026).
    repository.getAvailability = vi.fn(async () =>
      dayAvailability({
        slots: [
          slot({ available: false, reason: "too_soon", freeTables: 0 }),
          slot({ startsAt: "2026-08-25T20:00:00+05:00", available: false, reason: "too_soon", freeTables: 0 }),
        ],
      }),
    );

    renderCard();

    expect(
      await screen.findByText("На сегодня бронировать уже поздно. Выберите другой день."),
    ).toBeTruthy();
    expect(screen.queryByText(/Всё занято/)).toBeNull();
  });

  it("занятый слот виден, выключен и назван причиной, а не серым прямоугольником", async () => {
    repository.getAvailability = vi.fn(async () =>
      dayAvailability({
        slots: [
          slot({ startsAt: "2026-08-25T17:30:00+05:00", available: false, reason: "too_soon", freeTables: 0 }),
          slot(),
        ],
      }),
    );

    renderCard();
    await slotsShown();

    const taken = screen.getByRole("button", { name: "17:30 — слишком близко к началу" });
    expect(taken).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "19:30" })).toHaveProperty("disabled", false);
  });

  it("время слота — стенные часы ЗАВЕДЕНИЯ, а не пересчёт в пояс браузера", async () => {
    // +05:00 у заведения; тестовый пояс — Asia/Almaty (UTC+5 с 2024 года),
    // поэтому смещение берём заведомо чужое: в Берлине это было бы 16:30.
    repository.getAvailability = vi.fn(async () =>
      dayAvailability({ slots: [slot({ startsAt: "2026-08-25T19:30:00+02:00" })] }),
    );

    renderCard();
    await slotsShown();

    expect(screen.getByRole("button", { name: "19:30" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "22:30" })).toBeNull();
  });

  it("смена числа гостей перезапрашивает доступность и снимает выбор времени", async () => {
    // Сервер отдаёт на шестерых ТОТ ЖЕ слот, что и на двоих: без снятия
    // выбора «19:30» нашёлся бы в новой выдаче, и кнопка снова предлагала бы
    // бронь — на компанию, для которой этот слот никто не проверял.
    repository.getAvailability = vi.fn(async (input) =>
      dayAvailability({ guests: input.guests, slots: [slot()] }),
    );

    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));
    expect(screen.getByRole("link", { name: /Забронировать на 19:30/ })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Гости"), { target: { value: "6" } });

    // Дождаться НОВОЙ сетки, а не переходного скелета: пока выдача едет,
    // слота нет ни у кого, и «Выберите время» на скелете ничего не доказывает.
    await waitFor(() => expect(repository.getAvailability).toHaveBeenCalledTimes(2));
    expect(vi.mocked(repository.getAvailability).mock.calls[1][0]).toEqual(
      expect.objectContaining({ guests: 6, restaurantId: "venue-1" }),
    );
    await slotsShown();
    // Сетка на шестерых на экране, слот в ней есть — и всё равно не выбран.
    expect(screen.getByRole("button", { name: "19:30" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(screen.getByRole("button", { name: "Выберите время" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Забронировать на 19:30/ })).toBeNull();
  });

  it("слот после полуночи подписан своим днём, а не выбранной датой", async () => {
    // Заведение до 02:00: для выбранного дня сервер отдаёт старт уже
    // следующего числа. Гость должен прийти в ту ночь, что на кнопке.
    repository.getAvailability = vi.fn(async () =>
      dayAvailability({
        slots: [
          slot({ startsAt: "2026-08-26T00:30:00+05:00", endsAt: "2026-08-26T02:00:00+05:00" }),
        ],
      }),
    );

    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "00:30" }));

    const submit = screen.getByRole("link", { name: /Забронировать на 00:30/ });
    expect(submit.textContent).toContain("26 августа · 2 гостя");
  });

  it("очищенная дата — просьба выбрать дату, а не вечная загрузка", async () => {
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));

    // Chrome шлёт пустую строку, когда стёрты сегменты даты.
    fireEvent.change(screen.getByLabelText("Дата"), { target: { value: "" } });

    expect(
      await screen.findByText("Выберите дату, чтобы увидеть свободное время."),
    ).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    // Слот принадлежал дню, которого больше нет.
    expect(screen.getByRole("button", { name: "Выберите время" })).toBeTruthy();
  });
});

describe("карточка брони — поля заперты, пока доступность едет", () => {
  it("пока первая выдача едет, дату и гостей менять нельзя", async () => {
    repository.getAvailability = vi.fn(() => pending<DayAvailability>());

    renderCard();

    // Скелет на экране — значит, запрос в полёте и показывать нечего.
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByLabelText("Дата")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Гости")).toHaveProperty("disabled", true);
  });

  it("когда выдача приехала, поля снова открыты — и запираются только на время перезапроса", async () => {
    renderCard();
    await slotsShown();

    expect(screen.getByLabelText("Дата")).toHaveProperty("disabled", false);
    expect(screen.getByLabelText("Гости")).toHaveProperty("disabled", false);

    // Смена компании — новый запрос: пока он летит, поля заперты, чтобы гость
    // не менял выбор под ответ, которого ещё нет.
    let deliver: (value: DayAvailability) => void = () => {};
    repository.getAvailability = vi.fn(
      (input) =>
        new Promise<DayAvailability>((resolve) => {
          deliver = () => resolve(dayAvailability({ guests: input.guests, slots: [slot()] }));
        }),
    );
    fireEvent.change(screen.getByLabelText("Гости"), { target: { value: "6" } });

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByLabelText("Дата")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Гости")).toHaveProperty("disabled", true);

    deliver(dayAvailability());
    await slotsShown();
    expect(screen.getByLabelText("Дата")).toHaveProperty("disabled", false);
    expect(screen.getByLabelText("Гости")).toHaveProperty("disabled", false);
    expect((screen.getByLabelText("Гости") as HTMLSelectElement).value).toBe("6");
  });
});

describe("карточка брони — выбор переживает уход на вход", () => {
  it("дата, гости и слот восстанавливаются для того же заведения", async () => {
    const first = renderCard();
    await slotsShown();
    fireEvent.change(screen.getByLabelText("Дата"), { target: { value: FUTURE } });
    fireEvent.change(screen.getByLabelText("Гости"), { target: { value: "4" } });
    await waitFor(() =>
      expect(repository.getAvailability).toHaveBeenLastCalledWith(
        expect.objectContaining({ date: FUTURE, guests: 4 }),
      ),
    );
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));
    expect(screen.getByRole("link", { name: /Забронировать на 19:30/ })).toBeTruthy();

    // Ушёл на страницу бронирования и вернулся: карточка смонтирована заново.
    first.unmount();
    renderCard();

    expect(((await screen.findByLabelText("Дата")) as HTMLInputElement).value).toBe(FUTURE);
    expect((screen.getByLabelText("Гости") as HTMLSelectElement).value).toBe("4");
    await slotsShown();
    expect(screen.getByRole("button", { name: "19:30" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("link", { name: /Забронировать на 19:30/ })).toBeTruthy();
  });

  it("черновик одного заведения не всплывает на странице другого", async () => {
    const first = renderCard();
    await slotsShown();
    fireEvent.change(screen.getByLabelText("Гости"), { target: { value: "4" } });
    await waitFor(() =>
      expect(repository.getAvailability).toHaveBeenLastCalledWith(
        expect.objectContaining({ guests: 4 }),
      ),
    );
    first.unmount();

    renderScreen(<BookingCard venue={venueDetail({ id: "venue-2", name: "Другое" })} />);
    await slotsShown();
    expect((screen.getByLabelText("Гости") as HTMLSelectElement).value).toBe("2");
  });
});

describe("карточка брони — переход на страницу бронирования", () => {
  it("пока время не выбрано — выключенная кнопка «Выберите время», а не ссылка в никуда", async () => {
    renderCard();
    await slotsShown();

    expect(screen.getByRole("button", { name: "Выберите время" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("link", { name: /Забронировать/ })).toBeNull();
  });

  it("ссылка несёт день, компанию и слот ДОСЛОВНО — страница бронирования читает их из адреса", async () => {
    repository.getAvailability = vi.fn(async (input) =>
      dayAvailability({ guests: input.guests, slots: [slot()] }),
    );
    renderCard();
    await slotsShown();
    fireEvent.change(screen.getByLabelText("Гости"), { target: { value: "4" } });
    await waitFor(() => expect(repository.getAvailability).toHaveBeenCalledTimes(2));
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));

    const link = screen.getByRole("link", { name: /Забронировать на 19:30/ });
    expect(link.getAttribute("href")).toBe(
      `/venues/venue-1/book?date=${todayIso()}&guests=4&slot=2026-08-25T19%3A30%3A00%2B05%3A00`,
    );
    expect(link.textContent).toContain("25 августа · 4 гостя");
  });

  it("вход здесь не проверяется: гость без сессии тоже идёт на страницу бронирования, а не на /login", async () => {
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));

    const link = screen.getByRole("link", { name: /Забронировать на 19:30/ });
    expect(link.getAttribute("href")).toMatch(/^\/venues\/venue-1\/book\?/);
    expect(link.getAttribute("href")).not.toContain("/login");
  });
});

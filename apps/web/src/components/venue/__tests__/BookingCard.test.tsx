import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import {
  RepositoryError,
  type AuthUser,
  type Booking,
  type DayAvailability,
} from "@bookeat/api/client";

import {
  booking,
  dayAvailability,
  pending,
  renderScreen,
  repositoryStub,
  slot,
  venueDetail,
} from "@web/test/harness";
import { todayIso } from "@web/lib/format";

/**
 * Карточка брони в правой колонке страницы заведения (Figma
 * QovvuAoI9YxsLMwWkfgKN8, узел 3525:14731).
 *
 * Проверяется то, что ломается молча и дорого:
 *   • три РАЗНЫЕ пустоты вместо одной («нет часов» ≠ «нет столика на компанию»
 *     ≠ «всё занято») — совет гостю в каждом случае свой;
 *   • время слота печатается по стенным часам ЗАВЕДЕНИЯ, а не по поясу
 *     браузера;
 *   • гостю без входа кнопка не врёт, а ведёт на вход и помнит, откуда;
 *   • на 409 гостю НЕ сообщают о брони, которой нет;
 *   • двойное нажатие не даёт второй стол, а повтор той же брони уходит с тем
 *     же ключом идемпотентности.
 */

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

/** Вход подменяется, а не поднимается по-настоящему: карточка про бронь, а не
 * про OTP. `isLoading: false` — сессия из хранилища уже прочитана. */
let auth: { signedIn: boolean; isLoading: boolean; user: AuthUser | null } = {
  signedIn: false,
  isLoading: false,
  user: null,
};

vi.mock("@web/lib/auth", () => ({
  useAuth: () => ({ ...auth, completeSignIn: vi.fn(), signOut: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/venues/venue-1",
  useSearchParams: () => new URLSearchParams(""),
}));

const { BookingCard } = await import("@web/components/venue/BookingCard");

function guest(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: "damir@example.kz",
    fullName: "Дамир",
    phone: "+77010000000",
    city: null,
    avatarUrl: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as AuthUser;
}

function signIn(user: AuthUser = guest()) {
  auth = { signedIn: true, isLoading: false, user };
}

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

/** `createBooking`, который отвечает только когда тест скажет: так ловится
 * всё, что гость успевает сделать за секунду спиннера. */
function deferredBooking() {
  let resolve: (value: Booking) => void = () => {};
  repository.createBooking = vi.fn(
    () =>
      new Promise<Booking>((done) => {
        resolve = done;
      }),
  );
  return (value: Booking = booking()) => act(async () => resolve(value));
}

beforeEach(() => {
  auth = { signedIn: false, isLoading: false, user: null };
  // Заглушки, которые тест переназначил, переживают его: `restoreMocks`
  // возвращает реализацию, а не прежнее свойство объекта. Без этой строки
  // порядок тестов в файле становился бы частью их условий.
  repository.getAvailability = vi.fn(async () => dayAvailability());
  repository.createBooking = vi.fn(async () => booking());
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

    signIn();
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));
    expect(screen.getByRole("button", { name: /Забронировать на 19:30/ })).toBeTruthy();

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
    expect(screen.queryByRole("button", { name: /Забронировать на 19:30/ })).toBeNull();
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

    signIn();
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "00:30" }));

    const submit = screen.getByRole("button", { name: /Забронировать на 00:30/ });
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

describe("карточка брони — выбор переживает уход на вход", () => {
  it("дата, гости и слот восстанавливаются для того же заведения", async () => {
    signIn();
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
    expect(screen.getByRole("button", { name: /Забронировать на 19:30/ })).toBeTruthy();

    // Ушёл на /login и вернулся: карточка смонтирована заново.
    first.unmount();
    renderCard();

    expect(((await screen.findByLabelText("Дата")) as HTMLInputElement).value).toBe(FUTURE);
    expect((screen.getByLabelText("Гости") as HTMLSelectElement).value).toBe("4");
    await slotsShown();
    expect(screen.getByRole("button", { name: "19:30" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: /Забронировать на 19:30/ })).toBeTruthy();
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

describe("карточка брони — отправка", () => {
  it("гостю без входа кнопка не врёт: это ссылка на вход, помнящая заведение", async () => {
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));

    const link = await screen.findByRole("link", { name: /Забронировать на 19:30/ });
    expect(link.getAttribute("href")).toBe("/login?next=%2Fvenues%2Fvenue-1");
    expect(screen.queryByRole("button", { name: /Забронировать на 19:30/ })).toBeNull();
  });

  it("вошёл, но профиль не приехал — кнопка выключена и говорит почему", async () => {
    // `AuthProvider` переживает падение GET /me после ввода кода:
    // `signedIn: true`, `user: null`. Телефона для брони нет.
    auth = { signedIn: true, isLoading: false, user: null };
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));

    const submit = screen.getByRole("button", { name: /Забронировать на 19:30/ });
    expect(submit).toHaveProperty("disabled", true);
    expect(submit.textContent).toContain("Профиль не загрузился");
    expect(screen.getByText(/Обновите страницу/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Обновить страницу" })).toBeTruthy();
    fireEvent.click(submit);
    expect(repository.createBooking).not.toHaveBeenCalled();
  });

  it("пока бронь летит, дата и гости выключены", async () => {
    signIn();
    deferredBooking();
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));
    fireEvent.click(screen.getByRole("button", { name: /Забронировать на 19:30/ }));

    await waitFor(() => expect(repository.createBooking).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Дата")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Гости")).toHaveProperty("disabled", true);
  });

  it("смена гостей во время отправки не теряет подтверждение и не даёт второй стол", async () => {
    // Сценарий двух броней: гость нажал, за секунду спиннера переключил
    // гостей с 2 на 3. Раньше это звало `create.reset()`, наблюдатель
    // отписывался, `onSuccess` не доходил — и гость жал снова с новым ключом.
    signIn();
    const settle = deferredBooking();
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));
    fireEvent.click(screen.getByRole("button", { name: /Забронировать на 19:30/ }));
    await waitFor(() => expect(repository.createBooking).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Гости"), { target: { value: "3" } });
    await settle();

    expect(await screen.findByText("Стол забронирован")).toBeTruthy();
    // Подтверждено то, что реально ушло на сервер: двое, а не трое.
    expect(screen.getByText(/19:30 · 2 гостя/)).toBeTruthy();
    expect(repository.createBooking).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Забронировать/ })).toBeNull();
  });

  it("отправляет строку слота ДОСЛОВНО, с именем и телефоном из профиля", async () => {
    signIn();
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));
    fireEvent.click(screen.getByRole("button", { name: /Забронировать на 19:30/ }));

    await waitFor(() => expect(repository.createBooking).toHaveBeenCalled());
    const [input, key] = vi.mocked(repository.createBooking).mock.calls[0];
    expect(input).toEqual({
      restaurantId: "venue-1",
      startsAt: "2026-08-25T19:30:00+05:00",
      guests: 2,
      name: "Дамир",
      phone: "+77010000000",
    });
    expect(key.length).toBeGreaterThan(0);
  });

  it("двойное нажатие не бронирует второй стол", async () => {
    signIn();
    repository.createBooking = vi.fn(() => pending<ReturnType<typeof booking>>());
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));

    const submit = screen.getByRole("button", { name: /Забронировать на 19:30/ });
    fireEvent.click(submit);
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(repository.createBooking).toHaveBeenCalledTimes(1));
  });

  it("повтор ТОЙ ЖЕ брони уходит с тем же ключом идемпотентности", async () => {
    signIn();
    repository.createBooking = vi.fn(async () => {
      throw new RepositoryError("offline", undefined, undefined, undefined, undefined, undefined, true);
    });
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));

    fireEvent.click(screen.getByRole("button", { name: /Забронировать на 19:30/ }));
    await screen.findByText("Не удалось забронировать");
    fireEvent.click(screen.getByRole("button", { name: /Забронировать на 19:30/ }));
    await waitFor(() => expect(repository.createBooking).toHaveBeenCalledTimes(2));

    const calls = vi.mocked(repository.createBooking).mock.calls;
    expect(calls[0][1]).toBe(calls[1][1]);
  });

  it("409 «слот занят» — прямо говорит, что брони НЕТ", async () => {
    signIn();
    repository.createBooking = vi.fn(async () => {
      throw new RepositoryError("conflict", undefined, 409, undefined, "slot_taken");
    });
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));
    fireEvent.click(screen.getByRole("button", { name: /Забронировать на 19:30/ }));

    expect(await screen.findByText("Это время только что заняли")).toBeTruthy();
    expect(screen.getByText(/Брони нет/)).toBeTruthy();
    // И ничего не обещает: кнопка вернулась к «выберите время».
    expect(screen.getByRole("button", { name: "Выберите время" })).toBeTruthy();
  });

  it("409 «ключ уже использован» — бронь есть, и вторую отправить нельзя", async () => {
    signIn();
    repository.createBooking = vi.fn(async () => {
      throw new RepositoryError("conflict", undefined, 409, undefined, "idempotency_key_reused");
    });
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));
    fireEvent.click(screen.getByRole("button", { name: /Забронировать на 19:30/ }));

    expect(await screen.findByText("Эта бронь уже создана")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Забронировать на 19:30/ })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("успех подтверждается стенными часами заведения, а не UTC из ответа", async () => {
    signIn();
    // Сервер отдаёт бронь в UTC (Booking.startsAt), заведение стоит на +05:00.
    repository.createBooking = vi.fn(async () => booking({ startsAt: "2026-08-25T14:30:00Z" }));
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));
    fireEvent.click(screen.getByRole("button", { name: /Забронировать на 19:30/ }));

    expect(await screen.findByText("Стол забронирован")).toBeTruthy();
    expect(screen.getByText(/25 августа, 19:30 · 2 гостя/)).toBeTruthy();
  });

  it("успех объявляется диктору и получает фокус вместо исчезнувшей кнопки", async () => {
    signIn();
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));
    const submit = screen.getByRole("button", { name: /Забронировать на 19:30/ });
    submit.focus();
    fireEvent.click(submit);

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Стол забронирован");
    expect(status.getAttribute("aria-live")).toBe("polite");
    // Кнопки больше нет, фокус не должен провалиться в body.
    expect(document.activeElement).toBe(status);
  });

  it("пустое имя в профиле — отдельный ответ, а не молчаливый 422", async () => {
    signIn(guest({ fullName: "  " }));
    renderCard();
    await slotsShown();
    fireEvent.click(screen.getByRole("button", { name: "19:30" }));
    fireEvent.click(screen.getByRole("button", { name: /Забронировать на 19:30/ }));

    expect(await screen.findByText("В профиле не указано имя")).toBeTruthy();
    expect(repository.createBooking).not.toHaveBeenCalled();
  });
});

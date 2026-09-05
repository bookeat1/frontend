import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { RepositoryError, type AuthUser, type Booking, type Restaurant } from "@bookeat/api/client";

import { booking, pending, renderScreen, repositoryStub, venueDetail } from "@web/test/harness";
import { bookingHref } from "@web/lib/booking-link";
import { todayIso } from "@web/lib/format";
import { loginHref } from "@web/lib/return-to";

/**
 * Страница бронирования (Figma QovvuAoI9YxsLMwWkfgKN8, узел 3525:14815).
 *
 * Главное, ради чего этот файл существует: ТУПИК «гость с пустым именем не
 * может забронировать» закрыт не молчаливым отказом, а полем ввода с видимой
 * ошибкой, которая получает фокус. Остальное — то, что ломается молча и
 * дорого: двойное нажатие, 409 без брони, ввод, который переживает отказ
 * сервера и уход на вход, режим переноса.
 */

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

let auth: { signedIn: boolean; isLoading: boolean; user: AuthUser | null } = {
  signedIn: false,
  isLoading: false,
  user: null,
};

vi.mock("@web/lib/auth", () => ({
  useAuth: () => ({ ...auth, completeSignIn: vi.fn(), signOut: vi.fn() }),
}));

const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() };
let search = new URLSearchParams("");

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/venues/venue-1/book",
  useSearchParams: () => search,
}));

const { BookingScreen, composeNotes } = await import("@web/components/booking/BookingScreen");

const SLOT = "2026-08-25T19:30:00+05:00";
const CHANGE_ID = "a1b2c3d4-0000-4000-8000-000000000001";

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

function signIn(user: AuthUser | null = guest()) {
  auth = { signedIn: true, isLoading: false, user };
}

function renderBooking() {
  return renderScreen(<BookingScreen id="venue-1" />);
}

async function slotsShown() {
  return screen.findByRole("group", { name: "Свободное время" });
}

/** Выбрать 19:30 и дождаться кнопки отправки. */
async function chooseSlot() {
  await slotsShown();
  fireEvent.click(screen.getByRole("button", { name: "19:30" }));
}

const nameField = () => screen.getByRole("textbox", { name: "Имя" }) as HTMLInputElement;
const phoneField = () => screen.getByRole("textbox", { name: "Телефон" }) as HTMLInputElement;
const submitButton = () => screen.getByRole("button", { name: "Забронировать" });

beforeEach(() => {
  auth = { signedIn: false, isLoading: false, user: null };
  search = new URLSearchParams("");
  repository.getRestaurant = vi.fn(async () => venueDetail());
  repository.getAvailability = vi.fn(async () => ({
    restaurantId: "venue-1",
    date: "2026-08-25",
    timezone: "Asia/Almaty",
    guests: 2,
    durationMinutes: 90,
    slots: [
      {
        startsAt: SLOT,
        endsAt: "2026-08-25T21:00:00+05:00",
        available: true,
        freeTables: 2,
        reason: null,
      },
    ],
  }));
  repository.createBooking = vi.fn(async () => booking());
  repository.rescheduleBooking = vi.fn(async () => booking({ id: CHANGE_ID }));
  window.sessionStorage.clear();
});

describe("страница бронирования — состояния", () => {
  it("пока заведение едет — загрузка, а не пустая форма", async () => {
    repository.getRestaurant = vi.fn(() => pending<Restaurant>());

    renderBooking();

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.queryByText("Дата и время")).toBeNull();
  });

  it("404 по заведению — «не найдено», а не «проверьте соединение»", async () => {
    repository.getRestaurant = vi.fn(async () => {
      throw new RepositoryError("not found", undefined, 404);
    });

    renderBooking();

    expect(await screen.findByText("Заведение не найдено")).toBeTruthy();
    expect(screen.queryByText("Не удалось загрузить")).toBeNull();
  });

  it("заведение не принимает онлайн-брони — говорим словами и не спрашиваем доступность", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail({ acceptsOnlineBookings: false }));

    renderBooking();

    expect(await screen.findByText("Онлайн-бронирование недоступно")).toBeTruthy();
    expect(repository.getAvailability).not.toHaveBeenCalled();
  });

  it("гостю без входа кнопка не врёт: ссылка на вход помнит страницу ВМЕСТЕ с выбором", async () => {
    renderBooking();
    await chooseSlot();

    const link = screen.getByRole("link", { name: "Войти и забронировать" });
    expect(link.getAttribute("href")).toBe(
      loginHref(bookingHref("venue-1", { date: todayIso(), guests: 2, slot: SLOT })),
    );
    expect(screen.queryByRole("button", { name: "Забронировать" })).toBeNull();
  });

  it("сессия ещё читается — кнопка «Забронировать» стоит выключенной, а не ссылкой на вход", async () => {
    // Узел 3525:14971, облик «waiting»: подпись честная (не «Бронируем…»),
    // нажать нельзя, и гостя не гонят на вход, пока не ясно, вошёл ли он.
    auth = { signedIn: false, isLoading: true, user: null };
    renderBooking();
    await chooseSlot();

    const button = submitButton();
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(screen.queryByRole("link", { name: "Войти и забронировать" })).toBeNull();
    expect(screen.queryByText("Код придёт на ваш номер. Заполненное вернётся на место.")).toBeNull();
  });

  /** Ниже `lg` сводка свёрнута за настоящей кнопкой (`docs/responsive.md`,
   * дыра № 10): диктор слышит состояние, тело связано через `aria-controls`.
   * Кнопка отправки при этом одна на оба экрана — `submitButton()` в тестах
   * отправки (`getByRole`) упал бы на второй. */
  it("сводка раскрывается кнопкой «Ваша бронь»", async () => {
    renderBooking();
    await chooseSlot();

    const toggle = screen.getByRole("button", { name: "Ваша бронь" });
    const body = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(body).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(body?.className).toContain("hidden");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(body?.className).not.toContain("hidden");
  });
});

describe("страница бронирования — имя и телефон", () => {
  it("имя, телефон и почта подставляются из профиля, но остаются полями ввода", async () => {
    signIn();
    renderBooking();
    await slotsShown();

    expect(nameField().value).toBe("Дамир");
    expect(nameField().disabled).toBe(false);
    expect(phoneField().value).toBe("701 000-00-00");
    expect((screen.getByRole("textbox", { name: "E-mail (необязательно)" }) as HTMLInputElement).value).toBe(
      "damir@example.kz",
    );
  });

  it("ИНОСТРАННЫЙ НОМЕР В ПРОФИЛЕ — поле пустое и с ошибкой, а не фальшивый «+7…» на сервер", async () => {
    // Аккаунт заведён из приложения с выбором страны. Раньше `nationalDigits`
    // брал первые десять цифр, и бронь уходила с `phone: "+74915112345"`.
    signIn(guest({ phone: "+4915112345678" }));
    renderBooking();
    await chooseSlot();

    expect(phoneField().value).toBe("");
    fireEvent.click(submitButton());

    await waitFor(() => expect(phoneField().getAttribute("aria-invalid")).toBe("true"));
    expect(repository.createBooking).not.toHaveBeenCalled();
    expect(nameField().value).toBe("Дамир");
  });

  it("ПУСТОЕ ИМЯ В ПРОФИЛЕ — ошибка видна, названа, получает фокус, а запрос не уходит", async () => {
    // Вход по коду создаёт учётную запись без имени, а сервер требует
    // непустое `name`. Раньше это был тупик «заполните имя в приложении».
    signIn(guest({ fullName: "  " }));
    renderBooking();
    await chooseSlot();

    expect(nameField().value).toBe("");
    fireEvent.click(submitButton());

    expect(await screen.findByText("Без имени заведение не поймёт, кого ждать.")).toBeTruthy();
    expect(screen.getByText("Проверьте форму")).toBeTruthy();
    expect(nameField().getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(nameField());
    expect(repository.createBooking).not.toHaveBeenCalled();

    // Гость вписал имя — ошибка уходит, бронь уходит с ЭТИМ именем.
    fireEvent.change(nameField(), { target: { value: "Камила" } });
    expect(screen.queryByText("Без имени заведение не поймёт, кого ждать.")).toBeNull();
    fireEvent.click(submitButton());

    await waitFor(() => expect(repository.createBooking).toHaveBeenCalledTimes(1));
    expect(vi.mocked(repository.createBooking).mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: "Камила", phone: "+77010000000" }),
    );
  });

  it("вошёл, но профиль не приехал (`user: null`) — поля пустые, ошибка по каждому, а не 422 от сервера", async () => {
    signIn(null);
    renderBooking();
    await chooseSlot();
    fireEvent.click(submitButton());

    expect(await screen.findByText("Без имени заведение не поймёт, кого ждать.")).toBeTruthy();
    expect(screen.getByText(/Нужен казахстанский номер из 10 цифр/)).toBeTruthy();
    expect(repository.createBooking).not.toHaveBeenCalled();
  });

  it("снятая галочка оферты — ошибка, запрос не уходит", async () => {
    signIn();
    renderBooking();
    await chooseSlot();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(submitButton());

    expect(await screen.findByText("Без согласия с условиями забронировать нельзя.")).toBeTruthy();
    expect(repository.createBooking).not.toHaveBeenCalled();
  });
});

describe("страница бронирования — отправка", () => {
  it("отправляет строку слота ДОСЛОВНО, почту и пожелания (чипы, потом текст), затем уходит на страницу брони", async () => {
    signIn();
    renderBooking();
    await chooseSlot();
    fireEvent.click(screen.getByRole("button", { name: "Столик у окна" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Пожелания к брони" }), {
      target: { value: "Отмечаем юбилей" },
    });
    fireEvent.click(submitButton());

    await waitFor(() => expect(repository.createBooking).toHaveBeenCalledTimes(1));
    const [input, key] = vi.mocked(repository.createBooking).mock.calls[0];
    expect(input).toEqual({
      restaurantId: "venue-1",
      startsAt: SLOT,
      guests: 2,
      name: "Дамир",
      phone: "+77010000000",
      email: "damir@example.kz",
      notes: "Столик у окна. Отмечаем юбилей",
    });
    expect(key.length).toBeGreaterThan(0);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/bookings/booking-1"));
  });

  it("двойное нажатие не бронирует второй стол", async () => {
    signIn();
    repository.createBooking = vi.fn(() => pending<Booking>());
    renderBooking();
    await chooseSlot();

    const submit = submitButton();
    fireEvent.click(submit);
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(repository.createBooking).toHaveBeenCalledTimes(1));
    expect(nameField().disabled).toBe(true);
  });

  it("пока запрос идёт — кнопка занята: «Бронируем…», disabled и aria-busy", async () => {
    // Узел 3525:14971, облик «submitting»: индикатор отправки есть, подпись
    // меняется на «Бронируем…», кнопка выключена, а «Забронировать» исчезает.
    signIn();
    repository.createBooking = vi.fn(() => pending<Booking>());
    renderBooking();
    await chooseSlot();
    fireEvent.click(submitButton());

    const busy = await screen.findByRole("button", { name: "Бронируем…" });
    expect(busy).toHaveProperty("disabled", true);
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("button", { name: "Забронировать" })).toBeNull();
  });

  it("повтор ТОЙ ЖЕ брони после обрыва уходит с тем же ключом идемпотентности", async () => {
    signIn();
    repository.createBooking = vi.fn(async () => {
      throw new RepositoryError("offline", undefined, undefined, undefined, undefined, undefined, true);
    });
    renderBooking();
    await chooseSlot();

    fireEvent.click(submitButton());
    await screen.findByText("Не удалось забронировать");
    fireEvent.click(submitButton());
    await waitFor(() => expect(repository.createBooking).toHaveBeenCalledTimes(2));

    const calls = vi.mocked(repository.createBooking).mock.calls;
    expect(calls[0][1]).toBe(calls[1][1]);
  });

  it("409 «слот занят» — прямо говорит, что брони НЕТ, снимает время и НЕ теряет ввод", async () => {
    signIn();
    repository.createBooking = vi.fn(async () => {
      throw new RepositoryError("conflict", undefined, 409, undefined, "slot_taken");
    });
    renderBooking();
    await chooseSlot();
    fireEvent.change(nameField(), { target: { value: "Камила" } });
    fireEvent.click(submitButton());

    expect(await screen.findByText("Это время только что заняли")).toBeTruthy();
    expect(screen.getByText(/Брони нет/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Выберите время" })).toHaveProperty("disabled", true);
    expect(nameField().value).toBe("Камила");
  });

  it("409 «ключ уже использован» — бронь есть, и вторую отправить нельзя", async () => {
    signIn();
    repository.createBooking = vi.fn(async () => {
      throw new RepositoryError("conflict", undefined, 409, undefined, "idempotency_key_reused");
    });
    renderBooking();
    await chooseSlot();
    fireEvent.click(submitButton());

    expect(await screen.findByText("Эта бронь уже создана")).toBeTruthy();
    expect(submitButton()).toHaveProperty("disabled", true);
  });
});

describe("страница бронирования — ввод переживает уход на вход", () => {
  it("имя, пожелания и чипы восстанавливаются после повторного монтирования", async () => {
    signIn();
    const first = renderBooking();
    await slotsShown();
    fireEvent.change(nameField(), { target: { value: "Камила" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Пожелания к брони" }), {
      target: { value: "Отмечаем юбилей" },
    });
    fireEvent.click(screen.getByRole("button", { name: "День рождения" }));
    first.unmount();

    renderBooking();
    await slotsShown();

    expect(nameField().value).toBe("Камила");
    expect((screen.getByRole("textbox", { name: "Пожелания к брони" }) as HTMLTextAreaElement).value).toBe(
      "Отмечаем юбилей",
    );
    expect(screen.getByRole("button", { name: "День рождения" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("страница бронирования — перенос (?change=)", () => {
  it("контактов нет, уходит PATCH по идентификатору брони, затем — на её страницу", async () => {
    signIn();
    search = new URLSearchParams(`change=${CHANGE_ID}`);
    renderBooking();
    await chooseSlot();

    expect(screen.queryByText("Контактные данные")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Перенести бронь" }));

    await waitFor(() => expect(repository.rescheduleBooking).toHaveBeenCalledTimes(1));
    expect(vi.mocked(repository.rescheduleBooking).mock.calls[0]).toEqual([
      CHANGE_ID,
      { startsAt: SLOT, guests: 2 },
    ]);
    expect(repository.createBooking).not.toHaveBeenCalled();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/bookings/${CHANGE_ID}`));
  });
});

describe("composeNotes", () => {
  it("чипы через запятую, свободный текст после точки, пусто — пусто", () => {
    expect(composeNotes(["Столик у окна", "Детский стул"], "  Отмечаем юбилей ")).toBe(
      "Столик у окна, Детский стул. Отмечаем юбилей",
    );
    expect(composeNotes(["Тихое место"], "")).toBe("Тихое место");
    expect(composeNotes([], "Без лука")).toBe("Без лука");
    expect(composeNotes([], "   ")).toBe("");
  });
});

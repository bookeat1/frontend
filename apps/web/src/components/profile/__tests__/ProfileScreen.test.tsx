import { useSyncExternalStore } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { AuthUser, Booking, BookingPage, RestaurantSummary } from "@bookeat/api/client";

import { booking, pending, renderScreen, repositoryStub, venueSummary } from "@web/test/harness";

/**
 * Страница гостя (узел 3525:15153). Проверяем то, что ломается молча:
 *   • гость без сессии уводится на /login С ВОЗВРАТОМ сюда, и личные запросы
 *     не уходят;
 *   • пока сессия читается — никаких решений и никакого редиректа;
 *   • карточка показывает то, что есть у профиля, и не выдумывает «0», пока
 *     статистика едет или упала;
 *   • меню помечает активный раздел, «Выйти» — кнопка, а не ссылка;
 *   • «Выйти» в ШАПКЕ (не знает о странице) тоже ведёт на главную: сессия
 *     была и кончилась — это выход, а не гость без входа;
 *   • строка «с BookEat с …» — месяц в родительном падеже.
 */

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const user: AuthUser = {
  id: "u1",
  email: "kamila@mail.kz",
  fullName: "Камила Ахметова",
  phone: "+77771234567",
  city: "Алматы",
  avatarUrl: null,
  createdAt: "2025-03-14T10:00:00Z",
  birthDate: null,
};

type AuthState = { signedIn: boolean; isLoading: boolean; user: AuthUser | null };
let auth: AuthState = { signedIn: true, isLoading: false, user };
const signOut = vi.fn();
const replace = vi.fn();
let search = "";

// Сессия — внешнее хранилище: `setAuth` посреди теста перерисовывает всех
// подписчиков `useAuth` (и экран, и шапку), как это делает настоящий провайдер.
const authListeners = new Set<() => void>();
function setAuth(next: AuthState) {
  auth = next;
  authListeners.forEach((listener) => listener());
}

vi.mock("@web/lib/auth", () => ({
  useAuth: () => {
    const state = useSyncExternalStore(
      (listener) => {
        authListeners.add(listener);
        return () => authListeners.delete(listener);
      },
      () => auth,
    );
    return { ...state, completeSignIn: vi.fn(), applyUser: vi.fn(), signOut };
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, prefetch: vi.fn() }),
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams(search),
}));

const { ProfileScreen } = await import("@web/components/profile/ProfileScreen");

function page(items: Booking[]): BookingPage {
  return { items, total: items.length, page: 1, pages: 1, perPage: 50 };
}

beforeEach(() => {
  auth = { signedIn: true, isLoading: false, user };
  search = "";
  replace.mockClear();
  signOut.mockClear();
  repository.listMyBookings = vi.fn(async () =>
    page([
      booking({ id: "b1", status: "completed", startsAt: "2025-05-12T14:00:00Z" }),
      booking({ id: "b2", status: "completed", startsAt: "2025-06-01T14:00:00Z" }),
      booking({ id: "b3", status: "confirmed", startsAt: "2099-01-01T14:00:00Z", endsAt: "2099-01-01T16:00:00Z" }),
    ]),
  );
  repository.getFavorites = vi.fn(async (): Promise<RestaurantSummary[]> => [venueSummary()]);
});

describe("ProfileScreen — сессия", () => {
  it("гостя без сессии уводит на /login с возвратом и ничего не запрашивает", async () => {
    auth = { signedIn: false, isLoading: false, user: null };

    renderScreen(<ProfileScreen />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/login?next=${encodeURIComponent("/profile")}`));
    expect(repository.listMyBookings).not.toHaveBeenCalled();
    expect(repository.getFavorites).not.toHaveBeenCalled();
    expect(screen.getByText("Профиль доступен после входа. Перенаправляем…")).toBeTruthy();
  });

  it("пока сессия читается — заглушка и никакого редиректа", () => {
    auth = { signedIn: false, isLoading: true, user: null };

    renderScreen(<ProfileScreen />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("«Выйти» — кнопка: завершает сессию и ведёт на главную, а не на /login", async () => {
    renderScreen(<ProfileScreen />);

    // В шапке своя кнопка «Выйти» — нужна та, что в меню разделов.
    const nav = await screen.findByRole("navigation", { name: "Разделы профиля" });
    const button = within(nav).getByRole("button", { name: "Выйти" });
    fireEvent.click(button);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/");
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("«Выйти» в шапке: сессия кончилась — на главную, а не на /login с возвратом", async () => {
    renderScreen(<ProfileScreen />);
    await screen.findByRole("heading", { level: 1, name: "Камила Ахметова" });

    const header = screen.getByRole("banner");
    fireEvent.click(within(header).getByRole("button", { name: "Выйти" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    // Шапка про страницу не знает — сама она никуда не ведёт.
    expect(replace).not.toHaveBeenCalled();

    // Провайдер сбросил сессию: `signedIn` true → false при `isLoading=false`.
    act(() => setAuth({ signedIn: false, isLoading: false, user: null }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining("/login"));
    // На тик до перехода — скелет, а не «доступен после входа, перенаправляем».
    expect(screen.queryByText("Профиль доступен после входа. Перенаправляем…")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });
});

describe("ProfileScreen — карточка гостя", () => {
  it("показывает инициал, имя, телефон, почту и «с BookEat с марта 2025»", async () => {
    renderScreen(<ProfileScreen />);

    expect(await screen.findByRole("heading", { level: 1, name: "Камила Ахметова" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Аватар" }).textContent).toBe("К");
    expect(
      screen.getByText("+7 777 123-45-67 · kamila@mail.kz · с BookEat с марта 2025"),
    ).toBeTruthy();
  });

  it("статистика — из ответов сервера: 2 визита и 1 избранное", async () => {
    renderScreen(<ProfileScreen />);

    expect(await screen.findByText("визита")).toBeTruthy();
    expect(screen.getByText("визита").previousSibling?.textContent).toBe("2");
    expect(screen.getByText("избранное").previousSibling?.textContent).toBe("1");
  });

  it("пока статистика едет — нет ни чисел, ни нулей; упавшая — не показывается", async () => {
    repository.listMyBookings = vi.fn(() => pending<BookingPage>());
    repository.getFavorites = vi.fn(async () => {
      throw new Error("network");
    });

    renderScreen(<ProfileScreen />);

    await screen.findByRole("heading", { level: 1, name: "Камила Ахметова" });
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByText(/визит/)).toBeNull();
    await waitFor(() => expect(repository.getFavorites).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/избранн/)).toBeNull());
  });

  it("без профиля (сеть) — обобщённая подпись вместо пустого круга", async () => {
    auth = { signedIn: true, isLoading: false, user: null };

    renderScreen(<ProfileScreen />);

    // `t.web.header.account` — та же подпись, что шапка показывает вошедшему без профиля.
    expect(await screen.findByRole("heading", { level: 1, name: "Мой профиль" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Аватар" }).textContent).toBe("М");
  });
});

describe("ProfileScreen — меню и сегменты", () => {
  it("активный раздел помечен aria-current, остальные — ссылки на ?section=", async () => {
    search = "section=favorites";

    renderScreen(<ProfileScreen />);

    // Ссылки ищем ВНУТРИ меню: в подвале сайта есть своё «Избранное».
    const nav = await screen.findByRole("navigation", { name: "Разделы профиля" });
    const links = within(nav);
    expect(links.getByRole("link", { name: "Избранное" }).getAttribute("aria-current")).toBe("page");
    expect(links.getByRole("link", { name: "Мои брони" }).getAttribute("href")).toBe("/profile");
    expect(links.getByRole("link", { name: "Настройки" }).getAttribute("href")).toBe("/profile?section=settings");
    expect(nav.querySelectorAll("a")).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 2, name: "Избранное" })).toBeTruthy();
  });

  it("неизвестный раздел — «Мои брони»; сегменты со счётчиками и стрелками", async () => {
    search = "section=whatever";

    renderScreen(<ProfileScreen />);

    const active = await screen.findByRole("tab", { name: "Активные · 1" });
    expect(active.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Прошедшие · 2" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { name: "Отменённые · 0" })).toBeTruthy();

    // Панель названа выбранной вкладкой, а не безымянная.
    expect(active.id).toBeTruthy();
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(active.id);

    fireEvent.keyDown(screen.getByRole("tablist", { name: "Фильтр броней" }), { key: "ArrowRight" });
    const past = screen.getByRole("tab", { name: "Прошедшие · 2" });
    expect(past.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(past.id);
  });
});

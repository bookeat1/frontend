import type { AuthUser, EventPage, EventQuery, ProfileUpdate } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as SecureStore from "expo-secure-store";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomeScreen from "../index";
import { useExploreEvents } from "../../src/components/explore/use-explore-data";
import { resolveCitySelection } from "../../src/lib/city-select";

/**
 * ГОСТЬ БЕЗ СЕССИИ МЕНЯЕТ ГОРОД.
 *
 * Было: выбор города писался ТОЛЬКО в профиль (`PATCH /users/me`). У гостя без
 * сессии профиля нет — запрос падал, `catch` его глотал, шапка оставалась на
 * откате «Алматы». Тап по городу не делал ровно ничего. С тех пор как «Афиша»
 * и «Акции» стали городскими, это ещё и запирало гостя в контенте чужого
 * города.
 *
 * Стало: выбор сначала пишется НА УСТРОЙСТВО (expo-secure-store), и только
 * вошедшему дополнительно уходит в профиль. Отсюда три проверки, и каждая
 * ломается тихо:
 *
 *   1. гость без сессии выбрал город → городские запросы спрашивают ЕГО город;
 *   2. выбор переживает перезапуск приложения (новый QueryClient + новый
 *      монтаж читают хранилище устройства);
 *   3. у вошедшего выбор по-прежнему доезжает до профиля, а если не доехал —
 *      экран об этом ГОВОРИТ, а не молчит.
 *
 * Шапку приходится подменять: она тянет локальный jpg через `require`, а Node
 * в тесте пытается разобрать его как модуль (та же причина, что и в
 * home-party-selectors.test.tsx). Подмена оставляет ровно то, что здесь
 * проверяется, — показанный город и кнопку «открыть пикер».
 */

const PREFERRED_CITY_KEY = "bookeat.city.v1";
const t = getDictionary("ru");

const push = vi.fn();
const listUpcomingEvents = vi.fn<(query?: EventQuery) => Promise<EventPage>>();
const updateMe = vi.fn<(patch: ProfileUpdate) => Promise<AuthUser>>();
const getMe = vi.fn<() => Promise<AuthUser>>();
const authStatus = { value: "signed-out" as "loading" | "signed-out" | "signed-in" };

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  usePathname: () => "/",
}));

vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/components/explore/HomeHeader", () => ({
  HomeHeader: ({ city, onOpenCity }: { city: string; onOpenCity: () => void }) => (
    <div>
      <span>{`город в шапке: ${city}`}</span>
      <button type="button" onClick={onOpenCity}>
        открыть пикер города
      </button>
    </div>
  ),
}));

// Ленты главной ходят каждая за своими данными; городской запрос проверяется
// отдельным зондом ниже, чтобы проверка не зависела от вёрстки блоков.
vi.mock("../../src/components/explore/RecommendedSection", () => ({
  RecommendedSection: () => null,
}));
vi.mock("../../src/components/explore/CuisineSection", () => ({ CuisineSection: () => null }));
vi.mock("../../src/components/explore/PromotionsSection", () => ({
  PromotionsSection: () => null,
}));
vi.mock("../../src/components/explore/EventsListSection", () => ({
  EventsListSection: () => null,
}));
vi.mock("../../src/components/explore/ArticlesSection", () => ({ ArticlesSection: () => null }));

vi.mock("../../src/lib/locale", async () => {
  const { getDictionary: dictionary } = await import("@bookeat/i18n");
  return {
    useLocale: () => ({ locale: "ru", dictionary: dictionary("ru"), setLocale: vi.fn() }),
  };
});

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: authStatus.value, repository: { getMe, updateMe } }),
}));

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ listUpcomingEvents }),
}));

/** Пустая страница «Афиши»: проверяется АРГУМЕНТ запроса, а не его содержимое
 * (что именно приходит на город — покрыто events-city.test.tsx). */
function emptyPage(): EventPage {
  return { items: [], total: 0, page: 1, pages: 1, perPage: 12 };
}

function user(city: string): AuthUser {
  return {
    id: "u1",
    email: "guest@example.com",
    fullName: "Дамир",
    phone: "+77010000000",
    city,
    avatarUrl: null,
    createdAt: null,
    birthDate: null,
  };
}

/** Городской запрос главной, смонтированный рядом с экраном: тот же
 * QueryClient, тот же резолвер города. */
function EventsProbe() {
  useExploreEvents();
  return null;
}

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <HomeScreen />
      <EventsProbe />
    </QueryClientProvider>,
  );
  return { client, view };
}

/** То, что делает экран `/city`: отдаёт выбранный город в почтовый ящик
 * `city-select` и возвращается назад. */
async function pickCity(city: string) {
  const person = userEvent.setup();
  await person.click(screen.getByRole("button", { name: "открыть пикер города" }));
  await act(async () => {
    resolveCitySelection(city);
  });
}

beforeEach(async () => {
  authStatus.value = "signed-out";
  push.mockReset();
  listUpcomingEvents.mockReset();
  listUpcomingEvents.mockImplementation(() => Promise.resolve(emptyPage()));
  updateMe.mockReset();
  // По умолчанию профиль отвечает отказом — так ведёт себя сервер для гостя
  // без сессии (401). Тесты вошедшего переопределяют это своим ответом.
  updateMe.mockRejectedValue(new Error("unauthorized"));
  getMe.mockReset();
  await SecureStore.deleteItemAsync(PREFERRED_CITY_KEY);
});

describe("гость без сессии меняет город", () => {
  it("после выбора городские запросы спрашивают выбранный город, а не откат", async () => {
    renderHome();
    // До выбора — откат из словаря.
    await waitFor(() =>
      expect(listUpcomingEvents).toHaveBeenCalledWith(
        expect.objectContaining({ city: t.explore.cityFallback }),
      ),
    );

    await pickCity("Астана");

    await waitFor(() =>
      expect(listUpcomingEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({ city: "Астана" }),
      ),
    );
    expect(await screen.findByText("город в шапке: Астана")).toBeTruthy();
    // Гостю без сессии писать некуда — профиля у него нет.
    expect(updateMe).not.toHaveBeenCalled();
  });

  it("выбор переживает перезапуск приложения", async () => {
    const first = renderHome();
    await pickCity("Астана");
    await waitFor(async () =>
      expect(await SecureStore.getItemAsync(PREFERRED_CITY_KEY)).toBe("Астана"),
    );
    first.view.unmount();

    // Перезапуск: свежий кэш запросов и свежий монтаж, как после холодного
    // старта. Единственное, что переживает его, — хранилище устройства.
    listUpcomingEvents.mockClear();
    renderHome();

    expect(await screen.findByText("город в шапке: Астана")).toBeTruthy();
    await waitFor(() =>
      expect(listUpcomingEvents).toHaveBeenCalledWith(
        expect.objectContaining({ city: "Астана" }),
      ),
    );
    // И ни одного запроса с откатом по дороге — иначе на холодном старте
    // мелькнёт чужой город.
    expect(
      listUpcomingEvents.mock.calls.some(([query]) => query?.city === t.explore.cityFallback),
    ).toBe(false);
  });
});

describe("вошедший меняет город", () => {
  it("выбор доезжает до профиля", async () => {
    authStatus.value = "signed-in";
    getMe.mockResolvedValue(user("Алматы"));
    updateMe.mockImplementation((patch) => Promise.resolve(user(patch.city ?? "")));

    renderHome();
    await waitFor(() => expect(getMe).toHaveBeenCalled());

    await pickCity("Астана");

    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ city: "Астана" }));
    expect(await screen.findByText("город в шапке: Астана")).toBeTruthy();
  });

  it("если профиль не сохранился — экран об этом говорит, а не молчит", async () => {
    authStatus.value = "signed-in";
    getMe.mockResolvedValue(user("Алматы"));
    updateMe.mockRejectedValue(new Error("network"));

    renderHome();
    await waitFor(() => expect(getMe).toHaveBeenCalled());

    await pickCity("Астана");

    expect(await screen.findByText(t.explore.citySyncFailed)).toBeTruthy();
    // Выбранный город при этом ОСТАЁТСЯ: человек просил Астану, он её и видит.
    expect(await screen.findByText("город в шапке: Астана")).toBeTruthy();
  });
});

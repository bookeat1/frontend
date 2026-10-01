import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

import type { SearchQuery } from "@bookeat/api/client";

import { renderScreen, repositoryStub, venueSummary } from "@web/test/harness";
import { resetRememberedLocation } from "@web/lib/geolocation";

/**
 * Сортировка «Сначала ближайшие» на /venues (спека geolocation-permission.md,
 * W1; сценарии 3.13-3.16, критерии 25-28).
 */

const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const trackEvent = vi.fn();
vi.mock("@web/lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  initAnalytics: vi.fn(),
}));

const repository = repositoryStub();
vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { CatalogScreen } = await import("@web/components/catalog/CatalogScreen");

const getCurrentPosition = vi.fn();

function setGeolocation(permissionState: "prompt" | "granted" | "denied" | null) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value:
      permissionState === null
        ? undefined
        : { query: vi.fn(async () => ({ state: permissionState, addEventListener: vi.fn(), removeEventListener: vi.fn() })) },
  });
}

function allow(lat = 43.238123, lng = 76.945678) {
  getCurrentPosition.mockImplementation((ok: (p: unknown) => void) =>
    ok({ coords: { latitude: lat, longitude: lng } }),
  );
}

function refuse(code: number) {
  getCurrentPosition.mockImplementation((_ok: unknown, fail: (e: { code: number }) => void) =>
    fail({ code }),
  );
}

function queries(): SearchQuery[] {
  return (repository.searchRestaurants as ReturnType<typeof vi.fn>).mock.calls.map(
    (call) => call[0] as SearchQuery,
  );
}

beforeEach(() => {
  search = "";
  replace.mockClear();
  trackEvent.mockClear();
  getCurrentPosition.mockReset();
  resetRememberedLocation();
  localStorage.clear();
  sessionStorage.clear();
  repository.searchRestaurants = vi.fn(async (query) => ({
    query,
    items: [venueSummary()],
    total: 1,
  }));
  setGeolocation("prompt");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("загрузка /venues без жеста (кр. 25)", () => {
  it("статус prompt: getCurrentPosition не зовётся, ни на обычной ссылке, ни с ?sort=nearest", async () => {
    renderScreen(<CatalogScreen />);
    await screen.findByLabelText("Сортировка");
    expect(getCurrentPosition).not.toHaveBeenCalled();

    search = "sort=nearest";
    renderScreen(<CatalogScreen />);
    // Кнопка вместо молчаливого запроса (3.15).
    expect(await screen.findByRole("button", { name: "Показать ближайшие" })).toBeTruthy();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(queries().every((q) => q.near === undefined)).toBe(true);
  });

  it("статус granted и ?sort=nearest: позиция берётся сразу, запрос уходит с near", async () => {
    setGeolocation("granted");
    allow();
    search = "sort=nearest";
    renderScreen(<CatalogScreen />);
    await waitFor(() => expect(queries().some((q) => q.near !== undefined)).toBe(true));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(queries().at(-1)?.near).toEqual({ lat: 43.238, lng: 76.946 });
  });

  it("granted и ?sort=nearest: через 10 минут позиция истекает и берётся заново молча", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      setGeolocation("granted");
      allow();
      search = "sort=nearest";
      renderScreen(<CatalogScreen />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 50);
      });
      expect(getCurrentPosition).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("button", { name: "Показать ближайшие" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("статус denied и ?sort=nearest: объяснение, сортировка снимается из адреса (3.14)", async () => {
    setGeolocation("denied");
    search = "sort=nearest";
    renderScreen(<CatalogScreen />);
    expect(await screen.findByText(/Браузер не дал доступ к геопозиции/)).toBeTruthy();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/venues", { scroll: false }));
  });
});

describe("жест гостя", () => {
  it("выбор «Сначала ближайшие» → запрос разрешения → sort=nearest в адресе (3.13)", async () => {
    allow();
    renderScreen(<CatalogScreen />);
    const select = await screen.findByLabelText("Сортировка");
    fireEvent.change(select, { target: { value: "nearest" } });
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/venues?sort=nearest", { scroll: false }));
    expect(trackEvent).toHaveBeenCalledWith("location_prompt_shown", { surface: "web_sort" });
    expect(trackEvent).toHaveBeenCalledWith("location_permission_result", {
      surface: "web_sort",
      result: "granted",
      precise: null,
    });
  });

  it("браузер держит диалог без ответа: селект не заблокирован, смена сортировки отменяет запрос, поздний ответ отброшен", async () => {
    let answer: (p: unknown) => void = () => {};
    getCurrentPosition.mockImplementation((ok: (p: unknown) => void) => {
      answer = ok;
    });
    renderScreen(<CatalogScreen />);
    const select = (await screen.findByLabelText("Сортировка")) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "nearest" } });
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
    expect(select.disabled).toBe(false);

    fireEvent.change(select, { target: { value: "rating" } });
    expect(replace).toHaveBeenCalledWith("/venues?sort=rating", { scroll: false });
    // Роутер в тесте подменён и адрес не меняет: важно, что «ближайшие» с селекта ушли.
    expect(select.value).not.toBe("nearest");
    replace.mockClear();

    // Диалог всё-таки закрыли «Разрешить» уже после смены сортировки.
    await act(async () => {
      answer({ coords: { latitude: 43.238123, longitude: 76.945678 } });
    });
    expect(replace).not.toHaveBeenCalled();
    expect(select.value).not.toBe("nearest");
  });

  it("denied: диалога нет, location_prompt_shown не уходит, результат denied уходит", async () => {
    setGeolocation("denied");
    refuse(1);
    renderScreen(<CatalogScreen />);
    const select = await screen.findByLabelText("Сортировка");
    await act(async () => {});
    fireEvent.change(select, { target: { value: "nearest" } });
    expect(await screen.findByText(/Браузер не дал доступ к геопозиции/)).toBeTruthy();
    expect(trackEvent.mock.calls.some(([name]) => name === "location_prompt_shown")).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith("location_permission_result", {
      surface: "web_sort",
      result: "denied",
      precise: null,
    });
  });

  it("отказ: сообщение, сортировка «Рекомендуемые», sort=nearest в адрес не попадает (3.14)", async () => {
    refuse(1);
    renderScreen(<CatalogScreen />);
    fireEvent.change(await screen.findByLabelText("Сортировка"), { target: { value: "nearest" } });
    expect(await screen.findByText(/Браузер не дал доступ к геопозиции/)).toBeTruthy();
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining("nearest"), expect.anything());
    expect((screen.getByLabelText("Сортировка") as HTMLSelectElement).value).toBe("recommended");
  });

  it("таймаут или ошибка: «Не удалось определить геопозицию…» (3.16)", async () => {
    refuse(3);
    renderScreen(<CatalogScreen />);
    fireEvent.change(await screen.findByLabelText("Сортировка"), { target: { value: "nearest" } });
    expect(await screen.findByText(/Не удалось определить геопозицию/)).toBeTruthy();
    expect(trackEvent).toHaveBeenCalledWith("location_permission_result", {
      surface: "web_sort",
      result: "unavailable",
      precise: null,
    });
  });

  it("кнопка «Показать ближайшие» по ссылке — это жест: зовёт getCurrentPosition", async () => {
    allow();
    search = "sort=nearest";
    renderScreen(<CatalogScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Показать ближайшие" }));
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queries().at(-1)?.near).toEqual({ lat: 43.238, lng: 76.946 }));
  });

  it("без Permissions API считаем prompt и всё равно работаем", async () => {
    setGeolocation(null);
    allow();
    renderScreen(<CatalogScreen />);
    fireEvent.change(await screen.findByLabelText("Сортировка"), { target: { value: "nearest" } });
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
  });
});

describe("координаты не утекают (кр. 26, 28)", () => {
  it("после сценария их нет ни в URL, ни в storage, ни в cookie, ни в событиях", async () => {
    allow(43.238123, 76.945678);
    renderScreen(<CatalogScreen />);
    fireEvent.change(await screen.findByLabelText("Сортировка"), { target: { value: "nearest" } });
    await waitFor(() => expect(replace).toHaveBeenCalled());

    const digits = /43\.238|76\.94/;
    for (const [url] of replace.mock.calls) expect(String(url)).not.toMatch(digits);
    expect(JSON.stringify({ ...localStorage })).not.toMatch(digits);
    expect(JSON.stringify({ ...sessionStorage })).not.toMatch(digits);
    expect(document.cookie).not.toMatch(digits);

    const keys = trackEvent.mock.calls.flatMap(([, props]) => Object.keys(props ?? {}));
    for (const forbidden of ["lat", "lng", "latitude", "longitude", "accuracy", "coords"]) {
      expect(keys).not.toContain(forbidden);
    }
    expect(JSON.stringify(trackEvent.mock.calls)).not.toMatch(digits);
  });

  it("catalog_distance_sort_applied уходит один раз за визит", async () => {
    setGeolocation("granted");
    allow();
    search = "sort=nearest";
    renderScreen(<CatalogScreen />);
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith("catalog_distance_sort_applied", { surface: "web_sort" }),
    );
    // Выдача перезапрашивается (кэш пуст) и экран перерисовывается: событие не дублируется.
    await waitFor(() => expect(queries().length).toBeGreaterThan(0));
    expect(trackEvent.mock.calls.filter(([n]) => n === "catalog_distance_sort_applied")).toHaveLength(1);
  });
});

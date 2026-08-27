import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Панель помнит выбранное заведение в localStorage. Пока этот выбор ни с чем не
 * сверялся, id, оставшийся от тестового сервера, уезжал на боевой API — и
 * десяток экранов получал 404 с текстом «проверьте соединение».
 *
 * Здесь проверяется контракт слоя: экраны заведения не монтируются, пока
 * GET /admin/my-restaurants не подтвердил выбор, а неподтверждённый выбор
 * сбрасывается и заменяется выбором заведения с объяснением.
 */

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const listMyRestaurants = vi.fn();
vi.mock("@/lib/api", async () => {
  const { STORAGE_KEYS } = await vi.importActual<typeof import("@/lib/token-store")>(
    "@/lib/token-store",
  );
  return {
    apiClient: { listMyRestaurants: () => listMyRestaurants() as unknown },
    session: { store: vi.fn(), accessToken: vi.fn() },
    clearSession: vi.fn(),
    STORAGE_KEYS,
  };
});

// Оболочка панели (сайдбар, переключатель заведения, пуш-тумблер) к решению
// «пускать ли на экран заведения» отношения не имеет.
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { STORAGE_KEYS } = await import("@/lib/token-store");
const { AuthProvider } = await import("@/lib/auth-context");
const PanelLayout = (await import("../layout")).default;

const STALE_ID = "85817ed1-3775-42f9-a453-c4f08462899b";

function seedSession(restaurant: { id: string; name: string } | null) {
  window.localStorage.setItem(STORAGE_KEYS.accessToken, "token");
  window.localStorage.setItem(
    STORAGE_KEYS.user,
    JSON.stringify({ id: "u-1", email: "owner@book-eat.com", role: "owner" }),
  );
  if (restaurant) {
    window.localStorage.setItem(STORAGE_KEYS.restaurant, JSON.stringify(restaurant));
  }
}

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PanelLayout>
          <p>Экран заведения</p>
        </PanelLayout>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  replace.mockClear();
});
afterEach(cleanup);

describe("PanelLayout — сверка запомненного заведения", () => {
  it("сбрасывает выбор, которого нет среди доступных, и предлагает выбрать другое", async () => {
    seedSession({ id: STALE_ID, name: "THE ME'ET" });
    listMyRestaurants.mockResolvedValue([
      { id: "v-2", name: "Юрта", role: "owner" },
      { id: "v-3", name: "Тбилиси", role: "manager" },
    ]);

    renderPanel();

    expect(await screen.findByText("Заведение недоступно")).toBeTruthy();
    // Экран заведения не должен был отрисоваться НИ РАЗУ: его запросы ушли бы
    // на боевой API с чужим id.
    expect(screen.queryByText("Экран заведения")).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.restaurant)).toBeNull();
  });

  it("пускает на экран, когда заведение подтверждено списком", async () => {
    seedSession({ id: "v-2", name: "Юрта" });
    listMyRestaurants.mockResolvedValue([
      { id: "v-2", name: "Юрта", role: "owner" },
      { id: "v-3", name: "Тбилиси", role: "manager" },
    ]);

    renderPanel();

    expect(await screen.findByText("Экран заведения")).toBeTruthy();
    expect(screen.queryByText("Заведение недоступно")).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.restaurant)).toContain("v-2");
  });

  it("держит экран закрытым, пока список заведений не ответил", async () => {
    seedSession({ id: "v-2", name: "Юрта" });
    listMyRestaurants.mockReturnValue(new Promise(() => {}));

    renderPanel();

    expect(await screen.findByText("Проверяем выбранное заведение…")).toBeTruthy();
    expect(screen.queryByText("Экран заведения")).toBeNull();
  });

  it("не сбрасывает выбор, когда список не загрузился: это сбой связи, а не чужое заведение", async () => {
    seedSession({ id: "v-2", name: "Юрта" });
    listMyRestaurants.mockRejectedValue(new Error("network down"));

    renderPanel();

    expect(await screen.findByText(/Не получилось загрузить список ваших заведений/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /повторить/i })).toBeTruthy();
    expect(window.localStorage.getItem(STORAGE_KEYS.restaurant)).toContain("v-2");
  });
});

import { __mockFoodieProfileOptions, RepositoryError, type FoodieProfile } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const t = getDictionary("ru");

/**
 * Шаг 2/4 — «Диетические предпочтения» (Figma node 5062:5734).
 *
 * Проверяется решение по неоднозначному месту задачи: «Без диеты»
 * ЭКСКЛЮЗИВЕН — выбор снимает всё прочее и наоборот (см.
 * `foodie-profile-selection.ts`). Остальные пункты — обычный мультивыбор.
 */

const push = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
  Stack: { Screen: () => null },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: t, setLocale: vi.fn() }),
}));

// FoodieProfileDraftProvider теперь читает сохранённый профиль (GET) при
// монтировании — по умолчанию пустой, тот же черновик, с которым все эти
// тесты уже написаны; тест на «скрытый, но выбранный» код переопределяет его.
const getFoodieProfile = vi.fn(async (): Promise<FoodieProfile> => ({ cuisines: [], diets: [], allergies: [], budget: null }));
const replaceFoodieProfile = vi.fn(async (input: unknown) => input);
vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    status: "signed-in",
    repository: { getFoodieProfile, replaceFoodieProfile },
  }),
}));

const getFoodieProfileOptions = vi.fn(async () => __mockFoodieProfileOptions);
vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getFoodieProfileOptions }),
}));

beforeEach(() => {
  getFoodieProfile.mockClear();
  getFoodieProfile.mockImplementation(async () => ({
    cuisines: [],
    diets: [],
    allergies: [],
    budget: null,
  }));
  getFoodieProfileOptions.mockClear();
  getFoodieProfileOptions.mockImplementation(async () => __mockFoodieProfileOptions);
});

const { default: FoodieProfileDietScreen } = await import("../foodie-profile/diet");
const { FoodieProfileDraftProvider } = await import("../../src/lib/foodie-profile-draft");

async function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <FoodieProfileDraftProvider>
        <FoodieProfileDietScreen />
      </FoodieProfileDraftProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText("Без диеты")).toBeTruthy());
  return utils;
}

function tile(name: string) {
  return screen.getByRole("checkbox", { name });
}

function isChecked(name: string): boolean {
  return tile(name).getAttribute("aria-checked") === "true";
}

describe("шаг «Диетические предпочтения»", () => {
  it("«Без диеты» снимает уже выбранные обычные пункты", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.click(screen.getByText("Веган"));
    await user.click(screen.getByText("Кето"));
    expect(isChecked("Веган")).toBe(true);
    expect(isChecked("Кето")).toBe(true);

    await user.click(screen.getByText("Без диеты"));

    expect(isChecked("Без диеты")).toBe(true);
    expect(isChecked("Веган")).toBe(false);
    expect(isChecked("Кето")).toBe(false);
  });

  it("выбор обычного пункта снимает активное «Без диеты»", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.click(screen.getByText("Без диеты"));
    expect(isChecked("Без диеты")).toBe(true);

    await user.click(screen.getByText("Халяль"));

    expect(isChecked("Без диеты")).toBe(false);
    expect(isChecked("Халяль")).toBe(true);
  });

  it("обычные пункты мультивыбираются между собой свободно", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.click(screen.getByText("Кето"));
    await user.click(screen.getByText("Палео"));

    expect(isChecked("Кето")).toBe(true);
    expect(isChecked("Палео")).toBe(true);
  });

  it("«Без лактозы» встречается на экране один раз, а не дважды (дубль макета не перенесён)", async () => {
    await renderScreen();
    expect(screen.getAllByText("Без лактозы")).toHaveLength(1);
  });

  it("пока справочник грузится — крутилка, «Далее» недоступна", async () => {
    let resolveOptions: (value: typeof __mockFoodieProfileOptions) => void;
    getFoodieProfileOptions.mockImplementation(
      () => new Promise((resolve) => (resolveOptions = resolve)),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <FoodieProfileDraftProvider>
          <FoodieProfileDietScreen />
        </FoodieProfileDraftProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText(t.onboarding.foodieProfile.optionsLoading)).toBeTruthy();
    expect(screen.queryByText("Без диеты")).toBeNull();

    resolveOptions!(__mockFoodieProfileOptions);
    await waitFor(() => expect(screen.getByText("Без диеты")).toBeTruthy());
  });

  it("сбой загрузки справочника показывает ошибку с «Повторить»", async () => {
    getFoodieProfileOptions.mockRejectedValueOnce(
      new RepositoryError("simulated offline", undefined, undefined, undefined, undefined, undefined, true),
    );

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FoodieProfileDraftProvider>
          <FoodieProfileDietScreen />
        </FoodieProfileDraftProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: t.common.retry }));
    await waitFor(() => expect(screen.getByText("Без диеты")).toBeTruthy());
  });

  it("диета, скрытая админом, но уже выбранная гостем раньше, рисуется отмеченной с запасной подписью", async () => {
    getFoodieProfile.mockImplementation(async () => ({
      cuisines: [],
      diets: ["vegan", "raw_food"],
      allergies: [],
      budget: null,
    }));

    await renderScreen();

    const hiddenTile = await screen.findByRole("checkbox", { name: "raw_food" });
    expect(hiddenTile.getAttribute("aria-checked")).toBe("true");
    expect(isChecked("Веган")).toBe(true);
  });
});

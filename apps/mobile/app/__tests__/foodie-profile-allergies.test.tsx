import { __mockFoodieProfileOptions, RepositoryError, type FoodieProfile } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Шаг 3/4 — «Аллергии» (Figma node 5062:5841): простой мультивыбор без
 * лимита и без эксклюзивных пунктов. */

const t = getDictionary("ru");

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
  push.mockClear();
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

const { default: FoodieProfileAllergiesScreen } = await import("../foodie-profile/allergies");
const { FoodieProfileDraftProvider } = await import("../../src/lib/foodie-profile-draft");

async function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <FoodieProfileDraftProvider>
        <FoodieProfileAllergiesScreen />
      </FoodieProfileDraftProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText("Орехи")).toBeTruthy());
  return utils;
}

describe("шаг «Аллергии»", () => {
  it("несколько пунктов выбираются и снимаются независимо друг от друга", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.click(screen.getByText("Орехи"));
    await user.click(screen.getByText("Моллюски"));
    expect(screen.getByRole("checkbox", { name: "Орехи" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("checkbox", { name: "Моллюски" }).getAttribute("aria-checked")).toBe("true");

    await user.click(screen.getByText("Орехи"));
    expect(screen.getByRole("checkbox", { name: "Орехи" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("checkbox", { name: "Моллюски" }).getAttribute("aria-checked")).toBe("true");
  });

  it("«Далее» активна и без выбора — пустой список аллергий валиден сам по себе", async () => {
    const user = userEvent.setup();
    await renderScreen();

    const next = () => screen.getByRole("button", { name: t.onboarding.foodieProfile.next });
    expect(next().getAttribute("aria-disabled")).not.toBe("true");

    await user.click(next());
    expect(push).toHaveBeenCalledWith("/foodie-profile/budget");
  });

  it("переходит на шаг бюджета и с выбранными пунктами", async () => {
    const user = userEvent.setup();
    await renderScreen();

    const next = () => screen.getByRole("button", { name: t.onboarding.foodieProfile.next });
    await user.click(screen.getByText("Соя"));
    await user.click(next());
    expect(push).toHaveBeenCalledWith("/foodie-profile/budget");
  });

  it("пока справочник грузится — крутилка, «Далее» недоступна даже без обязательного выбора", async () => {
    let resolveOptions: (value: typeof __mockFoodieProfileOptions) => void;
    getFoodieProfileOptions.mockImplementation(
      () => new Promise((resolve) => (resolveOptions = resolve)),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <FoodieProfileDraftProvider>
          <FoodieProfileAllergiesScreen />
        </FoodieProfileDraftProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText(t.onboarding.foodieProfile.optionsLoading)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t.onboarding.foodieProfile.next }).getAttribute("aria-disabled"),
    ).toBe("true");

    resolveOptions!(__mockFoodieProfileOptions);
    await waitFor(() => expect(screen.getByText("Орехи")).toBeTruthy());
  });

  it("сбой загрузки справочника показывает ошибку с «Повторить»", async () => {
    getFoodieProfileOptions.mockRejectedValueOnce(
      new RepositoryError("simulated offline", undefined, undefined, undefined, undefined, undefined, true),
    );

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FoodieProfileDraftProvider>
          <FoodieProfileAllergiesScreen />
        </FoodieProfileDraftProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: t.common.retry }));
    await waitFor(() => expect(screen.getByText("Орехи")).toBeTruthy());
  });

  it("аллергия, скрытая админом, но уже выбранная гостем раньше, рисуется отмеченной с запасной подписью", async () => {
    getFoodieProfile.mockImplementation(async () => ({
      cuisines: [],
      diets: [],
      allergies: ["nuts", "kiwi"],
      budget: null,
    }));

    await renderScreen();

    const hiddenTile = await screen.findByRole("checkbox", { name: "kiwi" });
    expect(hiddenTile.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("checkbox", { name: "Орехи" }).getAttribute("aria-checked")).toBe("true");
  });
});

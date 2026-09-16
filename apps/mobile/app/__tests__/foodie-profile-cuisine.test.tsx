import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * Шаг 1/4 визарда «Фуди-профиль» — «Любимая кухня» (Figma node 5161:11573).
 *
 * Проверяется решение по неоднозначному месту задачи: лимит 5 кухонь
 * БЛОКИРУЕТ тап по шестой, а не вытесняет самую старую выбранную (см.
 * `foodie-profile-selection.ts`). Здесь — что это видно с экрана, а не
 * просто верно в чистой функции: счётчик, подсказка лимита и то, что уже
 * выбранная пятёрка не меняется составом при попытке добавить шестую.
 */

const t = getDictionary("ru");

const push = vi.fn();
const back = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back, replace: vi.fn() }),
  Stack: { Screen: () => null },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// FoodieProfileDraftProvider теперь читает сохранённый профиль (GET) при
// монтировании — экрану этого шага он не нужен, поэтому ответ пустой, тот же
// черновик, с которым все эти тесты уже написаны.
vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    status: "signed-in",
    repository: {
      getFoodieProfile: vi.fn(async () => ({ cuisines: [], diets: [], allergies: [], budget: null })),
      replaceFoodieProfile: vi.fn(async (input: unknown) => input),
    },
  }),
}));

const { default: FoodieProfileCuisineScreen } = await import("../foodie-profile/cuisine");
const { FoodieProfileDraftProvider } = await import("../../src/lib/foodie-profile-draft");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FoodieProfileDraftProvider>
        <FoodieProfileCuisineScreen />
      </FoodieProfileDraftProvider>
    </QueryClientProvider>,
  );
}

const FIRST_FIVE = ["Казахская", "Азиатская", "Европейская", "Японская", "Итальянская"];
const SIXTH = "Корейская";

describe("шаг «Любимая кухня»", () => {
  it("счётчик растёт с каждым выбором", async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByText(t.onboarding.foodieProfile.cuisine.counter(0))).toBeTruthy();
    await user.click(screen.getByText("Казахская"));
    expect(screen.getByText(t.onboarding.foodieProfile.cuisine.counter(1))).toBeTruthy();
  });

  it("пятая кухня выбирается, шестая — блокируется без изменения набора", async () => {
    const user = userEvent.setup();
    renderScreen();

    for (const name of FIRST_FIVE) {
      await user.click(screen.getByText(name));
    }
    expect(screen.getByText(t.onboarding.foodieProfile.cuisine.counter(5))).toBeTruthy();

    // Шестая плитка притушена и объясняет причину — не молчит.
    expect(screen.getByText(t.onboarding.foodieProfile.cuisine.limitHint)).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: SIXTH }).getAttribute("aria-disabled")).toBe("true");

    await user.click(screen.getByText(SIXTH));
    // Счётчик не сдвинулся — набор не изменился составом.
    expect(screen.getByText(t.onboarding.foodieProfile.cuisine.counter(5))).toBeTruthy();
  });

  it("снять уже выбранную кухню можно даже при набранном лимите", async () => {
    const user = userEvent.setup();
    renderScreen();

    for (const name of FIRST_FIVE) {
      await user.click(screen.getByText(name));
    }
    await user.click(screen.getByText(FIRST_FIVE[0]));
    expect(screen.getByText(t.onboarding.foodieProfile.cuisine.counter(4))).toBeTruthy();
  });

  it("«Далее» неактивна без выбора и переходит на шаг диет при нажатии", async () => {
    const user = userEvent.setup();
    renderScreen();

    const next = () => screen.getByRole("button", { name: t.onboarding.foodieProfile.next });
    expect(next().getAttribute("aria-disabled")).toBe("true");

    await user.click(screen.getByText("Казахская"));
    expect(next().getAttribute("aria-disabled")).not.toBe("true");

    await user.click(next());
    expect(push).toHaveBeenCalledWith("/foodie-profile/diet");
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

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

const { default: FoodieProfileDietScreen } = await import("../foodie-profile/diet");
const { FoodieProfileDraftProvider } = await import("../../src/lib/foodie-profile-draft");

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FoodieProfileDraftProvider>
        <FoodieProfileDietScreen />
      </FoodieProfileDraftProvider>
    </QueryClientProvider>,
  );
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
    renderScreen();

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
    renderScreen();

    await user.click(screen.getByText("Без диеты"));
    expect(isChecked("Без диеты")).toBe(true);

    await user.click(screen.getByText("Халяль"));

    expect(isChecked("Без диеты")).toBe(false);
    expect(isChecked("Халяль")).toBe(true);
  });

  it("обычные пункты мультивыбираются между собой свободно", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByText("Кето"));
    await user.click(screen.getByText("Палео"));

    expect(isChecked("Кето")).toBe(true);
    expect(isChecked("Палео")).toBe(true);
  });

  it("«Без лактозы» встречается на экране один раз, а не дважды (дубль макета не перенесён)", () => {
    renderScreen();
    expect(screen.getAllByText("Без лактозы")).toHaveLength(1);
  });
});

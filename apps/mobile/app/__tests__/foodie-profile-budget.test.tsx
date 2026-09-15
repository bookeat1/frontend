import { getDictionary } from "@bookeat/i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Шаг 4/4 — «Ваш бюджет» (Figma node 5161:11786), единственный
 * НЕОБЯЗАТЕЛЬНЫЙ шаг визарда.
 *
 * Проверяются два решения по неоднозначным местам задачи:
 *   - дефолт бюджета — НИЧЕГО не выбрано (макет рисует «Средний» выбранным
 *     просто для демонстрации состояния, не как дефолт продукта);
 *   - «Готово» доступна СРАЗУ, без выбора — шаг необязательный.
 */

const t = getDictionary("ru");

const replace = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace }),
  Stack: { Screen: () => null },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const { default: FoodieProfileBudgetScreen } = await import("../foodie-profile/budget");
const { FoodieProfileDraftProvider } = await import("../../src/lib/foodie-profile-draft");

function renderScreen() {
  return render(
    <FoodieProfileDraftProvider>
      <FoodieProfileBudgetScreen />
    </FoodieProfileDraftProvider>,
  );
}

beforeEach(() => {
  replace.mockClear();
});

describe("шаг «Ваш бюджет»", () => {
  it("по умолчанию ни одна карточка не выбрана", () => {
    renderScreen();
    for (const tier of ["budget", "mid", "premium"] as const) {
      const copy = t.onboarding.foodieProfile.budget.options[tier];
      const card = screen.getByRole("radio", { name: `${copy.name}, ${copy.price}` });
      expect(card.getAttribute("aria-checked")).toBe("false");
    }
  });

  it("«Готово» доступна без выбора — шаг необязательный", async () => {
    const user = userEvent.setup();
    renderScreen();

    const done = screen.getByRole("button", { name: t.onboarding.foodieProfile.done });
    expect(done.getAttribute("aria-disabled")).not.toBe("true");

    await user.click(done);
    expect(replace).toHaveBeenCalledWith("/profile");
  });

  it("повторный тап по выбранной карточке снимает выбор", async () => {
    const user = userEvent.setup();
    renderScreen();

    const mid = t.onboarding.foodieProfile.budget.options.mid;
    const midCard = screen.getByRole("radio", { name: `${mid.name}, ${mid.price}` });

    await user.click(midCard);
    expect(midCard.getAttribute("aria-checked")).toBe("true");

    await user.click(midCard);
    expect(midCard.getAttribute("aria-checked")).toBe("false");
  });
});

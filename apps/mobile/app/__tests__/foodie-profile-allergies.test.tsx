import { getDictionary } from "@bookeat/i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

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

const { default: FoodieProfileAllergiesScreen } = await import("../foodie-profile/allergies");
const { FoodieProfileDraftProvider } = await import("../../src/lib/foodie-profile-draft");

function renderScreen() {
  return render(
    <FoodieProfileDraftProvider>
      <FoodieProfileAllergiesScreen />
    </FoodieProfileDraftProvider>,
  );
}

describe("шаг «Аллергии»", () => {
  it("несколько пунктов выбираются и снимаются независимо друг от друга", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByText("Орехи"));
    await user.click(screen.getByText("Моллюски"));
    expect(screen.getByRole("checkbox", { name: "Орехи" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("checkbox", { name: "Моллюски" }).getAttribute("aria-checked")).toBe("true");

    await user.click(screen.getByText("Орехи"));
    expect(screen.getByRole("checkbox", { name: "Орехи" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("checkbox", { name: "Моллюски" }).getAttribute("aria-checked")).toBe("true");
  });

  it("переходит на шаг бюджета только после выбора хотя бы одного пункта", async () => {
    const user = userEvent.setup();
    renderScreen();

    const next = () => screen.getByRole("button", { name: t.onboarding.foodieProfile.next });
    expect(next().getAttribute("aria-disabled")).toBe("true");

    await user.click(screen.getByText("Соя"));
    await user.click(next());
    expect(push).toHaveBeenCalledWith("/foodie-profile/budget");
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * После успешного `PUT /users/me/foodie-profile` (сценарий 3.8, критерий 24,
 * `specs/foodie-personalization-v1-20260916.md`) три ряда, читающих вкус
 * гостя, обязаны переспросить сервер: `home-picks` («Для вас»/«Выбрали для
 * вас»), `home-feed` («Акции») и `explore-events` («Афиша»). Проверяется
 * через минимальный зонд поверх `FoodieProfileDraftProvider`, а не полный
 * экран визарда — сама логика шага уже закреплена в
 * `app/__tests__/foodie-profile-budget.test.tsx`, здесь только
 * инвалидация.
 */

const getFoodieProfile = vi.fn(async () => ({
  cuisines: [],
  diets: [],
  allergies: [],
  budget: null,
}));
const replaceFoodieProfile = vi.fn(async (input: unknown) => input);

vi.mock("../auth", () => ({
  useAuth: () => ({
    status: "signed-in",
    repository: { getFoodieProfile, replaceFoodieProfile },
  }),
}));

// FoodieProfileDraftProvider теперь сверяется с живым справочником
// (`useFoodieOptions()`) при гидрации, чтобы отбрасывать скрытые коды — эта
// проверка не про инвалидацию, поэтому справочник просто пустой, но рабочий.
vi.mock("../repository", () => ({
  useRepository: () => ({
    getFoodieProfileOptions: vi.fn(async () => ({ cuisines: [], diets: [], allergies: [], budgets: [] })),
  }),
}));

const { FoodieProfileDraftProvider, useFoodieProfileDraft } = await import("../foodie-profile-draft");

/** Зонд: одна кнопка «Сохранить», зовёт `save()` напрямую — без UI визарда. */
function SaveProbe() {
  const { save, isLoadingProfile } = useFoodieProfileDraft();
  return (
    <button type="button" disabled={isLoadingProfile} onClick={() => void save()}>
      Сохранить
    </button>
  );
}

beforeEach(() => {
  getFoodieProfile.mockClear();
  replaceFoodieProfile.mockClear();
});

describe("сохранение фуди-профиля инвалидирует персонализированные ряды", () => {
  it("после успешного save() переспрашивает home-picks/home-feed/explore-events", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    // «Чужие» ключи — контроль: жест сохранения профиля не должен трогать
    // ничего постороннего (тот же принцип, что у `useHomeRefresh`).
    const seededKeys = [
      ["home-picks", "Алматы", 8],
      ["home-feed", "promos", "Алматы"],
      ["explore-events", 12, "Алматы", true],
      ["bookings"],
      ["favorites"],
    ];
    for (const key of seededKeys) queryClient.setQueryData(key, []);

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <FoodieProfileDraftProvider>
          <SaveProbe />
        </FoodieProfileDraftProvider>
      </QueryClientProvider>,
    );

    // Дождаться стартового GET — save() отказывает, пока он не успешен.
    await waitFor(() => expect(getFoodieProfile).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false));

    await act(async () => {
      await user.click(screen.getByRole("button"));
    });

    await waitFor(() => expect(replaceFoodieProfile).toHaveBeenCalled());

    const invalidatedRoots = invalidateQueries.mock.calls.map(
      ([arg]) => (arg as { queryKey: unknown[] }).queryKey[0],
    );
    expect(invalidatedRoots).toEqual(
      expect.arrayContaining(["home-picks", "home-feed", "explore-events"]),
    );
    // Ничего постороннего не инвалидировано этим же вызовом.
    expect(invalidatedRoots).not.toEqual(expect.arrayContaining(["bookings"]));
    expect(invalidatedRoots).not.toEqual(expect.arrayContaining(["favorites"]));
  });

  it("неудачный save() ничего не инвалидирует", async () => {
    replaceFoodieProfile.mockRejectedValueOnce(new Error("network"));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <FoodieProfileDraftProvider>
          <SaveProbe />
        </FoodieProfileDraftProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(getFoodieProfile).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false));

    await act(async () => {
      await user.click(screen.getByRole("button"));
    });

    await waitFor(() => expect(replaceFoodieProfile).toHaveBeenCalled());
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});

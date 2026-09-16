import type { FoodieProfile } from "@bookeat/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FOODIE_INVITE_DISMISS_LIMIT } from "../../lib/foodie-invite-snooze";

/**
 * Карточка-приглашение «Расскажите, что любите» (персонализация v1,
 * `specs/foodie-personalization-v1-20260916.md`, сценарий 3.2, критерий 22):
 *
 *   1. видна ТОЛЬКО вошедшему гостю с пустым профилем;
 *   2. непустой профиль (любое поле) — не видна вовсе, и это НЕОБРАТИМО:
 *      следующий заход с ЛЮБЫМ ответом (даже снова пустым — гость мог
 *      очистить профиль) её больше не покажет;
 *   3. крестик закрывает немедленно и копит счётчик; на третьем закрытии
 *      подряд наступает 30-дневный снуз.
 *
 * Хранилище — настоящий `expo-secure-store` в памяти (тот же приём, что в
 * useAppUpdate.test.tsx/home-picks-city.test.tsx): проверяется, что запись
 * реально переживает следующий монтаж хука, а не что были вызваны функции.
 */

const getFoodieProfile = vi.fn<() => Promise<FoodieProfile>>();
const authStatus = { value: "signed-in" as "loading" | "signed-out" | "signed-in" };

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({ status: authStatus.value, repository: { getFoodieProfile } }),
}));

const secureStore = new Map<string, string>();
vi.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => secureStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    secureStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    secureStore.delete(key);
  },
}));

const { useFoodieProfileInvite } = await import("../useFoodieProfileInvite");

const EMPTY_PROFILE: FoodieProfile = { cuisines: [], diets: [], allergies: [], budget: null };
const FILLED_PROFILE: FoodieProfile = { cuisines: ["italian"], diets: [], allergies: [], budget: null };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useFoodieProfileInvite(), { wrapper });
}

beforeEach(() => {
  authStatus.value = "signed-in";
  getFoodieProfile.mockReset();
  secureStore.clear();
});

describe("показ карточки", () => {
  it("вошедший гость с пустым профилем — карточка видна", async () => {
    getFoodieProfile.mockResolvedValue(EMPTY_PROFILE);
    const { result } = setup();
    await waitFor(() => expect(result.current.visible).toBe(true));
  });

  it("заполненный профиль — карточка не показывается вовсе", async () => {
    getFoodieProfile.mockResolvedValue(FILLED_PROFILE);
    const { result } = setup();
    await waitFor(() => expect(getFoodieProfile).toHaveBeenCalled());
    expect(result.current.visible).toBe(false);
  });

  it("гость без сессии — карточки нет, профиль не спрашивается", async () => {
    authStatus.value = "signed-out";
    const { result } = setup();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getFoodieProfile).not.toHaveBeenCalled();
    expect(result.current.visible).toBe(false);
  });

  it("непустой ответ навсегда гасит приглашение, даже на следующий заход с пустым профилем", async () => {
    getFoodieProfile.mockResolvedValue(FILLED_PROFILE);
    const first = setup();
    await waitFor(() => expect(first.result.current.visible).toBe(false));
    // Хранилище должно было записать hiddenForever уже сейчас.
    await waitFor(() => expect(secureStore.size).toBe(1));

    // Следующий монтаж (например, гость вернулся на главную) — профиль ВДРУГ
    // снова пуст (гость очистил), но приглашение уже не должно всплыть.
    getFoodieProfile.mockReset().mockResolvedValue(EMPTY_PROFILE);
    const second = setup();
    await waitFor(() => expect(getFoodieProfile).toHaveBeenCalled());
    expect(second.result.current.visible).toBe(false);
  });
});

describe("крестик: счётчик и 30-дневный снуз", () => {
  it("закрывает НЕМЕДЛЕННО, до того как запись в хранилище успела дойти", async () => {
    getFoodieProfile.mockResolvedValue(EMPTY_PROFILE);
    const { result } = setup();
    await waitFor(() => expect(result.current.visible).toBe(true));

    act(() => result.current.dismiss());
    expect(result.current.visible).toBe(false);
  });

  it(`${FOODIE_INVITE_DISMISS_LIMIT}-е закрытие подряд прячет карточку на 30 дней даже на новом монтаже`, async () => {
    getFoodieProfile.mockResolvedValue(EMPTY_PROFILE);

    for (let i = 0; i < FOODIE_INVITE_DISMISS_LIMIT; i += 1) {
      const { result } = setup();
      await waitFor(() => expect(result.current.visible).toBe(true));
      act(() => result.current.dismiss());
      // Ждём, пока запись в хранилище реально долетит, прежде чем
      // размонтировать и переоткрыть «заново».
      await waitFor(() => expect(secureStore.size).toBe(1));
    }

    const { result } = setup();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.visible).toBe(false);
  });
});

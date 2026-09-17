import { __mockFoodieProfileOptions, RepositoryError, type FoodieProfile } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

// `DataErrorState` (сбой `useFoodieOptions()`) читает язык через `useLocale()`
// — экран не оборачивается в `LocaleProvider` здесь, как и остальные тесты
// визарда.
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

const { default: FoodieProfileCuisineScreen } = await import("../foodie-profile/cuisine");
const { FoodieProfileDraftProvider } = await import("../../src/lib/foodie-profile-draft");

/** Ждёт, пока живой справочник (`GET /foodie-profile/options`, мок) догрузится
 * и сетка плиток отрисуется — до этого экран показывает крутилку. */
async function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <FoodieProfileDraftProvider>
        <FoodieProfileCuisineScreen />
      </FoodieProfileDraftProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText("Казахская")).toBeTruthy());
  return utils;
}

const FIRST_FIVE = ["Казахская", "Азиатская", "Европейская", "Японская", "Итальянская"];
const SIXTH = "Корейская";

describe("шаг «Любимая кухня»", () => {
  it("счётчик растёт с каждым выбором", async () => {
    const user = userEvent.setup();
    await renderScreen();

    expect(screen.getByText(t.onboarding.foodieProfile.cuisine.counter(0))).toBeTruthy();
    await user.click(screen.getByText("Казахская"));
    expect(screen.getByText(t.onboarding.foodieProfile.cuisine.counter(1))).toBeTruthy();
  });

  it("пятая кухня выбирается, шестая — блокируется без изменения набора", async () => {
    const user = userEvent.setup();
    await renderScreen();

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
    await renderScreen();

    for (const name of FIRST_FIVE) {
      await user.click(screen.getByText(name));
    }
    await user.click(screen.getByText(FIRST_FIVE[0]));
    expect(screen.getByText(t.onboarding.foodieProfile.cuisine.counter(4))).toBeTruthy();
  });

  it("«Далее» неактивна без выбора и переходит на шаг диет при нажатии", async () => {
    const user = userEvent.setup();
    await renderScreen();

    const next = () => screen.getByRole("button", { name: t.onboarding.foodieProfile.next });
    expect(next().getAttribute("aria-disabled")).toBe("true");

    await user.click(screen.getByText("Казахская"));
    expect(next().getAttribute("aria-disabled")).not.toBe("true");

    await user.click(next());
    expect(push).toHaveBeenCalledWith("/foodie-profile/diet");
  });

  it("пока справочник грузится — крутилка вместо сетки, «Далее» недоступна", async () => {
    let resolveOptions: (value: typeof __mockFoodieProfileOptions) => void;
    getFoodieProfileOptions.mockImplementation(
      () => new Promise((resolve) => (resolveOptions = resolve)),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <FoodieProfileDraftProvider>
          <FoodieProfileCuisineScreen />
        </FoodieProfileDraftProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText(t.onboarding.foodieProfile.optionsLoading)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t.onboarding.foodieProfile.next }).getAttribute("aria-disabled"),
    ).toBe("true");
    expect(screen.queryByText("Казахская")).toBeNull();

    resolveOptions!(__mockFoodieProfileOptions);
    await waitFor(() => expect(screen.getByText("Казахская")).toBeTruthy());
  });

  it("сбой загрузки справочника показывает ошибку с «Повторить», а не пустой/сломанный экран", async () => {
    // `isOffline` — единственная ветка `DataErrorState` с кнопкой
    // «Повторить»; сервер-side/generic отказ показывает «Написать в
    // поддержку» (сегодня скрыто, контакта ещё нет), это уже общий, не
    // локальный для этой задачи выбор компонента.
    getFoodieProfileOptions.mockRejectedValueOnce(
      new RepositoryError("simulated offline", undefined, undefined, undefined, undefined, undefined, true),
    );

    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <FoodieProfileDraftProvider>
          <FoodieProfileCuisineScreen />
        </FoodieProfileDraftProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(
      screen.getByRole("button", { name: t.onboarding.foodieProfile.next }).getAttribute("aria-disabled"),
    ).toBe("true");

    await user.click(screen.getByRole("button", { name: t.common.retry }));
    await waitFor(() => expect(screen.getByText("Казахская")).toBeTruthy());
  });

  it("код, скрытый админом, но уже выбранный гостем раньше, рисуется отмеченным с запасной подписью", async () => {
    getFoodieProfile.mockImplementation(async () => ({
      cuisines: ["kazakh", "truffle"],
      diets: [],
      allergies: [],
      budget: null,
    }));

    await renderScreen();

    // «truffle» — код, которого нет в живом справочнике (админ его скрыл),
    // но он уже в сохранённом профиле гостя: плитка рисуется с запасной
    // подписью (сам код) и отмеченной, а не пропадает молча.
    const hiddenTile = await screen.findByRole("checkbox", { name: "truffle" });
    expect(hiddenTile.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("checkbox", { name: "Казахская" }).getAttribute("aria-checked")).toBe("true");

    // Снять её можно обычным тапом, как любую другую плитку — код уходит из
    // выбора, а раз его и так нет в живом справочнике, плитка просто исчезает
    // (не «висит непонятной снятой»), в точности как обычная активная плитка
    // исчезла бы из ЛЮБОГО списка, не будь она вообще выбрана.
    const user = userEvent.setup();
    await user.click(hiddenTile);
    expect(screen.queryByRole("checkbox", { name: "truffle" })).toBeNull();
  });
});

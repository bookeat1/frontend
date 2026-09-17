import { __mockFoodieProfileOptions, RepositoryError } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
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
 *
 * А также — теперь, что «Готово» реально сохраняет черновик (`PUT
 * /users/me/foodie-profile`, `FoodieProfileDraftProvider.save`): уходит на
 * «Профиль» только при успехе, и остаётся на экране с текстом ошибки при
 * отказе бэкенда, не теряя выбор гостя.
 *
 * И — регрессия на тихую потерю данных: пока стартовый `GET` ещё грузится
 * или упал, «Готово» заблокирована, потому что `PUT` заменяет весь профиль
 * целиком и мог бы стереть ранее сохранённые категории пустым черновиком.
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

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: t, setLocale: vi.fn() }),
}));

const getFoodieProfileOptions = vi.fn(async () => __mockFoodieProfileOptions);
vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getFoodieProfileOptions }),
}));

/** Управляется отдельными тестами: "success" — PUT отвечает тем же черновиком,
 * "failure" — отклоняется, как настоящий сетевой сбой. */
let replaceOutcome: "success" | "failure" = "success";
const replaceFoodieProfile = vi.fn(async (input: unknown) => {
  if (replaceOutcome === "failure") {
    throw new Error("simulated PUT /users/me/foodie-profile failure");
  }
  return input;
});

/**
 * Стартовый `GET /users/me/foodie-profile` — управляемый вручную промис, а не
 * `async () => ...`: тестам на `isLoadingProfile`/`profileLoadFailed` нужно
 * держать запрос "в полёте" произвольно долго, а не полагаться на то, что он
 * успеет разрешиться раньше следующего `expect`.
 */
let settleGetProfile: (profile: {
  cuisines: string[];
  diets: string[];
  allergies: string[];
  budget: string | null;
}) => void;
let failGetProfile: (error: Error) => void;
const getFoodieProfile = vi.fn(
  () =>
    new Promise((resolve, reject) => {
      settleGetProfile = resolve;
      failGetProfile = reject;
    }),
);

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    status: "signed-in",
    repository: {
      getFoodieProfile,
      replaceFoodieProfile,
    },
  }),
}));

const { default: FoodieProfileBudgetScreen } = await import("../foodie-profile/budget");
const { FoodieProfileDraftProvider, useFoodieProfileDraft } = await import(
  "../../src/lib/foodie-profile-draft"
);

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FoodieProfileDraftProvider>
        <FoodieProfileBudgetScreen />
      </FoodieProfileDraftProvider>
    </QueryClientProvider>,
  );
}

/** Рендерит экран и сразу отвечает на стартовый `GET` пустым профилем, как
 * большинство тестов ниже, которым важно поведение `save()`, а не самой
 * загрузки — дожидается, пока «Готово» перестанет быть задизейблена. */
async function renderLoadedScreen() {
  const utils = renderScreen();
  settleGetProfile({ cuisines: [], diets: [], allergies: [], budget: null });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: t.onboarding.foodieProfile.done }).getAttribute("aria-disabled"),
    ).not.toBe("true"),
  );
  return utils;
}

beforeEach(() => {
  replace.mockClear();
  replaceFoodieProfile.mockClear();
  getFoodieProfile.mockClear();
  getFoodieProfileOptions.mockClear();
  getFoodieProfileOptions.mockImplementation(async () => __mockFoodieProfileOptions);
  replaceOutcome = "success";
});

describe("шаг «Ваш бюджет»", () => {
  it("по умолчанию ни одна карточка не выбрана", async () => {
    renderScreen();
    for (const tier of __mockFoodieProfileOptions.budgets) {
      const card = await screen.findByRole("radio", { name: `${tier.name}, ${tier.priceLabel}` });
      expect(card.getAttribute("aria-checked")).toBe("false");
    }
  });

  it("«Готово» доступна без выбора после загрузки, сохраняет черновик и уходит в «Профиль»", async () => {
    const user = userEvent.setup();
    await renderLoadedScreen();

    const done = screen.getByRole("button", { name: t.onboarding.foodieProfile.done });
    expect(done.getAttribute("aria-disabled")).not.toBe("true");

    await user.click(done);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
    expect(replaceFoodieProfile).toHaveBeenCalledWith({
      cuisines: [],
      diets: [],
      allergies: [],
      budget: null,
    });
  });

  it("пока стартовый GET грузится — «Готово» заблокирована (подписана «Загрузка») и включается после ответа", async () => {
    renderScreen();

    // Пока GET не ответил, ссылка в шапке показывает t.common.loading, а не
    // t.onboarding.foodieProfile.done, — тем же приёмом, что и во время PUT.
    const loading = screen.getByRole("button", { name: t.common.loading });
    expect(loading.getAttribute("aria-disabled")).toBe("true");

    settleGetProfile({ cuisines: ["kazakh"], diets: [], allergies: [], budget: null });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: t.onboarding.foodieProfile.done }).getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
  });

  it("сбой стартового GET блокирует «Готово», не даёт стереть сохранённое и снимается повтором", async () => {
    const user = userEvent.setup();
    renderScreen();

    const done = () => screen.getByRole("button", { name: t.onboarding.foodieProfile.done });
    failGetProfile(new Error("simulated GET /users/me/foodie-profile failure"));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(t.onboarding.foodieProfile.loadFailed),
    );
    expect(done().getAttribute("aria-disabled")).toBe("true");
    expect(replaceFoodieProfile).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: t.common.retry }));
    settleGetProfile({ cuisines: ["kazakh"], diets: [], allergies: [], budget: null });
    await waitFor(() => expect(done().getAttribute("aria-disabled")).not.toBe("true"));

    await user.click(done());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
    // Ранее сохранённая кухня из GET дошла до PUT нетронутой, а не пустым
    // черновиком — собственно то, от чего защищает эта блокировка.
    expect(replaceFoodieProfile).toHaveBeenCalledWith({
      cuisines: ["kazakh"],
      diets: [],
      allergies: [],
      budget: null,
    });
  });

  it("сбой сохранения оставляет черновик на экране и показывает ошибку с возможностью повторить", async () => {
    replaceOutcome = "failure";
    const user = userEvent.setup();
    await renderLoadedScreen();

    const done = () => screen.getByRole("button", { name: t.onboarding.foodieProfile.done });
    await user.click(done());

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(t.onboarding.foodieProfile.saveFailed),
    );
    expect(replace).not.toHaveBeenCalled();

    // Повторный тап после починки «сети» доводит сохранение до конца — тот же
    // «Готово», без потери набранного черновика.
    replaceOutcome = "success";
    await user.click(done());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
  });

  it("повторный тап по выбранной карточке снимает выбор", async () => {
    const user = userEvent.setup();
    renderScreen();

    const mid = __mockFoodieProfileOptions.budgets.find((tier) => tier.code === "mid")!;
    const midCard = await screen.findByRole("radio", { name: `${mid.name}, ${mid.priceLabel}` });

    await user.click(midCard);
    expect(midCard.getAttribute("aria-checked")).toBe("true");

    await user.click(midCard);
    expect(midCard.getAttribute("aria-checked")).toBe("false");
  });

  it("пока справочник бюджетных ярусов грузится — крутилка, «Готово» недоступна", async () => {
    let resolveOptions: (value: typeof __mockFoodieProfileOptions) => void;
    getFoodieProfileOptions.mockImplementation(
      () => new Promise((resolve) => (resolveOptions = resolve)),
    );

    renderScreen();
    settleGetProfile({ cuisines: [], diets: [], allergies: [], budget: null });

    expect(screen.getByText(t.onboarding.foodieProfile.optionsLoading)).toBeTruthy();
    // На этот момент подпись справа может быть ещё «Загрузка» (ждём и GET
    // профиля, и справочник) — важно, что кнопка задизейблена, а не какая
    // именно подпись на ней прямо сейчас.
    const nextButton = screen.getByRole("button", {
      name: new RegExp(`^(${t.common.loading}|${t.onboarding.foodieProfile.done})$`),
    });
    expect(nextButton.getAttribute("aria-disabled")).toBe("true");

    resolveOptions!(__mockFoodieProfileOptions);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: t.onboarding.foodieProfile.done }).getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
  });

  it("сбой загрузки справочника ярусов показывает ошибку с «Повторить»", async () => {
    getFoodieProfileOptions.mockRejectedValueOnce(
      new RepositoryError("simulated offline", undefined, undefined, undefined, undefined, undefined, true),
    );

    const user = userEvent.setup();
    renderScreen();
    settleGetProfile({ cuisines: [], diets: [], allergies: [], budget: null });

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: t.common.retry }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: t.onboarding.foodieProfile.done }).getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
  });

  it("ярус, скрытый админом, не рисуется карточкой и не считается выбранным, даже если он был сохранён (спека §3.5)", async () => {
    renderScreen();
    settleGetProfile({ cuisines: [], diets: [], allergies: [], budget: "student" });

    // «student» — ярус, которого нет в живом справочнике (админ его скрыл
    // после того, как гость его когда-то выбрал). Гидрация роняет его до
    // `null` — ни одна карточка не отмечена, «Готово» доступна как при
    // пустом (валидном для необязательного шага) выборе.
    for (const tier of __mockFoodieProfileOptions.budgets) {
      const card = await screen.findByRole("radio", { name: `${tier.name}, ${tier.priceLabel}` });
      expect(card.getAttribute("aria-checked")).toBe("false");
    }
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: t.onboarding.foodieProfile.done }).getAttribute("aria-disabled"),
      ).not.toBe("true"),
    );
  });
});

describe("гонка гидрации GET: тап на ОДНОМ шаге не блокирует гидрацию остальных трёх", () => {
  it("кухня, тронутая гостем до ответа GET, не мешает диете/аллергиям/бюджету подхватить сервер — регрессия ревью PR #225, раунд 2", async () => {
    // Регрессия обнаружена ревьюером `hydration-race.test.tsx`: раньше
    // `userEdited` был ОДНИМ общим флагом на все 4 категории — тап по
    // ЛЮБОЙ плитке на ЛЮБОМ шаге до ответа GET блокировал гидрацию
    // остальных трёх насовсем, и «Готово» отправляло PUT, стирающий их
    // ранее сохранённые значения.
    const user = userEvent.setup();
    let draftApi: ReturnType<typeof useFoodieProfileDraft>;
    function Spy() {
      draftApi = useFoodieProfileDraft();
      return null;
    }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <FoodieProfileDraftProvider>
          <Spy />
          <FoodieProfileBudgetScreen />
        </FoodieProfileDraftProvider>
      </QueryClientProvider>,
    );

    // Гость тапает кухню на шаге 1 (`cuisine.tsx`) ДО того, как стартовый
    // GET успел ответить — здесь это моделируется через контекст черновика
    // напрямую, а не рендером всех 4 экранов визарда.
    act(() => {
      draftApi.toggleCuisine("italian");
    });

    // На сервере уже было полное сохранение по всем 4 категориям.
    settleGetProfile({ cuisines: ["kazakh"], diets: ["vegan"], allergies: ["nuts"], budget: "mid" });

    const done = () => screen.getByRole("button", { name: t.onboarding.foodieProfile.done });
    await waitFor(() => expect(done().getAttribute("aria-disabled")).not.toBe("true"));

    // Гость доходит до «Готово», ничего больше не трогая на диете/
    // аллергиях/бюджете — считая, что там уже стоит его прежний выбор.
    await user.click(done());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));

    // Тронутая категория (кухня) — выбор гостя; три нетронутые — то, что
    // реально лежало на сервере, а не пустой/неполный черновик.
    expect(replaceFoodieProfile).toHaveBeenCalledWith({
      cuisines: ["italian"],
      diets: ["vegan"],
      allergies: ["nuts"],
      budget: "mid",
    });
  });
});

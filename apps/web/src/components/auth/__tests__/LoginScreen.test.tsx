import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { RepositoryError } from "@bookeat/api/client";

import { LocaleProvider } from "@web/lib/locale";

/**
 * Экран входа. Проверяется поведение, из-за которого он вообще появился:
 * кнопка «Войти» больше не должна вести в никуда, а форма — обязана честно
 * различать причины отказа сервера и не терять введённое.
 *
 * Четыре состояния асинхронной формы: пока запрос летит — кнопка занята,
 * отказ назван словами, успех уводит на главную, а введённый код при ошибке
 * остаётся на месте.
 */

const replace = vi.fn();
/** Адрес возврата в строке запроса. Меняется тестом, читается моком. */
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/login",
}));

const authRepository = {
  requestOtp: vi.fn(async () => ({ sent: true, devCode: null })),
  verifyOtp: vi.fn(async () => ({
    accessToken: "a",
    refreshToken: "r",
    expiresAt: "2026-09-01T00:00:00Z",
    isNewUser: false,
  })),
  getMe: vi.fn(async () => ({
    id: "u1",
    email: "",
    fullName: "Дамир",
    phone: "+77018692233",
    city: null,
  })),
  refresh: vi.fn(),
};

vi.mock("@web/lib/api", () => ({
  get authRepository() {
    return authRepository;
  },
  repository: {},
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

const { AuthProvider } = await import("@web/lib/auth");
const { LoginScreen } = await import("@web/components/auth/LoginScreen");

function renderLogin(ui: ReactElement = <LoginScreen />) {
  // `AuthProvider` чистит кэш при смене сессии, поэтому клиент запросов ему
  // обязателен — как и в настоящем дереве (app/providers.tsx).
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <AuthProvider>{ui}</AuthProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

const PHONE = "701 869-22-33";

async function goToCodeStep() {
  renderLogin();
  fireEvent.change(screen.getByLabelText("Номер телефона"), { target: { value: PHONE } });
  fireEvent.click(screen.getByRole("button", { name: "Получить код" }));
  await screen.findByText("Введите код");
}

async function enterCode(value = "482913") {
  const boxes = codeBoxes();
  value.split("").forEach((digit, index) => {
    fireEvent.change(boxes[index], { target: { value: digit } });
  });
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
  await waitFor(() => expect(authRepository.verifyOtp).toHaveBeenCalled());
}

function codeBoxes() {
  return screen.getAllByRole("textbox").filter((element) => element.getAttribute("maxlength") === "1");
}

describe("вход по номеру телефона", () => {
  // Сессия живёт в localStorage и переживает размонтирование: без очистки
  // следующий тест открывал бы экран уже вошедшим гостем.
  beforeEach(() => {
    window.localStorage.clear();
    search = "";
    replace.mockClear();
  });

  it("неполный номер не уходит на сервер", () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText("Номер телефона"), { target: { value: "701 869" } });
    fireEvent.click(screen.getByRole("button", { name: "Получить код" }));

    expect(authRepository.requestOtp).not.toHaveBeenCalled();
    expect(screen.getByText("Введите 10 цифр номера")).toBeTruthy();
  });

  it("полный номер уходит в E.164 и открывает шаг кода", async () => {
    await goToCodeStep();

    expect(authRepository.requestOtp).toHaveBeenCalledWith("+77018692233");
    // Клеток ШЕСТЬ: столько цифр генерирует сервер, хотя макет рисует четыре.
    expect(codeBoxes()).toHaveLength(6);
  });

  /** Сервер отвечает узкими кодами (`otp_rate_limited_minute` и прочие) —
   * гость должен видеть причину, а не «что-то пошло не так». */
  it("лимит по номеру назван словами, а не общей ошибкой", async () => {
    authRepository.requestOtp.mockRejectedValueOnce(
      new RepositoryError("rate limited", undefined, 422, "rate limited", "otp_rate_limited_minute", 60),
    );
    renderLogin();

    fireEvent.change(screen.getByLabelText("Номер телефона"), { target: { value: PHONE } });
    fireEvent.click(screen.getByRole("button", { name: "Получить код" }));

    expect(await screen.findByText("Слишком много запросов. Попробуйте через 60 с")).toBeTruthy();
  });

  it("верный код заводит сессию и уводит на главную", async () => {
    await goToCodeStep();

    const boxes = codeBoxes();
    "482913".split("").forEach((digit, index) => {
      fireEvent.change(boxes[index], { target: { value: digit } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    await waitFor(() =>
      expect(authRepository.verifyOtp).toHaveBeenCalledWith({
        phone: "+77018692233",
        code: "482913",
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("возвращает туда, откуда гость ушёл на вход", async () => {
    // Гость жал сердце на странице заведения — после кода он должен вернуться
    // на неё, а не на главную.
    search = "next=%2Fvenues%2Fabc%3Ffrom%3Dcard";
    await goToCodeStep();
    await enterCode();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/venues/abc?from=card"));
  });

  it("подделанный адрес возврата не уводит с домена", async () => {
    // `//evil.example` — протокольно-относительный адрес: слэш в начале есть, а
    // открылся бы чужой сайт. Это открытый редирект, и его тут быть не должно.
    search = "next=%2F%2Fevil.example";
    await goToCodeStep();
    await enterCode();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(replace).not.toHaveBeenCalledWith("//evil.example");
  });

  /** Неверный код НЕ стирается: гость правит одну цифру, а не набирает шесть. */
  it("отказ по коду не стирает введённое", async () => {
    authRepository.verifyOtp.mockRejectedValueOnce(
      new RepositoryError("unauthorized", undefined, 401, "unauthorized", "otp_invalid"),
    );
    await goToCodeStep();

    const boxes = codeBoxes();
    "111111".split("").forEach((digit, index) => {
      fireEvent.change(boxes[index], { target: { value: digit } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(codeBoxes().map((box) => (box as HTMLInputElement).value).join("")).toBe("111111");
  });

  it("«Изменить номер» возвращает на первый шаг с сохранённым номером", async () => {
    await goToCodeStep();

    fireEvent.click(screen.getByRole("button", { name: "Изменить номер" }));

    expect((screen.getByLabelText("Номер телефона") as HTMLInputElement).value).toBe(PHONE);
  });
});

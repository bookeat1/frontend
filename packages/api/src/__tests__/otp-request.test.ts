import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpAuthRepository } from "../http-repository";
import { RepositoryError } from "../repository";

/**
 * REGRESSION GUARD — эхо кода из `/auth/otp/request`.
 *
 * On a deployment with `AUTH_OTP_DEV_EXPOSE=true` the backend echoes the OTP in
 * the response body (`{"data":{"sent":true,"code":"688751"}}`); on production
 * the `code` field is simply absent. The repository must surface that echo as
 * `devCode` so a tester on a delivery-less backend can sign in — WITHOUT letting
 * anything depend on it in production, where it is always null.
 */

const BASE_URL = "https://api.example.test/api/v1";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /auth/otp/request", () => {
  it("прокидывает эхо кода из data.code в devCode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ data: { sent: true, code: "688751" } })),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => undefined });
    const result = await repository.requestOtp("+77010000000");

    expect(result.sent).toBe(true);
    expect(result.devCode).toBe("688751");
  });

  it("на проде поля code нет — devCode остаётся null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ data: { sent: true } })),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => undefined });
    const result = await repository.requestOtp("+77010000000");

    expect(result.sent).toBe(true);
    expect(result.devCode).toBeNull();
  });

  it("пустая строка в code — это не код, а null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ data: { sent: true, code: "" } })),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => undefined });
    const result = await repository.requestOtp("+77010000000");

    expect(result.devCode).toBeNull();
  });
});

/**
 * REGRESSION GUARD — the client deadline for the code-DELIVERY endpoints.
 *
 * The backend sends the OTP synchronously inside the request, with a 12-second
 * delivery budget (otpsender/waterfall.go) under a 15 s WriteTimeout. The
 * client's default deadline is 8 s, so the app used to abort a request that was
 * still working: the guest received the code and the screen said «Проверьте
 * соединение» without ever showing the code field. The OTP-request endpoints
 * must therefore wait LONGER than the server's budget.
 */
describe("OTP request deadline", () => {
  /** Reads the ms the abort signal was armed with, by intercepting the timer
   * the client asks for — the signal itself does not expose its deadline. */
  function captureTimeout(): { of: (path: string) => number | undefined } {
    const byPath = new Map<string, number>();
    const original = AbortSignal.timeout.bind(AbortSignal);
    let pending: number | undefined;
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      pending = ms;
      // A signal that never fires: the stubbed fetch answers immediately.
      return original(60_000);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        byPath.set(new URL(url).pathname, pending as number);
        return jsonResponse({ data: { sent: true, access_token: "a", refresh_token: "r" } });
      }),
    );
    return { of: (path) => byPath.get(path) };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("waits 20 s for /auth/otp/request — longer than the server's 12 s delivery budget", async () => {
    const captured = captureTimeout();
    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => undefined });
    await repository.requestOtp("+77010000000");
    expect(captured.of("/api/v1/auth/otp/request")).toBe(20_000);
  });

  it("waits 20 s for the phone-change request — the same synchronous waterfall", async () => {
    const captured = captureTimeout();
    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    await repository.requestPhoneChangeOtp("+77010000001");
    expect(captured.of("/api/v1/users/me/phone/otp/request")).toBe(20_000);
  });

  it("leaves every other endpoint on the 8 s default — verify sends nothing", async () => {
    const captured = captureTimeout();
    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => undefined });
    await repository.verifyOtp({ phone: "+77010000000", code: "123456" });
    expect(captured.of("/api/v1/auth/otp/verify")).toBe(8_000);
  });

  it("an explicit timeoutMs from the caller still wins over the OTP default", async () => {
    const captured = captureTimeout();
    const repository = new HttpAuthRepository({
      baseUrl: BASE_URL,
      timeoutMs: 50,
      getToken: () => undefined,
    });
    await repository.requestOtp("+77010000000");
    expect(captured.of("/api/v1/auth/otp/request")).toBe(50);
  });
});

/**
 * A client-side timeout must be distinguishable from having no network: the
 * sign-in screen says different things about them (the code may have arrived vs
 * check your connection), and both used to look identical.
 */
describe("timeout classification", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("a timed-out OTP request is both offline AND timed out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        await new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject((init.signal as AbortSignal).reason));
        });
        throw new Error("unreachable");
      }),
    );

    const repository = new HttpAuthRepository({
      baseUrl: BASE_URL,
      timeoutMs: 20,
      getToken: () => undefined,
    });

    const error = await repository.requestOtp("+77010000000").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RepositoryError);
    expect((error as RepositoryError).isTimeout).toBe(true);
    expect((error as RepositoryError).isOffline).toBe(true);
    expect((error as RepositoryError).status).toBeUndefined();
  });

  it("a plain network failure is offline but NOT timed out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Network request failed");
      }),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => undefined });
    const error = await repository.requestOtp("+77010000000").catch((e: unknown) => e);
    expect((error as RepositoryError).isOffline).toBe(true);
    expect((error as RepositoryError).isTimeout).toBe(false);
  });

  it("a 500 is a server failure, not a transport one", () => {
    const error = new RepositoryError("Server error 500", undefined, 500);
    expect(error.isServerFailure).toBe(true);
    expect(error.isOffline).toBe(false);
    expect(error.isTimeout).toBe(false);
  });
});

/**
 * Экран входа теперь ВЕДЁТ гостя на поле ввода кода, если запрос кода не дождался
 * ответа (см. classifyOtpRequestFailure в apps/mobile). Решение принимается по
 * `isTimeout`, поэтому здесь заперт источник этого флага: отказ СЕРВЕРА никогда не
 * должен выглядеть как таймаут, иначе человека посадят перед полем, в которое
 * нечего вводить.
 */
describe("только собственный дедлайн помечается как таймаут", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([422, 429, 500, 503])("ответ %i приходит без флага таймаута", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "nope", code: "validation_failed" }, status)),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => undefined });
    const error = (await repository.requestOtp("+77010000000").catch((e: unknown) => e)) as RepositoryError;

    expect(error).toBeInstanceOf(RepositoryError);
    expect(error.isTimeout).toBe(false);
    expect(error.isOffline).toBe(false);
    expect(error.status).toBe(status);
  });

  it("битый ответ сервера — тоже не таймаут", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>502</html>", { status: 200 })),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => undefined });
    const error = (await repository.requestOtp("+77010000000").catch((e: unknown) => e)) as RepositoryError;

    expect(error.isTimeout).toBe(false);
    expect(error.isOffline).toBe(false);
  });
});

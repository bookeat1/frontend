import { describe, expect, it, vi } from "vitest";
import { HttpAuthRepository } from "../http-repository";
import { RepositoryError } from "../repository";

/**
 * Feature B4 — change the signed-in guest's phone number via an OTP sent to the
 * NEW number.
 *
 * Two endpoints, both AUTHENTICATED (bearer token, the same path updateMe uses,
 * NOT the anonymous sign-in path):
 *   POST /users/me/phone/otp/request  { new_phone }        → {sent, devCode}
 *   POST /users/me/phone/otp/verify   { new_phone, code }  → updated user
 *
 * What is pinned here: the wire shape (paths, snake_case body, bearer header),
 * the `{sent, devCode}` echo mapping reused from requestOtp, that verify maps
 * with the SAME user mapper getMe/updateMe use, and the three error statuses
 * the screen branches on — 409 (number taken), 401 (bad/expired code), 422
 * (same-number/invalid).
 */

const BASE_URL = "https://api.example.test/api/v1";
const NEW_PHONE = "+77015550123";

function userPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "u-1",
    email: "",
    full_name: "Дамир",
    phone: NEW_PHONE,
    city: null,
    birth_date: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /users/me/phone/otp/request — requestPhoneChangeOtp", () => {
  it("отправляет new_phone с bearer-токеном и прокидывает эхо кода", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ data: { sent: true, code: "688751" } });
      }),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    const result = await repository.requestPhoneChangeOtp(NEW_PHONE);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.url).toBe(`${BASE_URL}/users/me/phone/otp/request`);
    // AUTHENTICATED: the request rides the bearer token, unlike anonymous
    // /auth/otp/request.
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer token");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ new_phone: NEW_PHONE });
    expect(result.sent).toBe(true);
    expect(result.devCode).toBe("688751");
  });

  it("на проде поля code нет — devCode остаётся null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: { sent: true } })));

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    const result = await repository.requestPhoneChangeOtp(NEW_PHONE);

    expect(result.sent).toBe(true);
    expect(result.devCode).toBeNull();
  });

  it("409 — номер уже привязан к другому аккаунту", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "already exists", code: "already_exists" }, 409)),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    const error = await repository.requestPhoneChangeOtp(NEW_PHONE).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RepositoryError);
    expect((error as RepositoryError).status).toBe(409);
  });

  it("422 — тот же номер / некорректный", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "validation failed", code: "validation_failed" }, 422)),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    const error = await repository.requestPhoneChangeOtp(NEW_PHONE).catch((e: unknown) => e);

    expect((error as RepositoryError).status).toBe(422);
  });
});

describe("POST /users/me/phone/otp/verify — confirmPhoneChange", () => {
  it("отправляет new_phone+code с bearer и возвращает обновлённого пользователя", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ data: userPayload() });
      }),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    const updated = await repository.confirmPhoneChange({ newPhone: NEW_PHONE, code: "123456" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.url).toBe(`${BASE_URL}/users/me/phone/otp/verify`);
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer token");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      new_phone: NEW_PHONE,
      code: "123456",
    });
    // Mapped with the SAME mapUser getMe/updateMe use — camelCase, phone moved.
    expect(updated.phone).toBe(NEW_PHONE);
    expect(updated.fullName).toBe("Дамир");
  });

  it("401 — неверный или просроченный код", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "unauthorized", code: "unauthorized" }, 401)),
    );

    const repository = new HttpAuthRepository({
      baseUrl: BASE_URL,
      getToken: () => "token",
      // A 401 on THIS call is a wrong code, not a dead session — do not spend a
      // refresh trying to "fix" it (the retry would just 401 again). The client
      // still calls onUnauthorized once; returning the same token lets the 401
      // stand and surface to the screen.
      onUnauthorized: async () => undefined,
    });
    const error = await repository
      .confirmPhoneChange({ newPhone: NEW_PHONE, code: "000000" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RepositoryError);
    expect((error as RepositoryError).status).toBe(401);
    expect((error as RepositoryError).isUnauthorized).toBe(true);
  });

  it("409 — номер заняли между request и verify", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "already exists", code: "already_exists" }, 409)),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    const error = await repository
      .confirmPhoneChange({ newPhone: NEW_PHONE, code: "123456" })
      .catch((e: unknown) => e);

    expect((error as RepositoryError).status).toBe(409);
  });

  it("422 — тот же номер / некорректный", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "validation failed", code: "validation_failed" }, 422)),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    const error = await repository
      .confirmPhoneChange({ newPhone: NEW_PHONE, code: "123456" })
      .catch((e: unknown) => e);

    expect((error as RepositoryError).status).toBe(422);
    expect((error as RepositoryError).isValidation).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { HttpAuthRepository } from "../http-repository";

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

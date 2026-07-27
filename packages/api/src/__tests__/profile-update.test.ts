import { describe, expect, it, vi } from "vitest";
import { HttpAuthRepository } from "../http-repository";
import { RepositoryError } from "../repository";

/**
 * REGRESSION GUARD — обновление токена посреди сохранения профиля.
 *
 * The access token lives 15 minutes. A guest who opens «Профиль», types, and
 * presses «Сохранить» a moment after it expires gets a 401 on the PATCH. The
 * client is supposed to refresh the session and resend THE SAME BODY once
 * (HttpClient.send). If it resends an empty body, or gives up and reports the
 * 401 to the screen, the guest either loses the edit or is told to sign in for
 * no reason — with a session that is perfectly alive.
 *
 * Also pinned here: the body itself. `PATCH /users/me` models every field as a
 * Go pointer, so an ABSENT key means "leave this column alone" while `null`
 * means the same thing and `""` means "clear it" (users/request.go +
 * usecase/users/facade.go). Sending the whole profile back would overwrite
 * fields this app does not even render.
 */

const BASE_URL = "https://api.example.test/api/v1";

function userPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "u-1",
    email: "",
    full_name: "Дамир",
    phone: "+77010000000",
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

describe("PATCH /users/me", () => {
  it("отправляет только изменённые поля", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ data: userPayload({ city: "Алматы" }) });
      }),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    const updated = await repository.updateMe({ city: "Алматы" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.init.method).toBe("PATCH");
    expect(calls[0]!.url).toBe(`${BASE_URL}/users/me`);
    // Exactly one key. No full_name, no birth_date — the server would treat a
    // present key as an instruction.
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ city: "Алматы" });
    expect(updated.city).toBe("Алматы");
  });

  it("токен протух в момент сохранения: правку досылают, а не теряют", async () => {
    const bodies: string[] = [];
    const tokens: Array<string | null> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(String(init.body));
        const headers = init.headers as Record<string, string>;
        tokens.push(headers.Authorization ?? null);
        if (tokens.length === 1) {
          return jsonResponse({ error: "unauthorized", code: "unauthorized" }, 401);
        }
        return jsonResponse({ data: userPayload({ full_name: "Дамир Саркулин" }) });
      }),
    );

    const repository = new HttpAuthRepository({
      baseUrl: BASE_URL,
      getToken: () => "stale-token",
      onUnauthorized: async (stale) => {
        expect(stale).toBe("stale-token");
        return "fresh-token";
      },
    });

    const updated = await repository.updateMe({ fullName: "Дамир Саркулин" });

    expect(tokens).toEqual(["Bearer stale-token", "Bearer fresh-token"]);
    // The SAME body both times — the edit survives the refresh untouched.
    expect(bodies[0]).toBe(bodies[1]);
    expect(JSON.parse(bodies[1]!)).toEqual({ full_name: "Дамир Саркулин" });
    expect(updated.fullName).toBe("Дамир Саркулин");
  });

  it("обновить сессию не удалось — 401 доходит до экрана как 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "unauthorized", code: "unauthorized" }, 401)),
    );

    const repository = new HttpAuthRepository({
      baseUrl: BASE_URL,
      getToken: () => "stale-token",
      // The refresh token is dead too: the handler signs the guest out and
      // answers nothing.
      onUnauthorized: async () => undefined,
    });

    await expect(repository.updateMe({ fullName: "Дамир" })).rejects.toMatchObject({
      status: 401,
    });
  });

  it("422 не выдаётся за проблему со связью", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: "validation failed", code: "validation_failed" }, 422),
      ),
    );

    const repository = new HttpAuthRepository({ baseUrl: BASE_URL, getToken: () => "token" });
    const error = await repository.updateMe({ birthDate: "2999-01-01" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RepositoryError);
    expect((error as RepositoryError).status).toBe(422);
    expect((error as RepositoryError).code).toBe("validation_failed");
  });
});

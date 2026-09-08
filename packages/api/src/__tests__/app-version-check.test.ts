import { describe, expect, it, vi } from "vitest";
import { mapAppUpdateDecision, type ApiAppVersionCheck } from "../http-mapping";
import { HttpRestaurantRepository } from "../http-repository";

/**
 * Контракт `GET /api/v1/app/version-check` (backend `appversion`, ADR-039).
 *
 * Ручка умеет запереть гостя в работающем приложении, поэтому проверяется не
 * только «правильно разобрали», но и направление, в котором разрешается любая
 * неясность: молчание. Незнакомый режим, пустое тело, потерянные тексты — всё
 * это `action: "none"`, а не «обновитесь».
 */

const BASE_URL = "https://api.example.test/api/v1";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("mapAppUpdateDecision", () => {
  it("разбирает мягкий режим целиком", () => {
    const api: ApiAppVersionCheck = {
      platform: "ios",
      action: "recommended",
      store_url: "https://apps.apple.com/app/id6757542577",
      min_recommended_version: "1.5.1",
      title: { ru: "Доступно обновление", en: "Update available" },
      message: { ru: "Вышла новая версия.", en: "A new version is out." },
    } as ApiAppVersionCheck;

    expect(mapAppUpdateDecision(api)).toEqual({
      action: "recommended",
      storeUrl: "https://apps.apple.com/app/id6757542577",
      title: { ru: "Доступно обновление", en: "Update available" },
      message: { ru: "Вышла новая версия.", en: "A new version is out." },
    });
  });

  it("жёсткий режим доходит как есть", () => {
    const decision = mapAppUpdateDecision({
      action: "required",
      store_url: "https://play.google.com/store/apps/details?id=kz.bookeat.app",
      title: { ru: "Нужно обновить приложение" },
    });
    expect(decision.action).toBe("required");
    expect(decision.storeUrl).toBe(
      "https://play.google.com/store/apps/details?id=kz.bookeat.app",
    );
  });

  it("«none» не тащит за собой ни ссылки, ни текстов", () => {
    // Ссылка на витрину приходит и в этом ответе; если её пронести дальше,
    // рано или поздно найдётся кнопка, которая туда поведёт без повода.
    expect(
      mapAppUpdateDecision({ action: "none", store_url: "https://apps.apple.com/x" }),
    ).toEqual({ action: "none" });
  });

  it("незнакомый режим — это молчание, а не запрет", () => {
    expect(mapAppUpdateDecision({ action: "block_everything" }).action).toBe("none");
    expect(mapAppUpdateDecision({}).action).toBe("none");
    expect(mapAppUpdateDecision(null).action).toBe("none");
  });

  it("пустая ссылка на магазин становится undefined, а не пустой строкой", () => {
    // Кнопка, которая никуда не ведёт, не должна быть отличима от отсутствия
    // ссылки: и то и другое — «идти некуда».
    expect(mapAppUpdateDecision({ action: "required", store_url: "" }).storeUrl).toBeUndefined();
  });

  it("пустые переводы отбрасываются, а объект без единого текста — undefined", () => {
    const decision = mapAppUpdateDecision({
      action: "recommended",
      store_url: "https://apps.apple.com/x",
      title: { ru: "Заголовок", en: "   " },
      message: { ru: "", kk: "" },
    });
    expect(decision.title).toEqual({ ru: "Заголовок" });
    expect(decision.message).toBeUndefined();
  });
});

describe("HttpRestaurantRepository.checkAppUpdate", () => {
  it("публичный GET /app/version-check с платформой и версией, без токена", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ data: { platform: "android", action: "none" } });
      }),
    );

    const repo = new HttpRestaurantRepository({
      baseUrl: BASE_URL,
      getToken: () => "token-that-must-not-be-sent",
    });
    const decision = await repo.checkAppUpdate({ platform: "android", version: "1.5.1" });

    expect(decision).toEqual({ action: "none" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${BASE_URL}/app/version-check?platform=android&version=1.5.1`);
    const headers = new Headers(calls[0]!.init.headers as HeadersInit);
    // Ручка анонимная и кэшируемая: заголовок авторизации сделал бы ответ
    // персональным, а он зависит только от сборки.
    expect(headers.get("Authorization")).toBeNull();
  });

  it("пустая версия просто не уходит в запрос", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return jsonResponse({ data: { platform: "ios", action: "none" } });
      }),
    );

    const repo = new HttpRestaurantRepository({ baseUrl: BASE_URL });
    await repo.checkAppUpdate({ platform: "ios", version: "" });

    expect(calls[0]).toBe(`${BASE_URL}/app/version-check?platform=ios`);
  });

  it("отказ сервера остаётся отказом — глотает его вызывающий, не репозиторий", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "boom" }, 500)));
    const repo = new HttpRestaurantRepository({ baseUrl: BASE_URL });
    await expect(repo.checkAppUpdate({ platform: "ios", version: "1.5.1" })).rejects.toThrow();
  });
});

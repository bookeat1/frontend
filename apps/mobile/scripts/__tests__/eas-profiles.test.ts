import { describe, expect, it } from "vitest";

import easJson from "../../eas.json";

import {
  ENVIRONMENTS,
  checkBuilderEnv,
  checkEasJson,
  describeProfile,
  resolveBuildProfile,
} from "../eas-profiles";

/**
 * Ловушка, которую закрывают эти проверки: до 2026-09-07 профиль `production`
 * с каналом `production` ходил на ТЕСТОВЫЙ бэкенд (это была бета под боевым
 * именем), а у `production-apk` адрес сервера вообще не был написан — он
 * наследовался через `extends`. Сборка с таким профилем уехала бы живым
 * гостям с бронями в тестовой базе, и никто бы этого не заметил до жалобы.
 *
 * Проверяем ГРАНИЦУ: реальный eas.json проходит правила, каждый релизный
 * профиль после разрешения `extends` явно знает свой сервер, а каждое
 * запрещённое сочетание даёт нарушение с конкретным кодом.
 */

const rules = (errors: Array<{ rule: string }>) => errors.map((error) => error.rule);

describe("реальный eas.json", () => {
  it("проходит все правила", () => {
    expect(checkEasJson(easJson)).toEqual([]);
  });

  it("каждый релизный профиль явно знает приложение и сервер", () => {
    const table = Object.keys(easJson.build)
      .map((name) => describeProfile(name, resolveBuildProfile(easJson, name)))
      .filter((row) => row.channel === "production")
      .map(({ name, target, environment }) => [name, target, environment]);

    expect(table).toEqual([
      ["beta", "beta", "test"],
      ["beta-apk", "beta", "test"],
      ["production-main", "main", "main"],
      ["production-apk-main", "main", "main"],
    ]);
  });

  it("не содержит профиля с именем ровно `production`", () => {
    expect(Object.keys(easJson.build)).not.toContain("production");
    expect(Object.keys(easJson.submit)).not.toContain("production");
  });

  it("apk-профили не полагаются на наследование адреса сервера", () => {
    // Наследование работает (eas-json сливает env по ключам), но адрес
    // обязан быть виден в самом профиле: читающий файл не должен ходить по
    // цепочке extends, чтобы узнать, куда пойдёт сборка.
    expect(easJson.build["beta-apk"].env.EXPO_PUBLIC_API_URL).toBe(ENVIRONMENTS.test.apiUrl);
    expect(easJson.build["production-apk-main"].env.EXPO_PUBLIC_API_URL).toBe(
      ENVIRONMENTS.main.apiUrl,
    );
    expect(easJson.build["production-apk-main"].env.BOOKEAT_TARGET).toBe("main");
  });
});

const release = (env: Record<string, string>, extra: Record<string, unknown> = {}) => ({
  channel: "production",
  env,
  ...extra,
});

describe("запрещённые сочетания", () => {
  it("профиль `production` на тестовом сервере — исходная ловушка", () => {
    const config = { build: { production: release({ EXPO_PUBLIC_API_URL: ENVIRONMENTS.test.apiUrl }) } };
    expect(rules(checkEasJson(config))).toContain("PRODUCTION_NAME_REQUIRES_MAIN_TARGET");
  });

  it("основное приложение на тестовом сервере", () => {
    const config = {
      build: {
        "production-main": release({
          BOOKEAT_TARGET: "main",
          EXPO_PUBLIC_API_URL: ENVIRONMENTS.test.apiUrl,
          EXPO_PUBLIC_AMPLITUDE_API_KEY: ENVIRONMENTS.main.amplitudeKey,
        }),
      },
    };
    expect(rules(checkEasJson(config))).toEqual(["MAIN_TARGET_REQUIRES_MAIN_API"]);
  });

  it("основное приложение под именем без production", () => {
    const config = {
      build: {
        beta: release({
          BOOKEAT_TARGET: "main",
          EXPO_PUBLIC_API_URL: ENVIRONMENTS.main.apiUrl,
          EXPO_PUBLIC_AMPLITUDE_API_KEY: ENVIRONMENTS.main.amplitudeKey,
        }),
      },
    };
    expect(rules(checkEasJson(config))).toEqual(["MAIN_TARGET_REQUIRES_PRODUCTION_NAME"]);
  });

  it("магазинный канал без адреса сервера = мок-репозиторий в магазине", () => {
    const config = { build: { beta: release({}) } };
    expect(rules(checkEasJson(config))).toEqual(["RELEASE_REQUIRES_EXPLICIT_API_URL"]);
  });

  it("наследование не спасает, если у родителя адреса тоже нет", () => {
    const config = {
      build: {
        beta: release({}),
        "beta-apk": { extends: "beta", channel: "production" },
      },
    };
    expect(rules(checkEasJson(config))).toEqual([
      "RELEASE_REQUIRES_EXPLICIT_API_URL",
      "RELEASE_REQUIRES_EXPLICIT_API_URL",
    ]);
  });

  it("бета на боевом сервере", () => {
    const config = {
      build: {
        beta: release({
          EXPO_PUBLIC_API_URL: ENVIRONMENTS.main.apiUrl,
          EXPO_PUBLIC_AMPLITUDE_API_KEY: ENVIRONMENTS.test.amplitudeKey,
        }),
      },
    };
    expect(rules(checkEasJson(config))).toEqual(["BETA_FORBIDS_MAIN_API"]);
  });

  it("заглушка OTP и чужая аналитика у основного приложения", () => {
    const config = {
      build: {
        "production-main": release({
          BOOKEAT_TARGET: "main",
          EXPO_PUBLIC_API_URL: ENVIRONMENTS.main.apiUrl,
          EXPO_PUBLIC_AMPLITUDE_API_KEY: ENVIRONMENTS.test.amplitudeKey,
          EXPO_PUBLIC_OTP_DELIVERY_DISABLED: "1",
        }),
      },
    };
    expect(rules(checkEasJson(config))).toEqual([
      "MAIN_TARGET_REQUIRES_MAIN_AMPLITUDE",
      "MAIN_TARGET_FORBIDS_OTP_STUB",
    ]);
  });

  it("неизвестный адрес сервера и BOOKEAT_RUNTIME_VERSION в сборке", () => {
    const config = {
      build: {
        beta: release({
          EXPO_PUBLIC_API_URL: "https://backend.book-eat.com",
          BOOKEAT_RUNTIME_VERSION: "1.5",
        }),
      },
    };
    expect(rules(checkEasJson(config))).toEqual([
      "UNKNOWN_API_URL",
      "BUILD_FORBIDS_RUNTIME_VERSION_OVERRIDE",
    ]);
  });

  it("submit-профиль без одноимённого build-профиля", () => {
    const config = {
      build: { "production-main": easJson.build["production-main"] },
      submit: { production: {} },
    };
    expect(rules(checkEasJson(config))).toEqual(["SUBMIT_PROFILE_WITHOUT_BUILD_PROFILE"]);
  });

  it("зацикленный extends не вешает проверку", () => {
    const config = {
      build: {
        a: { extends: "b", channel: "production" },
        b: { extends: "a", channel: "production" },
      },
    };
    expect(rules(checkEasJson(config))).toEqual(["UNRESOLVABLE_PROFILE", "UNRESOLVABLE_PROFILE"]);
  });
});

describe("окружение на сборщике EAS", () => {
  const onBuilder = (profile: string, overrides: Record<string, string> = {}) => ({
    EAS_BUILD: "true",
    EAS_BUILD_PROFILE: profile,
    ...resolveBuildProfile(easJson, profile).env,
    ...overrides,
  });

  it("окружение, совпадающее с eas.json, проходит", () => {
    expect(checkBuilderEnv(easJson, onBuilder("production-main"))).toEqual([]);
    expect(checkBuilderEnv(easJson, onBuilder("beta"))).toEqual([]);
  });

  it("подменённый на сборщике адрес сервера роняет сборку", () => {
    const errors = checkBuilderEnv(
      easJson,
      onBuilder("production-main", { EXPO_PUBLIC_API_URL: ENVIRONMENTS.test.apiUrl }),
    );
    expect(rules(errors)).toEqual(["BUILDER_ENV_DIFFERS_FROM_EAS_JSON", "MAIN_TARGET_REQUIRES_MAIN_API"]);
  });

  it("сборка беты, которой в окружение подсунули боевой сервер", () => {
    const errors = checkBuilderEnv(
      easJson,
      onBuilder("beta", { EXPO_PUBLIC_API_URL: ENVIRONMENTS.main.apiUrl }),
    );
    expect(rules(errors)).toEqual(["BUILDER_ENV_DIFFERS_FROM_EAS_JSON", "BETA_FORBIDS_MAIN_API"]);
  });

  it("неизвестный или отсутствующий профиль", () => {
    expect(rules(checkBuilderEnv(easJson, { EAS_BUILD_PROFILE: "production" }))).toEqual([
      "UNRESOLVABLE_PROFILE",
    ]);
    expect(rules(checkBuilderEnv(easJson, { EAS_BUILD: "true" }))).toEqual([
      "BUILDER_WITHOUT_PROFILE_NAME",
    ]);
  });
});

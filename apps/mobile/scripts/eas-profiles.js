/* eslint-env node */
"use strict";

/**
 * Правила для профилей сборки в eas.json. Чистая логика без зависимостей:
 * её грузит vitest (scripts/__tests__), scripts/check-eas-profiles.js и
 * app.config.js на сборщике EAS — а app.config.js Expo вычисляет везде,
 * поэтому CommonJS и ничего кроме стандартной библиотеки Node.
 *
 * ЗАЧЕМ. До 2026-09-07 профиль назывался `production`, имел канал `production`
 * и при этом ходил на ТЕСТОВЫЙ бэкенд. Это был профиль БЕТЫ
 * (com.bookeatteam.bookeatapp), но по имени читался как боевой; боевой —
 * `production-main`. Не сломалось только потому, что ловушку помнили и
 * переписывали в каждый ранбук. Здесь она превращена в правило, которое роняет
 * сборку до установки зависимостей, а не всплывает у гостя в виде бронирования
 * в тестовой базе.
 *
 * Что здесь называется «окружением». Приложение узнаёт свой бэкенд ТОЛЬКО из
 * EXPO_PUBLIC_API_URL (packages/api, createRestaurantRepository): переменная
 * не задана — приложение молча работает на мок-репозитории с выдуманными
 * заведениями. Поэтому у профиля с магазинным каналом переменная обязана
 * присутствовать явно. Наследование через `extends` учитывается так же, как
 * в @expo/eas-json: env сливается по ключам, {...base.env, ...profile.env}.
 *
 * Какое приложение собирается, решает BOOKEAT_TARGET (см. app.config.js):
 * `main` — то, что стоит у живых гостей; всё остальное — бета. Правило Дамира
 * от 03.09.2026: бета смотрит на тестовый бэкенд, живые гости — на боевой, и
 * никак иначе. Имя профиля обязано говорить то же самое: `production*` ⇔ main.
 */

/** Известные окружения: адрес API и парный ему проект Amplitude. */
const ENVIRONMENTS = Object.freeze({
  test: Object.freeze({
    apiUrl: "https://test.backend.book-eat.com/api/v1",
    amplitudeKey: "ea6dc484a21af0092fc13af158f8c404",
  }),
  main: Object.freeze({
    apiUrl: "https://backend.book-eat.com/api/v1",
    amplitudeKey: "d084c0beaf84da775fd428b3b5544b57",
  }),
});

/** Канал, откуда обновления забирают магазинные сборки (ветка EAS production). */
const RELEASE_CHANNEL = "production";

/** Профиль с таким префиксом имени обязан собирать основное приложение. */
const MAIN_NAME_PREFIX = "production";

/** Переменные, которые вообще влияют на «какое приложение и на какой сервер». */
const ENV_KEYS = Object.freeze([
  "BOOKEAT_TARGET",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_AMPLITUDE_API_KEY",
  "EXPO_PUBLIC_OTP_DELIVERY_DISABLED",
  "BOOKEAT_RUNTIME_VERSION",
]);

const MAX_EXTENDS_DEPTH = 5;

/** Дословно mergeProfiles из @expo/eas-json/build/build/resolver.js (21.5.0). */
function mergeProfiles(base, update) {
  const result = { ...base, ...update };
  if (base.env && update.env) {
    result.env = { ...base.env, ...update.env };
  }
  if (base.android && update.android) {
    result.android = mergeProfiles(base.android, update.android);
  }
  if (base.ios && update.ios) {
    result.ios = mergeProfiles(base.ios, update.ios);
  }
  return result;
}

/** Профиль сборки с уже применённой цепочкой `extends`. */
function resolveBuildProfile(easJson, name, depth = 0) {
  const profiles = (easJson && easJson.build) || {};
  const profile = profiles[name];
  if (!profile) {
    throw new Error(`eas.json: профиля сборки "${name}" нет`);
  }
  if (depth > MAX_EXTENDS_DEPTH) {
    throw new Error(`eas.json: цепочка extends у "${name}" слишком длинная или зациклена`);
  }
  const { extends: baseName, ...rest } = profile;
  if (!baseName) {
    return rest;
  }
  return mergeProfiles(resolveBuildProfile(easJson, baseName, depth + 1), rest);
}

function environmentOf(apiUrl) {
  for (const [id, env] of Object.entries(ENVIRONMENTS)) {
    if (env.apiUrl === apiUrl) {
      return id;
    }
  }
  return undefined;
}

/** Строка для сводной таблицы: что на самом деле соберёт профиль. */
function describeProfile(name, resolved) {
  const env = resolved.env || {};
  return {
    name,
    channel: resolved.channel || "-",
    target: env.BOOKEAT_TARGET === "main" ? "main" : "beta",
    apiUrl: env.EXPO_PUBLIC_API_URL || "(не задан → мок-репозиторий)",
    environment: environmentOf(env.EXPO_PUBLIC_API_URL) || "-",
  };
}

/**
 * Проверка одного разрешённого профиля. Возвращает список нарушений
 * {rule, profile, message}; пустой список — профиль честный.
 */
function checkResolvedProfile(name, resolved) {
  const errors = [];
  const fail = (rule, message) => errors.push({ rule, profile: name, message });

  const env = resolved.env || {};
  const isMain = env.BOOKEAT_TARGET === "main";
  const isRelease = resolved.channel === RELEASE_CHANNEL;
  const apiUrl = env.EXPO_PUBLIC_API_URL;
  const apiEnv = environmentOf(apiUrl);
  const amplitude = env.EXPO_PUBLIC_AMPLITUDE_API_KEY;

  if (name.startsWith(MAIN_NAME_PREFIX) && !isMain) {
    fail(
      "PRODUCTION_NAME_REQUIRES_MAIN_TARGET",
      `имя начинается с "${MAIN_NAME_PREFIX}", но BOOKEAT_TARGET не "main": это сборка беты под боевым именем`,
    );
  }
  if (isMain && !name.startsWith(MAIN_NAME_PREFIX)) {
    fail(
      "MAIN_TARGET_REQUIRES_PRODUCTION_NAME",
      `BOOKEAT_TARGET=main, а имя не начинается с "${MAIN_NAME_PREFIX}": боевая сборка под чужим именем`,
    );
  }
  if (isRelease && !apiUrl) {
    fail(
      "RELEASE_REQUIRES_EXPLICIT_API_URL",
      `канал "${RELEASE_CHANNEL}" без EXPO_PUBLIC_API_URL: приложение уедет в магазин на мок-репозитории`,
    );
  }
  if (apiUrl && !apiEnv) {
    fail(
      "UNKNOWN_API_URL",
      `EXPO_PUBLIC_API_URL="${apiUrl}" не совпадает ни с одним известным окружением (${Object.keys(ENVIRONMENTS).join(", ")})`,
    );
  }
  if (isMain) {
    if (apiEnv !== "main") {
      fail(
        "MAIN_TARGET_REQUIRES_MAIN_API",
        `основное приложение (BOOKEAT_TARGET=main) обязано ходить на ${ENVIRONMENTS.main.apiUrl}, задано: ${apiUrl || "(ничего)"}`,
      );
    }
    if (amplitude !== ENVIRONMENTS.main.amplitudeKey) {
      fail(
        "MAIN_TARGET_REQUIRES_MAIN_AMPLITUDE",
        "основное приложение обязано слать аналитику в боевой проект Amplitude",
      );
    }
    if (env.EXPO_PUBLIC_OTP_DELIVERY_DISABLED === "1") {
      fail(
        "MAIN_TARGET_FORBIDS_OTP_STUB",
        "EXPO_PUBLIC_OTP_DELIVERY_DISABLED=1 у основного приложения: гости увидят «код не придёт»",
      );
    }
  } else {
    if (apiEnv === "main") {
      fail(
        "BETA_FORBIDS_MAIN_API",
        "бета/предпросмотр ходит на БОЕВОЙ бэкенд: тестовые брони попадут живым заведениям (правило от 03.09.2026: бета смотрит на тест)",
      );
    }
    if (amplitude === ENVIRONMENTS.main.amplitudeKey) {
      fail("BETA_FORBIDS_MAIN_AMPLITUDE", "бета шлёт аналитику в боевой проект Amplitude");
    }
  }
  if (env.BOOKEAT_RUNTIME_VERSION !== undefined) {
    fail(
      "BUILD_FORBIDS_RUNTIME_VERSION_OVERRIDE",
      "BOOKEAT_RUNTIME_VERSION задан в профиле сборки: он только для `eas update` (см. app.config.js)",
    );
  }
  return errors;
}

/** Проверка всего eas.json: каждый профиль сборки и секция submit. */
function checkEasJson(easJson) {
  const errors = [];
  const build = (easJson && easJson.build) || {};
  for (const name of Object.keys(build)) {
    let resolved;
    try {
      resolved = resolveBuildProfile(easJson, name);
    } catch (error) {
      errors.push({ rule: "UNRESOLVABLE_PROFILE", profile: name, message: error.message });
      continue;
    }
    errors.push(...checkResolvedProfile(name, resolved));
  }
  const submit = (easJson && easJson.submit) || {};
  for (const name of Object.keys(submit)) {
    if (!build[name]) {
      errors.push({
        rule: "SUBMIT_PROFILE_WITHOUT_BUILD_PROFILE",
        profile: name,
        message: "профиль submit без одноимённого профиля build: непонятно, чей бинарь он отправляет",
      });
    }
  }
  return errors;
}

/**
 * Проверка на сборщике EAS: то, что реально лежит в окружении сборки, обязано
 * совпадать с eas.json (EAS_BUILD_PROFILE говорит, какой профиль собирается)
 * и проходить те же правила. Ловит переопределения из панели EAS и правки
 * eas.json, которые не прошли через файл.
 */
function checkBuilderEnv(easJson, env) {
  const name = env.EAS_BUILD_PROFILE;
  if (!name) {
    return [
      {
        rule: "BUILDER_WITHOUT_PROFILE_NAME",
        profile: "?",
        message: "на сборщике нет EAS_BUILD_PROFILE — непонятно, какой профиль проверять",
      },
    ];
  }
  let resolved;
  try {
    resolved = resolveBuildProfile(easJson, name);
  } catch (error) {
    return [{ rule: "UNRESOLVABLE_PROFILE", profile: name, message: error.message }];
  }
  const errors = [];
  const expected = resolved.env || {};
  for (const key of Object.keys(expected)) {
    if (env[key] !== expected[key]) {
      // Значения печатаем только для известных публичных переменных.
      const detail = ENV_KEYS.includes(key)
        ? `eas.json = "${expected[key]}", сборщик = "${env[key]}"`
        : "значения различаются";
      errors.push({
        rule: "BUILDER_ENV_DIFFERS_FROM_EAS_JSON",
        profile: name,
        message: `${key}: ${detail}`,
      });
    }
  }
  const live = {};
  for (const key of ENV_KEYS) {
    if (env[key] !== undefined) {
      live[key] = env[key];
    }
  }
  errors.push(...checkResolvedProfile(name, { ...resolved, env: live }));
  return errors;
}

module.exports = {
  ENVIRONMENTS,
  ENV_KEYS,
  RELEASE_CHANNEL,
  MAIN_NAME_PREFIX,
  resolveBuildProfile,
  describeProfile,
  checkResolvedProfile,
  checkEasJson,
  checkBuilderEnv,
};

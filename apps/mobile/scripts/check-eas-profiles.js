#!/usr/bin/env node
/* eslint-env node */
"use strict";

/**
 * Проверка профилей eas.json. Правила и почему они такие — в ./eas-profiles.js.
 *
 * Где запускается:
 *   - `pnpm run check:eas` (корневой package.json) — шаг CI и часть
 *     `pnpm run check`. Скрипт нарочно НЕ в apps/mobile/package.json: его
 *     `scripts` входят в отпечаток runtimeVersion (см. app.config.js).
 *   - scripts/__tests__/eas-profiles.test.ts — те же правила под vitest.
 *   - На сборщике EAS те же правила применяет app.config.js (там есть
 *     EAS_BUILD_PROFILE и env профиля, сверяется реальное окружение сборки).
 *     Этот скрипт с EAS_BUILD_PROFILE в окружении делает ту же сверку —
 *     удобно для локальной имитации сборщика.
 *
 * Код выхода 1 при любом нарушении.
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  checkBuilderEnv,
  checkEasJson,
  describeProfile,
  resolveBuildProfile,
} = require("./eas-profiles");

const easJsonPath = path.join(__dirname, "..", "eas.json");
const easJson = JSON.parse(fs.readFileSync(easJsonPath, "utf8"));

const rows = Object.keys(easJson.build || {}).map((name) => {
  try {
    return describeProfile(name, resolveBuildProfile(easJson, name));
  } catch (error) {
    return { name, channel: "?", target: "?", apiUrl: `ошибка: ${error.message}`, environment: "?" };
  }
});

const width = (key) => Math.max(key.length, ...rows.map((row) => String(row[key]).length));
const columns = ["name", "channel", "target", "environment", "apiUrl"];
const line = (row) => columns.map((key) => String(row[key]).padEnd(width(key))).join("  ");

console.log(`eas.json: ${easJsonPath}`);
console.log(line(Object.fromEntries(columns.map((key) => [key, key]))));
for (const row of rows) {
  console.log(line(row));
}

const onBuilder = process.env.EAS_BUILD === "true" || Boolean(process.env.EAS_BUILD_PROFILE);
const errors = [
  ...checkEasJson(easJson),
  ...(onBuilder ? checkBuilderEnv(easJson, process.env) : []),
];

if (onBuilder) {
  console.log(
    `сборщик EAS: профиль ${process.env.EAS_BUILD_PROFILE || "?"}, платформа ${process.env.EAS_BUILD_PLATFORM || "?"} — окружение сборки сверено с eas.json`,
  );
}

if (errors.length === 0) {
  console.log("eas.json: все профили честные, ошибок нет");
  process.exit(0);
}

console.error("");
console.error(`eas.json: ${errors.length} нарушение(й), сборка остановлена:`);
for (const error of errors) {
  console.error(`  [${error.rule}] ${error.profile}: ${error.message}`);
}
process.exit(1);

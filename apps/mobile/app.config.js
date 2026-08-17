/**
 * Один код — два приложения в App Store.
 *
 * BookEat Beta (com.bookeatteam.bookeatapp) — то, что мы собираем каждый день.
 * BookEat (com.bookeat.app) — приложение, которое уже стоит у живых людей;
 * раньше в нём была старая система на Supabase, и подмена его начинки — это и
 * есть настоящий переезд.
 *
 * Второй вариант включается переменной BOOKEAT_TARGET=main. Ничего, кроме
 * идентификатора и версии, при этом не меняется: сервер, экраны и логика те же,
 * иначе «проверили на бете, выпустили основное» ничего бы не значило.
 */
const config = require("./app.json").expo;

const MAIN = process.env.BOOKEAT_TARGET === "main";

module.exports = () => {
  if (!MAIN) return config;

  return {
    ...config,
    // Версия обязана быть выше той, что уже лежит в App Store (1.4), иначе
    // Apple не примет сборку.
    version: "1.5",
    ios: {
      ...config.ios,
      bundleIdentifier: "com.bookeat.app",
      buildNumber: "1",
    },
    android: {
      ...config.android,
      package: "com.bookeat.app",
    },
  };
};

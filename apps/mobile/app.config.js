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
      // Второй заход на ту же версию 1.5: первая сборка ушла в TestFlight без
      // логотипа (её собрали за несколько часов до того, как значок лёг в код),
      // а Apple не принимает второй бинарник с тем же номером.
      buildNumber: "2",
    },
    android: {
      ...config.android,
      package: "com.bookeat.app",
    },
  };
};

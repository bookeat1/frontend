/**
 * Настройки отпечатка нативной части (@expo/fingerprint).
 *
 * runtimeVersion у нас считается политикой "fingerprint" (app.json): Expo
 * хеширует всё, что влияет на нативный рантайм — зависимости с нативным кодом,
 * config-плагины, права, иконки, google-services.json, app config. Новый
 * рантайм появляется ровно тогда, когда нативная часть действительно поменялась,
 * то есть когда обновление по воздуху и правда нельзя доставить в старый бинарь.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ. По умолчанию в отпечаток попадают и номера версий
 * (`version`, `ios.buildNumber`, `android.versionCode`) — см.
 * node_modules/@expo/fingerprint/build/sourcer/Expo.js, normalizeExpoConfig().
 * Тогда поднятие 1.5.1 -> 1.6 снова резало бы живым пользователям обновления,
 * а именно от этого мы и уходим: номер версии на нативный рантайм не влияет.
 * SourceSkips.ExpoConfigVersions выкидывает эти три поля из хеша.
 *
 * Значения задаются именами из перечисления SourceSkips
 * (@expo/fingerprint/build/sourcer/SourceSkips.js), библиотека сама сводит их
 * в битовую маску. Осторожно: этот список ЗАМЕНЯЕТ значение по умолчанию
 * (PackageJsonAndroidAndIosScriptsIfNotContainRun), поэтому его тоже
 * перечисляем явно — иначе отпечаток начал бы разъезжаться до и после prebuild.
 *
 * Файл читается и локально (`eas update`, `npx expo-updates
 * runtimeversion:resolve`), и на сборщике EAS — он лежит в репозитории.
 * Менять его — значит менять рантайм у ВСЕХ будущих сборок, поэтому трогать
 * только осознанно.
 *
 * Документация: https://docs.expo.dev/versions/latest/sdk/fingerprint/
 */
module.exports = {
  sourceSkips: [
    "ExpoConfigVersions",
    "PackageJsonAndroidAndIosScriptsIfNotContainRun",
  ],
  /**
   * ПОЧЕМУ ЗДЕСЬ СТРАЖ ПРОФИЛЕЙ.
   *
   * `app.config.js` подключает `scripts/eas-profiles.js` УСЛОВНО — только когда
   * выставлен `EAS_BUILD`/`EAS_BUILD_PROFILE`, то есть только на сборщике EAS.
   * @expo/fingerprint перехватывает `require` во время вычисления app config и
   * записывает каждый подключённый локальный файл как источник отпечатка
   * (`reasons: ["expoConfigPlugins"]`, см. build/ExpoConfigLoader.js). Из-за
   * условия файл попадал в отпечаток на сборщике и НЕ попадал на нашей машине:
   *
   *   local: 479c27f2…   EAS: bfbccdd1…      → сборки 09.09.2026 упали на фазе
   *   CONFIGURE_EXPO_UPDATES ("Runtime version mismatch", Android 8d4c083c,
   *   iOS a4a62af6), в диффе ровно одна добавленная запись — этот файл.
   *
   * `ignorePaths` из этого файла ExpoConfigLoader применяет к списку
   * подключённых модулей, поэтому запись ниже убирает источник с ОБЕИХ сторон
   * и отпечатки снова сходятся. Локальный отпечаток при этом не меняется
   * (у нас файл в источники и не попадал) — уже выпущенные бинари и их OTA не
   * затронуты.
   *
   * Семантически это верно: страж — проверка окружения сборки, он не влияет ни
   * на один байт нативной части. Если когда-нибудь `require` станет
   * безусловным, эту строку надо убрать вместе с условием.
   */
  ignorePaths: ["scripts/eas-profiles.js"],
};

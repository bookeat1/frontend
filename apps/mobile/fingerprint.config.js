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
};

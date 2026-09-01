/* eslint-env node */
/**
 * Правила Android Auto Backup: чистая часть, без Expo и без файловой системы.
 * Вынесена отдельно, чтобы её можно было проверить тестом, не поднимая prebuild.
 *
 * ЗАЧЕМ ЭТО ВООБЩЕ ЕСТЬ.
 * Android при переустановке приложения на том же устройстве возвращает данные
 * из облачного бэкапа. Среди них — то, чем приложение доказывает FCM свою
 * личность: кэш регистрации `shared_prefs/com.google.android.gms.appid.xml`
 * и идентификатор установки Firebase (FID) в `files/PersistedInstallation.*.json`.
 * Восстановленный FID означает, что старый и новый экземпляры приложения
 * считаются ОДНИМ, а FCM держит один токен на FID — второй экземпляр остаётся
 * с мёртвым токеном и пуши молча не доходят. Firebase прямо просит исключить
 * эти данные из бэкапа:
 * https://firebase.google.com/docs/cloud-messaging/troubleshooting
 *
 * ГРАБЛИ, из-за которых имена написаны именно так.
 * 1. `path` НЕ поддерживает шаблоны и сравнивается на точное совпадение пути
 *    (AOSP `BackupAgent.manifestExcludesContainFilePath` — `excludePath.equals(filePath)`),
 *    поэтому имя файла нужно полное, вместе с расширением, а имя FID-файла
 *    приходится вычислять, а не подставлять звёздочку.
 * 2. Имя FID-файла = `PersistedInstallation.` + `FirebaseApp.getPersistenceKey()` + `.json`,
 *    где ключ — это base64url без выравнивания от имени приложения Firebase
 *    (`[DEFAULT]`) и от `mobilesdk_app_id`. Проверено по исходникам
 *    firebase-common 22.0.1 (`FirebaseApp.getPersistenceKey`) и по байткоду
 *    firebase-installations 18.0.0 (`PersistedInstallation`), который в этой
 *    версии кладёт файл в `getFilesDir()`, то есть под бэкап.
 * 3. Правил ДВА: `full-backup-content` для Android 11 и ниже и
 *    `data-extraction-rules` для Android 12 и выше. На 12+ старый файл не
 *    читается вовсе, поэтому одного мало.
 */

/** Имя приложения Firebase по умолчанию (`FirebaseApp.DEFAULT_APP_NAME`). */
const DEFAULT_FIREBASE_APP_NAME = "[DEFAULT]";

/** `com.google.android.gms.common.util.Base64Utils.encodeUrlSafeNoPadding`. */
function base64UrlNoPadding(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Имя файла Firebase Installations для конкретного mobilesdk_app_id.
 * @param {string} mobilesdkAppId например `1:811053965921:android:8727a96a21f3bf6fee0020`
 * @returns {string}
 */
function firebaseInstallationsFileName(mobilesdkAppId) {
  const persistenceKey =
    base64UrlNoPadding(DEFAULT_FIREBASE_APP_NAME) + "+" + base64UrlNoPadding(mobilesdkAppId);
  return `PersistedInstallation.${persistenceKey}.json`;
}

/**
 * Достаёт mobilesdk_app_id для нужного имени пакета из разобранного
 * google-services.json. В нашем файле лежат оба приложения — бета и релиз, —
 * поэтому выбор по пакету обязателен.
 * @param {unknown} googleServices
 * @param {string} packageName
 * @returns {string | null} null, если такого пакета в файле нет
 */
function findMobilesdkAppId(googleServices, packageName) {
  const clients =
    googleServices && typeof googleServices === "object" && Array.isArray(googleServices.client)
      ? googleServices.client
      : [];
  for (const client of clients) {
    const info = client && client.client_info;
    const android = info && info.android_client_info;
    if (android && android.package_name === packageName && typeof info.mobilesdk_app_id === "string") {
      return info.mobilesdk_app_id;
    }
  }
  return null;
}

/**
 * Что исключаем. Порядок здесь и есть порядок строк в обоих xml.
 * @param {string | null} installationsFileName
 * @returns {{ domain: string, path: string, why: string }[]}
 */
function backupExclusions(installationsFileName) {
  const exclusions = [
    // Оставляем правило expo-secure-store как есть, чтобы наш файл не был
    // ухудшением по сравнению с тем, что плагин ставил до нас.
    { domain: "sharedpref", path: "SecureStore", why: "правило expo-secure-store, сохранено дословно" },
    // ...и добавляем то же имя с расширением: настоящий файл настроек
    // называется SecureStore.xml, а сравнение точное, без шаблонов.
    { domain: "sharedpref", path: "SecureStore.xml", why: "то же хранилище, реальное имя файла" },
    { domain: "sharedpref", path: "com.google.android.gms.appid.xml", why: "кэш регистрации FCM" },
  ];
  if (installationsFileName) {
    exclusions.push({
      domain: "file",
      path: installationsFileName,
      why: "идентификатор установки Firebase (FID)",
    });
  }
  return exclusions;
}

function renderExcludes(exclusions, indent) {
  return exclusions
    .map((rule) => `${indent}<!-- ${rule.why} -->\n${indent}<exclude domain="${rule.domain}" path="${rule.path}"/>`)
    .join("\n");
}

const GENERATED_BY = "apps/mobile/plugins/withAndroidBackupRules.js";

/**
 * Правила для Android 11 и ниже (`android:fullBackupContent`).
 * @param {string | null} installationsFileName
 */
function buildFullBackupContentXml(installationsFileName) {
  const exclusions = backupExclusions(installationsFileName);
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Создан ${GENERATED_BY}. Править здесь бесполезно: файл перезаписывается на каждом prebuild. -->
<!-- Auto Backup для Android 11 и ниже. -->
<full-backup-content>
  <include domain="sharedpref" path="."/>
${renderExcludes(exclusions, "  ")}
</full-backup-content>
`;
}

/**
 * Правила для Android 12 и выше (`android:dataExtractionRules`).
 * Исключения повторяются и для облачного бэкапа, и для переноса на другое
 * устройство: при переносе старый экземпляр остаётся жив, и разделённый FID
 * ломает пуши ровно так же.
 * @param {string | null} installationsFileName
 */
function buildDataExtractionRulesXml(installationsFileName) {
  const exclusions = backupExclusions(installationsFileName);
  const body = `    <include domain="sharedpref" path="."/>
${renderExcludes(exclusions, "    ")}`;
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Создан ${GENERATED_BY}. Править здесь бесполезно: файл перезаписывается на каждом prebuild. -->
<!-- Auto Backup и Data Transfer для Android 12 и выше. -->
<data-extraction-rules>
  <cloud-backup>
${body}
  </cloud-backup>
  <device-transfer>
${body}
  </device-transfer>
</data-extraction-rules>
`;
}

module.exports = {
  DEFAULT_FIREBASE_APP_NAME,
  base64UrlNoPadding,
  firebaseInstallationsFileName,
  findMobilesdkAppId,
  backupExclusions,
  buildFullBackupContentXml,
  buildDataExtractionRulesXml,
};

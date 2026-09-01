/* eslint-env node */
/**
 * Config-плагин: собственные правила Android Auto Backup.
 *
 * ПОЧЕМУ СВОЙ ФАЙЛ, А НЕ ПРАВКА ЧУЖОГО.
 * Правила, которые ставит expo-secure-store, лежат внутри его android-модуля
 * (`node_modules/expo-secure-store/android/src/main/res/xml/…`) — это ресурсы
 * библиотеки, их нельзя дополнить из приложения, не переопределив целиком.
 * Поэтому мы объявляем СВОЙ ресурс и переводим манифест на него, а исключение
 * SecureStore переносим к себе дословно (см. `backupExclusions`), чтобы ничего
 * не потерять.
 *
 * ПОРЯДОК В app.json: этот плагин обязан стоять ДО "expo-secure-store", хотя
 * применяется ПОСЛЕ него. Моды у Expo — луковица: `withBaseMod` подставляет
 * ранее зарегистрированный мод как `nextMod`, поэтому зарегистрированный
 * последним выполняется первым (`@expo/config-plugins/build/plugins/withMod.js`).
 * Если поставить нас после secure-store, мы отработаем раньше него, и он
 * напечатает на каждом prebuild: «tried to apply Android Auto Backup rules,
 * but other backup rules are already present» — проверено на этом проекте.
 *
 * ПОЧЕМУ НЕ allowBackup=false.
 * Полное выключение бэкапа убило бы и то, что переносится законно; мешает
 * ровно один класс данных — идентификаторы регистрации в FCM.
 *
 * Оба атрибута обязательны: `android:fullBackupContent` читает Android 11 и
 * ниже, `android:dataExtractionRules` — Android 12 и выше.
 */
const fs = require("fs");
const path = require("path");
const { AndroidConfig, createRunOncePlugin, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const {
  buildDataExtractionRulesXml,
  buildFullBackupContentXml,
  findMobilesdkAppId,
  firebaseInstallationsFileName,
} = require("./android-backup-rules");

const BACKUP_RULES_RESOURCE = "bookeat_backup_rules";
const DATA_EXTRACTION_RULES_RESOURCE = "bookeat_data_extraction_rules";

/**
 * Имя файла Firebase Installations для СОБИРАЕМОГО сейчас пакета.
 * У беты (BOOKEAT_TARGET не задан) google-services.json не подключён — тогда
 * исключать нечего, и остаются только правила по shared_prefs.
 */
function resolveInstallationsFileName(config, projectRoot) {
  const googleServicesFile = config.android && config.android.googleServicesFile;
  const packageName = config.android && config.android.package;
  if (!googleServicesFile || !packageName) return null;

  const absolutePath = path.resolve(projectRoot, googleServicesFile);
  if (!fs.existsSync(absolutePath)) return null;

  let googleServices;
  try {
    googleServices = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`withAndroidBackupRules: не разобрать ${absolutePath}: ${error.message}`);
  }

  const mobilesdkAppId = findMobilesdkAppId(googleServices, packageName);
  if (!mobilesdkAppId) {
    // Молчать нельзя: правило не появится, а пуши после переустановки снова
    // будут зависеть от везения.
    console.warn(
      `withAndroidBackupRules: в ${googleServicesFile} нет клиента для пакета ${packageName}; ` +
        "идентификатор установки Firebase останется в бэкапе.",
    );
    return null;
  }
  return firebaseInstallationsFileName(mobilesdkAppId);
}

const withAndroidBackupRules = (config) => {
  config = withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    mainApplication.$["android:fullBackupContent"] = `@xml/${BACKUP_RULES_RESOURCE}`;
    mainApplication.$["android:dataExtractionRules"] = `@xml/${DATA_EXTRACTION_RULES_RESOURCE}`;
    return config;
  });

  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const installationsFileName = resolveInstallationsFileName(config, config.modRequest.projectRoot);
      const xmlDirectory = path.join(config.modRequest.platformProjectRoot, "app", "src", "main", "res", "xml");

      await fs.promises.mkdir(xmlDirectory, { recursive: true });
      await fs.promises.writeFile(
        path.join(xmlDirectory, `${BACKUP_RULES_RESOURCE}.xml`),
        buildFullBackupContentXml(installationsFileName),
        "utf8",
      );
      await fs.promises.writeFile(
        path.join(xmlDirectory, `${DATA_EXTRACTION_RULES_RESOURCE}.xml`),
        buildDataExtractionRulesXml(installationsFileName),
        "utf8",
      );
      return config;
    },
  ]);

  return config;
};

module.exports = createRunOncePlugin(withAndroidBackupRules, "bookeat-android-backup-rules", "1.0.0");
module.exports.BACKUP_RULES_RESOURCE = BACKUP_RULES_RESOURCE;
module.exports.DATA_EXTRACTION_RULES_RESOURCE = DATA_EXTRACTION_RULES_RESOURCE;

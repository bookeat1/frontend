import { describe, expect, it } from "vitest";

import googleServices from "../../google-services.json";

import {
  assertExcludesAreInIncludedPaths,
  backupExclusions,
  backupIncludes,
  buildDataExtractionRulesXml,
  buildFullBackupContentXml,
  findMobilesdkAppId,
  firebaseInstallationsFileName,
} from "../android-backup-rules";

/**
 * Баг, который ловят эти проверки: при переустановке из Google Play Android
 * возвращал приложению кэш регистрации FCM и идентификатор установки Firebase,
 * приложение считало себя зарегистрированным и пуши молча не доходили
 * (боевые квитанции Expo от 2026-09-01: DeviceNotRegistered на устройстве
 * после переустановки, доставка ok на устройстве после стирания данных).
 *
 * Проверяем ГРАНИЦУ: что исключения дословно попали в ОБА файла правил —
 * и в старый full-backup-content, и в data-extraction-rules для Android 12+,
 * — и что исключение SecureStore при этом не потерялось.
 */

const PROD_APP_ID = "1:811053965921:android:8727a96a21f3bf6fee0020";
const PROD_INSTALLATIONS_FILE =
  "PersistedInstallation.W0RFRkFVTFRd+MTo4MTEwNTM5NjU5MjE6YW5kcm9pZDo4NzI3YTk2YTIxZjNiZjZmZWUwMDIw.json";

describe("firebaseInstallationsFileName", () => {
  it("собирает имя файла из base64url без выравнивания, как FirebaseApp.getPersistenceKey", () => {
    expect(firebaseInstallationsFileName(PROD_APP_ID)).toBe(PROD_INSTALLATIONS_FILE);
  });

  it("не оставляет ни '=' выравнивания, ни символов обычного base64", () => {
    const name = firebaseInstallationsFileName("1:1:android:ff/ff+ff?ff");
    expect(name).not.toContain("=");
    expect(name.replace("PersistedInstallation.", "").replace(".json", "")).toMatch(/^[A-Za-z0-9_-]+\+[A-Za-z0-9_-]+$/);
  });
});

describe("findMobilesdkAppId", () => {
  it("выбирает клиента боевого пакета, а не первого попавшегося", () => {
    expect(findMobilesdkAppId(googleServices, "kz.bookeat.app")).toBe(PROD_APP_ID);
  });

  it("не путает боевой пакет с бетой", () => {
    expect(findMobilesdkAppId(googleServices, "com.bookeatteam.bookeatapp")).not.toBe(PROD_APP_ID);
  });

  it("возвращает null, если такого пакета в файле нет", () => {
    expect(findMobilesdkAppId(googleServices, "com.example.absent")).toBeNull();
  });

  it("не падает на мусоре вместо файла", () => {
    expect(findMobilesdkAppId(null, "kz.bookeat.app")).toBeNull();
    expect(findMobilesdkAppId({}, "kz.bookeat.app")).toBeNull();
  });
});

describe("правила бэкапа", () => {
  const legacy = buildFullBackupContentXml(PROD_INSTALLATIONS_FILE);
  const modern = buildDataExtractionRulesXml(PROD_INSTALLATIONS_FILE);

  it("старый файл объявлен как full-backup-content", () => {
    expect(legacy).toContain("<full-backup-content>");
  });

  it("новый файл объявлен как data-extraction-rules и покрывает оба сценария", () => {
    expect(modern).toContain("<data-extraction-rules>");
    expect(modern).toContain("<cloud-backup>");
    expect(modern).toContain("<device-transfer>");
  });

  it("исключение SecureStore не потерялось ни в одном из файлов", () => {
    for (const xml of [legacy, modern]) {
      expect(xml).toContain('<exclude domain="sharedpref" path="SecureStore"/>');
      expect(xml).toContain('<exclude domain="sharedpref" path="SecureStore.xml"/>');
    }
  });

  it("кэш регистрации FCM исключён в обоих файлах", () => {
    for (const xml of [legacy, modern]) {
      expect(xml).toContain('<exclude domain="sharedpref" path="com.google.android.gms.appid.xml"/>');
    }
  });

  /**
   * Регрессия EAS-сборки 56140de2 (versionCode 103, 2026-09-01):
   * `<exclude domain="file" .../>` при белом списке из одного sharedpref —
   * фатальная ошибка android lint «is not in an included path», задача
   * `:app:lintVitalRelease` роняла релиз через 20 минут платной сборки.
   */
  it("не исключает домены вне белого списка: домен file и так не бэкапится", () => {
    for (const xml of [legacy, modern]) {
      expect(xml).not.toContain('domain="file"');
    }
  });

  it("в data-extraction-rules исключения стоят и в облачном бэкапе, и в переносе на другое устройство", () => {
    const cloud = modern.slice(modern.indexOf("<cloud-backup>"), modern.indexOf("</cloud-backup>"));
    const transfer = modern.slice(modern.indexOf("<device-transfer>"), modern.indexOf("</device-transfer>"));
    for (const section of [cloud, transfer]) {
      expect(section).toContain('path="com.google.android.gms.appid.xml"');
      expect(section).toContain('path="SecureStore.xml"');
      expect(section).toContain('<include domain="sharedpref" path="."/>');
    }
  });

  it("shared_prefs по-прежнему бэкапятся целиком, кроме перечисленного", () => {
    for (const xml of [legacy, modern]) {
      expect(xml).toContain('<include domain="sharedpref" path="."/>');
    }
  });

  it("без google-services.json остаются только правила по shared_prefs, файл не исключается вслепую", () => {
    for (const xml of [buildFullBackupContentXml(null), buildDataExtractionRulesXml(null)]) {
      expect(xml).not.toContain('domain="file"');
      expect(xml).toContain('<exclude domain="sharedpref" path="com.google.android.gms.appid.xml"/>');
      expect(xml).toContain('<exclude domain="sharedpref" path="SecureStore"/>');
    }
  });
});

/**
 * Повторяет проверку android lint `FullBackupContentDetector.checkSection`.
 * Она стоит здесь, а не «где-нибудь потом», потому что нарушение этой проверки
 * стоит двадцати минут платной сборки на EAS и обнаруживается только там:
 * локальный `expo prebuild` xml пишет, а lint не запускает.
 */
describe("assertExcludesAreInIncludedPaths", () => {
  it("ловит исключение в домене, у которого нет ни одного include", () => {
    expect(() =>
      assertExcludesAreInIncludedPaths(
        [{ domain: "sharedpref", path: "." }],
        [{ domain: "file", path: "PersistedInstallation.x.json" }],
      ),
    ).toThrow(/не покрыт ни одним <include>/);
  });

  it("пропускает исключение, если домен есть в белом списке", () => {
    expect(() =>
      assertExcludesAreInIncludedPaths(
        [
          { domain: "sharedpref", path: "." },
          { domain: "file", path: "." },
        ],
        [{ domain: "file", path: "PersistedInstallation.x.json" }],
      ),
    ).not.toThrow();
  });

  it("без единого include не проверяет ничего: бэкапится всё минус исключения", () => {
    expect(() =>
      assertExcludesAreInIncludedPaths([], [{ domain: "file", path: "PersistedInstallation.x.json" }]),
    ).not.toThrow();
  });
});

describe("backupExclusions", () => {
  it("отбрасывает исключение FID, пока домен file вне белого списка", () => {
    const rules = backupExclusions(PROD_INSTALLATIONS_FILE, backupIncludes());
    expect(rules.some((rule) => rule.domain === "file")).toBe(false);
    expect(rules.map((rule) => rule.path)).toContain("com.google.android.gms.appid.xml");
  });

  it("возвращает исключение FID сразу, как только домен file попадёт в белый список", () => {
    const rules = backupExclusions(PROD_INSTALLATIONS_FILE, [
      { domain: "sharedpref", path: "." },
      { domain: "file", path: "." },
    ]);
    expect(rules).toContainEqual(
      expect.objectContaining({ domain: "file", path: PROD_INSTALLATIONS_FILE }),
    );
  });
});

describe("сгенерированный xml валиден по правилам lint", () => {
  const parseRules = (xml: string) =>
    [...xml.matchAll(/<(include|exclude) domain="([^"]+)" path="([^"]+)"\/>/g)].map((match) => ({
      tag: match[1],
      domain: match[2],
      path: match[3],
    }));

  it("каждый exclude в каждом файле покрыт include своего домена", () => {
    for (const xml of [
      buildFullBackupContentXml(PROD_INSTALLATIONS_FILE),
      buildDataExtractionRulesXml(PROD_INSTALLATIONS_FILE),
      buildFullBackupContentXml(null),
      buildDataExtractionRulesXml(null),
    ]) {
      const rules = parseRules(xml);
      const includes = rules.filter((rule) => rule.tag === "include");
      const excludes = rules.filter((rule) => rule.tag === "exclude");
      expect(excludes.length).toBeGreaterThan(0);
      for (const exclude of excludes) {
        expect(
          includes.some(
            (include) => include.domain === exclude.domain && (include.path === "." || exclude.path.startsWith(include.path)),
          ),
        ).toBe(true);
      }
    }
  });

  it("ни один комментарий не содержит '--': такой xml не собрал бы уже aapt2", () => {
    for (const xml of [buildFullBackupContentXml(PROD_INSTALLATIONS_FILE), buildDataExtractionRulesXml(PROD_INSTALLATIONS_FILE)]) {
      for (const comment of xml.match(/<!--[\s\S]*?-->/g) ?? []) {
        expect(comment.slice(4, -3)).not.toContain("--");
      }
    }
  });
});

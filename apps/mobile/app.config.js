/**
 * Один код — два приложения в App Store.
 *
 * BookEat Beta (com.bookeatteam.bookeatapp) — то, что мы собираем каждый день.
 * BookEat (com.bookeat.app) — приложение, которое уже стоит у живых людей;
 * раньше в нём была старая система на Supabase, и подмена его начинки — это и
 * есть настоящий переезд.
 *
 * Второй вариант включается переменной BOOKEAT_TARGET=main. Меняются только
 * идентификатор пакета и номер сборки: сервер, экраны, логика и маркетинговая
 * версия у обоих одни и те же, иначе «проверили на бете, выпустили основное»
 * ничего бы не значило.
 */
const config = require("./app.json").expo;

const MAIN = process.env.BOOKEAT_TARGET === "main";

/**
 * Страж профилей сборки (правила — scripts/eas-profiles.js). На сборщике EAS
 * проверяем, что профиль из eas.json честный и что окружение сборки совпадает
 * с файлом: имя `production*` ⇔ BOOKEAT_TARGET=main ⇔ боевой бэкенд, канал
 * `production` только с явным EXPO_PUBLIC_API_URL. Нарушение — исключение,
 * и сборка падает на чтении конфига, до prebuild и до бинаря.
 *
 * Почему здесь, а не в хуке `eas-build-pre-install`: хуки — это `scripts` в
 * package.json, а они входят в отпечаток runtimeVersion (источник
 * `packageJson:scripts` у @expo/fingerprint). Добавление хука сдвинуло бы
 * рантайм ВСЕХ будущих сборок и оторвало OTA от уже выпущенных 105 / iOS 4
 * (проверено 2026-09-07: отпечатки до/после такого хука различаются). В
 * отпечаток попадает только ВЫЧИСЛЕННЫЙ конфиг, а не исходник этого файла,
 * поэтому проверка тут на рантайм не влияет.
 *
 * Локально не срабатывает: у `expo start` и `eas update` нет EAS_BUILD. Файл
 * целиком проверяют `pnpm run check:eas` (шаг CI) и scripts/__tests__.
 */
if (process.env.EAS_BUILD === "true" || process.env.EAS_BUILD_PROFILE) {
  const { checkBuilderEnv, checkEasJson } = require("./scripts/eas-profiles");
  const easJson = require("./eas.json");
  const violations = [...checkEasJson(easJson), ...checkBuilderEnv(easJson, process.env)];
  if (violations.length > 0) {
    throw new Error(
      [
        `eas.json: сборка остановлена стражем профилей (${violations.length}):`,
        ...violations.map((v) => `  [${v.rule}] ${v.profile}: ${v.message}`),
      ].join("\n"),
    );
  }
}

/**
 * ЕДИНСТВЕННОЕ место, где живёт маркетинговая версия. Она одна на оба
 * приложения: это один и тот же продукт, собранный из одного коммита, и
 * «1.5.1 у основного и 1.0.0 у беты» означало только то, что бету забыли
 * поднять. Отличаться у двух сборок должны идентификатор пакета и номер
 * сборки, версия — нет.
 *
 * В app.json поля "version" НЕТ намеренно: пока оно там лежало, версия была
 * задана в двух местах, и app.config.js молча переопределял её только для
 * BOOKEAT_TARGET=main.
 *
 * Как поднимать в следующий раз:
 *  1. Меняем ТОЛЬКО эту строку — обе сборки уезжают с новой версией.
 *  2. Значение обязано быть строго выше последней ВЫПУЩЕННОЙ в App Store
 *     версии, иначе Apple отбивает загрузку (90062 «поезд версии закрыт»).
 *     Занятые версии: uv run --with pyjwt python ~/.bookeat/asc.py \
 *       "/v1/apps/6757542577/appStoreVersions?limit=3"
 *  3. Номера сборок (ios.buildNumber, android.versionCode) при этом НЕ
 *     выравниваем: они считаются отдельно в каждом магазине и у каждого
 *     приложения свои.
 *  4. На доставку обновлений по воздуху смена версии больше не влияет —
 *     runtimeVersion считается по отпечатку нативной части, а версии из
 *     отпечатка исключены (fingerprint.config.js).
 */
// 1.5.1 закрыта: в App Store она READY_FOR_SALE (проверено 2026-09-10 через
// ASC API, /v1/apps/6757542577/appStoreVersions). После выпуска «поезд» версии
// закрывается, и Apple отбивает загрузку любой новой сборки с тем же
// CFBundleShortVersionString (90062). В Google Play 1.5.1 тоже раскатана на
// 100% (versionCode 105, production). Поэтому магазинный релиз 2026-09-10
// уезжает как 1.5.2. На доставку обновлений по воздуху это не влияет: версии
// исключены из отпечатка (fingerprint.config.js).
const APP_VERSION = "1.5.2";

/**
 * Переходный период после перехода на runtimeVersion по отпечатку.
 *
 * У приложений, которые УЖЕ стоят у людей, рантайм остался старым — той
 * маркетинговой версией, с которой их собрали (политика appVersion):
 *   "1.5"   — Android kz.bookeat.app в Google Play (сборки 100…103)
 *             и iOS com.bookeat.app сборки 1–2 в App Store;
 *   "1.5.1" — iOS com.bookeat.app сборка 3 в TestFlight;
 *   "1.0.0" — бета com.bookeatteam.bookeatapp.
 * Отпечатка у них нет и появиться не может: рантайм вшит в бинарь. Пока эти
 * установки живы, обновления для них надо публиковать ПОД ИХ СТАРЫЙ рантайм,
 * а у `eas update` флага --runtime-version нет — значение берётся только из
 * app config. Отсюда эта переменная.
 *
 *   BOOKEAT_RUNTIME_VERSION=1.5 BOOKEAT_TARGET=main eas update --branch production ...
 *
 * Строковый runtimeVersion старше политики: expo-updates возвращает его как
 * есть и отпечаток не считает (см. resolveRuntimeVersionAsync в
 * node_modules/expo-updates/utils/src).
 *
 * ТОЛЬКО ДЛЯ `eas update`. В `eas build` эту переменную не задавать никогда:
 * она вшила бы фиксированный рантайм в новый бинарь и вернула нас к ручному
 * управлению совместимостью. Убрать вместе с этим комментарием, когда старые
 * установки вымрут (проверять по аналитике активных версий).
 */
const RUNTIME_VERSION_OVERRIDE = process.env.BOOKEAT_RUNTIME_VERSION;

const withRuntimeOverride = (expo) =>
  RUNTIME_VERSION_OVERRIDE
    ? { ...expo, runtimeVersion: RUNTIME_VERSION_OVERRIDE }
    : expo;

/**
 * Base path Metro's web export bakes into every asset/script URL (MW-3,
 * ADR-046). Was hardcoded `"/preview"` in `app.json`'s `experiments.baseUrl`
 * — that value is only right for the test slot in Caddy
 * (`deploy/web-test/caddy-web-preview.snippet`, `handle_path /preview*`); a
 * prod slot will sit at a different path (or the domain root, `""`), and
 * without an override the two builds could not diverge without editing code
 * on every deploy.
 *
 * A PLAIN env var, not `EXPO_PUBLIC_BOOKEAT_WEB_BASE_URL`: this is read by
 * Metro/expo-router while `expo export --platform web` runs, i.e. by this
 * config file in Node, never by code shipped into the client bundle — same
 * reasoning as `BOOKEAT_TARGET` / `BOOKEAT_RUNTIME_VERSION` above. Expo's
 * CLI loads `.env`/`.env.local` into `process.env` before evaluating this
 * file regardless of prefix, so it can still be set from a dotenv file, not
 * only the shell.
 */
const WEB_BASE_URL = process.env.BOOKEAT_WEB_BASE_URL ?? "/preview";

const withWebBaseUrl = (expo) => ({
  ...expo,
  experiments: { ...expo.experiments, baseUrl: WEB_BASE_URL },
});

module.exports = () => {
  if (!MAIN) {
    return withWebBaseUrl(
      withRuntimeOverride({
        ...config,
        version: APP_VERSION,
      }),
    );
  }

  return withWebBaseUrl(
    withRuntimeOverride({
      ...config,
      version: APP_VERSION,
      ios: {
        ...config.ios,
        bundleIdentifier: "com.bookeat.app",
        // Apple не принимает второй бинарник с тем же номером, поэтому каждая
        // отправка в TestFlight поднимает это число. 2 — сборка от 18.08.2026,
        // 3 — первая, куда попали правки конца августа и начала сентября:
        // поиск по меню, сетка рубрик, подпись кухни, «Лучшие позиции» только с
        // фото и настоящий тумблер уведомлений.
        // 4 залит в App Store Connect 2026-09-02 (VALID, не expired — проверено
        // 2026-09-10 через ASC API /v1/apps/6757542577/builds). Номер повторно
        // не принимается, поэтому магазинная сборка 2026-09-10 — это 5.
        buildNumber: "5",
      },
      android: {
        ...config.android,
        // В Google Play приложение опубликовано под ИМЕНЕМ ПАКЕТА
        // kz.bookeat.app (проверено 2026-08-21: страница магазина по этому
        // имени открывается, по com.bookeat.app — 404). Имя пакета после
        // публикации сменить нельзя, оно и ЕСТЬ приложение: собери мы AAB под
        // com.bookeat.app, в магазине появилось бы второе приложение вместо
        // обновления, с нулём установок и вторым BookEat в поиске.
        //
        // На iOS идентификатор остаётся com.bookeat.app — там опубликовано
        // именно оно. Две платформы, два разных идентификатора у одного
        // продукта; это нормально и менять iOS нельзя по той же причине.
        package: "kz.bookeat.app",
        // Файл настроек Firebase для ЭТОГО имени пакета. Без него приложение не
        // может зарегистрироваться в сервисе уведомлений: гость видит «не
        // получилось включить», а системный запрос разрешения даже не всплывает
        // (жалоба пользователя Play 2026-08-28). Файл содержит оба наших пакета,
        // бету и релиз, и не является секретом: он и так уезжает внутри сборки.
        // ВАЖНО: подхватывается только при СБОРКЕ, обновлением по воздуху не
        // доставляется.
        googleServicesFile: "./google-services.json",
        // Play принимает только сборку с номером ВЫШЕ уже опубликованной.
        // Номер прошлой сборки в консоли нам не виден, поэтому берётся
        // заведомо больший; уменьшить его потом нельзя, поэтому не «миллион»,
        // а просто с запасом.
        // 100 уехал в Play со сборкой 1.5 от 21.08. Play принимает только
        // строго больший номер, поэтому 101 (2026-08-28, сборка с настройками
        // Firebase для пуш-уведомлений).
        // 102 лежит в production Google Play (проверено 2026-09-01 через
        // Play Developer API, релиз 1.5, статус completed), поэтому следующая
        // сборка обязана быть 103 — с правилами бэкапа, которые больше не
        // возвращают приложению чужой идентификатор регистрации в FCM.
        // 104 уже залит в трек internal (релиз 1.5.1, проверено 2026-09-02
        // через Play Developer API: залитые номера 3,4,5,100,101,102,103,104).
        // Повторно номер использовать нельзя, поэтому следующая сборка — 105.
        // 105 лежит в production Google Play с релизом «1.5.1», статус
        // completed (перепроверено 2026-09-10 через Play Developer API:
        // залитые номера 4,5,100,101,102,103,104,105), поэтому магазинная
        // сборка 2026-09-10 — это 106.
        // 106 залит в трек internal релизом «1.5.2» (проверено 2026-09-12
        // через Play Developer API: залитые номера 4,5,100,102,103,104,105,
        // 106; в production тогда ещё лежал 105). Номер занят навсегда,
        // поэтому магазинная сборка 2026-09-12 — с атрибуцией промо марафона
        // прямо в бинаре, без расчёта на обновление по воздуху — это 107.
        versionCode: 107,
      },
    }),
  );
};

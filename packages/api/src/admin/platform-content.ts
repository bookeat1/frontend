import { RepositoryError } from "../repository";

/**
 * Чистая логика раздела «Контент платформы» — акции и афиши, у которых НЕТ
 * заведения (backend PR #103, migration 0085).
 *
 * Здесь нет ни DOM, ни React: обе функции — это договорённость с бэкендом, и
 * проверять её надо тестом без экрана.
 */

// ---- Кнопка события: проверка внешней ссылки --------------------------------

/**
 * Предел длины ссылки. Ровно тот же, что в домене
 * (`domain.maxEventActionURL` = 2048): число продублировано осознанно —
 * серверу оно нужно как граница хранения, панели как подсказка редактору,
 * и разъехаться они могут только вместе с правкой обеих сторон.
 */
export const MAX_ACTION_URL_LENGTH = 2048;

/**
 * Схемы, которые сервер принимает. АЛЛОУЛИСТ, как и в домене: `javascript:`,
 * `data:`, `intent:` и прочее — это исполнение кода или локальное действие на
 * телефоне гостя, и перечислять их «запрещёнными» — заведомо проигранная игра.
 * `http` рядом с `https` — тоже как на сервере: часть казахстанских
 * билетных партнёров до сих пор публикует ссылки без TLS.
 */
const ALLOWED_ACTION_URL_SCHEMES = new Set(["http:", "https:"]);

/**
 * Чем именно плоха ссылка. Значения ОДИН В ОДИН повторяют случаи
 * `domain.ValidateExternalActionURL`, чтобы редактор увидел причину ДО
 * отправки формы.
 *
 * ЗАЧЕМ ДУБЛИРОВАТЬ СЕРВЕРНУЮ ПРОВЕРКУ. Не ради безопасности — клиенту тут
 * верить нельзя и никто не собирается: сервер проверяет ссылку заново, и его
 * ответ окончателен. Ради ответа на вопрос «что не так»: `response.HandleError`
 * заменяет текст любой `ErrValidation` на общее «validation failed» и не
 * присылает узкого `code`, так что по ответу сервера отличить «схема не та» от
 * «нет хоста» физически невозможно. Пока на бэкенде не появится отдельный код
 * ошибки, единственное место, где панель может назвать причину, — здесь.
 */
export type ActionUrlProblem =
  /** Выбрана внешняя ссылка, а поле пустое. */
  | "empty"
  /** Длиннее MAX_ACTION_URL_LENGTH. */
  | "too_long"
  /** Пробел или управляющий символ внутри — классический способ протащить
   * «java\nscript:» мимо наивной проверки. */
  | "whitespace"
  /** Не разбирается как адрес вообще. */
  | "malformed"
  /** Схема вне аллоулиста, либо её нет совсем («book-eat.com/x»). */
  | "scheme"
  /** Схема есть, хоста нет («https:///x») — открывать нечего. */
  | "no_host"
  /** Логин и пароль внутри адреса — форма фишинга и секрет в поле, которое
   * отдаётся каждому гостю. */
  | "credentials";

/**
 * Проверяет внешнюю ссылку кнопки. Возвращает `null`, когда придраться не к
 * чему, иначе — причину отказа.
 */
export function validateActionUrl(raw: string): ActionUrlProblem | null {
  const value = raw.trim();
  if (value === "") return "empty";
  if (value.length > MAX_ACTION_URL_LENGTH) return "too_long";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f || char === " ") return "whitespace";
  }

  // Схема и authority разбираются ВРУЧНУЮ, а не через `new URL`, и это не
  // самодеятельность: WHATWG-разбор в браузере ПОЧИНИЛ БЫ то, что сервер
  // отвергает. `new URL("https:///x")` возвращает host "x" — то есть панель
  // сказала бы «ссылка нормальная», а Go (`url.Parse`, Host == "") ответил бы
  // 422 без объяснений. Здесь мы читаем строку так же, как её читает сервер.
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(value);
  if (!scheme || !ALLOWED_ACTION_URL_SCHEMES.has(`${scheme[1]!.toLowerCase()}:`)) {
    // Сюда же попадает бессхемный «book-eat.com/x»: клиенту пришлось бы
    // угадывать схему, а угадывание http — это молчаливое понижение ссылки.
    return "scheme";
  }
  const afterScheme = value.slice(scheme[0].length);
  const authority = afterScheme.split(/[/?#]/, 1)[0] ?? "";
  if (authority === "") return "no_host";
  if (authority.includes("@")) return "credentials";

  try {
    const parsed = new URL(value);
    if (parsed.host === "") return "no_host";
  } catch {
    return "malformed";
  }
  return null;
}

// ---- Отказы сервера ---------------------------------------------------------

/**
 * Чем закончилась неудачная запись платформенного контента.
 *
 * ВАЖНО ПРО «сообщение сервера». Его на проводе нет. `response.HandleError`
 * (internal/transport/rest/response/response.go) намеренно подменяет текст
 * доменной ошибки общим — «validation failed», «forbidden» — и присылает
 * только общий `code` вида `validation`; узкого кода у проверок ссылки и
 * запрета билетов не заведено. То есть отличить «ссылка не та» от «билеты
 * платформе нельзя» по ответу нельзя, а показывать редактору английское
 * «validation failed» — значит показывать строку, написанную для логов.
 * Поэтому панель называет причину сама (и делает это ДО отправки, где может),
 * а тут остаётся ровно то, что сервер действительно различает.
 */
export type PlatformContentFailureKind =
  /** 422 — запись отвергнута, ничего не изменилось. */
  | "refused"
  /** 403 — роль не входит в domain.PlatformContentRoles (сегодня это только
   * суперадмин). */
  | "forbidden"
  /** 401 — сессия кончилась. */
  | "unauthorized"
  /** 404 — записи уже нет. */
  | "not_found"
  /** Всё остальное: 5xx, таймаут, offline. Единственный случай, когда мы НЕ
   * знаем, применилась запись или нет, — и говорить «ничего не сохранилось»
   * здесь нельзя. */
  | "unknown";

export interface PlatformContentFailure {
  kind: PlatformContentFailureKind;
  /** `false` — только когда так сказал СЕРВЕР. `"unknown"` — когда не сказал. */
  applied: false | "unknown";
}

/** Разбирает пойманную ошибку записи. Принимает `unknown`, потому что стоит на `catch`. */
export function classifyPlatformContentFailure(error: unknown): PlatformContentFailure {
  const status = error instanceof RepositoryError ? error.status : undefined;
  switch (status) {
    case 401:
      return { kind: "unauthorized", applied: false };
    case 403:
      return { kind: "forbidden", applied: false };
    case 404:
      return { kind: "not_found", applied: false };
    case 422:
      // ErrValidation на бэкенде возвращается только ДО коммита, поэтому
      // «ничего не изменилось» здесь факт, а не догадка.
      return { kind: "refused", applied: false };
    default:
      return { kind: "unknown", applied: "unknown" };
  }
}

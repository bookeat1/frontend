import { RepositoryError } from "../repository";
import type { I18nMap, I18nPatch } from "./types";

/**
 * Переводы контента: одна модель на весь кабинет.
 *
 * КОНТРАКТ СЕРВЕРА (internal/domain/locale.go, `domain.I18nPatch`), от него тут
 * пляшет всё. Рядом с обычным полем лежит объект `<поле>_i18n`, и он —
 * единственное в теле запроса, что НЕ является полной заменой:
 *
 *   ключ со строкой   → язык записывается;
 *   ключ с null/пусто → язык УДАЛЯЕТСЯ;
 *   ключа нет         → язык остаётся как был;
 *   объекта нет       → поле не трогается совсем.
 *
 * Отсюда три правила, которые нельзя нарушать:
 *
 * 1. РУССКИЙ ТЕКСТ — ЭТО КОЛОНКА, а не элемент карты. Ключ `ru` в патче пишет
 *    саму колонку (`domain.ApplyTranslations`), а при наличии в теле и колонки,
 *    и ключа выигрывает колонка. Удалить `ru` нельзя — 422. Поэтому клиент
 *    `ru` в патч НЕ КЛАДЁТ НИКОГДА: русский текст едет обычным полем формы.
 * 2. ЯЗЫКА ТОЛЬКО ТРИ — ru, kk, en (`domain.SupportedLocales`). Чужой язык или
 *    два написания одного («kk» и «kk-KZ» в одном объекте) — 422.
 * 3. ШЛЁМ ТОЛЬКО ИЗМЕНЁННОЕ. Патч, который перечисляет все языки, затирает
 *    правку коллеги, сделанную между чтением формы и сохранением; патч, который
 *    перечисляет только тронутые, — нет. Ради этого различия серверный формат и
 *    сделан частичным.
 *
 * 4. ЧУЖИЕ ЯЗЫКИ НЕ НАШЕ ДЕЛО. В старых записях (импорт) лежат `ko`/`zh`.
 *    Кабинет их не показывает, не присылает и не пытается удалить: нетронутый
 *    ключ сервер сохраняет сам, а попытка его записать — это 422. Чистка таких
 *    строк — миграция данных, а не действие формы.
 *
 * Формат ОДИН на весь админский контент, включая редактор гастрогида: полной
 * замены карты переводов не осталось нигде (бэкенд `588c177` + `1252c4c`).
 *
 * Модуль чистый (ни DOM, ни сети) — вся ветвистая часть проверяется юнит-тестом.
 */

/** Языки, на которых кабинет ведёт контент. `ru` — базовый. */
export const CONTENT_LOCALES = ["ru", "kk", "en"] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];

/**
 * Языки, которые живут В КАРТЕ переводов, то есть все, кроме русского.
 *
 * Русского здесь нет не по недосмотру: он хранится обычной колонкой, и попытка
 * положить его в карту — это либо изменение самого текста (тогда его место в
 * обычном поле формы), либо 422 (если пытаться удалить).
 */
export const TRANSLATION_LOCALES = ["kk", "en"] as const;
export type TranslationLocale = (typeof TRANSLATION_LOCALES)[number];

/** Черновик формы: по строке на каждый переводимый язык. Пустая строка —
 * осмысленное значение («перевода нет / удалить перевод»), не «не знаю». */
export type TranslationDraft = Record<TranslationLocale, string>;

/** Пустой черновик. Отдельная функция, а не общая константа: черновик
 * изменяемый, и общий объект утёк бы между полями формы. */
export function emptyTranslationDraft(): TranslationDraft {
  return { kk: "", en: "" };
}

/**
 * Черновик из карты, как её отдал сервер.
 *
 * Ключ `ru` из карты игнорируется намеренно: сервер держит его равным колонке
 * (инвариант `ApplyTranslations`), и показывать его вторым полем значило бы
 * предложить редактору два места для одного текста. Чужие языки (в старых
 * данных лежат `ko`/`zh`) в черновик тоже не попадают — кабинет их не правит и
 * не удаляет, а патч без их ключей их сохраняет.
 */
export function translationDraftFrom(map?: I18nMap | null): TranslationDraft {
  const draft = emptyTranslationDraft();
  if (!map) return draft;
  for (const locale of TRANSLATION_LOCALES) {
    const value = map[locale];
    if (typeof value === "string") draft[locale] = value;
  }
  return draft;
}

/** Языки, перевода на которые нет: гость с таким языком увидит русский текст. */
export function missingTranslations(draft: TranslationDraft): TranslationLocale[] {
  return TRANSLATION_LOCALES.filter((locale) => draft[locale].trim() === "");
}

/**
 * Языки, которые ЭТО сохранение удалит: перевод был, а поле опустело.
 *
 * Нужно, чтобы человек прочитал последствие ДО нажатия «Сохранить». Пустое поле
 * перевода — это команда «удалить», и она не должна быть догадкой.
 */
export function removedTranslations(
  draft: TranslationDraft,
  stored?: I18nMap | null,
): TranslationLocale[] {
  const before = translationDraftFrom(stored);
  return TRANSLATION_LOCALES.filter(
    (locale) => before[locale].trim() !== "" && draft[locale].trim() === "",
  );
}

/** Изменился ли черновик по сравнению с тем, что отдал сервер. */
export function translationsChanged(
  draft: TranslationDraft,
  stored?: I18nMap | null,
): boolean {
  return buildTranslationPatch(draft, stored) !== undefined;
}

/**
 * Патч для `<поле>_i18n` — ТОЛЬКО изменившиеся языки.
 *
 * `undefined` значит «ключ в тело не класть»: поле переводов не трогаем вовсе.
 * Это не то же самое, что `{}` — пустой объект сервер разберёт и применит
 * (ничего не изменив), но он же поедет по проводу и будет выглядеть как
 * намерение, которого не было.
 *
 * Значения тримятся: сервер всё равно считает пробельную строку удалением
 * (`I18nPatch.ApplyTo`), и хранить « » значит хранить значение, которое
 * читается как отсутствующее.
 */
export function buildTranslationPatch(
  draft: TranslationDraft,
  stored?: I18nMap | null,
): I18nPatch | undefined {
  const before = translationDraftFrom(stored);
  const patch: I18nPatch = {};
  let touched = false;
  for (const locale of TRANSLATION_LOCALES) {
    const next = draft[locale].trim();
    const prev = before[locale].trim();
    if (next === prev) continue;
    // Пустое поле = удалить язык. Но удалять то, чего и не было, незачем:
    // ветка выше это уже отсекла (обе строки пустые — равны).
    patch[locale] = next === "" ? null : next;
    touched = true;
  }
  return touched ? patch : undefined;
}

/**
 * Чем кончилась запись, у которой был патч переводов.
 *
 * ВАЖНО ПРО 422. Узкого кода у проверок переводов НЕТ: `response.HandleError`
 * подменяет текст любой `ErrValidation` на «validation failed» и присылает
 * общий код `validation` (см. transport/rest/response/response.go). То есть
 * отличить «неподдерживаемый язык» от «нельзя удалить русский» по проводу
 * НЕВОЗМОЖНО, и показывать серверную строку — значит показывать строку из
 * логов. Поэтому оба этих состояния кабинет делает НЕДОСТИЖИМЫМИ (языка только
 * три, русский поле перевода не предлагает), а 422 объясняет одним честным
 * русским текстом.
 */
export type TranslationFailureKind =
  /** 422 — сервер не принял содержимое формы. Ничего не записано:
   * `ErrValidation` в этих usecase'ах возвращается до коммита. */
  | "refused"
  /** 401 — сессия закончилась. */
  | "unauthorized"
  /** 403 — прав на эту запись нет. */
  | "forbidden"
  /** 404 — записи больше нет. */
  | "not_found"
  /** Всё остальное: 5xx, таймаут, обрыв связи. ЗАПИСАЛОСЬ ЛИ — НЕИЗВЕСТНО. */
  | "unknown";

export interface TranslationFailure {
  kind: TranslationFailureKind;
  /** `false` — только когда об этом сказал СЕРВЕР. `"unknown"` — когда не
   * сказал: запрос, оборвавшийся по таймауту, мог и записаться. Экран не имеет
   * права печатать «ничего не сохранилось» на `"unknown"`. */
  applied: false | "unknown";
}

/** Разбор отказа. Принимает `unknown`, потому что стоит в `catch`. */
export function classifyTranslationFailure(error: unknown): TranslationFailure {
  const status = error instanceof RepositoryError ? error.status : undefined;
  switch (status) {
    case 401:
      return { kind: "unauthorized", applied: false };
    case 403:
      return { kind: "forbidden", applied: false };
    case 404:
      return { kind: "not_found", applied: false };
    case 422:
      return { kind: "refused", applied: false };
    default:
      return { kind: "unknown", applied: "unknown" };
  }
}

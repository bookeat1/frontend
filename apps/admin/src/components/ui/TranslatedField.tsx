"use client";

import { useId, useState } from "react";
import {
  TRANSLATION_LOCALES,
  missingTranslations,
  removedTranslations,
  type I18nMap,
  type TranslationDraft,
  type TranslationLocale,
} from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { TextArea, TextInput } from "./FormControls";

const copy = t.admin.translations;

/** Вкладки в одном порядке на всех экранах: сначала базовый русский. */
const TABS = ["ru", ...TRANSLATION_LOCALES] as const;
type Tab = (typeof TABS)[number];

/**
 * Поле с переводами: одно поле формы, три языка.
 *
 * ЧТО ЗДЕСЬ ГЛАВНОЕ И ПОЧЕМУ ИМЕННО ТАК.
 *
 * 1. ВКЛАДКА «Русский» — ЭТО САМО ПОЛЕ, а не перевод. Русский текст хранится
 *    обычной колонкой (`domain.I18n.WithLocale`), поэтому она связана с тем же
 *    состоянием, что и раньше: `base`/`onBaseChange`. Никакого второго места
 *    для русского текста в кабинете не появляется.
 * 2. ПУСТОЕ ПОЛЕ ПЕРЕВОДА — ЭТО КОМАНДА «УДАЛИТЬ», а не «оставить как было».
 *    Такое поведение нельзя оставлять догадкой, поэтому оно написано словами
 *    ПОД полем и ровно тогда, когда сработает: перевод был и его стёрли —
 *    предупреждение об удалении; перевода и не было — объяснение, что гость
 *    увидит русский текст.
 * 3. ЗАПОЛНЕННОСТЬ ВИДНА, НЕ ОТКРЫВАЯ ВКЛАДКУ. У языка без перевода в ярлыке
 *    стоит точка, и она же проговорена в `aria-label` — иначе с закрытыми
 *    глазами вкладки неразличимы.
 *
 * Компонент НИЧЕГО не знает про сеть и про формат запроса: он ведёт черновик,
 * а патч из черновика собирает `buildTranslationPatch` в момент отправки.
 */
export function TranslatedField({
  id,
  label,
  hint,
  required,
  multiline = false,
  maxLength,
  rows,
  placeholder,
  disabled,
  base,
  onBaseChange,
  translations,
  onTranslationsChange,
  stored,
}: {
  /** Базовый DOM-id. Поля вкладок получают суффикс языка: два поля на одной
   * странице обязаны различаться, иначе `<label for>` указывает на чужое. */
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  /** Русский текст — обычное поле записи. */
  base: string;
  onBaseChange: (next: string) => void;
  /** Черновик переводов (kk/en). */
  translations: TranslationDraft;
  onTranslationsChange: (next: TranslationDraft) => void;
  /** Карта, как её отдал сервер. Нужна ровно для одного: сказать, что
   * сохранение УДАЛИТ перевод. `undefined` = «не знаем» (например, листинг
   * карт не отдаёт), и тогда об удалении не заявляем. */
  stored?: I18nMap;
}) {
  const [tab, setTab] = useState<Tab>("ru");
  const reactId = useId();
  const tablistId = `${id}-${reactId}`;

  const missing = missingTranslations(translations);
  const removed = removedTranslations(translations, stored);

  const inputId = `${id}-${tab}`;
  const value = tab === "ru" ? base : translations[tab];
  const onValueChange = (next: string) => {
    if (tab === "ru") onBaseChange(next);
    else onTranslationsChange({ ...translations, [tab]: next });
  };

  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={inputId} className="text-sm font-medium text-text">
        {label}
        {required ? <span className="text-brand"> *</span> : null}
      </label>

      <div role="tablist" aria-label={copy.tablistLabel(label)} className="flex flex-wrap gap-xs">
        {TABS.map((code) => {
          const isMissing = code !== "ru" && missing.includes(code);
          const willRemove = code !== "ru" && removed.includes(code);
          return (
            <button
              key={code}
              type="button"
              role="tab"
              id={`${tablistId}-tab-${code}`}
              aria-selected={tab === code}
              aria-controls={`${tablistId}-panel`}
              aria-label={
                code === "ru"
                  ? copy.localeName.ru
                  : isMissing
                    ? copy.tabMissingLabel(copy.localeName[code])
                    : copy.tabFilledLabel(copy.localeName[code])
              }
              onClick={() => setTab(code)}
              className={`min-h-[36px] rounded-pill px-md text-[13px] font-medium transition-colors ${
                tab === code
                  ? "bg-brand text-white"
                  : "bg-chip text-text hover:bg-hairline"
              }`}
            >
              <span aria-hidden="true">
                {copy.localeName[code]}
                {willRemove ? " ×" : isMissing ? " •" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div id={`${tablistId}-panel`} role="tabpanel" aria-labelledby={`${tablistId}-tab-${tab}`}>
        {multiline ? (
          <TextArea
            id={inputId}
            value={value}
            disabled={disabled}
            maxLength={maxLength}
            placeholder={placeholder}
            rows={rows}
            onChange={(e) => onValueChange(e.target.value)}
          />
        ) : (
          <TextInput
            id={inputId}
            value={value}
            disabled={disabled}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={(e) => onValueChange(e.target.value)}
          />
        )}
      </div>

      <FieldNote tab={tab} translations={translations} removed={removed} hint={hint} />

      {/* Сводка по полю: каких языков не хватает, видно не открывая вкладки. */}
      {missing.length > 0 ? (
        <span className="text-[12px] text-text-muted">
          {copy.missingSummary(missing.map((l) => copy.localeName[l]).join(", "))}
        </span>
      ) : null}
    </div>
  );
}

/** Подпись под активной вкладкой: что именно случится с этим языком. */
function FieldNote({
  tab,
  translations,
  removed,
  hint,
}: {
  tab: Tab;
  translations: TranslationDraft;
  removed: TranslationLocale[];
  hint?: string;
}) {
  if (tab === "ru") {
    return (
      <span className="text-[12px] text-text-muted">{hint ? `${hint} ${copy.baseHint}` : copy.baseHint}</span>
    );
  }
  const name = copy.localeName[tab];
  if (removed.includes(tab)) {
    // Это предупреждение — не украшение: пустое поле СОТРЁТ перевод при
    // сохранении, и человек обязан прочитать это до нажатия, а не после.
    return (
      <span role="status" className="text-[12px] font-medium text-brand">
        {copy.willRemove(name)}
      </span>
    );
  }
  if (translations[tab].trim() === "") {
    return <span className="text-[12px] text-text-muted">{copy.emptyMeansFallback(name)}</span>;
  }
  return <span className="text-[12px] text-text-muted">{copy.filledHint(name)}</span>;
}

/**
 * Шапка формы: каких языков не хватает во всей форме сразу.
 *
 * Точки на вкладках отвечают на вопрос про ОДНО поле; этот блок — про запись
 * целиком, и только он честно отвечает на «готова ли карточка к показу на
 * казахском». Ничего не считает сам: собирает уже посчитанное по полям.
 */
export function TranslationCoverageNote({
  fields,
}: {
  fields: readonly { label: string; translations: TranslationDraft }[];
}) {
  const gaps = TRANSLATION_LOCALES.map((locale) => ({
    locale,
    fields: fields.filter((f) => f.translations[locale].trim() === "").map((f) => f.label),
  })).filter((g) => g.fields.length > 0);

  if (gaps.length === 0) {
    return (
      <p role="status" className="text-[12px] text-emerald-700">
        {copy.coverageComplete}
      </p>
    );
  }

  return (
    <div role="note" className="flex flex-col gap-xxs rounded-card bg-chip px-md py-sm">
      <span className="text-[12px] font-semibold text-text">{copy.coverageTitle}</span>
      {gaps.map((gap) => (
        <span key={gap.locale} className="text-[12px] text-text-muted">
          {copy.coverageLine(copy.localeName[gap.locale], gap.fields.join(", "))}
        </span>
      ))}
    </div>
  );
}

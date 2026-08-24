"use client";

import {
  SOCIAL_LINK_TYPES,
  isKnownSocialLinkType,
  type SocialLinkError,
  type SocialLinkInput,
} from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { Button } from "./Button";
import { Select, TextInput } from "./FormControls";

/**
 * Редактор ссылок заведения на соцсети: строки «вид + адрес», кнопка добавить,
 * кнопка удалить у каждой строки.
 *
 * Компонент БЕЗ запросов — он только про раскладку и правку списка, а грузят и
 * сохраняют его два разных владельца: форма заведения у суперадмина
 * (VenuesView) и карточка «Соцсети» в «Настройках» заведения. Иначе получилось
 * бы две почти одинаковые формы, которые разъедутся на первой же правке.
 *
 * Строка держит собственный `key`, а не индекс массива: удаление второй из трёх
 * строк по индексу заставило бы React переиспользовать чужое состояние поля, и
 * фокус с текстом уехали бы в соседнюю строку.
 *
 * Виды ссылок — только те, которые приложение реально показывает
 * (SOCIAL_LINK_TYPES). Незнакомый вид из старых данных строку НЕ ломает: он
 * остаётся отдельным пунктом списка с пометкой, что приложение его не покажет,
 * — потерять чужую запись молча хуже, чем показать её как есть.
 */

const copy = t.admin.socialLinks;

export interface SocialLinkDraft extends SocialLinkInput {
  /** Стабильный ключ строки на время жизни формы. */
  key: string;
}

let draftSeq = 0;
function nextKey(): string {
  draftSeq += 1;
  return `social-${draftSeq}`;
}

/** Строки формы из того, что отдал сервер. */
export function draftsFromLinks(links: readonly SocialLinkInput[]): SocialLinkDraft[] {
  return links.map((link) => ({ key: nextKey(), type: link.type, url: link.url }));
}

/** Новая пустая строка: вид — первый из ещё не занятых, чтобы в типичном
 * случае («добавил Instagram, потом WhatsApp») не выбирать его руками. */
export function emptyDraft(existing: readonly SocialLinkInput[]): SocialLinkDraft {
  const used = new Set(existing.map((link) => link.type));
  const free = SOCIAL_LINK_TYPES.find((type) => !used.has(type));
  return { key: nextKey(), type: free ?? SOCIAL_LINK_TYPES[0], url: "" };
}

/** Все известные виды уже заняты — добавлять нечего. */
export function allTypesUsed(rows: readonly SocialLinkInput[]): boolean {
  const used = new Set(rows.map((row) => row.type));
  return SOCIAL_LINK_TYPES.every((type) => used.has(type));
}

/** Тексты клиентских ошибок строки. Держатся рядом с полем, потому что нужны
 * обоим владельцам формы. */
export const SOCIAL_LINK_ERROR_COPY: Record<SocialLinkError, string> = {
  not_a_link: copy.errorNotALink,
  bad_instagram: copy.errorInstagram,
  bad_whatsapp: copy.errorWhatsapp,
  duplicate_type: copy.errorDuplicate,
};

const TYPE_LABELS: Record<string, string> = {
  instagram: copy.types.instagram,
  whatsapp: copy.types.whatsapp,
  website: copy.types.website,
};

const TYPE_HINTS: Record<string, string> = {
  instagram: copy.hintInstagram,
  whatsapp: copy.hintWhatsapp,
  website: copy.hintWebsite,
};

export function SocialLinksField({
  rows,
  onChange,
  disabled = false,
  errorIndex = null,
  errorMessage = null,
  idPrefix = "social",
  showTitle = true,
}: {
  rows: SocialLinkDraft[];
  onChange: (next: SocialLinkDraft[]) => void;
  disabled?: boolean;
  /** Номер строки с ошибкой — сообщение показывается под ней, а не общей
   * строкой внизу: иначе при трёх ссылках непонятно, какую чинить. */
  errorIndex?: number | null;
  errorMessage?: string | null;
  idPrefix?: string;
  /** Заголовок «Соцсети» рисует сам блок. В карточке настроек его уже даёт
   * заголовок карточки, и второй такой же читался бы как вложенный раздел. */
  showTitle?: boolean;
}) {
  const patch = (key: string, change: Partial<SocialLinkInput>) => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  };

  return (
    <div className="flex flex-col gap-sm">
      {showTitle ? (
        <span className="text-sm font-medium text-text">{copy.title}</span>
      ) : null}
      <p className="max-w-prose text-[12px] text-text-muted">{copy.description}</p>

      {rows.length === 0 ? (
        <p className="text-[13px] text-text-muted">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col gap-md">
          {rows.map((row, index) => {
            const number = index + 1;
            const hasError = errorIndex === index && errorMessage;
            return (
              <li key={row.key} className="flex flex-col gap-xs">
                <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
                  <Select
                    id={`${idPrefix}-type-${number}`}
                    aria-label={`${copy.typeLabel} ${number}`}
                    className="sm:w-[190px] sm:shrink-0"
                    disabled={disabled}
                    value={row.type}
                    onChange={(e) => patch(row.key, { type: e.target.value })}
                  >
                    {SOCIAL_LINK_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </option>
                    ))}
                    {isKnownSocialLinkType(row.type) ? null : (
                      <option value={row.type}>{copy.unknownType(row.type)}</option>
                    )}
                  </Select>
                  <TextInput
                    id={`${idPrefix}-url-${number}`}
                    aria-label={`${copy.urlLabel} ${number}`}
                    aria-invalid={hasError ? true : undefined}
                    inputMode="url"
                    autoComplete="off"
                    placeholder={copy.urlPlaceholder}
                    disabled={disabled}
                    value={row.url}
                    onChange={(e) => patch(row.key, { url: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    aria-label={copy.removeAria(number)}
                    onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
                  >
                    {copy.remove}
                  </Button>
                </div>
                <span className="text-[12px] text-text-muted">
                  {TYPE_HINTS[row.type] ?? copy.hintWebsite}
                </span>
                {hasError ? (
                  <span role="alert" className="text-[13px] text-brand">
                    {errorMessage}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || allTypesUsed(rows)}
          onClick={() => onChange([...rows, emptyDraft(rows)])}
        >
          {copy.add}
        </Button>
      </div>
    </div>
  );
}

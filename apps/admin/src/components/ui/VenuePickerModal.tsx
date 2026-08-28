"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { VenueSearchResult } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { Button } from "./Button";
import { Field, TextInput } from "./FormControls";
import { Modal } from "./Modal";
import { EmptyState, ErrorState, LoadingState } from "../StateViews";

/** Ниже двух символов поиск по каталогу находит половину города — это не
 * полезный ответ и при этом дорогой. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

export interface VenueSearchClient {
  searchVenues(query: string, perPage?: number): Promise<{ items: VenueSearchResult[] }>;
}

export interface VenuePickerCopy {
  title: string;
  searchLabel: string;
  searchHint: string;
  loading: string;
  empty: string;
  /** Подпись кнопки у заведения, которое уже в списке. */
  alreadyAdded: string;
  inactive: string;
}

/**
 * ВЫБОР ЗАВЕДЕНИЯ ИЗ КАТАЛОГА — одно окно на панель.
 *
 * Им пользуются подборка гастрогида и ручной состав блока «Выбрали для вас»:
 * вопрос у них один и тот же («какое заведение добавить»), поэтому и поиск
 * один. Различаются только подписи, и они приходят пропом `copy` — словарь
 * внутри общего окна заставил бы оба экрана называть вещи одинаково.
 *
 * Заведения, которые уже в списке, ПОКАЗЫВАЮТСЯ и блокируются, а не прячутся:
 * редактор, который не находит «Дареджани», потому что оно уже добавлено,
 * решает, что сломан поиск.
 *
 * Запрос дебаунсится: набранное название — это один запрос, а не по одному на
 * букву. Панелью пользуются и с телефона.
 */
export function VenuePickerModal({
  client,
  copy,
  attachedIds,
  onPick,
  onClose,
  attaching,
}: {
  client: VenueSearchClient;
  copy: VenuePickerCopy;
  attachedIds: string[];
  onPick: (venue: VenueSearchResult) => void;
  onClose: () => void;
  attaching: boolean;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const enabled = debounced.length >= MIN_QUERY;
  const searchQuery = useQuery({
    queryKey: ["venue-search", debounced],
    queryFn: () => client.searchVenues(debounced, 20),
    enabled,
  });

  const attached = new Set(attachedIds);
  const items = searchQuery.data?.items ?? [];

  return (
    <Modal title={copy.title} onClose={onClose}>
      <div className="flex flex-col gap-md">
        <Field label={copy.searchLabel} hint={copy.searchHint} htmlFor="venue-picker-search">
          <TextInput
            id="venue-picker-search"
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>

        {!enabled ? null : searchQuery.isPending ? (
          <LoadingState title={copy.loading} />
        ) : searchQuery.isError ? (
          <ErrorState onRetry={() => void searchQuery.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={copy.empty} />
        ) : (
          <ul className="flex max-h-[360px] flex-col gap-xs overflow-y-auto">
            {items.map((v) => {
              const already = attached.has(v.id);
              return (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-sm rounded-card bg-screen p-md"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-sm">
                      <span className="break-words text-sm font-medium text-text">{v.name}</span>
                      {!v.is_active ? (
                        <span className="whitespace-nowrap rounded-pill bg-rose-100 px-sm py-xxs text-[11px] text-rose-700">
                          {copy.inactive}
                        </span>
                      ) : null}
                    </div>
                    <p className="break-words text-[13px] text-text-muted">
                      {[v.city, v.address].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={already || attaching}
                    loading={attaching}
                    onClick={() => onPick(v)}
                  >
                    {already ? copy.alreadyAdded : t.admin.common.create}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.admin.common.cancel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

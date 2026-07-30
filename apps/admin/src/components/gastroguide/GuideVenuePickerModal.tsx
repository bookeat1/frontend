"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { VenueSearchResult } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/FormControls";
import { Modal } from "../ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "../StateViews";

const copy = t.admin.gastroguide;

/** Below two characters the catalog search matches most of the city, which is
 * not a useful answer and is an expensive one. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

export interface VenueSearchClient {
  searchVenues(query: string, perPage?: number): Promise<{ items: VenueSearchResult[] }>;
}

/**
 * Search the venue catalog and attach one venue to the collection.
 *
 * Venues already in the collection are shown and disabled rather than hidden:
 * an editor who cannot find "Дареджани" because it is already there would
 * assume the search is broken. The server refuses the duplicate anyway
 * (guide_venue_already_attached), so this is about not making them ask.
 */
export function GuideVenuePickerModal({
  client,
  attachedIds,
  onPick,
  onClose,
  attaching,
}: {
  client: VenueSearchClient;
  attachedIds: string[];
  onPick: (venue: VenueSearchResult) => void;
  onClose: () => void;
  attaching: boolean;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounced so a typed name is one request, not one per keystroke — this
  // panel is used over a phone connection often enough for that to matter.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const enabled = debounced.length >= MIN_QUERY;
  const searchQuery = useQuery({
    queryKey: ["guide-venue-search", debounced],
    queryFn: () => client.searchVenues(debounced, 20),
    enabled,
  });

  const attached = new Set(attachedIds);
  const items = searchQuery.data?.items ?? [];

  return (
    <Modal title={copy.venueAdd} onClose={onClose}>
      <div className="flex flex-col gap-md">
        <Field label={copy.venueSearch} hint={copy.venueSearchHint} htmlFor="guide-venue-search">
          <TextInput
            id="guide-venue-search"
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>

        {!enabled ? null : searchQuery.isPending ? (
          <LoadingState title={copy.venueSearchLoading} />
        ) : searchQuery.isError ? (
          <ErrorState onRetry={() => void searchQuery.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={copy.venueSearchEmpty} />
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
                          {copy.venueInactive}
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
                    {already ? copy.venueAlreadyAdded : t.admin.common.create}
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

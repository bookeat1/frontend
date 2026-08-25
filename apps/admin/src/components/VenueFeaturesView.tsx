"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  reorderVenueFeatures,
  sortVenueFeatures,
  type VenueFeatureDictionaryEntry,
  type VenueFeatureSaveInput,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useIsPlatformAdmin } from "@/lib/use-venue-catalog";

import { EmptyState, ErrorState, LoadingState } from "./StateViews";
import { Button } from "./ui/Button";
import { Field, TextInput } from "./ui/FormControls";
import { Modal } from "./ui/Modal";

/**
 * «Удобства» — справочник платформы: единственное место, где удобство можно
 * завести, переименовать, переставить и скрыть.
 *
 * Почему только суперадмин: справочник общий. Заведение из него ВЫБИРАЕТ (см.
 * «Настройки» → «Удобства»), но не пополняет — ровно так на бэкенде разведены
 * `/admin/venue-features` (RequireRole(RoleAdmin) + `requirePlatform` в
 * usecase) и `/restaurants/:id/features` (RequireRestaurantManager). Именно
 * свободный ввод и породил в старой таблице удобств кухню («Восточная кухня»),
 * район («Коктобе») и требование к звуку под одной колонкой с «Wi-Fi» — и
 * фильтром это не могло стать никогда.
 *
 * Почему нет кнопки «Удалить»: на удобство ссылаются заведения, поэтому DELETE
 * на сервере не удаляет, а снимает флаг активности. Скрытое удобство исчезает
 * из приложения и из выбора у заведений, но остаётся у тех, кто его уже
 * отметил, и возвращается одной кнопкой.
 *
 * Столбец «У заведений» — `venue_count` из ответа. Он здесь не украшение: у
 * половины боевого справочника он равен нулю, а нулевое удобство в фильтре
 * приложения не находит ничего. Показать это владельцу — единственный способ
 * отличить «удобства нет ни у кого» от «фильтр сломан».
 */

const copy = t.admin.venueFeatureDictionary;

export interface VenueFeatureDictionaryClient {
  listVenueFeaturesForAdmin(): Promise<VenueFeatureDictionaryEntry[]>;
  createVenueFeature(input: VenueFeatureSaveInput): Promise<VenueFeatureDictionaryEntry>;
  updateVenueFeature(
    id: string,
    input: VenueFeatureSaveInput,
  ): Promise<VenueFeatureDictionaryEntry>;
  hideVenueFeature(id: string): Promise<VenueFeatureDictionaryEntry>;
}

export function VenueFeaturesView({
  client = apiClient,
}: {
  client?: VenueFeatureDictionaryClient;
}) {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) {
    return <EmptyState title={copy.adminOnlyTitle} description={copy.adminOnlyDescription} />;
  }
  return <VenueFeatureDictionary client={client} />;
}

/** Сам экран, без гейта: гейт читает контекст авторизации, а здесь только
 * данные и клиент — поэтому его можно рендерить против фейка. */
export function VenueFeatureDictionary({ client }: { client: VenueFeatureDictionaryClient }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<VenueFeatureDictionaryEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["venue-features-admin"],
    queryFn: () => client.listVenueFeaturesForAdmin(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["venue-features-admin"] });
    // Публичный список — тот же справочник другими глазами: он тоже устарел.
    void queryClient.invalidateQueries({ queryKey: ["venue-features"] });
  };

  const items = useMemo(() => sortVenueFeatures(query.data ?? []), [query.data]);

  const visibility = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      visible ? client.updateVenueFeature(id, { is_active: true }) : client.hideVenueFeature(id),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: () => setActionError(copy.visibilityFailed),
  });

  /** Перестановка — это правки display_order у нескольких записей подряд.
   * Отдельной ручки «поменять местами» у удобств нет (в отличие от городов),
   * поэтому правки идут одна за другой, и если какая-то не легла, человеку
   * говорят прямо, а список перечитывается с сервера — чтобы на экране был
   * порядок сервера, а не наша догадка. */
  const reorder = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const patches = reorderVenueFeatures(items, id, direction);
      for (const patch of patches) {
        await client.updateVenueFeature(patch.id, { display_order: patch.display_order });
      }
    },
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: () => {
      setActionError(copy.orderFailed);
      invalidate();
    },
  });

  return (
    <div className="p-md md:p-lg">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="text-xl font-semibold text-neutral-900">{copy.title}</h1>
        <Button onClick={() => setCreating(true)}>{copy.add}</Button>
      </div>

      <p className="mt-sm max-w-prose text-sm text-text-muted">{copy.description}</p>

      {query.isPending ? (
        <LoadingState title={copy.loadingTitle} />
      ) : query.isError ? (
        <ErrorState message={copy.loadFailed} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : (
        <>
          <div className="mt-md overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">{copy.colName}</th>
                  <th className="px-4 py-2 font-medium">{copy.colOrder}</th>
                  <th className="px-4 py-2 font-medium">{copy.colVenues}</th>
                  <th className="px-4 py-2 font-medium">{copy.colStatus}</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="break-words font-medium text-neutral-900">{item.name}</div>
                      <div className="text-[12px] text-neutral-500">{item.code}</div>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{index + 1}</td>
                    <td
                      className={
                        item.venue_count === 0
                          ? "px-4 py-3 text-neutral-400"
                          : "px-4 py-3 text-neutral-700"
                      }
                    >
                      {copy.venuesCount(item.venue_count)}
                    </td>
                    <td className="px-4 py-3">
                      {item.is_active ? (
                        <span className="text-neutral-700">{copy.statusVisible}</span>
                      ) : (
                        <span className="text-neutral-400">{copy.statusHidden}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-xs">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={index === 0 || reorder.isPending}
                          aria-label={copy.moveUpAria(item.name)}
                          onClick={() => reorder.mutate({ id: item.id, direction: "up" })}
                        >
                          {copy.moveUp}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={index === items.length - 1 || reorder.isPending}
                          aria-label={copy.moveDownAria(item.name)}
                          onClick={() => reorder.mutate({ id: item.id, direction: "down" })}
                        >
                          {copy.moveDown}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={copy.editAria(item.name)}
                          onClick={() => setEditing(item)}
                        >
                          {copy.edit}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={visibility.isPending && visibility.variables?.id === item.id}
                          aria-label={
                            item.is_active ? copy.hideAria(item.name) : copy.restoreAria(item.name)
                          }
                          onClick={() =>
                            visibility.mutate({ id: item.id, visible: !item.is_active })
                          }
                        >
                          {item.is_active ? copy.hide : copy.restore}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-sm max-w-prose text-[12px] text-text-muted">{copy.venuesHint}</p>
        </>
      )}

      {actionError ? (
        <p className="mt-md text-sm text-brand" role="alert">
          {actionError}
        </p>
      ) : null}

      {creating ? (
        <VenueFeatureFormModal
          title={copy.newTitle}
          save={(input) => client.createVenueFeature(input)}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            invalidate();
          }}
        />
      ) : null}

      {editing ? (
        <VenueFeatureFormModal
          title={editing.name}
          entry={editing}
          save={(input) => client.updateVenueFeature(editing.id, input)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      ) : null}
    </div>
  );
}

/** Код удобства — машинный ключ: по нему ездит фильтр каталога и клиент
 * подбирает иконку. Сервер валидирует его тем же правилом (validateCode). */
const CODE_RE = /^[a-z0-9_]+$/;

function VenueFeatureFormModal({
  title,
  entry,
  save,
  onClose,
  onSaved,
}: {
  title: string;
  entry?: VenueFeatureDictionaryEntry;
  save: (input: VenueFeatureSaveInput) => Promise<VenueFeatureDictionaryEntry>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(entry?.name ?? "");
  const [code, setCode] = useState(entry?.code ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: onSaved,
    onError: () => setError(copy.saveFailed),
  });

  const submit = () => {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toLowerCase();
    if (!trimmedName) {
      setError(copy.nameRequired);
      return;
    }
    if (!trimmedCode) {
      setError(copy.codeRequired);
      return;
    }
    if (!CODE_RE.test(trimmedCode)) {
      setError(copy.codeBad);
      return;
    }
    setError(null);
    mutation.mutate({ name: trimmedName, code: trimmedCode });
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-md">
        <Field label={copy.fieldName} hint={copy.fieldNameHint} required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label={copy.fieldCode} hint={copy.fieldCodeHint} required>
          <TextInput
            value={code}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>

        {error ? (
          <p className="text-sm text-brand" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-xs">
          <Button variant="ghost" onClick={onClose}>
            {t.admin.common.cancel}
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {copy.save}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

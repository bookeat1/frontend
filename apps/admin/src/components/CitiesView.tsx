"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  reorderCityIds,
  sortCities,
  validateCityAlias,
  type CityAliasError,
  type CityDictionaryEntry,
  type CitySaveInput,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useIsPlatformAdmin } from "@/lib/use-venue-catalog";

import { EmptyState, ErrorState, LoadingState } from "./StateViews";
import { Button } from "./ui/Button";
import { Field, TextInput } from "./ui/FormControls";
import { Modal } from "./ui/Modal";

/**
 * «Города» — справочник платформы: единственное место, где город можно завести,
 * переименовать, переставить и скрыть.
 *
 * Почему только суперадмин: справочник общий. Заведение из него ВЫБИРАЕТ, но не
 * пополняет — ровно так на бэкенде разведены `/admin/cities`
 * (RequireRole(RoleAdmin), usecase проверяет роль ещё раз) и всё остальное.
 * До этого справочника списком городов были ДВЕ КОНСТАНТЫ В КОДЕ, а город у
 * заведения — свободной строкой, поэтому «алматы» из старой системы просто
 * переставало находиться фильтром каталога.
 *
 * Почему нет кнопки «Удалить»: на город ссылаются заведения (FK RESTRICT) и его
 * название лежит живой строкой в `restaurants.city`. DELETE на сервере снимает
 * флаг активности — город исчезает из выбора и из приложения, но заведения,
 * которые уже в нём, остаются на месте, и вернуть его можно одной кнопкой.
 */

const copy = t.admin.cities;

/** Ровно те методы клиента, которые нужны экрану: так его можно рендерить в
 * тестах против фейка, не поднимая ни сети, ни авторизации. */
export interface CityDictionaryClient {
  listCitiesForAdmin(): Promise<CityDictionaryEntry[]>;
  createCity(input: CitySaveInput): Promise<CityDictionaryEntry>;
  updateCity(id: string, input: CitySaveInput): Promise<CityDictionaryEntry>;
  hideCity(id: string): Promise<CityDictionaryEntry>;
  reorderCities(cityIds: readonly string[]): Promise<CityDictionaryEntry[]>;
  addCityAlias(id: string, alias: string): Promise<CityDictionaryEntry>;
}

export function CitiesView({ client = apiClient }: { client?: CityDictionaryClient }) {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) {
    return <EmptyState title={copy.adminOnlyTitle} description={copy.adminOnlyDescription} />;
  }
  return <CitiesDictionary client={client} />;
}

/** Сам экран, без гейта: гейт читает контекст авторизации, а здесь только
 * данные и клиент. */
export function CitiesDictionary({ client }: { client: CityDictionaryClient }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CityDictionaryEntry | null>(null);
  const [aliasing, setAliasing] = useState<CityDictionaryEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["cities-admin"],
    queryFn: () => client.listCitiesForAdmin(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["cities-admin"] });
    // Публичный список — тот же справочник другими глазами: он тоже устарел.
    void queryClient.invalidateQueries({ queryKey: ["cities"] });
    // Переименование города переписывает строку `city` у всех его заведений
    // (сервер делает это в одной транзакции) — каталог после этого устарел.
    void queryClient.invalidateQueries({ queryKey: ["venue-catalog"] });
  };

  const items = useMemo(() => sortCities(query.data ?? []), [query.data]);

  const visibility = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      visible ? client.updateCity(id, { is_active: true }) : client.hideCity(id),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: () => setActionError(copy.visibilityFailed),
  });

  /** Перестановка у городов — ОДИН запрос: `PUT /admin/cities/order` принимает
   * весь порядок последовательностью id (у кухонь такой ручки нет, там пачка
   * PATCH-ей). Полная последовательность, а не «сдвинь этот» — потому что два
   * администратора, двигающие строки одновременно, иначе получили бы порядок,
   * которого не просил ни один. */
  const reorder = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const ids = reorderCityIds(items, id, direction);
      if (ids.length === 0) return;
      await client.reorderCities(ids);
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
        <div className="mt-md overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">{copy.colName}</th>
                <th className="px-4 py-2 font-medium">{copy.colCode}</th>
                <th className="px-4 py-2 font-medium">{copy.colOrder}</th>
                <th className="px-4 py-2 font-medium">{copy.colStatus}</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 break-words font-medium text-neutral-900">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-neutral-500">{item.code}</td>
                  <td className="px-4 py-3 text-neutral-700">{index + 1}</td>
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
                        aria-label={copy.aliasAria(item.name)}
                        onClick={() => setAliasing(item)}
                      >
                        {copy.alias}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={visibility.isPending && visibility.variables?.id === item.id}
                        aria-label={
                          item.is_active ? copy.hideAria(item.name) : copy.restoreAria(item.name)
                        }
                        onClick={() => visibility.mutate({ id: item.id, visible: !item.is_active })}
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
      )}

      {actionError ? (
        <p className="mt-md text-sm text-brand" role="alert">
          {actionError}
        </p>
      ) : null}

      {creating ? (
        <CityFormModal
          title={copy.newTitle}
          save={(input) => client.createCity(input)}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            invalidate();
          }}
        />
      ) : null}

      {editing ? (
        <CityFormModal
          title={editing.name}
          entry={editing}
          save={(input) => client.updateCity(editing.id, input)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      ) : null}

      {aliasing ? (
        <CityAliasModal
          city={aliasing}
          save={(alias) => client.addCityAlias(aliasing.id, alias)}
          onClose={() => setAliasing(null)}
          onSaved={invalidate}
        />
      ) : null}
    </div>
  );
}

/** Код города — машинный ключ: он ездит в адресной строке и не зависит от
 * языка. Сервер валидирует его тем же правилом (`validateCode`). */
const CODE_RE = /^[a-z0-9_]+$/;

function CityFormModal({
  title,
  entry,
  save,
  onClose,
  onSaved,
}: {
  title: string;
  entry?: CityDictionaryEntry;
  save: (input: CitySaveInput) => Promise<CityDictionaryEntry>;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Правим `value` (базовое русское название), а не `name`: `name` приходит на
  // языке запроса, и сохранить его обратно значило бы записать в справочник
  // перевод вместо названия.
  const [name, setName] = useState(entry?.value ?? entry?.name ?? "");
  const [code, setCode] = useState(entry?.code ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: onSaved,
    onError: () => setError(copy.saveFailed),
  });

  const submit = () => {
    const trimmedName = name.trim().replace(/\s+/g, " ");
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

const ALIAS_ERROR_COPY: Record<CityAliasError, string> = {
  empty: copy.aliasEmpty,
  same_as_name: copy.aliasSameAsName,
};

/**
 * Ещё одно написание города.
 *
 * Окно НЕ закрывается после успеха: написаний у города обычно несколько
 * («Нур-Султан», «нур султан», «nur-sultan»), и закрывать окно после каждого
 * значило бы открывать его заново четыре раза подряд.
 *
 * Объяснение в окне обязательно. Поле «Написание» без него читается как второе
 * название города, и человек либо не поймёт, зачем оно, либо решит, что так
 * город переименовывается.
 */
function CityAliasModal({
  city,
  save,
  onClose,
  onSaved,
}: {
  city: CityDictionaryEntry;
  save: (alias: string) => Promise<CityDictionaryEntry>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [alias, setAlias] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: (_data, sent) => {
      setSaved(sent);
      setAlias("");
      onSaved();
    },
    onError: () => {
      setSaved(null);
      setError(copy.aliasFailed);
    },
  });

  const submit = () => {
    const checked = validateCityAlias(alias, city);
    if (!checked.ok) {
      setSaved(null);
      setError(ALIAS_ERROR_COPY[checked.error]);
      return;
    }
    setError(null);
    mutation.mutate(checked.alias);
  };

  return (
    <Modal title={copy.aliasTitle(city.name)} onClose={onClose}>
      <div className="flex flex-col gap-md">
        <p className="max-w-prose text-sm text-text-muted">{copy.aliasExplain}</p>

        <Field label={copy.aliasField} hint={copy.aliasHint} required>
          <TextInput
            value={alias}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setAlias(e.target.value)}
          />
        </Field>

        {error ? (
          <p className="text-sm text-brand" role="alert">
            {error}
          </p>
        ) : null}

        {saved && !error ? (
          <p className="text-sm text-emerald-700" role="status">
            {copy.aliasSaved}
          </p>
        ) : null}

        <div className="flex justify-end gap-xs">
          <Button variant="ghost" onClick={onClose}>
            {t.admin.common.cancel}
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {copy.aliasSave}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

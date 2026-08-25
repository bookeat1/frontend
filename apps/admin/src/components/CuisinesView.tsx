"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  reorderCuisines,
  sortCuisines,
  type CuisineDictionaryEntry,
  type CuisineSaveInput,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useIsPlatformAdmin } from "@/lib/use-venue-catalog";

import { EmptyState, ErrorState, LoadingState } from "./StateViews";
import { Button } from "./ui/Button";
import { Field, TextInput } from "./ui/FormControls";
import { CIRCLE_MAX_EDGE } from "@/lib/image-downscale";
import { ImageUploadField } from "./ui/ImageUploadField";
import { Modal } from "./ui/Modal";

/**
 * «Кухни» — справочник платформы: единственное место, где кухню можно завести,
 * переименовать, переставить и скрыть.
 *
 * Почему только суперадмин: справочник общий. Заведение из него ВЫБИРАЕТ (см.
 * «Настройки» → «Кухни»), но не пополняет — ровно так на бэкенде разведены
 * `/admin/cuisines` (RequireRole(RoleAdmin)) и `/restaurants/:id/cuisines`
 * (RequireRestaurantManager). Именно свободный ввод и породил в каталоге
 * «Кафе, европейская» как отдельную кухню, которую не находил ни один фильтр.
 *
 * Почему нет кнопки «Удалить»: на кухню ссылаются заведения и предпочтения
 * гостей, поэтому DELETE на сервере не удаляет, а снимает флаг активности.
 * Скрытая кухня исчезает из приложения и из выбора у заведений, но остаётся у
 * тех, кто её уже выбрал, и возвращается одной кнопкой.
 */

const copy = t.admin.cuisines;

export interface CuisineDictionaryClient {
  listCuisinesForAdmin(): Promise<CuisineDictionaryEntry[]>;
  createCuisine(input: CuisineSaveInput): Promise<CuisineDictionaryEntry>;
  updateCuisine(id: string, input: CuisineSaveInput): Promise<CuisineDictionaryEntry>;
  hideCuisine(id: string): Promise<CuisineDictionaryEntry>;
}

export function CuisinesView({ client = apiClient }: { client?: CuisineDictionaryClient }) {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) {
    return <EmptyState title={copy.adminOnlyTitle} description={copy.adminOnlyDescription} />;
  }
  return <CuisinesDictionary client={client} />;
}

/** Сам экран, без гейта: гейт читает контекст авторизации, а здесь только
 * данные и клиент — поэтому его можно рендерить против фейка. */
export function CuisinesDictionary({ client }: { client: CuisineDictionaryClient }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CuisineDictionaryEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["cuisines-admin"],
    queryFn: () => client.listCuisinesForAdmin(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["cuisines-admin"] });
    // Публичный список — тот же справочник другими глазами: он тоже устарел.
    void queryClient.invalidateQueries({ queryKey: ["cuisines"] });
  };

  const items = useMemo(() => sortCuisines(query.data ?? []), [query.data]);

  const visibility = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      visible ? client.updateCuisine(id, { is_active: true }) : client.hideCuisine(id),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: () => setActionError(copy.visibilityFailed),
  });

  /** Перестановка — это правки display_order у нескольких записей подряд.
   * Отдельной ручки «поменять местами» нет, поэтому правки идут одна за другой,
   * и если какая-то не легла, человеку говорят прямо, а список перечитывается с
   * сервера — чтобы на экране был порядок сервера, а не наша догадка. */
  const reorder = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const patches = reorderCuisines(items, id, direction);
      for (const patch of patches) {
        await client.updateCuisine(patch.id, { display_order: patch.display_order });
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
        <div className="mt-md overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">{copy.colImage}</th>
                <th className="px-4 py-2 font-medium">{copy.colName}</th>
                <th className="px-4 py-2 font-medium">{copy.colOrder}</th>
                <th className="px-4 py-2 font-medium">{copy.colStatus}</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <CuisineThumb url={item.image_url ?? null} name={item.name} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="break-words font-medium text-neutral-900">{item.name}</div>
                    <div className="text-[12px] text-neutral-500">{item.code}</div>
                  </td>
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
      )}

      {actionError ? (
        <p className="mt-md text-sm text-brand" role="alert">
          {actionError}
        </p>
      ) : null}

      {creating ? (
        <CuisineFormModal
          title={copy.newTitle}
          save={(input) => client.createCuisine(input)}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            invalidate();
          }}
        />
      ) : null}

      {editing ? (
        <CuisineFormModal
          title={editing.name}
          entry={editing}
          save={(input) => client.updateCuisine(editing.id, input)}
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

/** Миниатюра кухни. Обычный <img>, а не next/image: адреса произвольные (R2), и
 * битая ссылка не должна оставлять дыру — вместо неё подпись. */
function CuisineThumb({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <span className="text-[12px] text-neutral-400">{copy.noImage}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      className="h-10 w-10 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/** Код кухни — машинный ключ: по нему клиент подбирает запасную картинку, и он
 * ездит в адресной строке. Сервер валидирует его тем же правилом. */
const CODE_RE = /^[a-z0-9_]+$/;

function CuisineFormModal({
  title,
  entry,
  save,
  onClose,
  onSaved,
}: {
  title: string;
  entry?: CuisineDictionaryEntry;
  save: (input: CuisineSaveInput) => Promise<CuisineDictionaryEntry>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(entry?.name ?? "");
  const [code, setCode] = useState(entry?.code ?? "");
  const [image, setImage] = useState(entry?.image_url ?? "");
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
    // image_url отправляется всегда: пустая строка — это «убрать картинку», и
    // сервер понимает её именно так (пустое значение обнуляет поле).
    mutation.mutate({ name: trimmedName, code: trimmedCode, image_url: image.trim() });
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-md">
        <Field label={copy.fieldName} required>
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

        {/* Картинку кухни показывают КРУЖКОМ 72 pt на главной приложения, а не
            обложкой — поэтому потолок свой, маленький. Без него в бакет
            уезжает исходный PNG на 200–430 КБ ради 216 пикселей на экране
            (замер 2026-08-25, см. lib/image-downscale.ts). */}
        <ImageUploadField
          value={image}
          onChange={setImage}
          label={copy.fieldImage}
          hint={copy.fieldImageHint}
          maxEdge={CIRCLE_MAX_EDGE}
        />

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

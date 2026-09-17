"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FOODIE_DIET_EXCLUSIVE_CODE,
  FOODIE_PRICE_CATEGORIES,
  buildFoodieI18nField,
  canHideFoodieOption,
  flattenFoodieOptions,
  isLastActiveOfKind,
  reorderFoodieOptions,
  sortFoodieOptions,
  translationDraftFrom,
  type CuisineDictionaryEntry,
  type FoodieOptionEntry,
  type FoodieOptionKind,
  type FoodieOptionSaveInput,
  type FoodieOptionsAdminResponse,
  type FoodiePriceCategory,
  type TranslationDraft,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useIsPlatformAdmin } from "@/lib/use-venue-catalog";

import { EmptyState, ErrorState, LoadingState } from "../StateViews";
import { Button } from "../ui/Button";
import { CheckboxRow, Field, Select, TextInput } from "../ui/FormControls";
import { CIRCLE_MAX_EDGE } from "@/lib/image-downscale";
import { ImageUploadField } from "../ui/ImageUploadField";
import { Modal } from "../ui/Modal";
import { TranslatedField, TranslationCoverageNote } from "../ui/TranslatedField";
import { foodieOptionErrorText, foodieOptionsCopy as copy } from "./copy";

/**
 * «Фуди-профиль» — справочник плиток визарда гостя (спека
 * foodie-profile-admin-dictionaries-20260916.md, FE-A1): кухни, диеты,
 * аллергии, бюджет — те же четыре шага, что гость проходит в мобильном
 * визарде, раньше вшитые в код, теперь платформенный справочник.
 *
 * Построен НАПРЯМУЮ по образцу `CuisinesView`/`CuisinesDictionary` (тот же
 * DELETE-это-скрытие, тот же список + модалка), но с одним запросом на все
 * четыре вкладки: `GET /admin/foodie-profile/options` отдаёт бакет
 * `{cuisines, diets, allergies, budgets}` целиком (спека §5), поэтому вкладки
 * — это фильтр по уже загруженным данным, а не четыре отдельных запроса.
 *
 * Кухня-плитка ссылается на справочник «Кухни заведений» (`cuisine_ids`,
 * 🔴1 = A): без связи плитка сохраняется и показывается гостю, но НЕ даёт
 * очков в ряду «Для вас» — это видно колонкой «Влияет на подбор» и
 * подсчитано СЕРВЕРОМ (`affects_matching`), клиент её не пересчитывает.
 *
 * Про переводы (`name_i18n`/`description_i18n`/`price_label_i18n`) — см.
 * заголовок `packages/api/src/admin/foodie-options.ts`: эта ручка (как и
 * `/admin/cuisines`) заменяет карту переводов ЦЕЛИКОМ, а не патчем, поэтому
 * здесь `buildFoodieI18nField`, а не `buildTranslationPatch`.
 */

export interface FoodieOptionsClient {
  listFoodieOptionsForAdmin(): Promise<FoodieOptionsAdminResponse>;
  createFoodieOption(input: FoodieOptionSaveInput): Promise<FoodieOptionEntry>;
  updateFoodieOption(id: string, input: FoodieOptionSaveInput): Promise<FoodieOptionEntry>;
  hideFoodieOption(id: string): Promise<FoodieOptionEntry>;
  listCuisinesForAdmin(): Promise<CuisineDictionaryEntry[]>;
}

const QUERY_KEY = ["foodie-options-admin"] as const;

const TABS: readonly { kind: FoodieOptionKind; label: string }[] = [
  { kind: "cuisine", label: copy.tabCuisine },
  { kind: "diet", label: copy.tabDiet },
  { kind: "allergy", label: copy.tabAllergy },
  { kind: "budget", label: copy.tabBudget },
];

function bucketFor(data: FoodieOptionsAdminResponse, kind: FoodieOptionKind): FoodieOptionEntry[] {
  switch (kind) {
    case "cuisine":
      return data.cuisines;
    case "diet":
      return data.diets;
    case "allergy":
      return data.allergies;
    case "budget":
      return data.budgets;
  }
}

export function FoodieOptionsView({ client = apiClient }: { client?: FoodieOptionsClient }) {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) {
    return <EmptyState title={copy.adminOnlyTitle} description={copy.adminOnlyDescription} />;
  }
  return <FoodieOptions client={client} />;
}

function FoodieOptions({ client }: { client: FoodieOptionsClient }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FoodieOptionKind>("cuisine");
  const [editing, setEditing] = useState<FoodieOptionEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => client.listFoodieOptionsForAdmin(),
  });

  const cuisineDictionaryQuery = useQuery({
    queryKey: ["cuisines-admin"],
    queryFn: () => client.listCuisinesForAdmin(),
    // Только вкладка «Кухни» читает справочник кухонь заведений — остальные
    // три его не показывают, лишний запрос им не нужен.
    enabled: tab === "cuisine",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const allItems = useMemo(
    () => (query.data ? flattenFoodieOptions(query.data) : []),
    [query.data],
  );
  const items = useMemo(
    () => (query.data ? sortFoodieOptions(bucketFor(query.data, tab)) : []),
    [query.data, tab],
  );

  const visibility = useMutation({
    mutationFn: ({ item, visible }: { item: FoodieOptionEntry; visible: boolean }) =>
      visible ? client.updateFoodieOption(item.id, { is_active: true }) : client.hideFoodieOption(item.id),
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: (error) => setActionError(foodieOptionErrorText(error)),
  });

  const reorder = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const patches = reorderFoodieOptions(items, id, direction);
      for (const patch of patches) {
        await client.updateFoodieOption(patch.id, { display_order: patch.display_order });
      }
    },
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: () => {
      setActionError(copy.orderFailed);
      void invalidate();
    },
  });

  const activeTab = TABS.find((t) => t.kind === tab)!;

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-text">{copy.title}</h1>
          <p className="mt-xxs max-w-[70ch] text-sm text-text-muted">{copy.subtitle}</p>
        </div>
        <Button onClick={() => setCreating(true)}>{copy.add}</Button>
      </header>

      <div role="tablist" aria-label={copy.title} className="flex flex-wrap gap-xs">
        {TABS.map((item) => (
          <button
            key={item.kind}
            type="button"
            role="tab"
            aria-selected={tab === item.kind}
            onClick={() => setTab(item.kind)}
            className={`min-h-[40px] rounded-pill px-lg text-sm font-medium transition-colors ${
              tab === item.kind ? "bg-brand text-white" : "bg-chip text-text hover:bg-hairline"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {actionError ? (
        <p role="alert" className="break-words text-sm text-brand">
          {actionError}
        </p>
      ) : null}

      {query.isPending ? (
        <LoadingState title={copy.loadingTitle} />
      ) : query.isError ? (
        <ErrorState message={copy.loadFailed} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-[12px] text-text-muted">
                <th className="px-md py-sm font-medium">{copy.colImage}</th>
                <th className="px-md py-sm font-medium">{copy.colName}</th>
                <th className="px-md py-sm font-medium">{copy.colOrder}</th>
                {tab === "cuisine" ? (
                  <th className="px-md py-sm font-medium">{copy.colMatching}</th>
                ) : null}
                <th className="px-md py-sm font-medium">{copy.colStatus}</th>
                <th className="px-md py-sm font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const pendingVisibility =
                  visibility.isPending && visibility.variables?.item.id === item.id;
                const pendingReorder = reorder.isPending;
                const hideAllowed = canHideFoodieOption(allItems, item);
                const hideBlockedReason =
                  item.kind === "diet" && item.code === FOODIE_DIET_EXCLUSIVE_CODE
                    ? copy.hideBlockedExclusive
                    : isLastActiveOfKind(allItems, item)
                      ? copy.hideBlockedLast
                      : undefined;

                return (
                  <tr key={item.id} className="border-b border-hairline last:border-0 align-top">
                    <td className="px-md py-sm">
                      <OptionThumb url={item.image_url ?? null} name={item.name} />
                    </td>
                    <td className="px-md py-sm">
                      <div className="break-words font-medium text-text">{item.name}</div>
                      <div className="text-[12px] text-text-muted">{item.code}</div>
                    </td>
                    <td className="px-md py-sm text-text">{index + 1}</td>
                    {tab === "cuisine" ? (
                      <td className="px-md py-sm">
                        {item.affects_matching ? copy.matchingYes : copy.matchingNo}
                      </td>
                    ) : null}
                    <td className="px-md py-sm">
                      {item.is_active ? (
                        <span className="text-text">{copy.statusVisible}</span>
                      ) : (
                        <span className="text-text-muted">{copy.statusHidden}</span>
                      )}
                    </td>
                    <td className="px-md py-sm">
                      <div className="flex flex-wrap justify-end gap-xs">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={index === 0 || pendingReorder}
                          aria-label={copy.moveUpAria(item.name)}
                          onClick={() => reorder.mutate({ id: item.id, direction: "up" })}
                        >
                          {copy.moveUp}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={index === items.length - 1 || pendingReorder}
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
                          loading={pendingVisibility}
                          disabled={item.is_active && !hideAllowed}
                          title={item.is_active ? hideBlockedReason : undefined}
                          aria-label={
                            item.is_active ? copy.hideAria(item.name) : copy.restoreAria(item.name)
                          }
                          onClick={() =>
                            visibility.mutate({ item, visible: !item.is_active })
                          }
                        >
                          {item.is_active ? copy.hide : copy.restore}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating ? (
        <FoodieOptionFormModal
          title={`${copy.newTitle} — ${activeTab.label}`}
          kind={tab}
          cuisineDictionary={cuisineDictionaryQuery.data ?? []}
          cuisineDictionaryLoading={cuisineDictionaryQuery.isLoading}
          cuisineDictionaryFailed={cuisineDictionaryQuery.isError}
          save={(input) => client.createFoodieOption({ kind: tab, ...input })}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void invalidate();
          }}
        />
      ) : null}

      {editing ? (
        <FoodieOptionFormModal
          title={editing.name}
          kind={editing.kind}
          entry={editing}
          cuisineDictionary={cuisineDictionaryQuery.data ?? []}
          cuisineDictionaryLoading={cuisineDictionaryQuery.isLoading}
          cuisineDictionaryFailed={cuisineDictionaryQuery.isError}
          save={(input) => client.updateFoodieOption(editing.id, input)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void invalidate();
          }}
        />
      ) : null}
    </section>
  );
}

/** Миниатюра плитки. Обычный <img>, а не next/image: адрес произвольный
 * (R2), а битая ссылка не должна оставлять дыру — вместо неё подпись. */
function OptionThumb({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <span className="text-[12px] text-text-muted">—</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      className="h-10 w-10 rounded-card object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/** Код — машинный ключ: на него ссылаются уже сохранённые профили гостей
 * (`user_foodie_*`, `users.foodie_budget_tier`), поэтому сервер отвергает
 * его смену на PATCH (422 «код неизменяем»), и форма его на правке даже не
 * предлагает трогать. Тот же алфавит, что на сервере. */
const CODE_RE = /^[a-z0-9_]+$/;

function FoodieOptionFormModal({
  title,
  kind,
  entry,
  cuisineDictionary,
  cuisineDictionaryLoading,
  cuisineDictionaryFailed,
  save,
  onClose,
  onSaved,
}: {
  title: string;
  kind: FoodieOptionKind;
  entry?: FoodieOptionEntry;
  /** Справочник кухонь заведений для мультивыбора — только `kind: "cuisine"`. */
  cuisineDictionary: readonly CuisineDictionaryEntry[];
  /** Различают «справочник ещё грузится» / «загрузка упала» от «в справочнике
   * реально нет активных кухонь» — иначе оба состояния молча схлопываются в
   * `fieldCuisinesEmpty`, и не заполненная форма выглядит как пустой каталог. */
  cuisineDictionaryLoading: boolean;
  cuisineDictionaryFailed: boolean;
  save: (input: FoodieOptionSaveInput) => Promise<FoodieOptionEntry>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!entry;
  const [name, setName] = useState(entry?.name ?? "");
  const [code, setCode] = useState(entry?.code ?? "");
  const [image, setImage] = useState(entry?.image_url ?? "");
  const [nameI18n, setNameI18n] = useState<TranslationDraft>(() =>
    translationDraftFrom(entry?.name_i18n),
  );
  const [cuisineIds, setCuisineIds] = useState<string[]>(entry?.cuisine_ids ?? []);
  const [description, setDescription] = useState(entry?.description ?? "");
  const [descriptionI18n, setDescriptionI18n] = useState<TranslationDraft>(() =>
    translationDraftFrom(entry?.description_i18n),
  );
  const [priceLabel, setPriceLabel] = useState(entry?.price_label ?? "");
  const [priceLabelI18n, setPriceLabelI18n] = useState<TranslationDraft>(() =>
    translationDraftFrom(entry?.price_label_i18n),
  );
  const [priceCategory, setPriceCategory] = useState<string>(entry?.price_category ?? "");
  const [error, setError] = useState<string | null>(null);

  const activeCuisines = useMemo(
    () => cuisineDictionary.filter((c) => c.is_active),
    [cuisineDictionary],
  );

  // Код-ревью 2026-09-17: плитка может быть связана с кухней заведений,
  // которую позже скрыли в `/admin/cuisines` (нет каскада на hide —
  // `foodieoption/repository.go` LEFT JOIN не смотрит на `is_active`). Если
  // показывать только `activeCuisines`, такая связь остаётся в `cuisineIds`
  // невидимой и несбрасываемой — сохранение падает 422 («сервер отклонил
  // запись»), а чекбокса, чтобы отвязать её, в форме нет. Показываем скрытые,
  // но всё ещё связанные, отдельным помеченным пунктом — админ может явно
  // снять галочку и сохранить.
  const hiddenLinkedCuisines = useMemo(
    () => cuisineDictionary.filter((c) => !c.is_active && cuisineIds.includes(c.id)),
    [cuisineDictionary, cuisineIds],
  );

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: onSaved,
    // Введённое редактором не выбрасывается: модалка остаётся открытой со
    // всеми полями, меняется только сообщение.
    onError: (err) => setError(foodieOptionErrorText(err)),
  });

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(copy.nameRequired);
      return;
    }

    let trimmedCode = "";
    if (!isEdit) {
      trimmedCode = code.trim().toLowerCase();
      if (!trimmedCode) {
        setError(copy.codeRequired);
        return;
      }
      if (!CODE_RE.test(trimmedCode)) {
        setError(copy.codeBad);
        return;
      }
    }

    setError(null);

    const input: FoodieOptionSaveInput = {
      name: trimmedName,
      // image_url отправляется всегда: пустая строка — «убрать картинку»,
      // сервер понимает её именно так (см. CuisineFormModal).
      image_url: image.trim(),
      name_i18n: buildFoodieI18nField(nameI18n, entry?.name_i18n),
    };
    if (!isEdit) input.code = trimmedCode;

    if (kind === "cuisine") {
      // Отправляется всегда, включая пустой массив: сервер ЗАМЕЩАЕТ связь
      // целиком (`cuisine_ids: *[]string`), а не дополняет.
      input.cuisine_ids = cuisineIds;
    }

    if (kind === "budget") {
      input.description = description.trim();
      input.description_i18n = buildFoodieI18nField(descriptionI18n, entry?.description_i18n);
      input.price_label = priceLabel.trim();
      input.price_label_i18n = buildFoodieI18nField(priceLabelI18n, entry?.price_label_i18n);
      // "" — явное снятие яруса (спека 3.10 «ярус можно оставить пустым»).
      input.price_category = priceCategory;
    }

    mutation.mutate(input);
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-md">
        <TranslationCoverageNote
          fields={[
            { label: copy.fieldName, translations: nameI18n },
            ...(kind === "budget"
              ? [
                  { label: copy.fieldDescription, translations: descriptionI18n },
                  { label: copy.fieldPriceLabel, translations: priceLabelI18n },
                ]
              : []),
          ]}
        />

        <TranslatedField
          id="foodie-option-name"
          label={copy.fieldName}
          required
          maxLength={40}
          base={name}
          onBaseChange={setName}
          translations={nameI18n}
          onTranslationsChange={setNameI18n}
          stored={entry?.name_i18n}
        />

        {isEdit ? (
          <Field label={copy.fieldCode} hint={copy.fieldCodeLocked}>
            <TextInput value={entry.code} disabled className="text-text-muted" />
          </Field>
        ) : (
          <Field label={copy.fieldCode} hint={copy.fieldCodeHint} required htmlFor="foodie-option-code">
            <TextInput
              id="foodie-option-code"
              value={code}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
        )}

        <ImageUploadField
          value={image}
          onChange={setImage}
          label={copy.fieldImage}
          hint={copy.fieldImageHint}
          maxEdge={CIRCLE_MAX_EDGE}
        />

        {kind === "cuisine" ? (
          <div className="flex flex-col gap-xs">
            <span className="text-sm font-medium text-text">{copy.fieldCuisines}</span>
            <p className="text-[12px] text-text-muted">{copy.fieldCuisinesHint}</p>
            {cuisineDictionaryLoading ? (
              <p className="text-[13px] text-text-muted">{copy.fieldCuisinesLoading}</p>
            ) : cuisineDictionaryFailed ? (
              <p role="alert" className="text-[13px] text-brand">
                {copy.fieldCuisinesFailed}
              </p>
            ) : activeCuisines.length === 0 && hiddenLinkedCuisines.length === 0 ? (
              <p className="text-[13px] text-text-muted">{copy.fieldCuisinesEmpty}</p>
            ) : (
              <div className="flex flex-col gap-xxs rounded-card border border-hairline p-sm">
                {activeCuisines.map((c) => (
                  <CheckboxRow
                    key={c.id}
                    label={c.name}
                    checked={cuisineIds.includes(c.id)}
                    onChange={(checked) =>
                      setCuisineIds((prev) =>
                        checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                      )
                    }
                  />
                ))}
              </div>
            )}
            {/* Кухня заведений скрыта в `/admin/cuisines`, но всё ещё
                связана с этой плиткой (см. hiddenLinkedCuisines выше) — без
                этого блока сохранение падает 422, а снять связь нечем. */}
            {!cuisineDictionaryLoading && !cuisineDictionaryFailed && hiddenLinkedCuisines.length > 0 ? (
              <div className="flex flex-col gap-xxs rounded-card border border-hairline border-dashed p-sm">
                <span className="text-[12px] text-text-muted">{copy.fieldCuisinesHiddenLinked}</span>
                {hiddenLinkedCuisines.map((c) => (
                  <CheckboxRow
                    key={c.id}
                    label={`${c.name} ${copy.fieldCuisinesHiddenSuffix}`}
                    checked={cuisineIds.includes(c.id)}
                    onChange={(checked) =>
                      setCuisineIds((prev) =>
                        checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                      )
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {kind === "budget" ? (
          <>
            <TranslatedField
              id="foodie-option-description"
              label={copy.fieldDescription}
              multiline
              base={description}
              onBaseChange={setDescription}
              translations={descriptionI18n}
              onTranslationsChange={setDescriptionI18n}
              stored={entry?.description_i18n}
            />
            <TranslatedField
              id="foodie-option-price-label"
              label={copy.fieldPriceLabel}
              hint={copy.fieldPriceLabelHint}
              base={priceLabel}
              onBaseChange={setPriceLabel}
              translations={priceLabelI18n}
              onTranslationsChange={setPriceLabelI18n}
              stored={entry?.price_label_i18n}
            />
            <Field
              label={copy.fieldPriceCategory}
              hint={copy.fieldPriceCategoryHint}
              htmlFor="foodie-option-price-category"
            >
              <Select
                id="foodie-option-price-category"
                value={priceCategory}
                onChange={(e) => setPriceCategory(e.target.value)}
              >
                <option value="">{copy.priceCategoryNone}</option>
                {FOODIE_PRICE_CATEGORIES.map((tier: FoodiePriceCategory) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}

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

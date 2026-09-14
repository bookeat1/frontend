"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  canTransitionPromoCodeStatus,
  type AdminListParams,
  type AdminPromo,
  type AdminPromoCode,
  type ApiPage,
  type CreatePromoCodeInput,
  type PatchPromoCodeInput,
  type PromoCodeListParams,
  type PromoCodeStatus,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { formatDateTime, isoToLocalInput, localInputToIso } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useIsPlatformAdmin } from "@/lib/use-venue-catalog";

import { EmptyState, ErrorState, LoadingState } from "../StateViews";
import { Button } from "../ui/Button";
import { Field, Select, TextInput, CheckboxRow } from "../ui/FormControls";
import { Modal } from "../ui/Modal";
import { promoCodeErrorText, promoCodesCopy as copy } from "./copy";

/**
 * «Промокоды» — код, который гость вводит на шаге подтверждения брони, чтобы
 * отметить участие в акции (кампания «Марафон Алматы», миграция 0108).
 *
 * Код НЕ создаёт акцию — он ссылается на уже существующую (`promotion_id`), в
 * том числе платформенную (см. «Акции платформы»). Раздел живёт в той же
 * группе меню и тем же стилем, что `PlatformPromosView`, но CRUD у него свой:
 * `/admin/promo-codes`, суперадмин-only, без id заведения в пути вовсе — код
 * не принадлежит ресторану.
 *
 * ВАЖНО про список: `GET /admin/promo-codes` отдаёт ПЛОСКИЙ массив
 * (`response.OK`), не `Page[T]` — в отличие от большинства других списков
 * кабинета. Пагинации у него сегодня нет.
 */
export interface PromoCodesClient {
  listPromoCodes(params?: PromoCodeListParams): Promise<AdminPromoCode[]>;
  createPromoCode(input: CreatePromoCodeInput): Promise<AdminPromoCode>;
  patchPromoCode(id: string, input: PatchPromoCodeInput): Promise<AdminPromoCode>;
  deletePromoCode(id: string): Promise<void>;
  listPlatformPromos(params?: AdminListParams): Promise<ApiPage<AdminPromo>>;
}

const QUERY_KEY = ["promo-codes"] as const;

const STATUS_STYLES: Record<PromoCodeStatus, string> = {
  draft: "bg-chip text-text-muted",
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  archived: "bg-rose-100 text-rose-700",
};

function statusLabel(status: PromoCodeStatus): string {
  switch (status) {
    case "draft":
      return copy.statusDraft;
    case "active":
      return copy.statusActive;
    case "paused":
      return copy.statusPaused;
    case "archived":
      return copy.statusArchived;
  }
}

function StatusBadge({ status }: { status: PromoCodeStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-pill px-sm py-xxs text-[11px] font-medium ${STATUS_STYLES[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function PlatformPromoCodesView({ client = apiClient }: { client?: PromoCodesClient }) {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) {
    return <EmptyState title={copy.adminOnlyTitle} description={copy.adminOnlyDescription} />;
  }
  return <PlatformPromoCodes client={client} />;
}

function PlatformPromoCodes({ client }: { client: PromoCodesClient }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => client.listPromoCodes(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const statusMutation = useMutation({
    mutationFn: ({ code, status }: { code: AdminPromoCode; status: PromoCodeStatus }) =>
      client.patchPromoCode(code.id, { status }),
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: (error) => setActionError(promoCodeErrorText(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (code: AdminPromoCode) => client.deletePromoCode(code.id),
    onSuccess: () => {
      setActionError(null);
      void invalidate();
    },
    onError: (error) => setActionError(promoCodeErrorText(error)),
  });

  const items = listQuery.data ?? [];

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-text">{copy.title}</h1>
          <p className="mt-xxs max-w-[60ch] text-sm text-text-muted">{copy.subtitle}</p>
        </div>
        <Button onClick={() => setCreating(true)}>{copy.createCode}</Button>
      </header>

      {actionError ? (
        <p role="alert" className="break-words text-sm text-brand">
          {actionError}
        </p>
      ) : null}

      {listQuery.isPending ? (
        <LoadingState title={copy.loading} />
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : (
        <>
          <p className="text-sm text-text-muted">{copy.total(items.length)}</p>
          <div className="overflow-x-auto rounded-card bg-surface">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[12px] text-text-muted">
                  <th className="px-md py-sm font-medium">{copy.columnCode}</th>
                  <th className="px-md py-sm font-medium">{copy.columnPromo}</th>
                  <th className="px-md py-sm font-medium">{copy.columnStatus}</th>
                  <th className="px-md py-sm font-medium">{copy.columnActivations}</th>
                  <th className="px-md py-sm font-medium">{copy.columnWindow}</th>
                  <th className="px-md py-sm font-medium">{copy.columnCreated}</th>
                  <th className="px-md py-sm font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((code) => {
                  const pendingStatus =
                    statusMutation.isPending && statusMutation.variables?.code.id === code.id;
                  const pendingDelete =
                    deleteMutation.isPending && deleteMutation.variables?.id === code.id;
                  const busy = pendingStatus || pendingDelete;
                  const nextStatus: PromoCodeStatus = code.status === "active" ? "paused" : "active";
                  const canToggle = canTransitionPromoCodeStatus(code.status, nextStatus);
                  // Акция скрыта/черновик/удалена, пока код активен — гость
                  // получит отказ, а причина в кабинете иначе не видна.
                  const promoMismatch = code.promo_missing || code.promo_status !== "published";

                  return (
                    <tr key={code.id} className="border-b border-hairline last:border-0 align-top">
                      <td className="whitespace-nowrap px-md py-sm font-mono text-[13px] font-semibold text-text">
                        {code.code}
                      </td>
                      <td className="px-md py-sm text-text">
                        <span className="break-words">{code.promo_missing ? code.promotion_id : code.promo_title}</span>
                        {promoMismatch ? (
                          <span className="ml-xs text-[12px] text-brand">
                            ({code.promo_missing ? copy.promoMissing : copy.promoHidden})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-md py-sm">
                        <StatusBadge status={code.status} />
                      </td>
                      <td className="whitespace-nowrap px-md py-sm text-text">
                        {code.activations}
                        {code.max_uses_total != null ? ` / ${code.max_uses_total}` : ` (${copy.noLimit})`}
                      </td>
                      <td className="whitespace-nowrap px-md py-sm text-[13px] text-text-muted">
                        {formatDateTime(code.starts_at)} — {formatDateTime(code.expires_at)}
                      </td>
                      <td className="whitespace-nowrap px-md py-sm text-[13px] text-text-muted">
                        {formatDateTime(code.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-md py-sm">
                        <div className="flex flex-wrap justify-end gap-xs">
                          {canToggle ? (
                            <Button
                              size="sm"
                              variant={code.status === "active" ? "secondary" : "primary"}
                              disabled={busy}
                              loading={pendingStatus}
                              onClick={() => {
                                setActionError(null);
                                statusMutation.mutate({ code, status: nextStatus });
                              }}
                            >
                              {code.status === "active" ? copy.deactivate : copy.activate}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            loading={pendingDelete}
                            onClick={() => {
                              if (!window.confirm(copy.confirmDelete)) return;
                              setActionError(null);
                              deleteMutation.mutate(code);
                            }}
                          >
                            {t.admin.common.delete}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {creating ? (
        <PromoCodeFormModal
          client={client}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void invalidate();
          }}
        />
      ) : null}
    </section>
  );
}

/** 3-32 латинских буквы/цифры после нормализации (пробелы/дефисы/подчёркивания
 * снимаются, регистр приводится к верхнему) — ТОЧНАЯ копия
 * `domain.NormalizePromoCode`/`domain.ValidatePromoCode` для подсказки до
 * отправки формы. Сервер всё равно проверяет заново и остаётся источником
 * истины. */
function looksLikeValidCode(raw: string): boolean {
  const normalized = raw.replace(/[\s\-_‐-―−]/g, "").toUpperCase();
  return /^[A-Z0-9]{3,32}$/.test(normalized);
}

function PromoCodeFormModal({
  client,
  onClose,
  onSaved,
}: {
  client: Pick<PromoCodesClient, "createPromoCode" | "listPlatformPromos">;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [startsAt, setStartsAt] = useState(isoToLocalInput(new Date().toISOString()));
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUsesTotal, setMaxUsesTotal] = useState("");
  const [maxUsesPerUser, setMaxUsesPerUser] = useState("1");
  const [activateNow, setActivateNow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const promosQuery = useQuery({
    queryKey: ["platform-promos-picker"],
    queryFn: () => client.listPlatformPromos({ per_page: 100 }),
  });
  const promos = promosQuery.data?.items ?? [];

  const mutation = useMutation({
    mutationFn: (input: CreatePromoCodeInput) => client.createPromoCode(input),
    onSuccess: onSaved,
    // Введённое не выбрасывается: модалка остаётся открытой со всеми полями,
    // меняется только сообщение.
    onError: (error) => setFormError(promoCodeErrorText(error)),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Второе нажатие, пока летит первое, создало бы второй код.
    if (mutation.isPending) return;
    setFormError(null);

    const trimmedCode = code.trim();
    if (!trimmedCode || !looksLikeValidCode(trimmedCode)) {
      setFormError(copy.codeShapeInvalid);
      return;
    }
    if (!promotionId) {
      setFormError(copy.promoRequired);
      return;
    }
    const startsIso = localInputToIso(startsAt);
    const expiresIso = localInputToIso(expiresAt);
    if (!startsIso || !expiresIso) {
      setFormError(t.admin.common.required);
      return;
    }
    if (new Date(expiresIso) <= new Date(startsIso)) {
      setFormError(copy.endBeforeStart);
      return;
    }

    let maxTotal: number | null = null;
    if (maxUsesTotal.trim()) {
      const parsed = Number(maxUsesTotal.trim());
      if (!Number.isInteger(parsed) || parsed < 1) {
        setFormError(copy.maxUsesTotalInvalid);
        return;
      }
      maxTotal = parsed;
    }

    const perUserRaw = maxUsesPerUser.trim();
    let perUser: number | undefined;
    if (perUserRaw) {
      const parsed = Number(perUserRaw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        setFormError(copy.maxUsesPerUserInvalid);
        return;
      }
      perUser = parsed;
    }

    mutation.mutate({
      code: trimmedCode,
      promotion_id: promotionId,
      starts_at: startsIso,
      expires_at: expiresIso,
      max_uses_total: maxTotal,
      max_uses_per_user: perUser,
      status: activateNow ? "active" : undefined,
    });
  }

  return (
    <Modal title={copy.createCodeTitle} onClose={onClose}>
      <form className="flex flex-col gap-md" onSubmit={submit} noValidate>
        <Field label={copy.fieldCode} required hint={copy.fieldCodeHint} htmlFor="promo-code-code">
          <TextInput
            id="promo-code-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={32}
            placeholder="MARATHON26"
          />
        </Field>

        <Field
          label={copy.fieldPromo}
          required
          hint={copy.fieldPromoHint}
          htmlFor="promo-code-promotion"
        >
          <Select
            id="promo-code-promotion"
            value={promotionId}
            onChange={(e) => setPromotionId(e.target.value)}
            disabled={promosQuery.isPending}
          >
            <option value="">{copy.fieldPromoPlaceholder}</option>
            {promos.map((promo) => (
              <option key={promo.id} value={promo.id}>
                {promo.title}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <Field label={copy.fieldStartsAt} required htmlFor="promo-code-starts">
            <TextInput
              id="promo-code-starts"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
          <Field label={copy.fieldExpiresAt} required htmlFor="promo-code-expires">
            <TextInput
              id="promo-code-expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <Field
            label={copy.fieldMaxUsesTotal}
            hint={copy.fieldMaxUsesTotalHint}
            htmlFor="promo-code-max-total"
          >
            <TextInput
              id="promo-code-max-total"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={maxUsesTotal}
              onChange={(e) => setMaxUsesTotal(e.target.value)}
            />
          </Field>
          <Field
            label={copy.fieldMaxUsesPerUser}
            hint={copy.fieldMaxUsesPerUserHint}
            htmlFor="promo-code-max-per-user"
          >
            <TextInput
              id="promo-code-max-per-user"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={maxUsesPerUser}
              onChange={(e) => setMaxUsesPerUser(e.target.value)}
            />
          </Field>
        </div>

        <CheckboxRow label={copy.activateNow} checked={activateNow} onChange={setActivateNow} />

        {formError ? (
          <p role="alert" className="break-words text-sm text-brand">
            {formError}
          </p>
        ) : null}

        <div className="mt-sm flex justify-end gap-sm">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.admin.common.cancel}
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {mutation.isPending ? t.admin.common.saving : t.admin.common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AcquirerAccount, KaspiCompany } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { CheckboxRow, Field, Select } from "./ui/FormControls";
import { ErrorState, LoadingState } from "./StateViews";

/**
 * «Приём оплаты» — на счёт какой компании в сервисе Kaspi попадают деньги
 * гостей этого заведения.
 *
 * Раньше идентификатор компании переписывали руками из другой панели, и цена
 * опечатки тут не «неудобно», а «деньги ушли не тому». Поэтому компанию
 * ВЫБИРАЮТ из списка, который отдаёт бэкенд (GET /admin/kaspi/companies).
 *
 * Две вещи, которые карточка обязана говорить вслух:
 *
 *  1. живая сессия кассира. Без неё компания в Kaspi выглядит рабочей
 *     («активна»), но ссылку на оплату не создаст — и узнают об этом от гостя;
 *  2. недоступный сервис Kaspi. Пустой список читался бы как «компаний нет»,
 *     поэтому 503 показывается словами, а кнопка сохранения запирается: менять
 *     привязку вслепую нельзя.
 *
 * Только для суперадмина: PUT привязки бэкенд разрешает лишь ему, список
 * компаний — тоже. Кто вешает карточку на экран, тот и проверяет роль
 * (см. SettingsView).
 */
const copy = t.admin.payments;

/** Провайдер, о котором эта карточка. Другие эквайеры сюда не заводятся: у
 * них нет ни счетов на выбор, ни сессии кассира. */
const PROVIDER = "kaspi";

export interface PaymentAcceptanceClient {
  getAcquirerAccount(restaurantId: string, provider: string): Promise<AcquirerAccount>;
  setAcquirerAccount(
    restaurantId: string,
    input: { provider: string; account_ref: string; is_active: boolean },
  ): Promise<AcquirerAccount>;
  listKaspiCompanies(): Promise<KaspiCompany[]>;
}

export function PaymentAcceptanceCard({
  restaurantId,
  client = apiClient,
}: {
  restaurantId: string;
  client?: PaymentAcceptanceClient;
}) {
  const queryClient = useQueryClient();
  const accountKey = useMemo(
    () => ["acquirer-account", PROVIDER, restaurantId] as const,
    [restaurantId],
  );

  const accountQuery = useQuery({
    queryKey: accountKey,
    queryFn: () => client.getAcquirerAccount(restaurantId, PROVIDER),
  });

  // Список компаний живёт отдельным запросом и НЕ блокирует карточку: сервис
  // Kaspi может лежать, а текущую привязку показать всё равно надо — это
  // первое, что спросят, когда оплата не проходит.
  const companiesQuery = useQuery({
    queryKey: ["kaspi-companies"] as const,
    queryFn: () => client.listKaspiCompanies(),
    retry: false,
  });

  if (accountQuery.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (accountQuery.isError) {
    return <ErrorState message={copy.loadFailed} onRetry={() => void accountQuery.refetch()} />;
  }

  return (
    <PaymentAcceptanceForm
      restaurantId={restaurantId}
      client={client}
      account={accountQuery.data}
      companies={companiesQuery.data}
      companiesLoading={companiesQuery.isPending}
      companiesFailed={companiesQuery.isError}
      onRetryCompanies={() => void companiesQuery.refetch()}
      onSaved={() => queryClient.invalidateQueries({ queryKey: accountKey })}
    />
  );
}

function PaymentAcceptanceForm({
  restaurantId,
  client,
  account,
  companies,
  companiesLoading,
  companiesFailed,
  onRetryCompanies,
  onSaved,
}: {
  restaurantId: string;
  client: PaymentAcceptanceClient;
  account: AcquirerAccount;
  companies: KaspiCompany[] | undefined;
  companiesLoading: boolean;
  companiesFailed: boolean;
  onRetryCompanies: () => void;
  onSaved: () => void;
}) {
  const [accountRef, setAccountRef] = useState(account.account_ref ?? "");
  const [isActive, setIsActive] = useState(account.is_active);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Идём за сервером: после сохранения (или повторной загрузки) поля обязаны
  // показывать ТО, ЧТО СОХРАНЕНО, а не то, что было выбрано.
  useEffect(() => {
    setAccountRef(account.account_ref ?? "");
    setIsActive(account.is_active);
  }, [account.account_ref, account.is_active]);

  const save = useMutation({
    mutationFn: (input: { account_ref: string; is_active: boolean }) =>
      client.setAcquirerAccount(restaurantId, { provider: PROVIDER, ...input }),
    onSuccess: () => {
      setLocalError(null);
      setNotice(copy.saved);
      onSaved();
    },
    onError: (error: unknown) => {
      setNotice(null);
      setLocalError(saveErrorMessage(error));
    },
  });

  const selected = companies?.find((c) => c.id === accountRef);
  // Компания, к которой заведение привязано, но которой в списке нет (сервис
  // недоступен, или её удалили в Kaspi): показать привязку всё равно надо.
  const boundName = selected?.name ?? account.account_ref;

  function submit() {
    setLocalError(null);
    setNotice(null);
    const ref = accountRef.trim();
    if (ref === "") {
      setLocalError(copy.emptySelection);
      return;
    }
    save.mutate({ account_ref: ref, is_active: isActive });
  }

  const dirty = accountRef.trim() !== (account.account_ref ?? "") || isActive !== account.is_active;
  const busy = save.isPending;

  return (
    <div className="rounded-card bg-surface p-lg">
      <h2 className="text-base font-semibold text-text">{copy.title}</h2>
      <p className="mt-xs max-w-prose text-[13px] text-text-muted">{copy.description}</p>

      <p className="mt-sm text-[13px] text-text">
        {account.connected ? copy.currentBinding(boundName, account.account_ref) : copy.notBound}
      </p>

      {companiesFailed ? (
        <div className="mt-md flex flex-wrap items-center gap-md">
          <span role="alert" className="text-sm text-brand">
            {copy.companiesUnavailable}
          </span>
          <Button variant="secondary" onClick={onRetryCompanies}>
            {copy.retry}
          </Button>
        </div>
      ) : null}

      <fieldset
        className="mt-lg flex flex-col gap-md border-0 p-0"
        disabled={busy || companiesLoading || companiesFailed}
      >
        <div className="max-w-[420px]">
          <Field label={copy.selectLabel} hint={copy.selectHint} htmlFor="kaspi-company">
            <Select
              id="kaspi-company"
              value={accountRef}
              onChange={(e) => {
                setAccountRef(e.target.value);
                setLocalError(null);
                setNotice(null);
              }}
            >
              <option value="">{copy.selectPlaceholder}</option>
              {/* Привязка, которой нет в списке, не должна молча пропасть из
                  поля: иначе «Сохранить» отправит чужой выбор. */}
              {account.account_ref !== "" && !companies?.some((c) => c.id === account.account_ref) ? (
                <option value={account.account_ref}>
                  {copy.optionLabel(account.account_ref, account.account_ref)}
                </option>
              ) : null}
              {(companies ?? []).map((company) => (
                <option key={company.id} value={company.id}>
                  {copy.optionLabel(company.name, company.id)}
                </option>
              ))}
            </Select>
          </Field>
          {companies?.length === 0 && !companiesLoading && !companiesFailed ? (
            <p className="mt-xs text-[12px] text-text-muted">{copy.emptyCompanies}</p>
          ) : null}
        </div>

        {selected ? <CompanyState company={selected} /> : null}

        <CheckboxRow
          label={copy.activeLabel}
          hint={copy.activeHint}
          checked={isActive}
          onChange={(next) => {
            setIsActive(next);
            setLocalError(null);
            setNotice(null);
          }}
        />

        <div className="flex flex-wrap items-center gap-md">
          <Button onClick={submit} loading={busy} disabled={!dirty}>
            {busy ? copy.saving : copy.save}
          </Button>
          {notice ? (
            <span role="status" className="text-sm text-text-muted">
              {notice}
            </span>
          ) : null}
          {localError ? (
            <span role="alert" className="text-sm text-brand">
              {localError}
            </span>
          ) : null}
        </div>
      </fieldset>
    </div>
  );
}

/**
 * Состояние выбранной компании. Сессия кассира стоит первой и отдельной
 * строкой: это единственный признак, по которому видно, пройдёт ли оплата
 * прямо сейчас.
 */
function CompanyState({ company }: { company: KaspiCompany }) {
  const live = company.has_active_session;
  return (
    <div className="flex flex-col gap-xxs">
      <span
        className={`inline-flex w-fit items-center rounded-pill px-md py-xs text-[12px] font-medium ${
          live ? "bg-[#e6f4ea] text-[#1c7d3f]" : "bg-chip text-text-muted"
        }`}
      >
        {live && company.last_session_ok_at
          ? copy.sessionLiveSince(formatDateTime(company.last_session_ok_at))
          : live
            ? copy.sessionLive
            : copy.sessionDown}
      </span>
      <span className="text-[12px] text-text-muted">{copy.statusLabel(company.status)}</span>
      {live ? null : (
        <span role="alert" className="max-w-prose text-[12px] text-brand">
          {copy.sessionWarning}
        </span>
      )}
    </div>
  );
}

/** 403 здесь означает ровно одно: привязку меняет только суперадмин. Общее
 * «не удалось сохранить» в этом случае отправило бы человека чинить не то. */
function saveErrorMessage(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  return status === 403 ? copy.saveForbidden : copy.saveFailed;
}

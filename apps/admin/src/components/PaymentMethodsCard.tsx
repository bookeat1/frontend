"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaymentMethodsInput, PaymentMethodsSettings } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { CheckboxRow } from "./ui/FormControls";
import { ErrorState, LoadingState } from "./StateViews";

/**
 * «Способы оплаты» — какие кнопки оплаты увидит гость этого заведения:
 * «Оплатить Kaspi» и/или «Оплатить картой», плюс главный переключатель.
 *
 * Только для суперадмина (бэкенд отвечает 403 остальным) — роль проверяет тот,
 * кто вешает карточку на экран (см. SettingsView). Привязка компании Kaspi
 * остаётся в «Приёме оплаты»; здесь только подсказка, когда Kaspi включён, а
 * привязки нет (гостю он тогда не покажется).
 *
 * `payments_enabled: null` — «наследует глобальную настройку». Пока человек не
 * тронул переключатель, на сервер уходит именно `null`, а не подсмотренное
 * значение: иначе любое сохранение методов молча закрепило бы заведение.
 */
const copy = t.admin.paymentMethods;

export interface PaymentMethodsClient {
  getPaymentMethods(restaurantId: string): Promise<PaymentMethodsSettings>;
  setPaymentMethods(restaurantId: string, input: PaymentMethodsInput): Promise<PaymentMethodsSettings>;
}

export function PaymentMethodsCard({
  restaurantId,
  client = apiClient,
}: {
  restaurantId: string;
  client?: PaymentMethodsClient;
}) {
  const queryClient = useQueryClient();
  const key = useMemo(() => ["payment-methods", restaurantId] as const, [restaurantId]);
  const query = useQuery({ queryKey: key, queryFn: () => client.getPaymentMethods(restaurantId) });

  if (query.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (query.isError) {
    return <ErrorState message={copy.loadFailed} onRetry={() => void query.refetch()} />;
  }
  return (
    <PaymentMethodsForm
      restaurantId={restaurantId}
      client={client}
      settings={query.data}
      onSaved={(saved) => queryClient.setQueryData(key, saved)}
    />
  );
}

function PaymentMethodsForm({
  restaurantId,
  client,
  settings,
  onSaved,
}: {
  restaurantId: string;
  client: PaymentMethodsClient;
  settings: PaymentMethodsSettings;
  onSaved: (saved: PaymentMethodsSettings) => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(settings.payments_enabled);
  const [kaspi, setKaspi] = useState(settings.methods.includes("kaspi"));
  const [card, setCard] = useState(settings.methods.includes("card"));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Поля следуют за сохранённым на сервере, а не за выбранным.
  useEffect(() => {
    setEnabled(settings.payments_enabled);
    setKaspi(settings.methods.includes("kaspi"));
    setCard(settings.methods.includes("card"));
  }, [settings]);

  const save = useMutation({
    mutationFn: (input: PaymentMethodsInput) => client.setPaymentMethods(restaurantId, input),
    onSuccess: (saved) => {
      setError(null);
      setNotice(copy.saved);
      onSaved(saved);
    },
    onError: (e: unknown) => {
      setNotice(null);
      setError((e as { status?: number } | null)?.status === 403 ? copy.saveForbidden : copy.saveFailed);
    },
  });

  const dirty =
    enabled !== settings.payments_enabled ||
    kaspi !== settings.methods.includes("kaspi") ||
    card !== settings.methods.includes("card");
  const busy = save.isPending;

  function touch<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setError(null);
      setNotice(null);
    };
  }

  return (
    <div className="rounded-card bg-surface p-lg">
      <h2 className="text-base font-semibold text-text">{copy.title}</h2>
      <p className="mt-xs max-w-prose text-[13px] text-text-muted">{copy.description}</p>

      <fieldset className="mt-lg flex flex-col gap-md border-0 p-0" disabled={busy}>
        <CheckboxRow
          label={copy.masterLabel}
          hint={enabled === null ? `${copy.masterHint} ${copy.inheritedHint}` : copy.masterHint}
          checked={enabled === true}
          onChange={touch(setEnabled)}
        />
        <CheckboxRow label={copy.kaspiLabel} checked={kaspi} onChange={touch(setKaspi)} />
        {kaspi && !settings.kaspi_account_bound ? (
          <p role="alert" className="max-w-prose text-[12px] text-brand">
            {copy.kaspiUnbound}
          </p>
        ) : null}
        <CheckboxRow label={copy.cardLabel} checked={card} onChange={touch(setCard)} />

        <div className="flex flex-wrap items-center gap-md">
          <Button
            onClick={() => {
              setError(null);
              setNotice(null);
              save.mutate({
                payments_enabled: enabled,
                methods: [...(kaspi ? (["kaspi"] as const) : []), ...(card ? (["card"] as const) : [])],
              });
            }}
            loading={busy}
            disabled={!dirty}
          >
            {busy ? copy.saving : copy.save}
          </Button>
          {notice ? (
            <span role="status" className="text-sm text-text-muted">
              {notice}
            </span>
          ) : null}
          {error ? (
            <span role="alert" className="text-sm text-brand">
              {error}
            </span>
          ) : null}
        </div>
      </fieldset>
    </div>
  );
}

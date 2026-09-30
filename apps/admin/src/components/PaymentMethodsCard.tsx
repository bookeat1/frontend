"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaymentMethodsInput, PaymentMethodsSettings } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { CheckboxRow, Field, Select } from "./ui/FormControls";
import { ErrorState, LoadingState } from "./StateViews";

/**
 * «Способы оплаты» — какие кнопки оплаты увидит гость этого заведения:
 * «Оплатить Kaspi» и/или «Оплатить картой», плюс главный переключатель.
 *
 * Только для суперадмина (бэкенд отвечает 403 остальным): карточка живёт в форме
 * заведения платформенного каталога (VenuesView), а тот экран открыт только
 * суперадмину. Привязка компании Kaspi
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
  onDirtyChange,
}: {
  restaurantId: string;
  client?: PaymentMethodsClient;
  /** Сообщает родителю, есть ли несохранённая правка (форма заведения тогда не закрывается). */
  onDirtyChange?: (dirty: boolean) => void;
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
      onDirtyChange={onDirtyChange}
    />
  );
}

function PaymentMethodsForm({
  restaurantId,
  client,
  settings,
  onSaved,
  onDirtyChange,
}: {
  restaurantId: string;
  client: PaymentMethodsClient;
  settings: PaymentMethodsSettings;
  onSaved: (saved: PaymentMethodsSettings) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(settings.payments_enabled);
  const [kaspi, setKaspi] = useState(settings.methods.includes("kaspi"));
  const [card, setCard] = useState(settings.methods.includes("card"));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Поля следуют за сохранённым на сервере, а не за выбранным.
  // Зависим только от сохранённых полей: обновление `kaspi_account_bound` (после
  // смены компании в «Приёме оплаты») не должно затирать несохранённый выбор.
  const savedMethods = settings.methods.join(",");
  useEffect(() => {
    setEnabled(settings.payments_enabled);
    setKaspi(savedMethods.split(",").includes("kaspi"));
    setCard(savedMethods.split(",").includes("card"));
  }, [settings.payments_enabled, savedMethods]);

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

  // Родитель (форма заведения) не должен закрыться, пока тут висит несохранённая
  // правка: общая кнопка «Сохранить» формы эту карточку не трогает.
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => onDirtyChangeRef.current?.(false), []);

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
        <Field label={copy.masterLabel} hint={copy.masterHint}>
          <Select
            value={enabled === null ? "inherit" : enabled ? "enabled" : "disabled"}
            onChange={(e) => {
              const v = e.target.value;
              touch(setEnabled)(v === "inherit" ? null : v === "enabled");
            }}
          >
            <option value="inherit">{copy.masterOptionInherit(settings.payments_enabled_global)}</option>
            <option value="enabled">{copy.masterOptionEnabled}</option>
            <option value="disabled">{copy.masterOptionDisabled}</option>
          </Select>
        </Field>
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

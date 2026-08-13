"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WhatsAppSettings } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { Field, TextInput } from "./ui/FormControls";
import { ErrorState, LoadingState } from "./StateViews";

const copy = t.admin.whatsapp;

/**
 * «Уведомления в WhatsApp» — близнец телеграм-карточки, потому что это тот же
 * канал уведомлений с другим транспортом, и второй, слегка иначе устроенный
 * экран настройки был бы лишней вещью для запоминания.
 *
 * Одно отличие важно: номер, который показывает карточка, — ВСЕГДА серверный.
 * Сервер приводит его к международному виду, и он же служит пропуском для
 * входящего нажатия кнопки в сообщении. Если бы поле продолжало показывать
 * набранное («8 701…»), человек видел бы одно, а работало бы другое.
 */

export interface WhatsAppClient {
  getWhatsAppSettings(restaurantId: string): Promise<WhatsAppSettings>;
  setWhatsAppPhone(restaurantId: string, phone: string): Promise<WhatsAppSettings>;
  clearWhatsAppSettings(restaurantId: string): Promise<void>;
}

export function WhatsAppNotificationCard({
  restaurantId,
  client = apiClient,
}: {
  restaurantId: string;
  client?: WhatsAppClient;
}) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["whatsapp-settings", restaurantId] as const, [restaurantId]);

  const settingsQuery = useQuery({
    queryKey,
    queryFn: () => client.getWhatsAppSettings(restaurantId),
  });

  if (settingsQuery.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (settingsQuery.isError) return <ErrorState onRetry={() => void settingsQuery.refetch()} />;

  return (
    <WhatsAppForm
      restaurantId={restaurantId}
      client={client}
      settings={settingsQuery.data}
      onChanged={() => queryClient.invalidateQueries({ queryKey })}
    />
  );
}

function WhatsAppForm({
  restaurantId,
  client,
  settings,
  onChanged,
}: {
  restaurantId: string;
  client: WhatsAppClient;
  settings: WhatsAppSettings;
  onChanged: () => void;
}) {
  const [phone, setPhone] = useState(settings.whatsapp_phone ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Следуем за сервером: после сохранения поле показывает нормализованный
  // номер, а не то, что было набрано.
  useEffect(() => {
    setPhone(settings.whatsapp_phone ?? "");
  }, [settings.whatsapp_phone]);

  const connect = useMutation({
    mutationFn: (value: string) => client.setWhatsAppPhone(restaurantId, value),
    onSuccess: (saved) => {
      setLocalError(null);
      setNotice(copy.connected);
      setPhone(saved.whatsapp_phone);
      onChanged();
    },
    onError: () => {
      setNotice(null);
      setLocalError(copy.connectFailed);
    },
  });

  const disconnect = useMutation({
    mutationFn: () => client.clearWhatsAppSettings(restaurantId),
    onSuccess: () => {
      setLocalError(null);
      setNotice(copy.disconnected);
      onChanged();
    },
    onError: () => {
      setNotice(null);
      setLocalError(copy.disconnectFailed);
    },
  });

  const busy = connect.isPending || disconnect.isPending;

  function submitConnect() {
    setLocalError(null);
    setNotice(null);
    const trimmed = phone.trim();
    if (trimmed === "") {
      setLocalError(copy.emptyPhone);
      return;
    }
    connect.mutate(trimmed);
  }

  return (
    <div className="rounded-card bg-surface p-lg">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h2 className="text-base font-semibold text-text">{copy.title}</h2>
        <ConnectionBadge connected={settings.connected} />
      </div>
      <p className="mt-xs max-w-prose text-[13px] text-text-muted">{copy.description}</p>

      {settings.connected && settings.whatsapp_phone ? (
        <p className="mt-sm text-[13px] text-text">{copy.currentPhone(settings.whatsapp_phone)}</p>
      ) : null}

      <fieldset className="mt-lg flex flex-col gap-md border-0 p-0" disabled={busy}>
        <div className="max-w-[360px]">
          <Field label={copy.inputLabel} hint={copy.inputHint} htmlFor="whatsapp-phone">
            <TextInput
              id="whatsapp-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder={copy.inputPlaceholder}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setLocalError(null);
                setNotice(null);
              }}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-md">
          <Button onClick={submitConnect} loading={connect.isPending}>
            {connect.isPending ? copy.connecting : copy.connect}
          </Button>
          {settings.connected ? (
            <Button
              variant="danger"
              onClick={() => {
                setLocalError(null);
                setNotice(null);
                disconnect.mutate();
              }}
              loading={disconnect.isPending}
            >
              {disconnect.isPending ? copy.disconnecting : copy.disconnect}
            </Button>
          ) : null}
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

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-md py-xs text-[12px] font-medium ${
        connected ? "bg-[#e6f4ea] text-[#1c7d3f]" : "bg-chip text-text-muted"
      }`}
    >
      {connected ? copy.statusConnected : copy.statusDisconnected}
    </span>
  );
}

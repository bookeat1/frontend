"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TelegramSettings } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { Field, TextInput } from "./ui/FormControls";
import { ErrorState, LoadingState } from "./StateViews";

/**
 * «Уведомления в Telegram» — the chat that receives this venue's booking/cancel
 * alerts. Connect with a numeric chat id or an @username, disconnect to stop.
 *
 * Both writes invalidate the settings query so the connected badge and the
 * prefilled id always reflect the server, never optimistic local state.
 */
const copy = t.admin.telegram;

export interface TelegramClient {
  getTelegramSettings(restaurantId: string): Promise<TelegramSettings>;
  setTelegramChatId(restaurantId: string, chatId: string): Promise<TelegramSettings>;
  clearTelegramSettings(restaurantId: string): Promise<void>;
}

export function TelegramNotificationCard({
  restaurantId,
  client = apiClient,
}: {
  restaurantId: string;
  client?: TelegramClient;
}) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["telegram-settings", restaurantId] as const, [restaurantId]);

  const settingsQuery = useQuery({
    queryKey,
    queryFn: () => client.getTelegramSettings(restaurantId),
  });

  if (settingsQuery.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (settingsQuery.isError) return <ErrorState onRetry={() => void settingsQuery.refetch()} />;

  return (
    <TelegramForm
      restaurantId={restaurantId}
      client={client}
      settings={settingsQuery.data}
      onChanged={() => queryClient.invalidateQueries({ queryKey })}
    />
  );
}

function TelegramForm({
  restaurantId,
  client,
  settings,
  onChanged,
}: {
  restaurantId: string;
  client: TelegramClient;
  settings: TelegramSettings;
  onChanged: () => void;
}) {
  const [chatId, setChatId] = useState(settings.telegram_chat_id ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Follow the server: after a connect/disconnect (or refetch) reset the input
  // to what is stored, so the field is never out of step with the badge.
  useEffect(() => {
    setChatId(settings.telegram_chat_id ?? "");
  }, [settings.telegram_chat_id]);

  const connect = useMutation({
    mutationFn: (id: string) => client.setTelegramChatId(restaurantId, id),
    onSuccess: () => {
      setLocalError(null);
      setNotice(copy.connected);
      onChanged();
    },
    onError: () => {
      setNotice(null);
      setLocalError(copy.connectFailed);
    },
  });

  const disconnect = useMutation({
    mutationFn: () => client.clearTelegramSettings(restaurantId),
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
    const trimmed = chatId.trim();
    if (trimmed === "") {
      setLocalError(copy.emptyChat);
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

      {settings.connected && settings.telegram_chat_id ? (
        <p className="mt-sm text-[13px] text-text">{copy.currentChat(settings.telegram_chat_id)}</p>
      ) : null}

      <fieldset className="mt-lg flex flex-col gap-md border-0 p-0" disabled={busy}>
        <div className="max-w-[360px]">
          <Field label={copy.inputLabel} hint={copy.inputHint} htmlFor="telegram-chat-id">
            <TextInput
              id="telegram-chat-id"
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder={copy.inputPlaceholder}
              value={chatId}
              onChange={(e) => {
                setChatId(e.target.value);
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

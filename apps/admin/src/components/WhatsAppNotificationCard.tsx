"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  isWhatsAppPhoneShaped,
  normalizeWhatsAppPhone,
  type WhatsAppSettings,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { Field, TextInput } from "./ui/FormControls";
import { ErrorState, LoadingState } from "./StateViews";

/**
 * «Брони в WhatsApp» — сестра телеграмной карточки: один номер, куда уходят
 * оповещения о новых бронях. Подключить — отключить, больше здесь ничего нет.
 *
 * Почему так мало. До этого карточка показывала ещё сводку адресатов и список
 * согласий персонала, и владелец, глядя на неё, не мог сказать, что она
 * делает. Согласия сотрудников продолжают жить в базе и продолжают получать
 * брони — панель их просто не показывает; сервер схлопывает совпавшие номера,
 * поэтому один аппарат получает одно сообщение.
 *
 * Чего здесь нельзя делать:
 *
 *  1. Показывать набранное вместо сохранённого. Номер приводит СЕРВЕР, и им же
 *     опознаётся входящее нажатие кнопки в сообщении. Покажи карточка «8 701…»,
 *     человек видел бы одно, а работало бы другое — молча.
 *  2. Обещать значком «Подключено» больше, чем канал делает. Строка состояния
 *     называет номер, на который брони РЕАЛЬНО уходят, а выключенный рубильник
 *     канала проговаривает вслух.
 */
const copy = t.admin.whatsapp;

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

  // Следуем за сервером: после подключения/отключения (и после любого
  // обновления запроса) в поле оказывается сохранённый номер, а не набранный.
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
  const connectedPhone =
    settings.connected && settings.whatsapp_phone ? settings.whatsapp_phone : null;

  function submitConnect() {
    setLocalError(null);
    setNotice(null);
    const trimmed = phone.trim();
    if (trimmed === "") {
      setLocalError(copy.emptyPhone);
      return;
    }
    // Приводим здесь же: сервер сохранит именно этот вид, и отправлять ему
    // что-то другое значит показать человеку одно, а записать другое.
    const normalized = normalizeWhatsAppPhone(trimmed);
    if (!isWhatsAppPhoneShaped(normalized)) {
      setLocalError(copy.invalidPhone);
      return;
    }
    connect.mutate(normalized);
  }

  return (
    <div className="rounded-card bg-surface p-lg">
      <h2 className="text-base font-semibold text-text">{copy.title}</h2>
      <p className="mt-xs max-w-prose text-[13px] text-text-muted">{copy.description}</p>

      <p className="mt-sm max-w-prose text-[13px] text-text">
        {connectedPhone ? copy.stateConnected(connectedPhone) : copy.stateDisconnected}
      </p>
      {/* Рубильник канала из кабинета не выключается, но если он выключен,
          подключённый номер всё равно молчит — и об этом надо сказать. */}
      {connectedPhone && !settings.enabled ? (
        <p className="mt-xs max-w-prose text-[13px] text-text-muted">{copy.channelOff}</p>
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

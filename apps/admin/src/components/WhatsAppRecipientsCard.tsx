"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  canEditManagerWhatsApp,
  classifyManagerWhatsAppFailure,
  parseManagerWhatsAppDraft,
  resolveWhatsAppRecipients,
  type ManagerWhatsAppDraftError,
  type ManagerWhatsAppFailureKind,
  type RestaurantManager,
  type SetManagerWhatsAppInput,
  type StaffActor,
  type WhatsAppRecipients,
  type WhatsAppSettings,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { CheckboxRow, Field, TextInput } from "./ui/FormControls";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";

/**
 * «Брони в WhatsApp» — ОДНА карточка на весь канал: номер заведения и личные
 * номера сотрудников, которые согласились получать брони.
 *
 * Почему одна. До этого на «Настройках» стояли два блока подряд —
 * «Уведомления в WhatsApp» (номер заведения) и «Сотрудники и WhatsApp»
 * (согласия), — и человек честно не понимал, зачем их два и какой из них
 * что-то доставляет. Хуже: зелёное «Подключено» у первого блока обещало
 * доставку, которой не было — рассылка шла только по сотрудникам. Теперь
 * номер заведения тоже адресат, и вместо значка «подключено» карточка прямо
 * перечисляет, КОМУ придёт бронь, а если никому — говорит об этом.
 *
 * Правила, которые здесь нельзя нарушить:
 *
 *  1. Номер, который показывает карточка, — ВСЕГДА серверный. Сервер приводит
 *     его к международному виду, и он же служит пропуском для входящего
 *     нажатия кнопки в сообщении. Показывай карточка набранное («8 701…»),
 *     человек видел бы одно, а работало бы другое.
 *  2. «Согласие есть, номера нет» недостижимо. Сервер отвечает на это 422, но
 *     человек не должен узнавать правило из ошибки: галочка без номера просто
 *     не отправляется, и рядом стоит объяснение.
 *  3. Мёртвых контролов нет. Список персонала видит владелец заведения (право
 *     `staff.manage`) или платформа, а МЕНЯТЬ строку может суперадмин, сам
 *     сотрудник или тот, кто СТРОГО старше по роли. Владелец не правит
 *     второго владельца — такая строка показывается только на чтение, а не
 *     кнопкой, которая упадёт 403.
 *  4. «Никому не придёт» говорится только когда это ПРАВДА. Роль без доступа к
 *     списку персонала видит неполную картину, и сводка это оговаривает.
 *
 * Ограничение, о котором честнее сказать вслух: имени сотрудника API не
 * отдаёт — в строке персонала есть только `user_id`. Поэтому человек в списке
 * опознаётся ролью, пометкой «Вы» и хвостом id.
 */

const copy = t.admin.whatsapp;

export interface WhatsAppRecipientsClient {
  getWhatsAppSettings(restaurantId: string): Promise<WhatsAppSettings>;
  setWhatsAppPhone(restaurantId: string, phone: string): Promise<WhatsAppSettings>;
  clearWhatsAppSettings(restaurantId: string): Promise<void>;
  listManagers(restaurantId: string): Promise<RestaurantManager[]>;
  setManagerWhatsApp(
    restaurantId: string,
    managerId: string,
    input: SetManagerWhatsAppInput,
  ): Promise<RestaurantManager>;
}

const DRAFT_ERROR_COPY: Record<ManagerWhatsAppDraftError, string> = {
  phone_required: copy.errorPhoneRequired,
  phone_invalid: copy.errorPhoneInvalid,
  nothing_to_change: copy.errorNothingToChange,
};

const FAILURE_COPY: Record<ManagerWhatsAppFailureKind, string> = {
  forbidden: copy.errorForbidden,
  refused: copy.errorRefused,
  unauthorized: copy.errorUnauthorized,
  not_found: copy.errorNotFound,
  unknown: copy.errorUnknown,
};

function roleLabel(role: string): string {
  switch (role) {
    case "owner":
      return copy.roleOwner;
    case "manager":
      return copy.roleManager;
    case "hostess":
      return copy.roleHostess;
    default:
      return role;
  }
}

export function WhatsAppRecipientsCard({
  restaurantId,
  actorUserId,
  isPlatformAdmin,
  client = apiClient,
}: {
  restaurantId: string;
  actorUserId: string;
  isPlatformAdmin: boolean;
  client?: WhatsAppRecipientsClient;
}) {
  const queryClient = useQueryClient();
  const settingsKey = useMemo(() => ["whatsapp-settings", restaurantId] as const, [restaurantId]);
  const managersKey = useMemo(() => ["restaurant-managers", restaurantId] as const, [restaurantId]);

  const settingsQuery = useQuery({
    queryKey: settingsKey,
    queryFn: () => client.getWhatsAppSettings(restaurantId),
  });
  const managersQuery = useQuery({
    queryKey: managersKey,
    queryFn: () => client.listManagers(restaurantId),
    retry: false,
  });

  if (settingsQuery.isPending || managersQuery.isPending) {
    return <LoadingState title={copy.loadingTitle} />;
  }
  // Настройки заведения — сердце карточки: без них показывать нечего.
  if (settingsQuery.isError) return <ErrorState onRetry={() => void settingsQuery.refetch()} />;

  const settings = settingsQuery.data;
  // 403 на список персонала — не поломка: список просто не для этой роли.
  const staffForbidden =
    managersQuery.isError && classifyManagerWhatsAppFailure(managersQuery.error) === "forbidden";
  const managers: RestaurantManager[] | null = managersQuery.isError ? null : managersQuery.data;

  const recipients = resolveWhatsAppRecipients({
    venuePhone: settings.whatsapp_phone,
    venueEnabled: settings.enabled,
    // Список не загрузился (не 403) — картина тоже неполная, и «никому» из неё
    // выводить нельзя.
    staff: managers,
  });

  const actor: StaffActor = {
    userId: actorUserId,
    isPlatformAdmin,
    // Своя же строка в списке — она и есть роль актора в ЭТОМ заведении.
    // Отдельного запроса за ролью не нужно; у суперадмина строки может не быть.
    staffRole: managers?.find((m) => m.user_id === actorUserId)?.role ?? null,
  };

  return (
    <div className="rounded-card bg-surface p-lg">
      <h2 className="text-base font-semibold text-text">{copy.title}</h2>
      <p className="mt-xs max-w-prose text-[13px] text-text-muted">{copy.description}</p>

      <RecipientsSummary recipients={recipients} />

      <section className="mt-xl">
        <h3 className="text-sm font-semibold text-text">{copy.venueSectionTitle}</h3>
        <p className="mt-xs max-w-prose text-[13px] text-text-muted">
          {copy.venueSectionDescription}
        </p>
        <VenueNumberForm
          restaurantId={restaurantId}
          client={client}
          settings={settings}
          onChanged={() => queryClient.invalidateQueries({ queryKey: settingsKey })}
        />
      </section>

      <section className="mt-xl">
        <h3 className="text-sm font-semibold text-text">{copy.staffSectionTitle}</h3>
        <p className="mt-xs max-w-prose text-[13px] text-text-muted">
          {copy.staffSectionDescription}
        </p>

        {managers === null ? (
          <div className="mt-lg">
            {staffForbidden ? (
              <EmptyState title={copy.forbiddenTitle} description={copy.forbiddenDescription} />
            ) : (
              <ErrorState
                message={copy.staffLoadFailed}
                onRetry={() => void managersQuery.refetch()}
              />
            )}
          </div>
        ) : managers.length === 0 ? (
          <div className="mt-lg">
            <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
          </div>
        ) : (
          <ul className="mt-lg flex flex-col gap-md">
            {managers.map((manager) => (
              <li key={manager.id}>
                <StaffRow
                  restaurantId={restaurantId}
                  client={client}
                  manager={manager}
                  editable={canEditManagerWhatsApp(actor, manager)}
                  isSelf={manager.user_id === actorUserId}
                  onSaved={(saved) => {
                    // Правда — на сервере: подменяем ровно одну строку, чтобы у
                    // остальных не сменилась ссылка (и не сбросился их набор).
                    queryClient.setQueryData<RestaurantManager[]>(managersKey, (prev) =>
                      (prev ?? []).map((m) => (m.id === saved.id ? saved : m)),
                    );
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Ответ на единственный вопрос, ради которого человек открывает эту карточку:
 * придёт ли бронь хоть кому-нибудь и кому именно.
 */
function RecipientsSummary({ recipients }: { recipients: WhatsAppRecipients }) {
  const somebody = recipients.venuePhone !== null || recipients.staff.length > 0;

  return (
    <div
      className={`mt-md rounded-card p-md ${somebody ? "bg-[#f2faf4]" : "bg-chip"}`}
    >
      {somebody ? (
        <>
          <p className="text-[13px] font-medium text-text">{copy.recipientsTitle}</p>
          <ul className="mt-xs flex flex-col gap-[2px]">
            {recipients.venuePhone ? (
              <li className="text-[13px] text-text">{copy.recipientsVenue(recipients.venuePhone)}</li>
            ) : null}
            {recipients.staff.map((r) => (
              <li key={r.managerId} className="text-[13px] text-text">
                {copy.recipientsStaff(roleLabel(r.role), r.phone)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="text-[13px] font-medium text-text">
            {recipients.nobody ? copy.nobodyTitle : copy.staffUnknownNote}
          </p>
          {recipients.nobody ? (
            <p className="mt-xs text-[13px] text-text-muted">
              {recipients.channelOff ? copy.channelOffDescription : copy.nobodyDescription}
            </p>
          ) : null}
        </>
      )}

      {/* Неполная картина не должна читаться как полная. */}
      {somebody && !recipients.staffVisible ? (
        <p className="mt-xs text-[13px] text-text-muted">{copy.staffUnknownNote}</p>
      ) : null}

    </div>
  );
}

function VenueNumberForm({
  restaurantId,
  client,
  settings,
  onChanged,
}: {
  restaurantId: string;
  client: WhatsAppRecipientsClient;
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
    <>
      {settings.connected && settings.whatsapp_phone ? (
        <p className="mt-sm text-[13px] text-text">{copy.currentPhone(settings.whatsapp_phone)}</p>
      ) : null}

      <fieldset className="mt-md flex flex-col gap-md border-0 p-0" disabled={busy}>
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
    </>
  );
}

function StaffRow({
  restaurantId,
  client,
  manager,
  editable,
  isSelf,
  onSaved,
}: {
  restaurantId: string;
  client: WhatsAppRecipientsClient;
  manager: RestaurantManager;
  editable: boolean;
  isSelf: boolean;
  onSaved: (saved: RestaurantManager) => void;
}) {
  const [optIn, setOptIn] = useState(manager.whatsapp_opt_in);
  const [phone, setPhone] = useState(manager.whatsapp_phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Следуем за сервером: после сохранения в поле оказывается приведённый им
  // номер, а не набранный. Сверяемся по ССЫЛКЕ на строку — react-query отдаёт
  // ту же, пока сервер не сказал ничего нового, и безусловный сброс на каждый
  // рендер затирал бы набираемое.
  const syncedRef = useRef(manager);
  useEffect(() => {
    if (syncedRef.current === manager) return;
    syncedRef.current = manager;
    setOptIn(manager.whatsapp_opt_in);
    setPhone(manager.whatsapp_phone ?? "");
  }, [manager]);

  const save = useMutation({
    mutationFn: (body: SetManagerWhatsAppInput) =>
      client.setManagerWhatsApp(restaurantId, manager.id, body),
    onSuccess: (saved) => {
      setError(null);
      setNotice(copy.saved);
      onSaved(saved);
    },
    onError: (cause) => {
      setNotice(null);
      setError(FAILURE_COPY[classifyManagerWhatsAppFailure(cause)]);
    },
  });

  const parsed = parseManagerWhatsAppDraft({ optIn, phone }, manager);
  // Незаполненный номер при включённой галочке объясняем сразу, не по нажатию:
  // кнопка при этом выключена, а выключенная кнопка сама ничего не объясняет.
  const blocking = !parsed.ok && parsed.error === "phone_required" ? parsed.error : null;
  const canSubmit = parsed.ok && !save.isPending;

  const covered = manager.whatsapp_opt_in && Boolean(manager.whatsapp_phone);

  return (
    <div
      className={`rounded-card border p-md ${
        covered ? "border-[#1c7d3f]/30 bg-[#f2faf4]" : "border-hairline bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <div className="flex flex-wrap items-center gap-sm">
          <span className="text-sm font-medium text-text">{roleLabel(manager.role)}</span>
          {isSelf ? (
            <span className="rounded-pill bg-chip px-sm py-[2px] text-[12px] text-text-muted">
              {copy.you}
            </span>
          ) : null}
          <span className="text-[12px] text-text-muted">
            {copy.idTail(manager.user_id.slice(-6))}
          </span>
        </div>
        <span
          className={`inline-flex items-center rounded-pill px-md py-xs text-[12px] font-medium ${
            covered ? "bg-[#e6f4ea] text-[#1c7d3f]" : "bg-chip text-text-muted"
          }`}
        >
          {covered ? copy.badgeOn : copy.badgeOff}
        </span>
      </div>

      <p className="mt-xs text-[13px] text-text-muted">
        {manager.whatsapp_phone ? copy.staffCurrentPhone(manager.whatsapp_phone) : copy.noPhone}
      </p>

      {editable ? (
        <fieldset className="mt-md flex flex-col gap-sm border-0 p-0" disabled={save.isPending}>
          <CheckboxRow
            label={copy.optInLabel}
            checked={optIn}
            onChange={(next) => {
              setOptIn(next);
              setError(null);
              setNotice(null);
            }}
          />
          <div className="max-w-[360px]">
            <Field
              label={copy.phoneLabel}
              hint={copy.phoneHint}
              htmlFor={`staff-whatsapp-phone-${manager.id}`}
            >
              <TextInput
                id={`staff-whatsapp-phone-${manager.id}`}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder={copy.phonePlaceholder}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError(null);
                  setNotice(null);
                }}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-md">
            <Button
              onClick={() => {
                if (!parsed.ok) {
                  setNotice(null);
                  setError(DRAFT_ERROR_COPY[parsed.error]);
                  return;
                }
                setError(null);
                setNotice(null);
                save.mutate(parsed.body);
              }}
              disabled={!canSubmit}
              loading={save.isPending}
            >
              {save.isPending ? copy.saving : copy.save}
            </Button>
            {blocking ? (
              <span role="alert" className="text-sm text-brand">
                {DRAFT_ERROR_COPY[blocking]}
              </span>
            ) : null}
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
      ) : (
        <p className="mt-sm text-[13px] text-text-muted">{copy.readOnlyNote}</p>
      )}
    </div>
  );
}

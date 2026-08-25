"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  canEditManagerWhatsApp,
  classifyManagerWhatsAppFailure,
  parseManagerWhatsAppDraft,
  type ManagerWhatsAppDraftError,
  type ManagerWhatsAppFailureKind,
  type RestaurantManager,
  type SetManagerWhatsAppInput,
  type StaffActor,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { CheckboxRow, Field, TextInput } from "./ui/FormControls";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";

/**
 * «Сотрудники и WhatsApp» — единственное место, где согласие сотрудника
 * получать брони в WhatsApp вообще можно включить.
 *
 * До этой карточки колонки `whatsapp_opt_in`/`whatsapp_phone` писались только
 * при СОЗДАНИИ строки персонала, то есть ни одно живое заведение включить
 * канал не могло. Бэкенд научился их менять (PATCH
 * /restaurants/:id/managers/:managerID), UI не было — канал молчал.
 *
 * Два правила, которые здесь нельзя нарушить:
 *
 *  1. «Согласие есть, номера нет» недостижимо. Сервер отвечает на это 422, но
 *     человек не должен узнавать правило из ошибки: галочка без номера просто
 *     не отправляется, и рядом стоит объяснение.
 *  2. Мёртвых контролов нет. Список видит владелец заведения (право
 *     `staff.manage`) или платформа, а МЕНЯТЬ строку может суперадмин, сам
 *     сотрудник или тот, кто СТРОГО старше по роли. Владелец не правит
 *     второго владельца — такая строка показывается только на чтение, а не
 *     кнопкой, которая упадёт 403.
 *
 * Ограничение, о котором честнее сказать вслух: имени сотрудника API не
 * отдаёт — в строке персонала есть только `user_id`. Поэтому человек в списке
 * опознаётся ролью, пометкой «Вы» и хвостом id.
 */

const copy = t.admin.staffWhatsapp;

export interface StaffWhatsAppClient {
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

export function StaffWhatsAppCard({
  restaurantId,
  actorUserId,
  isPlatformAdmin,
  client = apiClient,
}: {
  restaurantId: string;
  actorUserId: string;
  isPlatformAdmin: boolean;
  client?: StaffWhatsAppClient;
}) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["restaurant-managers", restaurantId] as const, [restaurantId]);

  const query = useQuery({
    queryKey,
    queryFn: () => client.listManagers(restaurantId),
    retry: false,
  });

  if (query.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (query.isError) {
    // 403 здесь — не поломка: список персонала просто не для этой роли.
    // Показывать «не удалось загрузить» с кнопкой «Повторить» значило бы звать
    // человека биться в дверь, которая не его.
    if (classifyManagerWhatsAppFailure(query.error) === "forbidden") {
      return <EmptyState title={copy.forbiddenTitle} description={copy.forbiddenDescription} />;
    }
    return <ErrorState message={copy.loadFailed} onRetry={() => void query.refetch()} />;
  }

  const managers: RestaurantManager[] = query.data;
  // Своя же строка в списке — она и есть роль актора в ЭТОМ заведении.
  // Отдельного запроса за ролью не нужно; у суперадмина строки может не быть.
  const actor: StaffActor = {
    userId: actorUserId,
    isPlatformAdmin,
    staffRole: managers.find((m) => m.user_id === actorUserId)?.role ?? null,
  };

  return (
    <div className="rounded-card bg-surface p-lg">
      <h2 className="text-base font-semibold text-text">{copy.title}</h2>
      <p className="mt-xs max-w-prose text-[13px] text-text-muted">{copy.description}</p>

      {managers.length === 0 ? (
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
                  queryClient.setQueryData<RestaurantManager[]>(queryKey, (prev) =>
                    (prev ?? []).map((m) => (m.id === saved.id ? saved : m)),
                  );
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
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
  client: StaffWhatsAppClient;
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
        {manager.whatsapp_phone ? copy.currentPhone(manager.whatsapp_phone) : copy.noPhone}
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

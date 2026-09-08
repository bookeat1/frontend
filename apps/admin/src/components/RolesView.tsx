"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GlobalRole, PlatformUser, UserRoleChange } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { useIsPlatformAdmin } from "@/lib/use-venue-catalog";

import { EmptyState, ErrorState, LoadingState } from "./StateViews";
import { Button } from "./ui/Button";
import { Field, Select, TextArea } from "./ui/FormControls";
import { Modal } from "./ui/Modal";

/**
 * «Роли» — управление глобальной ролью пользователя (Trello XAK5u4Lo).
 *
 * Не путать с ролью В ЗАВЕДЕНИИ (owner/manager/hostess, «Настройки» →
 * персонал): это тот единственный переключатель, который решает, увидит ли
 * человек весь платформенный раздел панели. Бэкенд (PR #62,
 * `internal/usecase/roles`) сам защищает от двух способов остаться без
 * администраторов: нельзя снять администратора с самого себя и нельзя снять
 * его с ПОСЛЕДНЕГО администратора — оба случая приходят одним и тем же 403 без
 * уточнения, какой именно, поэтому сообщение об ошибке ниже объясняет оба
 * сразу, а не гадает.
 */

const copy = t.admin.roles;

/** Ровно те методы клиента, которые нужны экрану — можно рендерить в тестах
 * против фейка. */
export interface RolesClient {
  searchUsers(q: string, limit?: number): Promise<PlatformUser[]>;
  setUserRole(userId: string, input: { role: GlobalRole; reason?: string }): Promise<void>;
  getUserRoleHistory(userId: string, limit?: number): Promise<UserRoleChange[]>;
}

export function RolesView({ client = apiClient }: { client?: RolesClient }) {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) {
    return <EmptyState title={copy.adminOnlyTitle} description={copy.adminOnlyDescription} />;
  }
  return <RolesDictionary client={client} />;
}

function RolesDictionary({ client }: { client: RolesClient }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PlatformUser | null>(null);
  const [viewingHistory, setViewingHistory] = useState<PlatformUser | null>(null);

  const query = useQuery({
    queryKey: ["admin-users", search.trim()],
    queryFn: () => client.searchUsers(search.trim()),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const rows = query.data ?? [];

  return (
    <div className="p-md md:p-lg">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{copy.title}</h1>
          <p className="mt-sm max-w-prose text-sm text-text-muted">{copy.description}</p>
        </div>
      </div>

      <div className="mt-md flex flex-col gap-xs">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.searchPlaceholder}
          className="min-h-[44px] w-full max-w-[360px] rounded-card border border-hairline bg-white px-md text-sm text-text outline-none focus:border-brand"
        />
        <span className="text-[12px] text-text-muted">{copy.searchHint}</span>
      </div>

      {query.isPending ? (
        <LoadingState title={copy.loadingTitle} />
      ) : query.isError ? (
        <ErrorState message={copy.loadFailed} onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : (
        <div className="mt-md overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">{copy.colUser}</th>
                <th className="px-4 py-2 font-medium">{copy.colContact}</th>
                <th className="px-4 py-2 font-medium">{copy.colRole}</th>
                <th className="px-4 py-2 font-medium">{copy.colStatus}</th>
                <th className="px-4 py-2 font-medium">{copy.colRegistered}</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelf = row.id === user?.id;
                return (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0 align-top">
                    <td className="max-w-[220px] break-words px-4 py-3 font-medium text-neutral-900">
                      {row.full_name || "—"}
                      {isSelf ? (
                        <span className="ml-xs rounded-pill bg-chip px-xs py-[1px] text-[11px] text-text-muted">
                          {copy.you}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[220px] break-words px-4 py-3 text-[13px] text-neutral-500">
                      {row.email ?? row.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{copy.role[row.role]}</td>
                    <td className="px-4 py-3">
                      {row.is_active ? (
                        <span className="text-neutral-700">{copy.statusActive}</span>
                      ) : (
                        <span className="text-neutral-400">{copy.statusInactive}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-xs">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSelf}
                          title={isSelf ? copy.selfHint : undefined}
                          aria-label={copy.changeRoleAria(row.full_name || row.email || row.id)}
                          onClick={() => setEditing(row)}
                        >
                          {copy.changeRole}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={copy.historyAria(row.full_name || row.email || row.id)}
                          onClick={() => setViewingHistory(row)}
                        >
                          {copy.history}
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

      {editing ? (
        <ChangeRoleModal
          client={client}
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      ) : null}

      {viewingHistory ? (
        <RoleHistoryModal
          client={client}
          target={viewingHistory}
          onClose={() => setViewingHistory(null)}
        />
      ) : null}
    </div>
  );
}

const ROLE_OPTIONS: GlobalRole[] = ["user", "restaurant", "admin"];

function ChangeRoleModal({
  client,
  target,
  onClose,
  onSaved,
}: {
  client: RolesClient;
  target: PlatformUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<GlobalRole>(target.role);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () => client.setUserRole(target.id, { role, reason: reason.trim() || undefined }),
    onSuccess: onSaved,
  });

  // Бэкенд отвечает ОДНИМ и тем же 403 (`forbidden`, без уточнения) и на
  // «нельзя снять роль с себя», и на «это последний администратор» — сообщение
  // ниже объясняет оба случая сразу, а не гадает, какой из них произошёл.
  const error = mutation.isError ? copy.saveFailed : null;

  return (
    <Modal title={copy.changeRoleTitle(target.full_name || target.email || target.id)} onClose={onClose}>
      <div className="flex flex-col gap-md">
        <Field label={copy.fieldRole} htmlFor="role-select">
          <Select
            id="role-select"
            value={role}
            onChange={(e) => setRole(e.target.value as GlobalRole)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {copy.role[r]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={copy.fieldReason} hint={copy.fieldReasonHint}>
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>

        {error ? (
          <p className="text-sm text-brand" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-xs">
          <Button variant="ghost" onClick={onClose}>
            {t.admin.common.cancel}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={role === target.role}
          >
            {copy.save}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RoleHistoryModal({
  client,
  target,
  onClose,
}: {
  client: RolesClient;
  target: PlatformUser;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["admin-user-role-history", target.id],
    queryFn: () => client.getUserRoleHistory(target.id),
  });

  const rows = query.data ?? [];

  return (
    <Modal title={copy.historyTitle(target.full_name || target.email || target.id)} onClose={onClose}>
      {query.isPending ? (
        <LoadingState title={copy.historyLoadingTitle} />
      ) : query.isError ? (
        <ErrorState message={copy.historyLoadFailed} onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={copy.historyEmptyTitle} description={copy.historyEmptyDescription} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500">
              <tr>
                <th className="px-2 py-2 font-medium">{copy.colFrom}</th>
                <th className="px-2 py-2 font-medium">{copy.colTo}</th>
                <th className="px-2 py-2 font-medium">{copy.colActor}</th>
                <th className="px-2 py-2 font-medium">{copy.colReason}</th>
                <th className="px-2 py-2 font-medium">{copy.colWhen}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((change) => (
                <tr key={change.id} className="border-b border-neutral-100 last:border-0 align-top">
                  <td className="px-2 py-2 text-neutral-700">{copy.role[change.from_role]}</td>
                  <td className="px-2 py-2 text-neutral-700">{copy.role[change.to_role]}</td>
                  <td className="max-w-[160px] break-words px-2 py-2 text-neutral-500">
                    {change.actor_id ? change.actor_id : copy.actorPlatform}
                  </td>
                  <td className="max-w-[200px] break-words px-2 py-2 text-neutral-500">
                    {change.reason ?? copy.noReason}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-neutral-500">
                    {formatDateTime(change.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

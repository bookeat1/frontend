"use client";

import { useState, type FormEvent } from "react";
import { AdminApiError } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isUuid } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";

/**
 * Restaurant selection step. The backend has no "list the restaurants I
 * manage" endpoint (see report), so we take the restaurant id explicitly and
 * validate it by loading its admin profile: 200 => access granted (and we get
 * the display name), 403 => not a manager here, 404 => wrong id.
 */
export function RestaurantGate() {
  const { user, logout, selectRestaurant } = useAuth();
  const [value, setValue] = useState(process.env.NEXT_PUBLIC_DEFAULT_RESTAURANT_ID ?? "");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (checking) return;
    const id = value.trim();
    if (!isUuid(id)) {
      setError(t.admin.restaurant.invalidId);
      return;
    }
    setError(null);
    setChecking(true);
    try {
      const profile = await apiClient.getProfile(id);
      selectRestaurant(profile);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 403) {
        setError(t.admin.restaurant.forbidden);
      } else if (err instanceof AdminApiError && err.status === 404) {
        setError(t.admin.restaurant.notFound);
      } else {
        setError(t.admin.common.errorDescription);
      }
      setChecking(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-screen px-lg">
      <div className="w-full max-w-[460px] rounded-card bg-surface p-huge shadow-sm">
        <h1 className="text-xl font-bold text-text">{t.admin.restaurant.gateTitle}</h1>
        <p className="mt-sm text-sm text-text-muted">{t.admin.restaurant.gateSubtitle}</p>

        <form className="mt-xl flex flex-col gap-lg" onSubmit={onSubmit} noValidate>
          <label className="flex flex-col gap-xs">
            <span className="text-sm font-medium text-text">{t.admin.restaurant.idLabel}</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t.admin.restaurant.idPlaceholder}
              spellCheck={false}
              autoComplete="off"
              className="min-h-[44px] rounded-card border border-hairline bg-white px-md font-mono text-sm text-text outline-none focus:border-brand"
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm text-brand">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={checking} className="w-full">
            {checking ? t.admin.restaurant.checking : t.admin.restaurant.confirm}
          </Button>
        </form>

        <div className="mt-lg flex items-center justify-between text-sm text-text-muted">
          <span className="truncate">{user?.email ?? user?.full_name}</span>
          <button type="button" onClick={() => void logout()} className="text-brand hover:underline">
            {t.admin.common.logout}
          </button>
        </div>
      </div>
    </main>
  );
}

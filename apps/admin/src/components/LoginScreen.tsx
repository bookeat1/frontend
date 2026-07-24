"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminApiError } from "@bookeat/api/admin";

import { useAuth } from "@/lib/auth-context";
import { isApiConfigured } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";

export function LoginScreen() {
  const router = useRouter();
  const { hydrated, token, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in -> leave the login page.
  useEffect(() => {
    if (hydrated && token) router.replace("/");
  }, [hydrated, token, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return; // double-submit guard
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      // Keep the user's input; only surface a message.
      if (err instanceof AdminApiError && err.status === 401) {
        setError(t.admin.login.invalidCredentials);
      } else {
        setError(t.admin.login.genericError);
      }
      setSubmitting(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  return (
    <main className="flex min-h-screen items-center justify-center bg-screen px-lg">
      <div className="w-full max-w-[400px] rounded-card bg-surface p-huge shadow-sm">
        <h1 className="text-xl font-bold text-text">{t.admin.login.title}</h1>
        <p className="mt-sm text-sm text-text-muted">{t.admin.login.subtitle}</p>

        {!isApiConfigured ? (
          <p className="mt-lg rounded-card bg-rose-50 p-md text-sm text-rose-700">
            NEXT_PUBLIC_API_URL не задан — задайте его в окружении.
          </p>
        ) : null}

        <form className="mt-xl flex flex-col gap-lg" onSubmit={onSubmit} noValidate>
          <label className="flex flex-col gap-xs">
            <span className="text-sm font-medium text-text">{t.admin.login.emailLabel}</span>
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.admin.login.emailPlaceholder}
              className="min-h-[44px] rounded-card border border-hairline bg-white px-md text-sm text-text outline-none focus:border-brand"
            />
          </label>

          <label className="flex flex-col gap-xs">
            <span className="text-sm font-medium text-text">{t.admin.login.passwordLabel}</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.admin.login.passwordPlaceholder}
              className="min-h-[44px] rounded-card border border-hairline bg-white px-md text-sm text-text outline-none focus:border-brand"
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm text-brand">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={!canSubmit} loading={submitting} className="w-full">
            {submitting ? t.admin.login.submitting : t.admin.login.submit}
          </Button>
        </form>
      </div>
    </main>
  );
}

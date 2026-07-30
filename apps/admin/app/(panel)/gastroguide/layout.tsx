"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { EmptyState } from "@/components/StateViews";

/**
 * The guide is the PLATFORM's editorial content, not a venue's, so every route
 * under it is superadmin-only.
 *
 * The server is what enforces this (RequireRole(RoleAdmin) plus a re-check in
 * the usecase). This guard exists so a venue owner who reaches the URL reads a
 * sentence instead of watching four requests fail with 403 — it is a courtesy,
 * never the security boundary.
 */
export default function GastroguideLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user && user.role !== "admin") {
    return <EmptyState title={t.admin.gastroguide.errorForbidden} />;
  }
  return <>{children}</>;
}

"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { EmptyState } from "@/components/StateViews";

/**
 * Статьи — редакционный контент ПЛАТФОРМЫ, как и гастрогид: у них нет
 * заведения, и правит их только суперадмин.
 *
 * Настоящую границу держит сервер (RequireRole(RoleAdmin) плюс перепроверка в
 * usecase). Этот гард нужен, чтобы владелец заведения, дошедший до адреса,
 * прочитал фразу, а не смотрел, как четыре запроса падают с 403.
 */
export default function ArticlesLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user && user.role !== "admin") {
    return <EmptyState title={t.admin.gastroguide.errorForbidden} />;
  }
  return <>{children}</>;
}

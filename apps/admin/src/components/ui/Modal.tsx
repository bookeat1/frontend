"use client";

import { useEffect, type ReactNode } from "react";

import { t } from "@/lib/i18n";

/**
 * A minimal accessible modal dialog: overlay + centered card, Esc to close,
 * scroll-locked body, labelled by its title. Used for the create/edit forms so
 * the list stays visible context underneath. Not a full focus-trap (single
 * shared dialog, keyboard-reachable controls) — kept deliberately small.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-md sm:items-center sm:p-lg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="my-auto w-full max-w-[560px] rounded-card bg-surface shadow-lg"
      >
        <header className="flex items-center justify-between gap-md border-b border-hairline px-lg py-md">
          <h2 className="text-base font-bold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.admin.common.close}
            className="rounded-pill px-sm py-xs text-lg leading-none text-text-muted hover:bg-chip"
          >
            ×
          </button>
        </header>
        <div className="p-lg">{children}</div>
      </div>
    </div>
  );
}

"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Shared form primitives for the admin panel. Real <label>/<input> pairs,
 * ≥44px touch targets, and long-Russian-word safe (fields wrap, never clip).
 * Reuse these — do not hand-roll bespoke inputs in a screen.
 */

const inputBase =
  "min-h-[44px] w-full rounded-card border border-hairline bg-white px-md text-sm text-text " +
  "outline-none focus:border-brand disabled:opacity-60";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  required,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-xs">
      <span className="text-sm font-medium text-text">
        {label}
        {required ? <span className="text-brand"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="text-[12px] text-text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputBase} min-h-[88px] resize-y break-words py-sm leading-snug ${
        props.className ?? ""
      }`}
    />
  );
}

/** The shared <select>. Same height and focus ring as TextInput so a form that
 * mixes them does not look assembled from two kits. */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

/** A labelled checkbox row with a ≥44px hit area. */
export function CheckboxRow({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Пояснение под строкой. Существует прежде всего ради ВЫКЛЮЧЕННОГО флажка:
   * запертый переключатель без причины читается как поломка, а причина,
   * сказанная вслух, — как решение. */
  hint?: string;
}) {
  return (
    <label
      className={`flex min-h-[44px] flex-col justify-center gap-xxs ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <span className="flex items-center gap-sm">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-brand"
        />
        <span className={`text-sm ${disabled ? "text-text-muted" : "text-text"}`}>{label}</span>
      </span>
      {hint ? <span className="text-[12px] text-text-muted">{hint}</span> : null}
    </label>
  );
}

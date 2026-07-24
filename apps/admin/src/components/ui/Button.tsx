"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-sm rounded-pill font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-brand";

// minHeight 44px honours the shared >=44 touch-target rule even on desktop.
const sizes: Record<Size, string> = {
  md: "min-h-[44px] px-lg text-sm",
  sm: "min-h-[36px] px-md text-[13px]",
};

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:opacity-90",
  secondary: "bg-chip text-text hover:bg-[#e7e7e7]",
  danger: "bg-white text-brand border border-brand hover:bg-[#fbeaea]",
  ghost: "bg-transparent text-text-muted hover:text-text",
};

/** The single shared button for the admin app — a real <button>, keyboard
 * reachable, with a visible focus ring. Never hand-roll another one. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

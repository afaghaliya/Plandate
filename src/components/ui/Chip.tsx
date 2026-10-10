"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "teal" | "amber" | "danger" | "success";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-ink-soft border-line",
    brand: "bg-brand-soft text-brand-ink border-brand/25",
    teal: "bg-teal-soft text-teal-ink border-teal/25",
    amber: "bg-amber-soft text-amber border-amber/25",
    danger: "bg-danger-soft text-danger border-danger/25",
    success: "bg-success-soft text-success border-success/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A chip that behaves like a checkbox. Used all over the planner form. */
export function ToggleChip({
  label,
  emoji,
  checked,
  onChange,
  name,
  value,
}: {
  label: string;
  emoji?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  name?: string;
  value?: string;
}) {
  return (
    <label
      className={cn(
        "cursor-pointer select-none inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
        checked
          ? "bg-brand text-white border-brand shadow-card"
          : "bg-surface text-ink-soft border-line hover:border-line-strong hover:bg-surface-2",
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        name={name}
        value={value}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {emoji ? <span aria-hidden>{emoji}</span> : null}
      {label}
    </label>
  );
}

/** Single-choice pill group. */
export function RadioChip({
  label,
  emoji,
  checked,
  onChange,
}: {
  label: string;
  emoji?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
        checked
          ? "bg-ink text-paper border-ink"
          : "bg-surface text-ink-soft border-line hover:border-line-strong hover:bg-surface-2",
      )}
    >
      {emoji ? <span aria-hidden>{emoji}</span> : null}
      {label}
    </button>
  );
}

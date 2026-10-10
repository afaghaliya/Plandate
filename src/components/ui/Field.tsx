import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const CONTROL =
  "w-full rounded-xl bg-surface border border-line px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-brand focus:outline-none";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="block text-[13px] font-bold mb-1.5">{label}</span>
      {children}
      {hint && !error ? <span className="block text-[12px] text-ink-faint mt-1">{hint}</span> : null}
      {error ? <span className="block text-[12px] text-danger mt-1">{error}</span> : null}
    </label>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input {...rest} className={cn(CONTROL, className)} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea {...rest} className={cn(CONTROL, "min-h-24 resize-y", className)} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select {...rest} className={cn(CONTROL, "appearance-none pr-9", className)} />;
}

/** Compact -/+ stepper for people counts. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 40,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2">
      <span className="text-[13px] font-semibold text-ink-soft">{label}</span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="size-7 rounded-full border border-line text-ink-soft hover:bg-surface-2 disabled:opacity-40"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-bold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="size-7 rounded-full border border-line text-ink-soft hover:bg-surface-2 disabled:opacity-40"
        >
          +
        </button>
      </span>
    </div>
  );
}

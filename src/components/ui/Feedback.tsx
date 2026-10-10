import type { ReactNode } from "react";
import { cn } from "./cn";

export function EmptyState({
  emoji = "🧭",
  title,
  body,
  action,
}: {
  emoji?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-6 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface-2/60">
      <div className="text-3xl mb-2" aria-hidden>
        {emoji}
      </div>
      <h3 className="font-bold text-base">{title}</h3>
      {body ? <p className="text-[13px] text-ink-faint mt-1 max-w-md mx-auto">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    info: "bg-teal-soft/70 border-teal/25 text-teal-ink",
    warning: "bg-amber-soft border-amber/25 text-amber",
    danger: "bg-danger-soft border-danger/25 text-danger",
    success: "bg-success-soft border-success/25 text-success",
  };
  return (
    <div className={cn("rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed", tones[tone], className)}>
      {title ? <p className="font-bold mb-0.5">{title}</p> : null}
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-4 rounded-full border-2 border-current border-t-transparent animate-spin",
        className,
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block rounded-lg bg-surface-3 animate-pulse", className)} />;
}

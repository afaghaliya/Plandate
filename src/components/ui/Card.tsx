import type { ComponentProps } from "react";
import { cn } from "./cn";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      {...rest}
      className={cn(
        "bg-surface border border-line rounded-[var(--radius-card)] shadow-card",
        className,
      )}
    />
  );
}

export function CardBody({ className, ...rest }: ComponentProps<"div">) {
  return <div {...rest} className={cn("p-4 sm:p-5", className)} />;
}

export function SectionHeading({
  title,
  action,
  hint,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-3">
      <div>
        <h2 className="text-lg sm:text-xl font-bold">{title}</h2>
        {hint ? <p className="text-[13px] text-ink-faint mt-0.5">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

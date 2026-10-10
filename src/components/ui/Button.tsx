import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "teal";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white shadow-card hover:bg-brand-strong",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-surface-2 shadow-card",
  ghost: "text-ink-soft hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger-soft text-danger border border-danger/30 hover:bg-danger hover:text-white",
  teal: "bg-teal text-white hover:brightness-110 shadow-card",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "text-[13px] px-3.5 py-2",
  md: "text-sm px-5 py-2.5",
  lg: "text-base px-7 py-3.5",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant, size, className, ...rest }: ButtonProps) {
  return <button {...rest} className={buttonClasses(variant, size, className)} />;
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function LinkButton({ variant, size, className, ...rest }: LinkButtonProps) {
  return <Link {...rest} className={buttonClasses(variant, size, className)} />;
}

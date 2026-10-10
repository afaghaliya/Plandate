"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="backdrop:bg-ink/45 bg-transparent p-0 m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[85vh]"
    >
      <div className="bg-surface border border-line rounded-[var(--radius-card)] shadow-float overflow-hidden">
        <header className="flex items-center justify-between gap-4 px-5 py-3.5 hairline">
          <h2 className="font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-8 rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink"
          >
            ✕
          </button>
        </header>
        <div className="px-5 py-4 overflow-y-auto max-h-[60vh] text-sm">{children}</div>
        {footer ? <footer className="px-5 py-3.5 border-t border-line bg-surface-2/60">{footer}</footer> : null}
      </div>
    </dialog>
  );
}

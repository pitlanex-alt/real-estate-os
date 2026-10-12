"use client";

import { useEffect, useRef } from "react";
import { Button } from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "primary" | "danger";
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = "danger",
  pending = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, pending]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center px-4 py-8">
      <button type="button" tabIndex={-1} aria-label="Loka staðfestingu" className="absolute inset-0 bg-[#171a17]/25" disabled={pending} onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="kelvo-card relative z-10 w-full max-w-[430px] p-6 sm:p-7">
        <h2 id="confirm-dialog-title" className="text-[19px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{title}</h2>
        <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" disabled={pending} onClick={onClose}>Hætta við</Button>
          <Button variant={confirmVariant} disabled={pending} onClick={onConfirm}>{pending ? "Augnablik…" : confirmLabel}</Button>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef } from "react";
import { Button, FormError } from "./ui";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open, title, description, confirmLabel, pendingLabel, pending, error, onConfirm, onClose,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    cancel.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-xl border border-neutral-200 bg-background p-6 text-foreground shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm dark:border-neutral-800"
    >
      <h2 id={titleId} className="font-display text-2xl font-semibold">{title}</h2>
      <p id={descriptionId} className="mt-3 text-sm leading-relaxed opacity-70">{description}</p>
      {error && <div className="mt-4"><FormError message={error} /></div>}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button ref={cancel} type="button" variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          variant="destructive"
        >
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

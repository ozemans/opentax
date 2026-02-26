import { useEffect, useRef, useCallback } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);
    // Focus the cancel button on open (safer default)
    cancelButtonRef.current?.focus();

    // Prevent body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const confirmClasses =
    confirmVariant === 'danger'
      ? 'bg-accent text-white hover:bg-accent-dark'
      : 'bg-primary text-white hover:bg-primary-dark';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-dark/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-card-hover"
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-display font-semibold text-slate-dark"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-message"
          className="mt-2 text-sm font-body text-slate"
        >
          {message}
        </p>

        <div className="mt-6 flex gap-3 justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-light px-6 py-3 text-sm
                       font-display font-medium text-slate-dark
                       hover:bg-surface transition-colors
                       focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-1"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-6 py-3 text-sm font-display font-medium
                        transition-colors focus:outline-none focus:ring-2
                        focus:ring-offset-1 ${confirmClasses}
                        ${confirmVariant === 'danger' ? 'focus:ring-accent' : 'focus:ring-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

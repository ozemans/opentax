import { useState, useEffect, useRef, useCallback } from 'react';

interface PasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
  mode: 'export' | 'import';
  error?: string;
  isLoading?: boolean;
}

export function PasswordDialog({
  isOpen,
  onClose,
  onSubmit,
  mode,
  error,
  isLoading = false,
}: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setLocalError('');
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, handleKeyDown]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError('');

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }

    if (mode === 'export' && password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    onSubmit(password);
  }

  if (!isOpen) return null;

  const displayError = error || localError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-dark/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-dialog-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-card-hover"
      >
        <h2
          id="password-dialog-title"
          className="text-lg font-display font-semibold text-slate-dark"
        >
          {mode === 'export' ? 'Encrypt Your Return' : 'Decrypt Your Return'}
        </h2>
        <p className="mt-1 text-sm font-body text-slate">
          {mode === 'export'
            ? 'Choose a password to encrypt your .opentax file. You will need this password to import it later.'
            : 'Enter the password used when this file was exported.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="pwd-input"
              className="text-sm font-body font-medium text-slate-dark"
            >
              Password
            </label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                id="pwd-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                className="w-full rounded-lg border border-slate-light px-3 py-2.5 pr-10
                           font-body text-slate-dark
                           focus:outline-none focus:ring-2 focus:ring-lavender focus:border-lavender"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate
                           hover:text-slate-dark focus:outline-none focus:ring-2
                           focus:ring-lavender rounded"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    <path d="M1 1l22 22" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {mode === 'export' && (
            <div className="space-y-1.5">
              <label
                htmlFor="pwd-confirm-input"
                className="text-sm font-body font-medium text-slate-dark"
              >
                Confirm Password
              </label>
              <input
                id="pwd-confirm-input"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="off"
                className="w-full rounded-lg border border-slate-light px-3 py-2.5
                           font-body text-slate-dark
                           focus:outline-none focus:ring-2 focus:ring-lavender focus:border-lavender"
              />
            </div>
          )}

          {displayError && (
            <p role="alert" className="text-sm font-body text-error">
              {displayError}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-slate-light px-6 py-3 text-sm
                         font-display font-medium text-slate-dark
                         hover:bg-surface transition-colors
                         focus:outline-none focus:ring-2 focus:ring-lavender focus:ring-offset-1
                         disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-xl bg-teal px-6 py-3 text-sm font-display font-medium
                         text-white hover:bg-teal-dark transition-colors
                         focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-1
                         disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : mode === 'export' ? 'Encrypt & Download' : 'Decrypt & Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useCallback, useId } from 'react';

interface EINInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  name: string;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** Formats 9 digits as XX-XXXXXXX. */
function formatEIN(digits: string): string {
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2, 9)}`;
}

export function EINInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  name,
}: EINInputProps) {
  const fieldId = useId();
  const errorId = useId();

  const digits = digitsOnly(value);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = digitsOnly(e.target.value);
      if (raw.length <= 9) {
        onChange(raw);
      }
    },
    [onChange]
  );

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="text-sm font-body font-medium text-slate-dark">
        {label}
        {required && <span className="ml-0.5 text-error">*</span>}
      </label>

      <input
        id={fieldId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatEIN(digits)}
        onChange={handleChange}
        onBlur={onBlur}
        required={required}
        placeholder="XX-XXXXXXX"
        maxLength={10}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`
          w-full rounded-lg border px-3 py-2.5
          font-body text-slate-dark tracking-wider
          placeholder:text-slate-light
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-lavender focus:border-lavender
          ${error ? 'border-error ring-1 ring-error/30' : 'border-slate-light'}
        `}
      />

      {error && (
        <p id={errorId} role="alert" className="text-sm font-body text-error">
          {error}
        </p>
      )}
    </div>
  );
}

import { useState, useCallback, useId } from 'react';
import { HelpTooltip } from './HelpTooltip';

interface SSNInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  name: string;
  helpText?: string;
  irsReference?: string;
}

/** Strips all non-digits from a string. */
function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** Formats 9 digits as XXX-XX-XXXX. */
function formatSSN(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
}

/** Masks first 5 digits: ***-**-XXXX */
function maskSSN(digits: string): string {
  if (digits.length < 9) return formatSSN(digits);
  return `***-**-${digits.slice(5, 9)}`;
}

export function SSNInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  name,
  helpText,
  irsReference,
}: SSNInputProps) {
  const fieldId = useId();
  const errorId = useId();
  const [isFocused, setIsFocused] = useState(false);

  const digits = digitsOnly(value);
  const displayValue = isFocused ? formatSSN(digits) : maskSSN(digits);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = digitsOnly(e.target.value);
      if (raw.length <= 9) {
        onChange(raw);
      }
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center">
        <label htmlFor={fieldId} className="text-sm font-body font-medium text-slate-dark">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
        {helpText && <HelpTooltip content={helpText} irsReference={irsReference} />}
      </div>

      <input
        id={fieldId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        required={required}
        placeholder="XXX-XX-XXXX"
        maxLength={11}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`
          w-full rounded-lg border px-3 py-2.5
          font-body text-slate-dark tracking-wider
          placeholder:text-slate-light
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-highlight focus:border-highlight
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

import { useState, useCallback, useId } from 'react';
import { HelpTooltip } from './HelpTooltip';

interface CurrencyInputProps {
  label: string;
  value: number; // In cents
  onChange: (cents: number) => void;
  onBlur?: () => void;
  helpText?: string;
  irsReference?: string;
  error?: string;
  required?: boolean;
  name: string;
  allowNegative?: boolean;
}

function formatDollars(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseDollarString(raw: string, allowNegative = false): number {
  // Detect leading minus
  const isNeg = allowNegative && raw.trimStart().startsWith('-');
  // Remove everything except digits and decimal point
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;

  const parts = cleaned.split('.');
  // Only keep first decimal point
  const normalized = parts.length > 1
    ? parts[0] + '.' + parts.slice(1).join('')
    : parts[0];

  const dollars = parseFloat(normalized);
  if (isNaN(dollars)) return 0;

  // Convert to cents, rounding to avoid floating-point issues
  const cents = Math.round(dollars * 100);
  return isNeg ? -cents : cents;
}

export function CurrencyInput({
  label,
  value,
  onChange,
  onBlur,
  helpText,
  irsReference,
  error,
  required = false,
  name,
  allowNegative = false,
}: CurrencyInputProps) {
  const fieldId = useId();
  const errorId = useId();

  // Display value tracks user's raw typing; formatted on blur
  const [displayValue, setDisplayValue] = useState<string>(
    value === 0 ? '' : formatDollars(value)
  );
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Allow only digits, commas, one decimal point, and optionally leading minus
      const pattern = allowNegative
        ? /^-?[0-9,]*\.?[0-9]{0,2}$/
        : /^[0-9,]*\.?[0-9]{0,2}$/;
      if (pattern.test(raw) || raw === '' || (allowNegative && raw === '-')) {
        setDisplayValue(raw);
        onChange(parseDollarString(raw, allowNegative));
      }
    },
    [onChange, allowNegative]
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Show raw number for editing (no commas)
    if (value !== 0) {
      const dollars = (Math.abs(value) / 100).toFixed(2);
      setDisplayValue(value < 0 ? `-${dollars}` : dollars);
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Format on blur
    const cents = parseDollarString(displayValue, allowNegative);
    if (cents === 0 && displayValue === '') {
      setDisplayValue('');
    } else {
      const formatted = formatDollars(Math.abs(cents));
      setDisplayValue(cents < 0 ? `-${formatted}` : formatted);
    }
    onBlur?.();
  }, [displayValue, onBlur, allowNegative]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center">
        <label htmlFor={fieldId} className="text-sm font-body font-medium text-slate-dark">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
        {helpText && <HelpTooltip content={helpText} irsReference={irsReference} />}
      </div>

      <div className="relative">
        <span
          className={`absolute left-3 top-1/2 -translate-y-1/2 font-body text-slate
                      ${isFocused ? 'text-slate-dark' : ''}`}
          aria-hidden="true"
        >
          $
        </span>
        <input
          id={fieldId}
          name={name}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          required={required}
          placeholder="0.00"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`
            w-full rounded-lg border pl-7 pr-3 py-2.5 text-right
            font-body text-slate-dark
            placeholder:text-slate-light
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-highlight focus:border-highlight
            ${error ? 'border-error ring-1 ring-error/30' : 'border-slate-light'}
          `}
        />
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-sm font-body text-error">
          {error}
        </p>
      )}
    </div>
  );
}

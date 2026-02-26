import { useId } from 'react';
import { HelpTooltip } from './HelpTooltip';

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea';
  value: string | number;
  onChange: (value: string) => void;
  onBlur?: () => void;
  helpText?: string;
  irsReference?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  className?: string;
  children?: React.ReactNode;
}

export function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  helpText,
  irsReference,
  error,
  required = false,
  disabled = false,
  placeholder,
  options,
  className = '',
  children,
}: FormFieldProps) {
  const fieldId = useId();
  const errorId = useId();

  const baseInputClasses = `
    w-full rounded-lg border px-3 py-2.5 font-body text-slate-dark
    placeholder:text-slate-light
    transition-colors duration-150
    focus:outline-none focus:ring-2 focus:ring-highlight focus:border-highlight
    disabled:opacity-50 disabled:cursor-not-allowed
    ${error ? 'border-error ring-1 ring-error/30' : 'border-slate-light'}
  `.trim();

  function renderInput() {
    if (children) {
      return children;
    }

    if (type === 'select' && options) {
      return (
        <select
          id={fieldId}
          name={name}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={baseInputClasses}
        >
          <option value="">{placeholder || 'Select...'}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (type === 'textarea') {
      return (
        <textarea
          id={fieldId}
          name={name}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          rows={3}
          className={baseInputClasses}
        />
      );
    }

    return (
      <input
        id={fieldId}
        name={name}
        type={type}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={baseInputClasses}
      />
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center">
        <label htmlFor={fieldId} className="text-sm font-body font-medium text-slate-dark">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
        {helpText && <HelpTooltip content={helpText} irsReference={irsReference} />}
      </div>

      {renderInput()}

      {error && (
        <p id={errorId} role="alert" className="text-sm font-body text-error">
          {error}
        </p>
      )}
    </div>
  );
}

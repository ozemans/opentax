import { useId } from 'react';
import { STATE_OPTIONS } from '@/ui/data/stateOptions';

interface StateSelectorProps {
  value: string;
  onChange: (stateCode: string) => void;
  error?: string;
}

export function StateSelector({ value, onChange, error }: StateSelectorProps) {
  const fieldId = useId();
  const errorId = useId();

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="text-sm font-body font-medium text-slate-dark">
        State of Residence
      </label>

      <select
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`
          w-full rounded-lg border px-3 py-2.5 font-body text-slate-dark
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-highlight focus:border-highlight
          ${error ? 'border-error ring-1 ring-error/30' : 'border-slate-light'}
        `}
      >
        <option value="">Select a state...</option>
        {STATE_OPTIONS.map((st) => (
          <option key={st.value} value={st.value}>
            {st.supported
              ? `\u2713 ${st.label}`
              : `${st.label} (Federal only)`}
          </option>
        ))}
      </select>

      {error && (
        <p id={errorId} role="alert" className="text-sm font-body text-error">
          {error}
        </p>
      )}
    </div>
  );
}

import type { FilingStatus } from '@/engine/types';

interface FilingStatusCardProps {
  value: FilingStatus;
  label: string;
  description: string;
  icon: string;
  isSelected: boolean;
  onSelect: () => void;
}

export function FilingStatusCard({
  value,
  label,
  description,
  icon,
  isSelected,
  onSelect,
}: FilingStatusCardProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  }

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      aria-label={label}
      tabIndex={0}
      data-filing-status={value}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`
        relative flex items-start gap-4 rounded-2xl border-2 p-5 cursor-pointer
        min-h-[64px] transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-2
        ${
          isSelected
            ? 'border-highlight bg-highlight-light shadow-card'
            : 'border-slate-light/50 bg-white hover:shadow-card-hover hover:border-slate-light'
        }
      `}
    >
      {/* Icon */}
      <span className="flex-shrink-0 text-2xl" aria-hidden="true">
        {icon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-display font-semibold text-slate-dark">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-body text-slate">
          {description}
        </p>
      </div>

      {/* Checkmark */}
      {isSelected && (
        <span className="flex-shrink-0 mt-0.5" aria-hidden="true">
          <svg
            className="h-6 w-6 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
      )}
    </div>
  );
}

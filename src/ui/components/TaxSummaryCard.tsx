import { useNavigate } from 'react-router';

interface TaxSummaryCardProps {
  title: string;
  items: Array<{
    label: string;
    value: number | string;
    isCurrency?: boolean;
    isPercentage?: boolean;
  }>;
  editPath?: string;
  highlight?: boolean;
}

function formatCurrency(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const formatted = dollars.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatPercentage(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

export function TaxSummaryCard({
  title,
  items,
  editPath,
  highlight = false,
}: TaxSummaryCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className={`rounded-2xl p-6 ${
        highlight
          ? 'bg-highlight-light border-2 border-highlight shadow-card-hover'
          : 'bg-white border border-slate-light/30 shadow-card'
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-display font-semibold text-slate-dark">
          {title}
        </h3>
        {editPath && (
          <button
            type="button"
            onClick={() => navigate(editPath)}
            className="text-sm font-display text-primary hover:text-primary-dark
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-highlight rounded px-2 py-1"
          >
            Edit
          </button>
        )}
      </div>

      <dl className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between items-baseline">
            <dt className="text-sm font-body text-slate">{item.label}</dt>
            <dd
              className={`text-sm font-body font-medium tabular-nums ${
                highlight ? 'text-slate-dark text-lg font-display' : 'text-slate-dark'
              }`}
            >
              {typeof item.value === 'string'
                ? item.value
                : item.isCurrency
                  ? formatCurrency(item.value)
                  : item.isPercentage
                    ? formatPercentage(item.value)
                    : item.value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

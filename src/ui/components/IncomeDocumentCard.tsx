import { useState, useId } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

interface IncomeDocumentCardProps {
  title: string;
  subtitle?: string;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}

export function IncomeDocumentCard({
  title,
  subtitle,
  isExpanded,
  onToggle,
  onRemove,
  children,
}: IncomeDocumentCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const contentId = useId();

  return (
    <>
      <div className="rounded-2xl border border-slate-light/50 bg-white shadow-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            className="flex flex-1 items-center gap-3 text-left
                       focus:outline-none focus:ring-2 focus:ring-lavender rounded-lg p-1 -m-1"
          >
            {/* Chevron */}
            <svg
              className={`h-5 w-5 text-slate transition-transform duration-200
                          ${isExpanded ? 'rotate-90' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>

            <div className="min-w-0">
              <p className="text-sm font-display font-semibold text-slate-dark truncate">
                {title}
              </p>
              {!isExpanded && subtitle && (
                <p className="text-xs font-body text-slate mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </button>

          {/* Remove button */}
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="ml-4 flex-shrink-0 text-sm font-display text-coral
                       hover:text-coral-dark transition-colors
                       focus:outline-none focus:ring-2 focus:ring-coral rounded px-2 py-1"
            aria-label={`Remove ${title}`}
          >
            Remove
          </button>
        </div>

        {/* Expandable content */}
        <div
          id={contentId}
          role="region"
          aria-label={`${title} details`}
          className={`overflow-hidden transition-all duration-300 ease-smooth
                      ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="border-t border-slate-light/30 px-5 py-5 space-y-4">
            {children}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          onRemove();
        }}
        title="Remove Document"
        message={`Are you sure you want to remove "${title}"? This action cannot be undone.`}
        confirmLabel="Remove"
        confirmVariant="danger"
      />
    </>
  );
}

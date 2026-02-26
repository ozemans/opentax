import { useState, useRef, useEffect, useId } from 'react';

interface HelpTooltipProps {
  content: string;
  irsReference?: string;
}

export function HelpTooltip({ content, irsReference }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full
                   bg-highlight-light text-slate text-xs font-display font-semibold
                   hover:bg-highlight focus:outline-none focus:ring-2 focus:ring-highlight
                   focus:ring-offset-1 transition-colors"
        aria-label="Help"
      >
        ?
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2
                     rounded-lg bg-white p-3 shadow-card-hover ring-1 ring-slate-light/30
                     text-sm font-body text-slate-dark"
        >
          <p>{content}</p>
          {irsReference && (
            <p className="mt-1.5 text-xs text-slate">Ref: {irsReference}</p>
          )}
          {/* Arrow */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 border-4
                        border-transparent border-t-white"
          />
        </div>
      )}
    </span>
  );
}

import { animate } from 'motion';
import { useEffect, useRef, useState } from 'react';
import { useTaxState } from '@/ui/hooks/useTaxState';

function formatDollars(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  return dollars.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function RefundTracker() {
  const { result, isComputing } = useTaxState();

  const refundOrOwed = result?.refundOrOwed ?? 0;
  const effectiveRate = result?.effectiveTaxRate ?? 0;

  const isRefund = refundOrOwed >= 0;
  const amountRef = useRef<HTMLSpanElement>(null);
  const [displayAmount, setDisplayAmount] = useState(formatDollars(refundOrOwed));

  // Animate number changes
  useEffect(() => {
    const target = Math.abs(refundOrOwed) / 100;
    const controls = animate(0, target, {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (value) => {
        setDisplayAmount(
          Math.round(value).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
        );
      },
    });

    return () => controls.stop();
  }, [refundOrOwed]);

  return (
    <>
      {/* Desktop sidebar card */}
      <div
        className="hidden lg:block sticky top-6 w-80 flex-shrink-0"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <div className="text-center">
            <p className="text-sm font-body text-slate">
              {isRefund ? 'Estimated Refund' : 'Estimated Amount Owed'}
            </p>

            <p
              className={`mt-2 text-4xl font-display font-bold tabular-nums
                          ${isRefund ? 'text-success' : 'text-coral'}`}
            >
              {isComputing ? (
                <span className="inline-block h-8 w-8 animate-spin rounded-full
                                 border-2 border-lavender border-t-teal" />
              ) : (
                <>
                  {isRefund ? '' : '-'}$<span ref={amountRef}>{displayAmount}</span>
                </>
              )}
            </p>

            <p className="mt-2 text-xs font-body text-slate">
              Effective tax rate: {effectiveRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40
                    bg-white/95 backdrop-blur-sm border-t border-slate-light/20
                    px-4 py-3 shadow-card"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <p className="text-xs font-body text-slate">
            {isRefund ? 'Est. Refund' : 'Est. Owed'}
          </p>
          <p
            className={`text-xl font-display font-bold tabular-nums
                        ${isRefund ? 'text-success' : 'text-coral'}`}
          >
            {isComputing ? (
              <span className="inline-block h-5 w-5 animate-spin rounded-full
                               border-2 border-lavender border-t-teal" />
            ) : (
              <>
                {isRefund ? '' : '-'}${displayAmount}
              </>
            )}
          </p>
        </div>
      </div>
    </>
  );
}

import { animate } from 'motion';
import { useEffect, useState } from 'react';
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
  const isRefund = refundOrOwed >= 0;
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
    <div
      className="flex items-center gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="text-xs font-body text-slate hidden sm:inline">
        {isRefund ? 'Est. Refund' : 'Est. Owed'}
      </span>
      <span
        className={`text-sm font-display font-bold tabular-nums ${
          isRefund ? 'text-success' : 'text-accent'
        }`}
      >
        {isComputing ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-highlight border-t-primary" />
        ) : (
          <>
            {isRefund ? '' : '-'}${displayAmount}
          </>
        )}
      </span>
    </div>
  );
}

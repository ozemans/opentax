import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, animate } from 'motion/react';
import { useEffect, useRef } from 'react';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { PasswordDialog } from '@/ui/components/PasswordDialog';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { useTaxState } from '@/ui/hooks/useTaxState';
import { useEncryptedExport } from '@/ui/hooks/useEncryptedExport';
import { generateReturnPackage } from '@/pdf/generator';

function formatCents(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  return dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatSignedCents(cents: number): string {
  const prefix = cents >= 0 ? '' : '-';
  return `${prefix}$${formatCents(cents)}`;
}

function formatCreditName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function LineItem({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 text-sm font-body">
      <span className="text-slate">{label}</span>
      <span className={`tabular-nums font-medium ${highlight ? 'text-primary-dark' : 'text-slate-dark'}`}>
        ${formatCents(value)}
      </span>
    </div>
  );
}

interface BarSegment {
  label: string;
  value: number;
  color: string;
}

function StackedBar({ segments, total }: { segments: BarSegment[]; total: number }) {
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-8 w-full overflow-hidden rounded-lg">
        {segments.map((seg, i) => {
          const pct = total > 0 ? (seg.value / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <motion.div
              key={i}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
              className="h-full"
              style={{ backgroundColor: seg.color }}
              title={`${seg.label}: $${formatCents(seg.value)}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs font-body">
        {segments.map((seg, i) => (
          seg.value > 0 && (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-slate">{seg.label}</span>
              <span className="text-slate-dark font-medium tabular-nums">${formatCents(seg.value)}</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

export function ResultsPage() {
  const { input, result, dispatch, clearAll } = useTaxState();
  const headingRef = useFocusOnPageChange('results');
  const navigate = useNavigate();
  const {
    exportReturn,
    isExporting,
    error: exportError,
    clearError: clearExportError,
  } = useEncryptedExport(input, dispatch);

  const [showNewReturn, setShowNewReturn] = useState(false);
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Read from result
  const refundOrOwed = result?.refundOrOwed ?? 0;
  const totalIncome = result?.totalIncome ?? 0;
  const totalTax = result?.totalTax ?? 0;
  const totalCredits = result?.totalCredits ?? 0;
  const effectiveTaxRate = result?.effectiveTaxRate ?? 0;
  const marginalTaxRate = result?.marginalTaxRate ?? 0;
  const incomeBreakdown = result?.incomeBreakdown;
  const taxBreakdown = result?.taxBreakdown;

  const isRefund = refundOrOwed >= 0;

  // State results
  const stateResults = result?.stateResults ?? {};
  const stateEntries = Object.values(stateResults);
  const statesWithIncomeTax = stateEntries.filter((s) => s.hasIncomeTax);
  const totalStateRefundOrOwed = stateEntries.reduce((s, r) => s + r.stateRefundOrOwed, 0);
  const combinedRefundOrOwed = refundOrOwed + totalStateRefundOrOwed;

  // Animated number
  const [displayAmount, setDisplayAmount] = useState('0');
  const animationRan = useRef(false);

  useEffect(() => {
    if (animationRan.current) return;
    animationRan.current = true;

    const target = Math.abs(refundOrOwed) / 100;
    const controls = animate(0, target, {
      duration: 1.0,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (value) => {
        setDisplayAmount(
          Math.round(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
        );
      },
    });

    return () => controls.stop();
  }, [refundOrOwed]);

  const incomeSegments: BarSegment[] = [
    { label: 'Wages', value: incomeBreakdown?.wages ?? 0, color: '#2DD4BF' },
    { label: 'Interest', value: incomeBreakdown?.interest ?? 0, color: '#A78BFA' },
    { label: 'Dividends', value: incomeBreakdown?.ordinaryDividends ?? 0, color: '#60A5FA' },
    { label: 'Capital Gains', value: (incomeBreakdown?.longTermCapitalGains ?? 0) + (incomeBreakdown?.shortTermCapitalGains ?? 0), color: '#34D399' },
    { label: 'Other', value: incomeBreakdown?.otherIncome ?? 0, color: '#94A3B8' },
  ];

  const taxSegments: BarSegment[] = [
    { label: 'Income Tax', value: taxBreakdown?.ordinaryIncomeTax ?? 0, color: '#F87171' },
    { label: 'Cap Gains Tax', value: taxBreakdown?.capitalGainsTax ?? 0, color: '#FB923C' },
    { label: 'SE Tax', value: taxBreakdown?.selfEmploymentTax ?? 0, color: '#FBBF24' },
    { label: 'Credits', value: totalCredits, color: '#22C55E' },
  ];

  const handleDownloadPDF = useCallback(async () => {
    if (!result) return;
    setIsDownloading(true);
    try {
      const pdfBytes = await generateReturnPackage(input, result);
      const blob = new Blob([pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `opentax-${input.taxYear}-return.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[OpenTax] Failed to generate PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [input, result]);

  async function handleExport(password: string) {
    await exportReturn(password);
    if (!exportError) {
      setShowExportPassword(false);
    }
  }

  async function handleNewReturn() {
    await clearAll();
    setShowNewReturn(false);
    navigate('/');
  }

  return (
    <PageContainer
      title="Your Tax Return Summary"
      description="Here is your completed federal tax return summary."
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        Results
      </h1>

      <div className="space-y-8">
        {/* Big refund/owed display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="text-center py-8"
        >
          <p className="text-sm font-body text-slate mb-2">
            {isRefund ? 'Your Estimated Federal Refund' : 'Your Estimated Amount Owed'}
          </p>
          <p
            className={`text-5xl sm:text-6xl font-display font-bold tabular-nums
                        ${isRefund ? 'text-success' : 'text-accent'}`}
          >
            {isRefund ? '' : '-'}${displayAmount}
          </p>
          <div className="mt-3 flex items-center justify-center gap-4 text-sm font-body text-slate">
            <span>Effective rate: {effectiveTaxRate.toFixed(1)}%</span>
            <span className="text-slate-light">|</span>
            <span>Marginal rate: {marginalTaxRate.toFixed(0)}%</span>
          </div>
        </motion.div>

        {/* Income composition bar */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          aria-labelledby="income-comp-heading"
        >
          <h2 id="income-comp-heading" className="text-base font-display font-semibold text-slate-dark mb-3">
            Income Composition
          </h2>
          <StackedBar segments={incomeSegments} total={totalIncome} />
        </motion.section>

        {/* Tax composition bar */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          aria-labelledby="tax-comp-heading"
        >
          <h2 id="tax-comp-heading" className="text-base font-display font-semibold text-slate-dark mb-3">
            Tax Composition
          </h2>
          <StackedBar segments={taxSegments} total={totalTax} />
        </motion.section>

        {/* Effective vs marginal rates */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="grid grid-cols-2 gap-4"
          aria-labelledby="rates-heading"
        >
          <h2 id="rates-heading" className="sr-only">Tax Rates</h2>
          <div className="rounded-2xl bg-highlight-light/50 p-5 text-center">
            <p className="text-xs font-body text-slate">Effective Rate</p>
            <p className="text-3xl font-display font-bold text-slate-dark mt-1">
              {effectiveTaxRate.toFixed(1)}%
            </p>
            <p className="text-xs font-body text-slate mt-1">
              Actual % of income paid in tax
            </p>
          </div>
          <div className="rounded-2xl bg-highlight-light/50 p-5 text-center">
            <p className="text-xs font-body text-slate">Marginal Rate</p>
            <p className="text-3xl font-display font-bold text-slate-dark mt-1">
              {marginalTaxRate.toFixed(0)}%
            </p>
            <p className="text-xs font-body text-slate mt-1">
              Rate on next dollar earned
            </p>
          </div>
        </motion.section>

        {/* State Tax Results */}
        {stateEntries.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.55 }}
            aria-labelledby="state-taxes-heading"
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-light/40" />
              <h2 id="state-taxes-heading" className="text-sm font-display font-semibold text-slate uppercase tracking-wide">
                State Taxes
              </h2>
              <div className="h-px flex-1 bg-slate-light/40" />
            </div>

            {stateEntries.map((sr) => (
              <div key={sr.stateCode} className="rounded-2xl border border-slate-light/30 bg-white p-5 shadow-card">
                {!sr.hasIncomeTax ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-display font-semibold text-slate-dark">{sr.stateName}</span>
                    <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-body font-medium text-success">
                      No State Income Tax
                    </span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* State refund/owed hero */}
                    <div className="text-center">
                      <p className="text-xs font-body text-slate mb-1">{sr.stateName}</p>
                      <p className={`text-2xl font-display font-bold tabular-nums ${sr.stateRefundOrOwed >= 0 ? 'text-success' : 'text-accent'}`}>
                        {formatSignedCents(sr.stateRefundOrOwed)}
                      </p>
                      <p className="text-xs font-body text-slate mt-0.5">
                        {sr.stateRefundOrOwed >= 0 ? 'Estimated State Refund' : 'Estimated Amount Owed'}
                      </p>
                    </div>

                    {/* Line-item breakdown */}
                    <div className="divide-y divide-slate-light/20">
                      <LineItem label="State AGI" value={sr.stateAGI} />
                      {sr.stateSubtractions > 0 && <LineItem label="Subtractions" value={sr.stateSubtractions} />}
                      {sr.stateDeduction > 0 && <LineItem label="Deduction" value={sr.stateDeduction} />}
                      {sr.stateExemptions > 0 && <LineItem label="Exemptions" value={sr.stateExemptions} />}
                      <LineItem label="Taxable Income" value={sr.stateTaxableIncome} highlight />
                      <LineItem label="Tax Before Credits" value={sr.stateTaxBeforeCredits} />
                      {sr.stateCredits > 0 && <LineItem label="Credits" value={sr.stateCredits} />}
                      {sr.stateSurtax > 0 && <LineItem label="Surtax" value={sr.stateSurtax} />}
                      {sr.localTax > 0 && <LineItem label="Local Tax" value={sr.localTax} />}
                      <LineItem label="Tax After Credits" value={sr.stateTaxAfterCredits} highlight />
                    </div>

                    {/* Credits breakdown */}
                    {Object.keys(sr.creditBreakdown).length > 0 && (
                      <div className="rounded-xl bg-surface/50 p-3">
                        <p className="text-xs font-display font-semibold text-slate mb-2">Credits</p>
                        {Object.entries(sr.creditBreakdown).map(([key, val]) => (
                          <div key={key} className="flex justify-between text-xs font-body py-0.5">
                            <span className="text-slate">{formatCreditName(key)}</span>
                            <span className="text-slate-dark tabular-nums">${formatCents(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* State rates */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-highlight-light/50 p-3 text-center">
                        <p className="text-xs font-body text-slate">Effective</p>
                        <p className="text-lg font-display font-bold text-slate-dark">{sr.effectiveRate.toFixed(1)}%</p>
                      </div>
                      <div className="rounded-xl bg-highlight-light/50 p-3 text-center">
                        <p className="text-xs font-body text-slate">Marginal</p>
                        <p className="text-lg font-display font-bold text-slate-dark">{sr.marginalRate.toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Combined total */}
            {statesWithIncomeTax.length > 0 && (
              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5 text-center">
                <p className="text-xs font-body text-slate mb-1">Combined Federal + State</p>
                <p className={`text-3xl font-display font-bold tabular-nums ${combinedRefundOrOwed >= 0 ? 'text-success' : 'text-accent'}`}>
                  {formatSignedCents(combinedRefundOrOwed)}
                </p>
                <p className="text-xs font-body text-slate mt-0.5">
                  {combinedRefundOrOwed >= 0 ? 'Total Estimated Refund' : 'Total Estimated Amount Owed'}
                </p>
              </div>
            )}
          </motion.section>
        )}

        {/* What's Next */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          aria-labelledby="next-steps-heading"
          className="rounded-2xl border border-slate-light/30 bg-white p-6 shadow-card"
        >
          <h2 id="next-steps-heading" className="text-lg font-display font-semibold text-slate-dark mb-4">
            What's Next
          </h2>
          <ol className="space-y-3 text-sm font-body text-slate-dark">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full
                              bg-primary/15 text-xs font-display font-semibold text-primary-dark">
                1
              </span>
              <span>
                <strong>Download your PDF return</strong> — Print and review all forms for accuracy.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full
                              bg-primary/15 text-xs font-display font-semibold text-primary-dark">
                2
              </span>
              <span>
                <strong>File electronically</strong> — Submit through IRS Free File or mail your printed return.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full
                              bg-primary/15 text-xs font-display font-semibold text-primary-dark">
                3
              </span>
              <span>
                <strong>Export a backup</strong> — Save an encrypted .opentax file for your records.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full
                              bg-primary/15 text-xs font-display font-semibold text-primary-dark">
                4
              </span>
              <span>
                <strong>Keep your records</strong> — The IRS recommends keeping tax records for at least 3 years.
              </span>
            </li>
          </ol>
        </motion.section>

        {/* Action buttons */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isDownloading || !result}
            className="w-full rounded-xl bg-primary px-6 py-4 text-base font-display
                       font-semibold text-white hover:bg-primary-dark transition-colors
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                       shadow-card hover:shadow-card-hover disabled:opacity-50"
          >
            {isDownloading ? 'Generating PDF...' : 'Download PDF Return'}
          </button>

          <button
            type="button"
            onClick={() => setShowExportPassword(true)}
            className="w-full rounded-xl border border-slate-light px-6 py-3 text-sm
                       font-display font-medium text-slate-dark hover:bg-surface
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-highlight focus:ring-offset-1"
          >
            Export Encrypted Backup
          </button>

          <button
            type="button"
            onClick={() => setShowNewReturn(true)}
            className="w-full rounded-xl border border-slate-light/50 px-6 py-3 text-sm
                       font-display font-medium text-slate hover:bg-surface
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-highlight focus:ring-offset-1"
          >
            Start New Return
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showNewReturn}
        onClose={() => setShowNewReturn(false)}
        onConfirm={handleNewReturn}
        title="Start New Return"
        message="This will clear all your current data and start fresh. Make sure you have exported a backup first."
        confirmLabel="Start Fresh"
        confirmVariant="danger"
      />

      <PasswordDialog
        isOpen={showExportPassword}
        onClose={() => {
          setShowExportPassword(false);
          clearExportError();
        }}
        onSubmit={handleExport}
        mode="export"
        error={exportError ?? undefined}
        isLoading={isExporting}
      />
    </PageContainer>
  );
}

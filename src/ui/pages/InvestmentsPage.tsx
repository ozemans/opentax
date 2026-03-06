import { useState, useCallback, useMemo } from 'react';
import type { Form1099B, FederalConfig, TaxLot } from '@/engine/types';
import { CurrencyInput } from '@/ui/components/CurrencyInput';
import { CapitalGainsImport } from '@/ui/components/CapitalGainsImport';
import { HoldingsImport } from '@/ui/components/HoldingsImport';
import { LotOptimizerPanel } from '@/ui/components/LotOptimizerPanel';
import { Document1099Upload } from '@/ui/components/Document1099Upload';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { HELP_TEXTS } from '@/ui/data/helpTexts';
import { useTaxState } from '@/ui/hooks/useTaxState';
import type { Parsed1099Result } from '@/utils/1099-parser';
import { computeTotalWashSaleDisallowed, detectWashSales } from '@/engine/federal/wash-sales';
import federalConfigJson from '../../../config/federal-2025.json';

const federalConfig = federalConfigJson as unknown as FederalConfig;

type EntryMode = 'transactions' | 'summary';

export function InvestmentsPage() {
  const { input, dispatch } = useTaxState();
  const headingRef = useFocusOnPageChange('investments');

  // Determine initial mode based on existing data
  const hasSummary = input.capitalGainsSummary != null;
  const hasTransactions = input.form1099Bs.length > 0;
  const [mode, setMode] = useState<EntryMode>(
    hasSummary && !hasTransactions ? 'summary' : 'transactions',
  );

  const transactions = input.form1099Bs;
  const priorYearSTCarryforward = input.priorYearSTCapitalLossCarryforward ?? 0;
  const priorYearLTCarryforward = input.priorYearLTCapitalLossCarryforward ?? 0;
  const summary = input.capitalGainsSummary ?? { shortTermGainLoss: 0, longTermGainLoss: 0 };

  const handleModeChange = useCallback(
    (newMode: EntryMode) => {
      if (newMode === 'summary') {
        // Pre-populate summary from current transactions
        const stTotal = transactions
          .filter((t) => !t.isLongTerm)
          .reduce((sum, t) => sum + t.gainLoss, 0);
        const ltTotal = transactions
          .filter((t) => t.isLongTerm)
          .reduce((sum, t) => sum + t.gainLoss, 0);
        dispatch({
          type: 'SET_CAPITAL_GAINS_SUMMARY',
          payload: { shortTermGainLoss: stTotal, longTermGainLoss: ltTotal },
        });
      } else {
        // Clear summary when switching back to transactions
        dispatch({ type: 'SET_CAPITAL_GAINS_SUMMARY', payload: undefined });
      }
      setMode(newMode);
    },
    [dispatch, transactions],
  );

  const handleAdd = useCallback(() => {
    dispatch({ type: 'ADD_1099_B' });
  }, [dispatch]);

  const handleUpdate = useCallback((index: number, updates: Partial<Form1099B>) => {
    // Recompute gain/loss if proceeds or costBasis changed
    const current = input.form1099Bs[index];
    if (current && ('proceeds' in updates || 'costBasis' in updates)) {
      const newProceeds = updates.proceeds ?? current.proceeds;
      const newCostBasis = updates.costBasis ?? current.costBasis;
      updates = { ...updates, gainLoss: newProceeds - newCostBasis };
    }
    dispatch({ type: 'UPDATE_1099_B', index, updates });
  }, [dispatch, input.form1099Bs]);

  const handleRemove = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_1099_B', index });
  }, [dispatch]);

  const handleBulkImport = useCallback((imported: Form1099B[]) => {
    // Append imported transactions to existing ones
    dispatch({ type: 'IMPORT_1099_BS', payload: [...input.form1099Bs, ...imported] });
  }, [dispatch, input.form1099Bs]);

  const handleImportHoldings = useCallback((lots: TaxLot[]) => {
    dispatch({ type: 'APPEND_TAX_LOTS', payload: lots });
  }, [dispatch]);

  const handleRemoveLot = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_TAX_LOT', index });
  }, [dispatch]);

  const handleConfirmSale = useCallback((newTransactions: Form1099B[]) => {
    dispatch({ type: 'IMPORT_1099_BS', payload: [...input.form1099Bs, ...newTransactions] });
  }, [dispatch, input.form1099Bs]);

  const handlePdfImport = useCallback(
    (result: Parsed1099Result) => {
      if (result.form1099Bs.length > 0) {
        dispatch({
          type: 'IMPORT_1099_BS',
          payload: [...input.form1099Bs, ...result.form1099Bs],
        });
      }
    },
    [dispatch, input.form1099Bs],
  );

  // Compute summary for transaction mode display
  const totalST = transactions
    .filter((t) => !t.isLongTerm)
    .reduce((sum, t) => sum + t.gainLoss, 0);
  const totalLT = transactions
    .filter((t) => t.isLongTerm)
    .reduce((sum, t) => sum + t.gainLoss, 0);

  // For the summary section, use either transaction totals or summary input
  const displayST = mode === 'summary' ? summary.shortTermGainLoss : totalST;
  const displayLT = mode === 'summary' ? summary.longTermGainLoss : totalLT;
  const net = displayST + displayLT;

  // Wash sale analysis
  const totalWashSaleDisallowed = useMemo(
    () => computeTotalWashSaleDisallowed(transactions),
    [transactions],
  );
  const washSaleAlerts = useMemo(
    () => detectWashSales(transactions),
    [transactions],
  );

  function formatCents(cents: number): string {
    const dollars = Math.abs(cents) / 100;
    const formatted = dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return cents < 0 ? `-$${formatted}` : `$${formatted}`;
  }

  return (
    <PageContainer
      title="Investments"
      description="Report capital gains and losses from stocks, bonds, crypto, and other investments."
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        Investments
      </h1>

      <div className="space-y-8">
        {/* Entry mode toggle */}
        <div
          className="flex rounded-lg border border-slate-light p-0.5 bg-white"
          role="radiogroup"
          aria-label="Capital gains entry method"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'transactions'}
            onClick={() => handleModeChange('transactions')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-body font-medium transition-colors duration-150
              ${mode === 'transactions'
                ? 'bg-highlight text-white shadow-sm'
                : 'text-slate hover:text-slate-dark'
              }`}
          >
            Individual Transactions
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'summary'}
            onClick={() => handleModeChange('summary')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-body font-medium transition-colors duration-150
              ${mode === 'summary'
                ? 'bg-highlight text-white shadow-sm'
                : 'text-slate hover:text-slate-dark'
              }`}
          >
            Just Totals
          </button>
        </div>

        {mode === 'transactions' ? (
          <>
            {/* 1099 PDF upload for capital gains */}
            <section aria-labelledby="pdf-upload-heading">
              <h2 id="pdf-upload-heading" className="text-lg font-display font-semibold text-slate-dark mb-4">
                Upload 1099 PDF
              </h2>
              <p className="text-sm font-body text-slate mb-3">
                Upload a consolidated 1099 PDF from your broker to automatically import capital gains transactions.
              </p>
              <Document1099Upload onImport={handlePdfImport} />
            </section>

            {/* Capital gains import/entry */}
            <section aria-labelledby="cap-gains-heading">
              <h2 id="cap-gains-heading" className="text-lg font-display font-semibold text-slate-dark mb-4">
                Capital Gains & Losses
              </h2>
              <CapitalGainsImport
                transactions={transactions}
                onAdd={handleAdd}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
                onBulkImport={handleBulkImport}
              />
            </section>
          </>
        ) : (
          /* Summary entry mode */
          <section aria-labelledby="summary-entry-heading">
            <h2 id="summary-entry-heading" className="text-lg font-display font-semibold text-slate-dark mb-2">
              Capital Gains & Losses — Totals
            </h2>
            <p className="text-sm font-body text-slate mb-5">
              Enter your net short-term and long-term gain or loss. Use a negative number for losses (e.g. -5000).
            </p>
            <div className="space-y-4">
              <CurrencyInput
                label="Net Short-Term Capital Gain/Loss"
                name="st-gain-loss"
                value={summary.shortTermGainLoss}
                allowNegative
                onChange={(v) =>
                  dispatch({
                    type: 'SET_CAPITAL_GAINS_SUMMARY',
                    payload: { ...summary, shortTermGainLoss: v },
                  })
                }
                helpText={HELP_TEXTS['capitalGainsSummary.shortTermGainLoss']?.content}
                irsReference={HELP_TEXTS['capitalGainsSummary.shortTermGainLoss']?.irsReference}
              />
              <CurrencyInput
                label="Net Long-Term Capital Gain/Loss"
                name="lt-gain-loss"
                value={summary.longTermGainLoss}
                allowNegative
                onChange={(v) =>
                  dispatch({
                    type: 'SET_CAPITAL_GAINS_SUMMARY',
                    payload: { ...summary, longTermGainLoss: v },
                  })
                }
                helpText={HELP_TEXTS['capitalGainsSummary.longTermGainLoss']?.content}
                irsReference={HELP_TEXTS['capitalGainsSummary.longTermGainLoss']?.irsReference}
              />
            </div>
          </section>
        )}

        {/* Prior year carryforward */}
        <section aria-labelledby="carryforward-heading">
          <h2 id="carryforward-heading" className="text-lg font-display font-semibold text-slate-dark mb-2">
            Prior Year Loss Carryforward
          </h2>
          <p className="text-sm font-body text-slate mb-4">
            From last year's Schedule D — see "Capital Loss Carryover Worksheet." Enter as positive numbers.
          </p>
          <div className="space-y-4">
            <CurrencyInput
              label="Short-Term Capital Loss Carryforward (Prior Year)"
              name="prior-year-st-loss"
              value={priorYearSTCarryforward}
              onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'priorYearSTCapitalLossCarryforward', value: v })}
              helpText={HELP_TEXTS['priorYearCapitalLossCarryforward']?.content}
              irsReference={HELP_TEXTS['priorYearCapitalLossCarryforward']?.irsReference}
            />
            <CurrencyInput
              label="Long-Term Capital Loss Carryforward (Prior Year)"
              name="prior-year-lt-loss"
              value={priorYearLTCarryforward}
              onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'priorYearLTCapitalLossCarryforward', value: v })}
              helpText={HELP_TEXTS['priorYearLTCapitalLossCarryforward']?.content}
              irsReference={HELP_TEXTS['priorYearLTCapitalLossCarryforward']?.irsReference}
            />
          </div>
        </section>

        {/* Holdings & Lot Optimizer */}
        <section aria-labelledby="holdings-heading">
          <h2 id="holdings-heading" className="text-lg font-display font-semibold text-slate-dark mb-2">
            Holdings &amp; Lot Optimizer
          </h2>
          <p className="text-sm font-body text-slate mb-4">
            Import your brokerage positions to model the tax impact of pending sales and identify
            loss-harvesting opportunities. Fidelity, Schwab, and Vanguard holdings CSVs are supported.
          </p>
          <HoldingsImport
            lots={input.taxLots ?? []}
            onBulkImport={handleImportHoldings}
            onRemove={handleRemoveLot}
          />
        </section>

        {(input.taxLots?.length ?? 0) > 0 && (
          <section aria-labelledby="lot-optimizer-heading">
            <h2 id="lot-optimizer-heading" className="text-lg font-display font-semibold text-slate-dark mb-2">
              Sale Optimizer
            </h2>
            <p className="text-sm font-body text-slate mb-4">
              Model the tax impact of selling specific lots using FIFO, LIFO, or a tax-minimizing selection.
            </p>
            <LotOptimizerPanel
              lots={input.taxLots ?? []}
              filingStatus={input.filingStatus}
              config={federalConfig}
              form1099Bs={input.form1099Bs}
              ytdShortTermGainCents={totalST}
              ytdLongTermGainCents={totalLT}
              priorYearSTCarryforwardCents={priorYearSTCarryforward}
              priorYearLTCarryforwardCents={priorYearLTCarryforward}
              onConfirmSale={handleConfirmSale}
            />
          </section>
        )}

        {/* Summary */}
        {(mode === 'summary' || transactions.length > 0) && (
          <section
            aria-labelledby="invest-summary-heading"
            className="rounded-2xl bg-highlight-light/50 p-5"
          >
            <h2 id="invest-summary-heading" className="text-base font-display font-semibold text-slate-dark mb-3">
              Investment Summary
            </h2>
            <div className="space-y-2 text-sm font-body">
              <div className="flex justify-between">
                <span className="text-slate">Net Short-Term</span>
                <span className={`font-medium tabular-nums ${displayST >= 0 ? 'text-success' : 'text-accent'}`}>
                  {formatCents(displayST)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Net Long-Term</span>
                <span className={`font-medium tabular-nums ${displayLT >= 0 ? 'text-success' : 'text-accent'}`}>
                  {formatCents(displayLT)}
                </span>
              </div>
              <div className="border-t border-highlight pt-2 flex justify-between">
                <span className="font-display font-semibold text-slate-dark">Net Capital Gain/Loss</span>
                <span className={`font-display font-semibold tabular-nums ${net >= 0 ? 'text-success' : 'text-accent'}`}>
                  {formatCents(net)}
                </span>
              </div>
            </div>

            {/* Wash sale alerts — broker-reported Box 1g */}
            {totalWashSaleDisallowed > 0 && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <svg className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div>
                    <p className="text-sm font-display font-semibold text-amber-900">
                      Wash Sale Losses Disallowed: {formatCents(totalWashSaleDisallowed)}
                    </p>
                    <p className="text-xs font-body text-amber-800 mt-0.5">
                      These losses are disallowed per IRS §1091 and reported in Form 1099-B Box 1g.
                      They increase the cost basis of repurchased shares — the loss is deferred, not lost.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Advisory wash sale detection (no Box 1g reported) */}
            {totalWashSaleDisallowed === 0 && washSaleAlerts.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <svg className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div>
                    <p className="text-sm font-display font-semibold text-amber-900">
                      Possible Wash Sales Detected ({washSaleAlerts.length})
                    </p>
                    <p className="text-xs font-body text-amber-800 mt-0.5 mb-2">
                      The following transactions may trigger the wash sale rule. Verify Box 1g on your 1099-B.
                    </p>
                    <ul className="space-y-1">
                      {washSaleAlerts.map((alert, i) => (
                        <li key={i} className="text-xs font-body text-amber-900">
                          • {alert.security}: {formatCents(alert.lossAmount)} loss sold {alert.dateSold},
                          repurchased {alert.triggerDate}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </PageContainer>
  );
}

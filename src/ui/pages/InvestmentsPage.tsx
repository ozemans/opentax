import { useState, useCallback } from 'react';
import type { Form1099B } from '@/engine/types';
import { CurrencyInput } from '@/ui/components/CurrencyInput';
import { CapitalGainsImport } from '@/ui/components/CapitalGainsImport';
import { Document1099Upload } from '@/ui/components/Document1099Upload';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { HELP_TEXTS } from '@/ui/data/helpTexts';
import { useTaxState } from '@/ui/hooks/useTaxState';
import type { Parsed1099Result } from '@/utils/1099-parser';

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
  const priorYearLossCarryforward = input.priorYearCapitalLossCarryforward ?? 0;
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
              />
            </div>
          </section>
        )}

        {/* Prior year carryforward */}
        <section aria-labelledby="carryforward-heading">
          <h2 id="carryforward-heading" className="text-lg font-display font-semibold text-slate-dark mb-4">
            Prior Year Loss Carryforward
          </h2>
          <CurrencyInput
            label="Capital Loss Carryforward from Prior Year"
            name="prior-year-loss"
            value={priorYearLossCarryforward}
            onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'priorYearCapitalLossCarryforward', value: v })}
            helpText={HELP_TEXTS['priorYearCapitalLossCarryforward']?.content}
            irsReference={HELP_TEXTS['priorYearCapitalLossCarryforward']?.irsReference}
          />
        </section>

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
          </section>
        )}
      </div>
    </PageContainer>
  );
}

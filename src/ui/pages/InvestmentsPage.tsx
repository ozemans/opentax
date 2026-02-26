import { useCallback } from 'react';
import type { Form1099B } from '@/engine/types';
import { CurrencyInput } from '@/ui/components/CurrencyInput';
import { CapitalGainsImport } from '@/ui/components/CapitalGainsImport';
import { Document1099Upload } from '@/ui/components/Document1099Upload';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { HELP_TEXTS } from '@/ui/data/helpTexts';
import { useTaxState } from '@/ui/hooks/useTaxState';
import type { Parsed1099Result } from '@/utils/1099-parser';

export function InvestmentsPage() {
  const { input, dispatch } = useTaxState();
  const headingRef = useFocusOnPageChange('investments');

  const transactions = input.form1099Bs;
  const priorYearLossCarryforward = input.priorYearCapitalLossCarryforward ?? 0;

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

  // Compute summary
  const totalST = transactions
    .filter((t) => !t.isLongTerm)
    .reduce((sum, t) => sum + t.gainLoss, 0);
  const totalLT = transactions
    .filter((t) => t.isLongTerm)
    .reduce((sum, t) => sum + t.gainLoss, 0);
  const net = totalST + totalLT;

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
        {transactions.length > 0 && (
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
                <span className={`font-medium tabular-nums ${totalST >= 0 ? 'text-success' : 'text-accent'}`}>
                  {formatCents(totalST)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Net Long-Term</span>
                <span className={`font-medium tabular-nums ${totalLT >= 0 ? 'text-success' : 'text-accent'}`}>
                  {formatCents(totalLT)}
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

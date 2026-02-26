import { CurrencyInput } from '@/ui/components/CurrencyInput';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { HELP_TEXTS } from '@/ui/data/helpTexts';
import { useTaxState } from '@/ui/hooks/useTaxState';
import { createEmptyItemizedDeductions } from '@/ui/state/defaults';

export function DeductionsPage() {
  const { input, result, dispatch } = useTaxState();
  const headingRef = useFocusOnPageChange('deductions');

  const useItemized = input.useItemizedDeductions;
  const itemized = input.itemizedDeductions ?? createEmptyItemizedDeductions();

  // Get actual standard deduction from engine result, fallback to a reasonable default
  const standardDeduction = result?.deductionBreakdown?.standardAmount ?? 0;

  const itemizedTotal =
    itemized.medicalExpenses +
    itemized.stateLocalTaxesPaid +
    itemized.realEstateTaxes +
    itemized.mortgageInterest +
    itemized.charitableCash +
    itemized.charitableNonCash +
    (itemized.otherDeductions ?? 0);

  function formatCents(cents: number): string {
    const dollars = cents / 100;
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  const standardIsLarger = standardDeduction >= itemizedTotal;

  function handleToggle(itemize: boolean) {
    dispatch({ type: 'SET_FIELD', path: 'useItemizedDeductions', value: itemize });
    if (itemize && !input.itemizedDeductions) {
      // Initialize itemized deductions if they don't exist yet
      dispatch({ type: 'SET_ITEMIZED_DEDUCTIONS', payload: createEmptyItemizedDeductions() });
    }
  }

  function updateItemized(field: string, value: number) {
    dispatch({
      type: 'SET_ITEMIZED_DEDUCTIONS',
      payload: { ...itemized, [field]: value },
    });
  }

  return (
    <PageContainer
      title="Deductions"
      description="Choose between the standard deduction or itemizing your deductions."
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        Deductions
      </h1>

      <div className="space-y-6">
        {/* Toggle cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Standard deduction card */}
          <button
            type="button"
            onClick={() => handleToggle(false)}
            aria-pressed={!useItemized}
            className={`
              rounded-2xl border-2 p-5 text-left transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-2
              ${!useItemized
                ? 'border-highlight bg-highlight-light shadow-card'
                : 'border-slate-light/50 bg-white hover:shadow-card-hover'}
            `}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-semibold text-slate-dark">
                Standard Deduction
              </h3>
              {standardIsLarger && !useItemized && (
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-display font-medium text-primary-dark">
                  Recommended
                </span>
              )}
            </div>
            <p className="mt-2 text-2xl font-display font-bold text-slate-dark tabular-nums">
              {formatCents(standardDeduction)}
            </p>
            <p className="mt-1 text-xs font-body text-slate">
              Fixed amount based on your filing status
            </p>
          </button>

          {/* Itemized deduction card */}
          <button
            type="button"
            onClick={() => handleToggle(true)}
            aria-pressed={useItemized}
            className={`
              rounded-2xl border-2 p-5 text-left transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-2
              ${useItemized
                ? 'border-highlight bg-highlight-light shadow-card'
                : 'border-slate-light/50 bg-white hover:shadow-card-hover'}
            `}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-semibold text-slate-dark">
                Itemized Deductions
              </h3>
              {!standardIsLarger && useItemized && (
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-display font-medium text-primary-dark">
                  Better Value
                </span>
              )}
            </div>
            <p className="mt-2 text-2xl font-display font-bold text-slate-dark tabular-nums">
              {formatCents(itemizedTotal)}
            </p>
            <p className="mt-1 text-xs font-body text-slate">
              Sum of your eligible expenses
            </p>
          </button>
        </div>

        {/* Live comparison */}
        <div className="rounded-lg bg-surface p-3 text-sm font-body text-center">
          <span className="text-slate">Itemized: </span>
          <span className={`font-medium ${!standardIsLarger ? 'text-success' : 'text-slate-dark'}`}>
            {formatCents(itemizedTotal)}
          </span>
          <span className="text-slate mx-2">vs</span>
          <span className="text-slate">Standard: </span>
          <span className={`font-medium ${standardIsLarger ? 'text-success' : 'text-slate-dark'}`}>
            {formatCents(standardDeduction)}
          </span>
        </div>

        {/* Itemized deduction fields */}
        {useItemized && (
          <div className="space-y-4 rounded-2xl border border-slate-light/30 bg-white p-5 shadow-card">
            <h3 className="text-base font-display font-semibold text-slate-dark">
              Itemized Deduction Details
            </h3>

            <CurrencyInput
              label="Medical & Dental Expenses"
              name="medical-expenses"
              value={itemized.medicalExpenses}
              onChange={(v) => updateItemized('medicalExpenses', v)}
              helpText={HELP_TEXTS['itemized.medicalExpenses']?.content}
              irsReference={HELP_TEXTS['itemized.medicalExpenses']?.irsReference}
            />

            <CurrencyInput
              label="State & Local Taxes (SALT)"
              name="state-local-taxes"
              value={itemized.stateLocalTaxesPaid}
              onChange={(v) => updateItemized('stateLocalTaxesPaid', v)}
              helpText={HELP_TEXTS['itemized.stateLocalTaxes']?.content}
              irsReference={HELP_TEXTS['itemized.stateLocalTaxes']?.irsReference}
            />
            {itemized.stateLocalTaxesPaid + itemized.realEstateTaxes > 1000000 && (
              <p className="text-xs font-body text-warning">
                Combined state/local + real estate taxes are capped at $10,000 (SALT cap).
              </p>
            )}

            <CurrencyInput
              label="Real Estate Taxes"
              name="real-estate-taxes"
              value={itemized.realEstateTaxes}
              onChange={(v) => updateItemized('realEstateTaxes', v)}
              helpText={HELP_TEXTS['itemized.realEstateTaxes']?.content}
              irsReference={HELP_TEXTS['itemized.realEstateTaxes']?.irsReference}
            />

            <CurrencyInput
              label="Mortgage Interest"
              name="mortgage-interest"
              value={itemized.mortgageInterest}
              onChange={(v) => updateItemized('mortgageInterest', v)}
              helpText={HELP_TEXTS['itemized.mortgageInterest']?.content}
              irsReference={HELP_TEXTS['itemized.mortgageInterest']?.irsReference}
            />

            <CurrencyInput
              label="Charitable Contributions (Cash)"
              name="charitable-cash"
              value={itemized.charitableCash}
              onChange={(v) => updateItemized('charitableCash', v)}
              helpText={HELP_TEXTS['itemized.charitableCash']?.content}
              irsReference={HELP_TEXTS['itemized.charitableCash']?.irsReference}
            />

            <CurrencyInput
              label="Charitable Contributions (Non-Cash)"
              name="charitable-noncash"
              value={itemized.charitableNonCash}
              onChange={(v) => updateItemized('charitableNonCash', v)}
              helpText={HELP_TEXTS['itemized.charitableNonCash']?.content}
              irsReference={HELP_TEXTS['itemized.charitableNonCash']?.irsReference}
            />

            <CurrencyInput
              label="Other Deductions"
              name="other-deductions"
              value={itemized.otherDeductions ?? 0}
              onChange={(v) => updateItemized('otherDeductions', v)}
            />
          </div>
        )}
      </div>
    </PageContainer>
  );
}

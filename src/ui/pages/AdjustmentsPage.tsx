import { CurrencyInput } from '@/ui/components/CurrencyInput';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { HELP_TEXTS } from '@/ui/data/helpTexts';
import { useTaxState } from '@/ui/hooks/useTaxState';

export function AdjustmentsPage() {
  const { input, dispatch } = useTaxState();
  const headingRef = useFocusOnPageChange('adjustments');

  const studentLoanInterest = input.studentLoanInterest ?? 0;
  const educatorExpenses = input.educatorExpenses ?? 0;
  const hsaDeduction = input.hsaDeduction ?? 0;
  const iraDeduction = input.iraDeduction ?? 0;
  const estimatedTaxPayments = input.estimatedTaxPayments;

  return (
    <PageContainer
      title="Adjustments"
      description="Above-the-line deductions reduce your adjusted gross income (AGI) before the standard or itemized deduction."
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        Adjustments
      </h1>

      <div className="space-y-6">
        <CurrencyInput
          label="Student Loan Interest"
          name="student-loan-interest"
          value={studentLoanInterest}
          onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'studentLoanInterest', value: v })}
          helpText={HELP_TEXTS['studentLoanInterest']?.content}
          irsReference={HELP_TEXTS['studentLoanInterest']?.irsReference}
        />
        {studentLoanInterest > 250000 && (
          <p className="text-xs font-body text-warning">
            Student loan interest deduction is capped at $2,500.
          </p>
        )}

        <CurrencyInput
          label="Educator Expenses"
          name="educator-expenses"
          value={educatorExpenses}
          onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'educatorExpenses', value: v })}
          helpText={HELP_TEXTS['educatorExpenses']?.content}
          irsReference={HELP_TEXTS['educatorExpenses']?.irsReference}
        />
        {educatorExpenses > 30000 && (
          <p className="text-xs font-body text-warning">
            Educator expenses deduction is capped at $300.
          </p>
        )}

        <CurrencyInput
          label="HSA Deduction"
          name="hsa-deduction"
          value={hsaDeduction}
          onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'hsaDeduction', value: v })}
          helpText={HELP_TEXTS['hsaDeduction']?.content}
          irsReference={HELP_TEXTS['hsaDeduction']?.irsReference}
        />

        <CurrencyInput
          label="IRA Deduction"
          name="ira-deduction"
          value={iraDeduction}
          onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'iraDeduction', value: v })}
          helpText={HELP_TEXTS['iraDeduction']?.content}
          irsReference={HELP_TEXTS['iraDeduction']?.irsReference}
        />

        <CurrencyInput
          label="Estimated Tax Payments (Form 1040-ES)"
          name="estimated-tax-payments"
          value={estimatedTaxPayments}
          onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'estimatedTaxPayments', value: v })}
          helpText={HELP_TEXTS['estimatedTaxPayments']?.content}
          irsReference={HELP_TEXTS['estimatedTaxPayments']?.irsReference}
        />
      </div>
    </PageContainer>
  );
}

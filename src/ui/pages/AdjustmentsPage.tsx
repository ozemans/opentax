import { CurrencyInput } from '@/ui/components/CurrencyInput';
import { HelpTooltip } from '@/ui/components/HelpTooltip';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { HELP_TEXTS } from '@/ui/data/helpTexts';
import { useTaxState } from '@/ui/hooks/useTaxState';

// IRA deduction phase-out thresholds for 2025 (cents)
const IRA_PHASE_OUT_SINGLE = { begin: 7_900_000, end: 8_900_000 };
const IRA_PHASE_OUT_MFJ = { begin: 12_600_000, end: 14_600_000 };
const IRA_MAX_CONTRIB = 700_000; // $7,000

function computeAllowableIRA(
  entered: number,
  agi: number,
  isMFJ: boolean,
  hasWorkplacePlan: boolean,
): number {
  const capped = Math.min(entered, IRA_MAX_CONTRIB);
  if (!hasWorkplacePlan) return capped;
  const phaseOut = isMFJ ? IRA_PHASE_OUT_MFJ : IRA_PHASE_OUT_SINGLE;
  if (agi <= phaseOut.begin) return capped;
  if (agi >= phaseOut.end) return 0;
  const ratio = (agi - phaseOut.begin) / (phaseOut.end - phaseOut.begin);
  return Math.max(0, Math.round(capped * (1 - ratio)));
}

export function AdjustmentsPage() {
  const { input, result, dispatch } = useTaxState();
  const headingRef = useFocusOnPageChange('adjustments');

  const studentLoanInterest = input.studentLoanInterest ?? 0;
  const educatorExpenses = input.educatorExpenses ?? 0;
  const hsaDeduction = input.hsaDeduction ?? 0;
  const iraDeduction = input.iraDeduction ?? 0;
  const hasWorkplacePlan = input.hasWorkplaceRetirementPlan ?? false;

  const agi = result?.adjustedGrossIncome ?? 0;
  const isMFJ =
    input.filingStatus === 'married_filing_jointly' ||
    input.filingStatus === 'qualifying_surviving_spouse';
  const allowableIRA = computeAllowableIRA(iraDeduction, agi, isMFJ, hasWorkplacePlan);
  const isPartiallyPhasedOut = hasWorkplacePlan && iraDeduction > 0 && allowableIRA < iraDeduction;
  const isFullyPhasedOut = hasWorkplacePlan && iraDeduction > 0 && allowableIRA === 0;

  return (
    <PageContainer
      title="Adjustments to Income"
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

        <div className="space-y-3">
          <CurrencyInput
            label="IRA Deduction"
            name="ira-deduction"
            value={iraDeduction}
            onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'iraDeduction', value: v })}
            helpText={HELP_TEXTS['iraDeduction']?.content}
            irsReference={HELP_TEXTS['iraDeduction']?.irsReference}
          />

          {/* Workplace retirement plan checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasWorkplacePlan}
              onChange={(e) =>
                dispatch({ type: 'SET_FIELD', path: 'hasWorkplaceRetirementPlan', value: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-light text-highlight focus:ring-highlight"
            />
            <span className="text-sm font-body text-slate-dark">
              I participate in a retirement plan at work (401k, 403b, SEP, SIMPLE, or pension)
              <HelpTooltip content={HELP_TEXTS['hasWorkplaceRetirementPlan']?.content ?? ''} irsReference={HELP_TEXTS['hasWorkplaceRetirementPlan']?.irsReference} />
            </span>
          </label>

          {/* Live phase-out feedback */}
          {hasWorkplacePlan && iraDeduction > 0 && (
            <div className={`rounded-xl p-3 text-xs font-body ${
              isFullyPhasedOut
                ? 'bg-accent/10 border border-accent/30 text-accent'
                : isPartiallyPhasedOut
                  ? 'bg-amber-50 border border-amber-200 text-amber-900'
                  : 'bg-success/10 border border-success/20 text-success'
            }`}>
              {isFullyPhasedOut
                ? 'Your IRA deduction is fully phased out at your income level. You may still contribute to a Traditional IRA, but the deduction isn\'t available.'
                : isPartiallyPhasedOut
                  ? `Your deductible IRA amount is reduced to $${(allowableIRA / 100).toLocaleString()} due to the income phase-out for workplace plan participants.`
                  : `Your full IRA deduction of $${(allowableIRA / 100).toLocaleString()} is allowable.`
              }
            </div>
          )}
        </div>

      </div>
    </PageContainer>
  );
}

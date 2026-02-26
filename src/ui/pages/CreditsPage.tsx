import { useCallback } from 'react';
import { CurrencyInput } from '@/ui/components/CurrencyInput';
import { SSNInput } from '@/ui/components/SSNInput';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { HELP_TEXTS } from '@/ui/data/helpTexts';
import { useTaxState } from '@/ui/hooks/useTaxState';

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function CreditsPage() {
  const { input, result, dispatch } = useTaxState();
  const headingRef = useFocusOnPageChange('credits');

  const childCareExpenses = input.childCareCreditExpenses ?? 0;
  const educationEntries = input.educationExpenses ?? [];
  const saversContributions = input.retirementSaversCredit?.contributions ?? 0;

  // Read auto-computed credits from result
  const ctc = result?.creditBreakdown?.childTaxCredit ?? 0;
  const actc = result?.creditBreakdown?.additionalChildTaxCredit ?? 0;
  const eitc = result?.creditBreakdown?.earnedIncomeCredit ?? 0;

  const handleAddEducation = useCallback(() => {
    dispatch({ type: 'ADD_EDUCATION_EXPENSE' });
  }, [dispatch]);

  const handleRemoveEducation = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_EDUCATION_EXPENSE', index });
  }, [dispatch]);

  const handleEducationChange = useCallback(
    (index: number, updates: Partial<{ type: 'american_opportunity' | 'lifetime_learning'; qualifiedExpenses: number; studentSSN: string }>) => {
      dispatch({ type: 'UPDATE_EDUCATION_EXPENSE', index, updates });
    },
    [dispatch]
  );

  return (
    <PageContainer
      title="Credits"
      description="Tax credits directly reduce the amount of tax you owe."
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        Credits
      </h1>

      <div className="space-y-8">
        {/* Auto-computed credits (read-only) */}
        <section aria-labelledby="auto-credits-heading">
          <h2 id="auto-credits-heading" className="text-lg font-display font-semibold text-slate-dark mb-4">
            Auto-Calculated Credits
          </h2>
          <div className="rounded-2xl bg-lavender-light/50 p-5 space-y-3">
            <div className="flex justify-between items-baseline text-sm font-body">
              <span className="text-slate">Child Tax Credit</span>
              <span className="font-medium text-slate-dark tabular-nums">{formatCents(ctc)}</span>
            </div>
            <div className="flex justify-between items-baseline text-sm font-body">
              <span className="text-slate">Additional Child Tax Credit (refundable)</span>
              <span className="font-medium text-slate-dark tabular-nums">{formatCents(actc)}</span>
            </div>
            <div className="flex justify-between items-baseline text-sm font-body">
              <span className="text-slate">Earned Income Credit</span>
              <span className="font-medium text-slate-dark tabular-nums">{formatCents(eitc)}</span>
            </div>
            <p className="text-xs font-body text-slate pt-1">
              These credits are calculated automatically based on your income, filing status, and dependents.
            </p>
          </div>
        </section>

        {/* Child & dependent care */}
        <section aria-labelledby="childcare-heading">
          <h2 id="childcare-heading" className="text-lg font-display font-semibold text-slate-dark mb-4">
            Child & Dependent Care
          </h2>
          <CurrencyInput
            label="Child & Dependent Care Expenses"
            name="childcare-expenses"
            value={childCareExpenses}
            onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'childCareCreditExpenses', value: v })}
            helpText={HELP_TEXTS['childCareCreditExpenses']?.content}
            irsReference={HELP_TEXTS['childCareCreditExpenses']?.irsReference}
          />
        </section>

        {/* Education credits */}
        <section aria-labelledby="education-heading">
          <h2 id="education-heading" className="text-lg font-display font-semibold text-slate-dark mb-4">
            Education Credits
          </h2>

          <div className="space-y-4">
            {educationEntries.map((entry, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-light/50 bg-white p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-display font-semibold text-slate-dark">
                    Student {i + 1}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleRemoveEducation(i)}
                    className="text-sm font-display text-coral hover:text-coral-dark
                               transition-colors focus:outline-none focus:ring-2
                               focus:ring-coral rounded px-2 py-1"
                  >
                    Remove
                  </button>
                </div>

                <SSNInput
                  label="Student SSN"
                  name={`edu-${i}-ssn`}
                  value={entry.studentSSN}
                  onChange={(v) => handleEducationChange(i, { studentSSN: v })}
                  required
                />

                {/* Credit type radio */}
                <fieldset>
                  <legend className="text-sm font-body font-medium text-slate-dark mb-2">
                    Credit Type
                  </legend>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label
                      className={`
                        flex-1 rounded-xl border-2 p-3 cursor-pointer transition-colors
                        ${entry.type === 'american_opportunity'
                          ? 'border-lavender bg-lavender-light'
                          : 'border-slate-light/50 bg-white hover:border-slate-light'}
                      `}
                    >
                      <input
                        type="radio"
                        name={`edu-${i}-type`}
                        value="american_opportunity"
                        checked={entry.type === 'american_opportunity'}
                        onChange={() => handleEducationChange(i, { type: 'american_opportunity' })}
                        className="sr-only"
                      />
                      <p className="text-sm font-display font-semibold text-slate-dark">
                        American Opportunity (AOTC)
                      </p>
                      <p className="text-xs font-body text-slate mt-0.5">
                        Up to $2,500/student. First 4 years only.
                      </p>
                    </label>
                    <label
                      className={`
                        flex-1 rounded-xl border-2 p-3 cursor-pointer transition-colors
                        ${entry.type === 'lifetime_learning'
                          ? 'border-lavender bg-lavender-light'
                          : 'border-slate-light/50 bg-white hover:border-slate-light'}
                      `}
                    >
                      <input
                        type="radio"
                        name={`edu-${i}-type`}
                        value="lifetime_learning"
                        checked={entry.type === 'lifetime_learning'}
                        onChange={() => handleEducationChange(i, { type: 'lifetime_learning' })}
                        className="sr-only"
                      />
                      <p className="text-sm font-display font-semibold text-slate-dark">
                        Lifetime Learning (LLC)
                      </p>
                      <p className="text-xs font-body text-slate mt-0.5">
                        Up to $2,000/return. Any education level.
                      </p>
                    </label>
                  </div>
                </fieldset>

                <CurrencyInput
                  label="Qualified Expenses"
                  name={`edu-${i}-expenses`}
                  value={entry.qualifiedExpenses}
                  onChange={(v) => handleEducationChange(i, { qualifiedExpenses: v })}
                  helpText={HELP_TEXTS['educationCredits']?.content}
                  irsReference={HELP_TEXTS['educationCredits']?.irsReference}
                  required
                />
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddEducation}
              className="w-full rounded-xl border border-dashed border-slate-light px-6 py-3
                         text-sm font-display font-medium text-slate
                         hover:border-teal hover:text-teal-dark hover:bg-teal/5
                         transition-colors focus:outline-none focus:ring-2
                         focus:ring-lavender focus:ring-offset-1"
            >
              + Add Student
            </button>
          </div>
        </section>

        {/* Retirement saver's credit */}
        <section aria-labelledby="savers-heading">
          <h2 id="savers-heading" className="text-lg font-display font-semibold text-slate-dark mb-4">
            Retirement Saver's Credit
          </h2>
          <CurrencyInput
            label="Retirement Contributions"
            name="savers-contributions"
            value={saversContributions}
            onChange={(v) =>
              dispatch({
                type: 'SET_RETIREMENT_SAVERS_CREDIT',
                payload: v > 0 ? { contributions: v } : undefined,
              })
            }
            helpText={HELP_TEXTS['retirementSaversCredit']?.content}
            irsReference={HELP_TEXTS['retirementSaversCredit']?.irsReference}
          />
        </section>
      </div>
    </PageContainer>
  );
}

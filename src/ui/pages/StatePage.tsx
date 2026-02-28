import { StateSelector } from '@/ui/components/StateSelector';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { STATE_OPTIONS } from '@/ui/data/stateOptions';
import { useTaxState } from '@/ui/hooks/useTaxState';

const STATE_INFO: Record<string, { description: string; highlights: string[] }> = {
  CA: {
    description: 'California has the highest state income tax rates in the nation, with a top rate of 13.3%.',
    highlights: [
      'Graduated brackets up to 13.3%',
      'Capital gains taxed as ordinary income (no preferential rate)',
      'Mental Health Services Tax (1% surcharge above $1M)',
    ],
  },
  NY: {
    description: 'New York has graduated state income tax. NYC residents also pay NYC income tax.',
    highlights: [
      'State tax with graduated brackets',
      'NYC additional tax for city residents',
      'Supplemental tax for high earners',
    ],
  },
  NJ: {
    description: 'New Jersey computes its own definition of gross income, separate from the federal calculation.',
    highlights: [
      'NJ-specific gross income computation',
      'Graduated brackets',
      'No deduction for property taxes on state return',
    ],
  },
  PA: {
    description: 'Pennsylvania has a flat income tax rate of 3.07%.',
    highlights: ['Flat 3.07% rate on all taxable income', 'Simple calculation'],
  },
  IL: {
    description: 'Illinois has a flat income tax rate of 4.95%.',
    highlights: ['Flat 4.95% rate', 'Simple calculation based on federal AGI'],
  },
  MA: {
    description: 'Massachusetts has a flat tax with a surcharge on short-term capital gains and a millionaire surtax.',
    highlights: [
      'Flat 5% rate on most income',
      '12% on short-term capital gains',
      '4% surtax on income over $1M',
    ],
  },
  VA: {
    description: 'Virginia has a graduated income tax with a top rate of 5.75%.',
    highlights: ['Simple graduated brackets', 'Top rate: 5.75% above $17,000'],
  },
  OH: {
    description: 'Ohio has graduated income tax brackets with some unique computation rules.',
    highlights: ['Graduated brackets with unique thresholds', 'No tax on first portion of income'],
  },
  NH: {
    description: 'New Hampshire has no broad income tax. The Interest & Dividends tax was repealed starting 2025.',
    highlights: [
      'No income tax on wages or salary',
      'Interest & Dividends tax repealed for 2025+',
      'No state return needed',
    ],
  },
  TX: {
    description: 'Texas has no state income tax.',
    highlights: ['No state income tax', 'No state return needed'],
  },
  FL: {
    description: 'Florida has no state income tax.',
    highlights: ['No state income tax', 'No state return needed'],
  },
};

export function StatePage() {
  const { input, dispatch } = useTaxState();
  const headingRef = useFocusOnPageChange('state');

  const stateCode = input.stateOfResidence;
  const nyResidencyType = input.nyResidencyType ?? 'resident';

  const selectedState = STATE_OPTIONS.find((s) => s.value === stateCode);
  const stateInfo = stateCode ? STATE_INFO[stateCode] : null;

  // NYC is tracked as an additional state (residents only)
  const isNYC = input.additionalStates?.includes('NYC') ?? false;
  const isNYNonResident = stateCode === 'NY' && nyResidencyType === 'nonresident';

  function handleStateChange(v: string) {
    dispatch({ type: 'SET_FIELD', path: 'stateOfResidence', value: v });
    // Clear NYC if switching away from NY
    if (v !== 'NY' && isNYC) {
      dispatch({ type: 'SET_ADDITIONAL_STATES', payload: [] });
    }
  }

  function handleNYResidencyChange(v: 'resident' | 'nonresident') {
    dispatch({ type: 'SET_FIELD', path: 'nyResidencyType', value: v });
    // Non-residents don't pay NYC local tax — clear it
    if (v === 'nonresident' && isNYC) {
      dispatch({ type: 'SET_ADDITIONAL_STATES', payload: [] });
    }
  }

  function handleNYCToggle(checked: boolean) {
    dispatch({
      type: 'SET_ADDITIONAL_STATES',
      payload: checked ? ['NYC'] : [],
    });
  }

  return (
    <PageContainer
      title="State Taxes"
      description="Select your state of residence to calculate state tax obligations."
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        State Taxes
      </h1>

      <div className="space-y-6">
        <StateSelector
          value={stateCode}
          onChange={handleStateChange}
        />

        {/* State info */}
        {stateCode && selectedState && (
          <div className="rounded-2xl border border-slate-light/30 bg-white p-5 shadow-card space-y-4">
            <h2 className="text-base font-display font-semibold text-slate-dark">
              {selectedState.label}
            </h2>

            {selectedState.supported ? (
              <>
                {stateInfo && (
                  <>
                    <p className="text-sm font-body text-slate">{stateInfo.description}</p>
                    <ul className="space-y-1.5">
                      {stateInfo.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm font-body text-slate-dark">
                          <svg
                            className="h-4 w-4 text-primary flex-shrink-0 mt-0.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            aria-hidden="true"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* NY residency type + NYC prompt */}
                {stateCode === 'NY' && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-highlight-light p-4">
                      <p className="text-sm font-display font-semibold text-slate-dark mb-3">
                        What is your New York residency status?
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="nyResidencyType"
                            value="resident"
                            checked={nyResidencyType === 'resident'}
                            onChange={() => handleNYResidencyChange('resident')}
                            className="h-4 w-4 border-slate-light text-primary focus:ring-highlight focus:ring-2"
                          />
                          <div>
                            <p className="text-sm font-body font-medium text-slate-dark">
                              Full-year resident — I live in New York
                            </p>
                            <p className="text-xs font-body text-slate">Files IT-201</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="nyResidencyType"
                            value="nonresident"
                            checked={nyResidencyType === 'nonresident'}
                            onChange={() => handleNYResidencyChange('nonresident')}
                            className="h-4 w-4 border-slate-light text-primary focus:ring-highlight focus:ring-2"
                          />
                          <div>
                            <p className="text-sm font-body font-medium text-slate-dark">
                              Non-resident — I work in NY but live elsewhere
                            </p>
                            <p className="text-xs font-body text-slate">Files IT-203 · Tax applies to NY-sourced wages only</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {isNYNonResident && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-body text-amber-800">
                          <strong>Non-resident filing:</strong> NY tax is computed on your NY-sourced wages only (from W-2 Box 16). No NYC local tax applies.
                        </p>
                      </div>
                    )}

                    {/* NYC checkbox — only for residents */}
                    {!isNYNonResident && (
                      <label className="flex items-center gap-3 cursor-pointer rounded-xl bg-highlight-light p-4">
                        <input
                          type="checkbox"
                          checked={isNYC}
                          onChange={(e) => handleNYCToggle(e.target.checked)}
                          className="h-5 w-5 rounded border-slate-light text-primary
                                     focus:ring-highlight focus:ring-2"
                        />
                        <div>
                          <p className="text-sm font-display font-semibold text-slate-dark">
                            I live in New York City
                          </p>
                          <p className="text-xs font-body text-slate mt-0.5">
                            NYC residents pay both NYS and NYC income tax.
                          </p>
                        </div>
                      </label>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <svg
                    className="h-4 w-4 text-success"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    aria-hidden="true"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <p className="text-sm font-body text-success">
                    Full state tax calculation supported
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-surface p-4">
                <p className="text-sm font-body text-slate">
                  Federal return will be calculated. State tax calculations for {selectedState.label} are coming soon.
                </p>
                <p className="mt-2 text-xs font-body text-slate-light">
                  You can still file your federal return and manually complete your state return separately.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Supported states overview */}
        {!stateCode && (
          <div className="rounded-2xl bg-highlight-light/50 p-5">
            <h3 className="text-sm font-display font-semibold text-slate-dark mb-3">
              Supported States
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm font-body">
              {STATE_OPTIONS.filter((s) => s.supported).map((s) => (
                <div key={s.value} className="flex items-center gap-1.5 text-slate-dark">
                  <svg className="h-3.5 w-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

import { useCallback } from 'react';
import type { Dependent } from '@/engine/types';
import { FormField } from '@/ui/components/FormField';
import { SSNInput } from '@/ui/components/SSNInput';
import { DependentForm } from '@/ui/components/DependentForm';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { STATE_OPTIONS } from '@/ui/data/stateOptions';
import { useTaxState } from '@/ui/hooks/useTaxState';

/**
 * Per IRS Pub 554: you are considered age 65 the day before your 65th birthday.
 * Returns true if the person is 65+ at any point during the tax year.
 */
function isAge65ByEndOfTaxYear(dob: string, taxYear: number): boolean {
  if (!dob) return false;
  // The 65th birthday must fall on or before Jan 1 of the year after taxYear.
  // (IRS treats you as 65 on Dec 31 if born Jan 1 of the following year.)
  return new Date(dob) <= new Date(`${taxYear - 64}-01-01`);
}

export function PersonalInfoPage() {
  const { input, dispatch } = useTaxState();
  const headingRef = useFocusOnPageChange('personal-info');

  const showSpouse =
    input.filingStatus === 'married_filing_jointly' ||
    input.filingStatus === 'married_filing_separately';

  const handleAddDependent = useCallback(() => {
    dispatch({ type: 'ADD_DEPENDENT' });
  }, [dispatch]);

  const handleDependentChange = useCallback(
    (index: number, updates: Partial<Dependent>) => {
      dispatch({ type: 'UPDATE_DEPENDENT', index, updates });
    },
    [dispatch]
  );

  const handleRemoveDependent = useCallback(
    (index: number) => {
      dispatch({ type: 'REMOVE_DEPENDENT', index });
    },
    [dispatch]
  );

  const stateOptions = STATE_OPTIONS.map((s) => ({
    value: s.value,
    label: s.label,
  }));

  return (
    <PageContainer
      title="Personal Information"
      description="Enter your personal details as they appear on your government-issued ID."
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        Personal Information
      </h1>

      <div className="space-y-8">
        {/* Taxpayer section */}
        <section aria-labelledby="taxpayer-heading">
          <h2 id="taxpayer-heading" className="text-lg font-display font-semibold text-slate-dark mb-4">
            Your Information
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="First Name"
                name="taxpayer-firstName"
                value={input.taxpayer.firstName}
                onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'taxpayer.firstName', value: v })}
                required
              />
              <FormField
                label="Last Name"
                name="taxpayer-lastName"
                value={input.taxpayer.lastName}
                onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'taxpayer.lastName', value: v })}
                required
              />
            </div>
            <SSNInput
              label="Social Security Number"
              name="taxpayer-ssn"
              value={input.taxpayer.ssn}
              onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'taxpayer.ssn', value: v })}
              required
            />
            <FormField
              label="Date of Birth"
              name="taxpayer-dob"
              type="date"
              value={input.taxpayer.dateOfBirth}
              onChange={(v) => {
                dispatch({ type: 'SET_FIELD', path: 'taxpayer.dateOfBirth', value: v });
                dispatch({ type: 'SET_FIELD', path: 'taxpayerAge65OrOlder', value: isAge65ByEndOfTaxYear(v, input.taxYear) });
              }}
              required
            />

            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm font-body text-slate-dark cursor-pointer">
                <input
                  type="checkbox"
                  checked={input.taxpayerAge65OrOlder ?? false}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', path: 'taxpayerAge65OrOlder', value: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-light text-primary focus:ring-highlight focus:ring-2"
                />
                Age 65 or older
              </label>
              <label className="flex items-center gap-2 text-sm font-body text-slate-dark cursor-pointer">
                <input
                  type="checkbox"
                  checked={input.taxpayerBlind ?? false}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', path: 'taxpayerBlind', value: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-light text-primary focus:ring-highlight focus:ring-2"
                />
                Legally blind
              </label>
            </div>
          </div>
        </section>

        {/* Spouse section (conditional) */}
        {showSpouse && (
          <section aria-labelledby="spouse-heading">
            <h2 id="spouse-heading" className="text-lg font-display font-semibold text-slate-dark mb-4">
              Spouse Information
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Spouse First Name"
                  name="spouse-firstName"
                  value={input.spouse?.firstName ?? ''}
                  onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'spouse.firstName', value: v })}
                  required
                />
                <FormField
                  label="Spouse Last Name"
                  name="spouse-lastName"
                  value={input.spouse?.lastName ?? ''}
                  onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'spouse.lastName', value: v })}
                  required
                />
              </div>
              <SSNInput
                label="Spouse SSN"
                name="spouse-ssn"
                value={input.spouse?.ssn ?? ''}
                onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'spouse.ssn', value: v })}
                required
              />
              <FormField
                label="Spouse Date of Birth"
                name="spouse-dob"
                type="date"
                value={input.spouse?.dateOfBirth ?? ''}
                onChange={(v) => {
                  dispatch({ type: 'SET_FIELD', path: 'spouse.dateOfBirth', value: v });
                  dispatch({ type: 'SET_FIELD', path: 'spouseAge65OrOlder', value: isAge65ByEndOfTaxYear(v, input.taxYear) });
                }}
                required
              />

              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm font-body text-slate-dark cursor-pointer">
                  <input
                    type="checkbox"
                    checked={input.spouseAge65OrOlder ?? false}
                    onChange={(e) => dispatch({ type: 'SET_FIELD', path: 'spouseAge65OrOlder', value: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-light text-primary focus:ring-highlight focus:ring-2"
                  />
                  Age 65 or older
                </label>
                <label className="flex items-center gap-2 text-sm font-body text-slate-dark cursor-pointer">
                  <input
                    type="checkbox"
                    checked={input.spouseBlind ?? false}
                    onChange={(e) => dispatch({ type: 'SET_FIELD', path: 'spouseBlind', value: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-light text-primary focus:ring-highlight focus:ring-2"
                  />
                  Legally blind
                </label>
              </div>
            </div>
          </section>
        )}

        {/* Address section */}
        <section aria-labelledby="address-heading">
          <h2 id="address-heading" className="text-lg font-display font-semibold text-slate-dark mb-4">
            Mailing Address
          </h2>
          <div className="space-y-4">
            <FormField
              label="Street Address"
              name="address-street"
              value={input.address.street}
              onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'address.street', value: v })}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                label="City"
                name="address-city"
                value={input.address.city}
                onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'address.city', value: v })}
                required
              />
              <FormField
                label="State"
                name="address-state"
                type="select"
                value={input.address.state}
                onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'address.state', value: v })}
                options={stateOptions}
                required
              />
              <FormField
                label="ZIP Code"
                name="address-zip"
                value={input.address.zip}
                onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'address.zip', value: v })}
                placeholder="12345"
                required
              />
            </div>
          </div>
        </section>

        {/* Dependents section */}
        <section aria-labelledby="dependents-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="dependents-heading" className="text-lg font-display font-semibold text-slate-dark">
              Dependents
            </h2>
            <span className="text-sm font-body text-slate">
              {input.dependents.length} {input.dependents.length === 1 ? 'dependent' : 'dependents'}
            </span>
          </div>

          <div className="space-y-4">
            {input.dependents.map((dep, i) => (
              <DependentForm
                key={i}
                index={i}
                dependent={dep}
                onChange={handleDependentChange}
                onRemove={handleRemoveDependent}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddDependent}
            className="mt-4 w-full rounded-xl border border-dashed border-slate-light
                       px-6 py-3 text-sm font-display font-medium text-slate
                       hover:border-primary hover:text-primary-dark hover:bg-primary/5
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-highlight focus:ring-offset-1"
          >
            + Add Dependent
          </button>
        </section>
      </div>
    </PageContainer>
  );
}

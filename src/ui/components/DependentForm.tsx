import { useState, useCallback } from 'react';
import type { Dependent } from '@/engine/types';
import { FormField } from './FormField';
import { SSNInput } from './SSNInput';
import { HelpTooltip } from './HelpTooltip';
import { ConfirmDialog } from './ConfirmDialog';
import { HELP_TEXTS } from '@/ui/data/helpTexts';

interface DependentFormProps {
  index: number;
  dependent: Dependent;
  onChange: (index: number, updates: Partial<Dependent>) => void;
  onRemove: (index: number) => void;
  errors?: Record<string, string>;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'child', label: 'Child' },
  { value: 'stepchild', label: 'Stepchild' },
  { value: 'foster', label: 'Foster Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other' },
];

const MONTHS_OPTIONS = Array.from({ length: 13 }, (_, i) => ({
  value: String(i),
  label: String(i),
}));

/** Under 17 at end of 2025 means born after 2008-12-31 */
function computeQualifiesForCTC(dateOfBirth: string): boolean {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  // Under 17 at end of tax year 2025 = born on or after Jan 1 2009
  const cutoff = new Date('2009-01-01');
  return dob >= cutoff;
}

export function DependentForm({
  index,
  dependent,
  onChange,
  onRemove,
  errors = {},
}: DependentFormProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = useCallback(
    (field: keyof Dependent, value: string | number | boolean) => {
      const updates: Partial<Dependent> = { [field]: value };

      // Auto-compute CTC qualification when DOB changes
      if (field === 'dateOfBirth') {
        updates.qualifiesForCTC = computeQualifiesForCTC(value as string);
      }

      onChange(index, updates);
    },
    [index, onChange]
  );

  return (
    <>
      <div className="rounded-2xl border border-slate-light/50 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-display font-semibold text-slate-dark">
            Dependent {index + 1}
          </h3>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="text-sm font-display text-accent hover:text-accent-dark
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-accent rounded px-2 py-1"
            aria-label={`Remove dependent ${index + 1}`}
          >
            Remove
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="First Name"
            name={`dependent-${index}-firstName`}
            value={dependent.firstName}
            onChange={(v) => handleChange('firstName', v)}
            error={errors['firstName']}
            helpText={HELP_TEXTS['dependent.firstName']?.content}
            irsReference={HELP_TEXTS['dependent.firstName']?.irsReference}
            required
          />
          <FormField
            label="Last Name"
            name={`dependent-${index}-lastName`}
            value={dependent.lastName}
            onChange={(v) => handleChange('lastName', v)}
            error={errors['lastName']}
            helpText={HELP_TEXTS['dependent.lastName']?.content}
            irsReference={HELP_TEXTS['dependent.lastName']?.irsReference}
            required
          />
        </div>

        <SSNInput
          label="Social Security Number"
          name={`dependent-${index}-ssn`}
          value={dependent.ssn}
          onChange={(v) => handleChange('ssn', v)}
          error={errors['ssn']}
          helpText={HELP_TEXTS['dependent.ssn']?.content}
          irsReference={HELP_TEXTS['dependent.ssn']?.irsReference}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Date of Birth"
            name={`dependent-${index}-dob`}
            type="date"
            value={dependent.dateOfBirth}
            onChange={(v) => handleChange('dateOfBirth', v)}
            error={errors['dateOfBirth']}
            helpText={HELP_TEXTS['dependent.dateOfBirth']?.content}
            irsReference={HELP_TEXTS['dependent.dateOfBirth']?.irsReference}
            required
          />
          <FormField
            label="Relationship"
            name={`dependent-${index}-relationship`}
            type="select"
            value={dependent.relationship}
            onChange={(v) => handleChange('relationship', v)}
            options={RELATIONSHIP_OPTIONS}
            error={errors['relationship']}
            helpText={HELP_TEXTS['dependent.relationship']?.content}
            irsReference={HELP_TEXTS['dependent.relationship']?.irsReference}
            required
          />
        </div>

        <FormField
          label="Months Lived in Home"
          name={`dependent-${index}-months`}
          type="select"
          value={String(dependent.monthsLivedWithYou)}
          onChange={(v) => handleChange('monthsLivedWithYou', parseInt(v, 10))}
          options={MONTHS_OPTIONS}
          helpText="How many months did this dependent live in your home during the tax year?"
          irsReference={HELP_TEXTS['dependent.monthsLivedWithYou']?.irsReference}
        />

        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
          <label className="flex items-center gap-2 text-sm font-body text-slate-dark cursor-pointer">
            <input
              type="checkbox"
              checked={dependent.isStudent}
              onChange={(e) => handleChange('isStudent', e.target.checked)}
              className="h-4 w-4 rounded border-slate-light text-primary
                         focus:ring-highlight focus:ring-2"
            />
            Full-time student
            {HELP_TEXTS['dependent.isStudent']?.content && (
              <HelpTooltip content={HELP_TEXTS['dependent.isStudent'].content} irsReference={HELP_TEXTS['dependent.isStudent']?.irsReference} />
            )}
          </label>
          <label className="flex items-center gap-2 text-sm font-body text-slate-dark cursor-pointer">
            <input
              type="checkbox"
              checked={dependent.isDisabled}
              onChange={(e) => handleChange('isDisabled', e.target.checked)}
              className="h-4 w-4 rounded border-slate-light text-primary
                         focus:ring-highlight focus:ring-2"
            />
            Permanently disabled
            {HELP_TEXTS['dependent.isDisabled']?.content && (
              <HelpTooltip content={HELP_TEXTS['dependent.isDisabled'].content} irsReference={HELP_TEXTS['dependent.isDisabled']?.irsReference} />
            )}
          </label>
        </div>

        {dependent.qualifiesForCTC && (
          <p className="text-xs font-body text-success flex items-center gap-1">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Qualifies for Child Tax Credit (under 17)
          </p>
        )}
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          onRemove(index);
        }}
        title="Remove Dependent"
        message={`Remove ${dependent.firstName || 'this dependent'}? This cannot be undone.`}
        confirmLabel="Remove"
        confirmVariant="danger"
      />
    </>
  );
}

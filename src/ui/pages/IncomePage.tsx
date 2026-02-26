import { useState, useCallback } from 'react';
import { FormField } from '@/ui/components/FormField';
import { CurrencyInput } from '@/ui/components/CurrencyInput';
import { EINInput } from '@/ui/components/EINInput';
import { IncomeDocumentCard } from '@/ui/components/IncomeDocumentCard';
import { Document1099Upload } from '@/ui/components/Document1099Upload';
import { DocumentW2Upload } from '@/ui/components/DocumentW2Upload';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { HELP_TEXTS } from '@/ui/data/helpTexts';
import { STATE_OPTIONS } from '@/ui/data/stateOptions';
import { useTaxState } from '@/ui/hooks/useTaxState';
import type { Parsed1099Result } from '@/utils/1099-parser';
import type { ParsedW2Result } from '@/utils/w2-parser';

type IncomeSection = 'w2' | '1099int' | '1099div' | '1099nec' | 'other';

export function IncomePage() {
  const { input, dispatch } = useTaxState();
  const headingRef = useFocusOnPageChange('income');

  const [activeSection, setActiveSection] = useState<IncomeSection>('w2');

  // Track expanded cards
  const [expandedW2, setExpandedW2] = useState<Set<number>>(new Set());
  const [expandedINT, setExpandedINT] = useState<Set<number>>(new Set());
  const [expandedDIV, setExpandedDIV] = useState<Set<number>>(new Set());
  const [expandedNEC, setExpandedNEC] = useState<Set<number>>(new Set());

  const toggleExpanded = useCallback(
    (_set: Set<number>, setFn: React.Dispatch<React.SetStateAction<Set<number>>>, index: number) => {
      setFn((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    },
    []
  );

  const handlePdfImport = useCallback(
    (result: Parsed1099Result) => {
      if (result.form1099INTs.length > 0) {
        dispatch({ type: 'IMPORT_1099_INTS', payload: result.form1099INTs });
      }
      if (result.form1099DIVs.length > 0) {
        dispatch({ type: 'IMPORT_1099_DIVS', payload: result.form1099DIVs });
      }
      if (result.form1099NECs.length > 0) {
        dispatch({ type: 'IMPORT_1099_NECS', payload: result.form1099NECs });
      }
      if (result.form1099Bs.length > 0) {
        dispatch({
          type: 'IMPORT_1099_BS',
          payload: [...input.form1099Bs, ...result.form1099Bs],
        });
      }
    },
    [dispatch, input.form1099Bs],
  );

  const handleW2PdfImport = useCallback(
    (result: ParsedW2Result) => {
      if (result.w2s.length > 0) {
        dispatch({ type: 'IMPORT_W2S', payload: result.w2s });
      }
    },
    [dispatch],
  );

  const stateOptions = STATE_OPTIONS.map((s) => ({ value: s.value, label: s.label }));

  const { w2s, form1099INTs, form1099DIVs, form1099NECs } = input;
  const otherIncome = input.otherIncome ?? 0;

  const sections: Array<{ key: IncomeSection; label: string; count: number }> = [
    { key: 'w2', label: 'W-2', count: w2s.length },
    { key: '1099int', label: '1099-INT', count: form1099INTs.length },
    { key: '1099div', label: '1099-DIV', count: form1099DIVs.length },
    { key: '1099nec', label: '1099-NEC', count: form1099NECs.length },
    { key: 'other', label: 'Other', count: otherIncome > 0 ? 1 : 0 },
  ];

  return (
    <PageContainer
      title="Income"
      description="Enter all your income documents: W-2s, 1099s, and other income sources."
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        Income
      </h1>

      {/* 1099 PDF Upload */}
      <section className="mb-6" aria-label="Upload 1099 PDF">
        <h2 className="text-base font-display font-semibold text-slate-dark mb-3">
          Import from 1099 PDF
        </h2>
        <Document1099Upload onImport={handlePdfImport} />
      </section>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Income sections">
        {sections.map((sec) => (
          <button
            key={sec.key}
            role="tab"
            aria-selected={activeSection === sec.key}
            onClick={() => setActiveSection(sec.key)}
            className={`
              rounded-lg px-4 py-2 text-sm font-display font-medium transition-colors
              focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-1
              ${activeSection === sec.key
                ? 'bg-highlight text-slate-dark'
                : 'bg-surface text-slate hover:bg-highlight-light'}
            `}
          >
            {sec.label}
            {sec.count > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5
                               rounded-full bg-primary/15 text-xs text-primary-dark px-1.5">
                {sec.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* W-2 Section */}
      {activeSection === 'w2' && (
        <div className="space-y-4" role="tabpanel" aria-label="W-2 income">
          {/* W-2 PDF Upload */}
          <div className="mb-2">
            <DocumentW2Upload onImport={handleW2PdfImport} />
          </div>
          {w2s.map((w2, i) => (
            <IncomeDocumentCard
              key={i}
              title={w2.employerName || `W-2 #${i + 1}`}
              subtitle={w2.wages > 0 ? `$${(w2.wages / 100).toLocaleString()}` : undefined}
              isExpanded={expandedW2.has(i)}
              onToggle={() => toggleExpanded(expandedW2, setExpandedW2, i)}
              onRemove={() => dispatch({ type: 'REMOVE_W2', index: i })}
            >
              <div className="space-y-4">
                <FormField
                  label="Employer Name"
                  name={`w2-${i}-employer`}
                  value={w2.employerName}
                  onChange={(v) => dispatch({ type: 'UPDATE_W2', index: i, updates: { employerName: v } })}
                  helpText={HELP_TEXTS['w2.employerName']?.content}
                  irsReference={HELP_TEXTS['w2.employerName']?.irsReference}
                  required
                />
                <EINInput
                  label="Employer EIN"
                  name={`w2-${i}-ein`}
                  value={w2.employerEIN}
                  onChange={(v) => dispatch({ type: 'UPDATE_W2', index: i, updates: { employerEIN: v } })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CurrencyInput
                    label="Wages (Box 1)"
                    name={`w2-${i}-wages`}
                    value={w2.wages}
                    onChange={(v) => dispatch({ type: 'UPDATE_W2', index: i, updates: { wages: v } })}
                    helpText={HELP_TEXTS['w2.wages']?.content}
                    irsReference={HELP_TEXTS['w2.wages']?.irsReference}
                    required
                  />
                  <CurrencyInput
                    label="Federal Tax Withheld (Box 2)"
                    name={`w2-${i}-fedwh`}
                    value={w2.federalWithheld}
                    onChange={(v) => dispatch({ type: 'UPDATE_W2', index: i, updates: { federalWithheld: v } })}
                    helpText={HELP_TEXTS['w2.federalWithheld']?.content}
                    irsReference={HELP_TEXTS['w2.federalWithheld']?.irsReference}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CurrencyInput
                    label="SS Wages (Box 3)"
                    name={`w2-${i}-sswages`}
                    value={w2.socialSecurityWages}
                    onChange={(v) => dispatch({ type: 'UPDATE_W2', index: i, updates: { socialSecurityWages: v } })}
                    helpText={HELP_TEXTS['w2.socialSecurityWages']?.content}
                  />
                  <CurrencyInput
                    label="SS Withheld (Box 4)"
                    name={`w2-${i}-sswh`}
                    value={w2.socialSecurityWithheld}
                    onChange={(v) => dispatch({ type: 'UPDATE_W2', index: i, updates: { socialSecurityWithheld: v } })}
                    helpText={HELP_TEXTS['w2.socialSecurityWithheld']?.content}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CurrencyInput
                    label="Medicare Wages (Box 5)"
                    name={`w2-${i}-medwages`}
                    value={w2.medicareWages}
                    onChange={(v) => dispatch({ type: 'UPDATE_W2', index: i, updates: { medicareWages: v } })}
                    helpText={HELP_TEXTS['w2.medicareWages']?.content}
                  />
                  <CurrencyInput
                    label="Medicare Withheld (Box 6)"
                    name={`w2-${i}-medwh`}
                    value={w2.medicareWithheld}
                    onChange={(v) => dispatch({ type: 'UPDATE_W2', index: i, updates: { medicareWithheld: v } })}
                    helpText={HELP_TEXTS['w2.medicareWithheld']?.content}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    label="State (Box 15)"
                    name={`w2-${i}-state`}
                    type="select"
                    value={w2.stateCode}
                    onChange={(v) => dispatch({ type: 'UPDATE_W2', index: i, updates: { stateCode: v } })}
                    options={stateOptions}
                  />
                  <CurrencyInput
                    label="State Wages (Box 16)"
                    name={`w2-${i}-statewages`}
                    value={w2.stateWages}
                    onChange={(v) => dispatch({ type: 'UPDATE_W2', index: i, updates: { stateWages: v } })}
                  />
                  <CurrencyInput
                    label="State Withheld (Box 17)"
                    name={`w2-${i}-statewh`}
                    value={w2.stateWithheld}
                    onChange={(v) => dispatch({ type: 'UPDATE_W2', index: i, updates: { stateWithheld: v } })}
                  />
                </div>
              </div>
            </IncomeDocumentCard>
          ))}
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'ADD_W2' });
              setExpandedW2((prev) => new Set(prev).add(w2s.length));
            }}
            className="w-full rounded-xl border border-dashed border-slate-light px-6 py-3
                       text-sm font-display font-medium text-slate
                       hover:border-primary hover:text-primary-dark hover:bg-primary/5
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-highlight focus:ring-offset-1"
          >
            + Add W-2
          </button>
        </div>
      )}

      {/* 1099-INT Section */}
      {activeSection === '1099int' && (
        <div className="space-y-4" role="tabpanel" aria-label="1099-INT income">
          {form1099INTs.map((f, i) => (
            <IncomeDocumentCard
              key={i}
              title={f.payerName || `1099-INT #${i + 1}`}
              subtitle={f.payerName ? `$${(f.interest / 100).toLocaleString()} interest` : undefined}
              isExpanded={expandedINT.has(i)}
              onToggle={() => toggleExpanded(expandedINT, setExpandedINT, i)}
              onRemove={() => dispatch({ type: 'REMOVE_1099_INT', index: i })}
            >
              <div className="space-y-4">
                <FormField
                  label="Payer Name"
                  name={`1099int-${i}-payer`}
                  value={f.payerName}
                  onChange={(v) => dispatch({ type: 'UPDATE_1099_INT', index: i, updates: { payerName: v } })}
                  required
                />
                <CurrencyInput
                  label="Interest Income (Box 1)"
                  name={`1099int-${i}-interest`}
                  value={f.interest}
                  onChange={(v) => dispatch({ type: 'UPDATE_1099_INT', index: i, updates: { interest: v } })}
                  helpText={HELP_TEXTS['1099int.interest']?.content}
                  irsReference={HELP_TEXTS['1099int.interest']?.irsReference}
                  required
                />
                <CurrencyInput
                  label="Early Withdrawal Penalty (Box 2)"
                  name={`1099int-${i}-penalty`}
                  value={f.earlyWithdrawalPenalty ?? 0}
                  onChange={(v) => dispatch({ type: 'UPDATE_1099_INT', index: i, updates: { earlyWithdrawalPenalty: v } })}
                  helpText={HELP_TEXTS['1099int.earlyWithdrawalPenalty']?.content}
                />
                <CurrencyInput
                  label="Federal Tax Withheld (Box 4)"
                  name={`1099int-${i}-fedwh`}
                  value={f.federalWithheld ?? 0}
                  onChange={(v) => dispatch({ type: 'UPDATE_1099_INT', index: i, updates: { federalWithheld: v } })}
                />
              </div>
            </IncomeDocumentCard>
          ))}
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'ADD_1099_INT' });
              setExpandedINT((prev) => new Set(prev).add(form1099INTs.length));
            }}
            className="w-full rounded-xl border border-dashed border-slate-light px-6 py-3
                       text-sm font-display font-medium text-slate
                       hover:border-primary hover:text-primary-dark hover:bg-primary/5
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-highlight focus:ring-offset-1"
          >
            + Add 1099-INT
          </button>
        </div>
      )}

      {/* 1099-DIV Section */}
      {activeSection === '1099div' && (
        <div className="space-y-4" role="tabpanel" aria-label="1099-DIV income">
          {form1099DIVs.map((f, i) => (
            <IncomeDocumentCard
              key={i}
              title={f.payerName || `1099-DIV #${i + 1}`}
              subtitle={f.ordinaryDividends > 0 ? `$${(f.ordinaryDividends / 100).toLocaleString()}` : undefined}
              isExpanded={expandedDIV.has(i)}
              onToggle={() => toggleExpanded(expandedDIV, setExpandedDIV, i)}
              onRemove={() => dispatch({ type: 'REMOVE_1099_DIV', index: i })}
            >
              <div className="space-y-4">
                <FormField
                  label="Payer Name"
                  name={`1099div-${i}-payer`}
                  value={f.payerName}
                  onChange={(v) => dispatch({ type: 'UPDATE_1099_DIV', index: i, updates: { payerName: v } })}
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CurrencyInput
                    label="Ordinary Dividends (Box 1a)"
                    name={`1099div-${i}-ordinary`}
                    value={f.ordinaryDividends}
                    onChange={(v) => dispatch({ type: 'UPDATE_1099_DIV', index: i, updates: { ordinaryDividends: v } })}
                    helpText={HELP_TEXTS['1099div.ordinaryDividends']?.content}
                    irsReference={HELP_TEXTS['1099div.ordinaryDividends']?.irsReference}
                    required
                  />
                  <CurrencyInput
                    label="Qualified Dividends (Box 1b)"
                    name={`1099div-${i}-qualified`}
                    value={f.qualifiedDividends}
                    onChange={(v) => dispatch({ type: 'UPDATE_1099_DIV', index: i, updates: { qualifiedDividends: v } })}
                    helpText={HELP_TEXTS['1099div.qualifiedDividends']?.content}
                    irsReference={HELP_TEXTS['1099div.qualifiedDividends']?.irsReference}
                  />
                </div>
                <CurrencyInput
                  label="Total Capital Gain (Box 2a)"
                  name={`1099div-${i}-capgain`}
                  value={f.totalCapitalGain}
                  onChange={(v) => dispatch({ type: 'UPDATE_1099_DIV', index: i, updates: { totalCapitalGain: v } })}
                  helpText={HELP_TEXTS['1099div.totalCapitalGain']?.content}
                />
                <CurrencyInput
                  label="Federal Tax Withheld (Box 4)"
                  name={`1099div-${i}-fedwh`}
                  value={f.federalWithheld ?? 0}
                  onChange={(v) => dispatch({ type: 'UPDATE_1099_DIV', index: i, updates: { federalWithheld: v } })}
                />
              </div>
            </IncomeDocumentCard>
          ))}
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'ADD_1099_DIV' });
              setExpandedDIV((prev) => new Set(prev).add(form1099DIVs.length));
            }}
            className="w-full rounded-xl border border-dashed border-slate-light px-6 py-3
                       text-sm font-display font-medium text-slate
                       hover:border-primary hover:text-primary-dark hover:bg-primary/5
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-highlight focus:ring-offset-1"
          >
            + Add 1099-DIV
          </button>
        </div>
      )}

      {/* 1099-NEC Section */}
      {activeSection === '1099nec' && (
        <div className="space-y-4" role="tabpanel" aria-label="1099-NEC income">
          {form1099NECs.map((f, i) => (
            <IncomeDocumentCard
              key={i}
              title={f.payerName || `1099-NEC #${i + 1}`}
              subtitle={
                f.nonemployeeCompensation > 0
                  ? `$${(f.nonemployeeCompensation / 100).toLocaleString()}`
                  : undefined
              }
              isExpanded={expandedNEC.has(i)}
              onToggle={() => toggleExpanded(expandedNEC, setExpandedNEC, i)}
              onRemove={() => dispatch({ type: 'REMOVE_1099_NEC', index: i })}
            >
              <div className="space-y-4">
                <FormField
                  label="Payer Name"
                  name={`1099nec-${i}-payer`}
                  value={f.payerName}
                  onChange={(v) => dispatch({ type: 'UPDATE_1099_NEC', index: i, updates: { payerName: v } })}
                  required
                />
                <CurrencyInput
                  label="Nonemployee Compensation (Box 1)"
                  name={`1099nec-${i}-comp`}
                  value={f.nonemployeeCompensation}
                  onChange={(v) => dispatch({ type: 'UPDATE_1099_NEC', index: i, updates: { nonemployeeCompensation: v } })}
                  helpText={HELP_TEXTS['1099nec.nonemployeeCompensation']?.content}
                  irsReference={HELP_TEXTS['1099nec.nonemployeeCompensation']?.irsReference}
                  required
                />
                <CurrencyInput
                  label="Federal Tax Withheld (Box 4)"
                  name={`1099nec-${i}-fedwh`}
                  value={f.federalWithheld ?? 0}
                  onChange={(v) => dispatch({ type: 'UPDATE_1099_NEC', index: i, updates: { federalWithheld: v } })}
                />
                <p className="text-xs font-body text-warning">
                  Self-employment income is subject to SE tax (15.3%). Schedule C may be required.
                </p>
              </div>
            </IncomeDocumentCard>
          ))}
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'ADD_1099_NEC' });
              setExpandedNEC((prev) => new Set(prev).add(form1099NECs.length));
            }}
            className="w-full rounded-xl border border-dashed border-slate-light px-6 py-3
                       text-sm font-display font-medium text-slate
                       hover:border-primary hover:text-primary-dark hover:bg-primary/5
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-highlight focus:ring-offset-1"
          >
            + Add 1099-NEC
          </button>
        </div>
      )}

      {/* Other income */}
      {activeSection === 'other' && (
        <div className="space-y-4" role="tabpanel" aria-label="Other income">
          <CurrencyInput
            label="Other Income"
            name="other-income"
            value={otherIncome}
            onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'otherIncome', value: v })}
            helpText="Any other taxable income not reported on W-2 or 1099 forms (e.g., gambling winnings, prizes, jury duty pay)."
          />
          <FormField
            label="Description (required for Schedule 1 Line 8)"
            name="other-income-description"
            value={input.otherIncomeDescription ?? ''}
            onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'otherIncomeDescription', value: v })}
            placeholder="e.g., Gambling winnings, Prize, Jury duty"
          />
        </div>
      )}
    </PageContainer>
  );
}

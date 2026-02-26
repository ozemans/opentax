import { useState, useCallback } from 'react';
import { FormField } from '@/ui/components/FormField';
import { TaxSummaryCard } from '@/ui/components/TaxSummaryCard';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { PasswordDialog } from '@/ui/components/PasswordDialog';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { useTaxState } from '@/ui/hooks/useTaxState';
import { useEncryptedExport } from '@/ui/hooks/useEncryptedExport';
import { generateReturnPackage } from '@/pdf/generator';

export function ReviewPage() {
  const { input, result, dispatch, clearAll } = useTaxState();
  const headingRef = useFocusOnPageChange('review');
  const {
    exportReturn,
    isExporting,
    error: exportError,
    clearError: clearExportError,
  } = useEncryptedExport(input, dispatch);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Read from result, fallback to zeros
  const totalIncome = result?.totalIncome ?? 0;
  const adjustedGrossIncome = result?.adjustedGrossIncome ?? 0;
  const taxableIncome = result?.taxableIncome ?? 0;
  const totalTax = result?.totalTax ?? 0;
  const totalCredits = result?.totalCredits ?? 0;
  const totalPayments = result?.totalPayments ?? 0;
  const refundOrOwed = result?.refundOrOwed ?? 0;
  const effectiveTaxRate = result?.effectiveTaxRate ?? 0;
  const incomeBreakdown = result?.incomeBreakdown;

  // Filing status display
  const filingStatusLabels: Record<string, string> = {
    single: 'Single',
    married_filing_jointly: 'Married Filing Jointly',
    married_filing_separately: 'Married Filing Separately',
    head_of_household: 'Head of Household',
    qualifying_surviving_spouse: 'Qualifying Surviving Spouse',
  };

  const handleDownloadPDF = useCallback(async () => {
    if (!result) return;
    setIsDownloading(true);
    try {
      const pdfBytes = await generateReturnPackage(input, result);
      const blob = new Blob([pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `opentax-${input.taxYear}-return.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[OpenTax] Failed to generate PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [input, result]);

  async function handleExport(password: string) {
    await exportReturn(password);
    if (!exportError) {
      setShowExportPassword(false);
    }
  }

  async function handleClearAll() {
    await clearAll();
    setShowClearConfirm(false);
  }

  return (
    <PageContainer
      title="Review Your Return"
      description="Review all the information below before downloading your completed tax return."
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        Review Your Return
      </h1>

      <div className="space-y-6">
        {/* Personal info summary */}
        <TaxSummaryCard
          title="Personal Information"
          editPath="/personal-info"
          items={[
            { label: 'Filing Status', value: filingStatusLabels[input.filingStatus] ?? input.filingStatus },
            { label: 'Dependents', value: input.dependents.length },
          ]}
        />

        {/* Income summary */}
        <TaxSummaryCard
          title="Income"
          editPath="/income"
          items={[
            { label: 'Wages & Salaries', value: incomeBreakdown?.wages ?? 0, isCurrency: true },
            { label: 'Interest Income', value: incomeBreakdown?.interest ?? 0, isCurrency: true },
            { label: 'Dividend Income', value: incomeBreakdown?.ordinaryDividends ?? 0, isCurrency: true },
            { label: 'Capital Gains', value: (incomeBreakdown?.shortTermCapitalGains ?? 0) + (incomeBreakdown?.longTermCapitalGains ?? 0), isCurrency: true },
            { label: 'Total Income', value: totalIncome, isCurrency: true },
          ]}
        />

        {/* Adjustments summary */}
        <TaxSummaryCard
          title="Adjustments"
          editPath="/adjustments"
          items={[
            { label: 'Total Adjustments', value: totalIncome - adjustedGrossIncome, isCurrency: true },
            { label: 'Adjusted Gross Income', value: adjustedGrossIncome, isCurrency: true },
          ]}
        />

        {/* Deductions summary */}
        <TaxSummaryCard
          title="Deductions"
          editPath="/deductions"
          items={[
            { label: 'Deduction Amount', value: adjustedGrossIncome - taxableIncome, isCurrency: true },
            { label: 'Taxable Income', value: taxableIncome, isCurrency: true },
          ]}
        />

        {/* Credits summary */}
        <TaxSummaryCard
          title="Credits"
          editPath="/credits"
          items={[
            { label: 'Total Credits', value: totalCredits, isCurrency: true },
          ]}
        />

        {/* Tax calculation */}
        <TaxSummaryCard
          title="Tax Calculation"
          highlight
          items={[
            { label: 'Total Tax', value: totalTax, isCurrency: true },
            { label: 'Total Payments & Credits', value: totalPayments + totalCredits, isCurrency: true },
            {
              label: refundOrOwed >= 0 ? 'Refund' : 'Amount Owed',
              value: refundOrOwed,
              isCurrency: true,
            },
            { label: 'Effective Tax Rate', value: effectiveTaxRate, isPercentage: true },
          ]}
        />

        {/* Direct Deposit */}
        <section aria-labelledby="direct-deposit-heading" className="space-y-4">
          <h2 id="direct-deposit-heading" className="text-lg font-display font-semibold text-slate-dark">
            Direct Deposit (Optional)
          </h2>
          <p className="text-sm font-body text-slate">
            For faster refund delivery, provide your bank account information.
          </p>

          <div className="rounded-2xl border border-slate-light/30 bg-white p-5 shadow-card space-y-4">
            <FormField
              label="Routing Number"
              name="routing-number"
              value={input.directDeposit?.routingNumber ?? ''}
              onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'directDeposit.routingNumber', value: v })}
              placeholder="9 digits"
              helpText="Your bank routing number (9 digits). Found on the bottom left of your checks."
              irsReference="Form 1040, Line 35b"
            />
            <FormField
              label="Account Number"
              name="account-number"
              value={input.directDeposit?.accountNumber ?? ''}
              onChange={(v) => dispatch({ type: 'SET_FIELD', path: 'directDeposit.accountNumber', value: v })}
              helpText="Your bank account number."
              irsReference="Form 1040, Line 35c"
            />
            <fieldset>
              <legend className="text-sm font-body font-medium text-slate-dark mb-2">
                Account Type
              </legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-body text-slate-dark">
                  <input
                    type="radio"
                    name="account-type"
                    value="checking"
                    checked={(input.directDeposit?.accountType ?? 'checking') === 'checking'}
                    onChange={() => dispatch({ type: 'SET_FIELD', path: 'directDeposit.accountType', value: 'checking' })}
                    className="h-4 w-4 border-slate-light text-primary focus:ring-highlight"
                  />
                  Checking
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-body text-slate-dark">
                  <input
                    type="radio"
                    name="account-type"
                    value="savings"
                    checked={(input.directDeposit?.accountType ?? 'checking') === 'savings'}
                    onChange={() => dispatch({ type: 'SET_FIELD', path: 'directDeposit.accountType', value: 'savings' })}
                    className="h-4 w-4 border-slate-light text-primary focus:ring-highlight"
                  />
                  Savings
                </label>
              </div>
            </fieldset>
          </div>
        </section>

        {/* Action buttons */}
        <div className="space-y-3 pt-4">
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isDownloading || !result}
            className="w-full rounded-xl bg-primary px-6 py-4 text-base font-display
                       font-semibold text-white hover:bg-primary-dark transition-colors
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                       shadow-card hover:shadow-card-hover disabled:opacity-50"
          >
            {isDownloading ? 'Generating PDF...' : 'Download PDF Return'}
          </button>

          <button
            type="button"
            onClick={() => setShowExportPassword(true)}
            className="w-full rounded-xl border border-slate-light px-6 py-3 text-sm
                       font-display font-medium text-slate-dark hover:bg-surface
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-highlight focus:ring-offset-1"
          >
            Export .opentax Backup
          </button>

          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="w-full rounded-xl border border-accent/30 px-6 py-3 text-sm
                       font-display font-medium text-accent hover:bg-accent/5
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-accent focus:ring-offset-1"
          >
            Clear All Data
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAll}
        title="Clear All Data"
        message="This will permanently delete all your tax return data from this device. This action cannot be undone. Consider exporting a backup first."
        confirmLabel="Clear Everything"
        confirmVariant="danger"
      />

      <PasswordDialog
        isOpen={showExportPassword}
        onClose={() => {
          setShowExportPassword(false);
          clearExportError();
        }}
        onSubmit={handleExport}
        mode="export"
        error={exportError ?? undefined}
        isLoading={isExporting}
      />
    </PageContainer>
  );
}

// Federal Income & AGI Computation
// References: IRS Form 1040 Lines 1-11, Schedule 1 Part II

import type { TaxInput, FederalConfig } from '../types';

/**
 * Compute gross Schedule C net profit/loss.
 * This is a simplified version — full Schedule C is in self-employment.ts.
 * Used here only for total income computation.
 */
function computeScheduleCNet(input: TaxInput): number {
  if (!input.scheduleCData) return 0;
  const data = input.scheduleCData;
  const expenses = data.expenses;
  const totalExpenses =
    (expenses.advertising ?? 0) +
    (expenses.carAndTruck ?? 0) +
    (expenses.commissions ?? 0) +
    (expenses.insurance ?? 0) +
    (expenses.legalAndProfessional ?? 0) +
    (expenses.officeExpenses ?? 0) +
    (expenses.supplies ?? 0) +
    (expenses.utilities ?? 0) +
    (expenses.otherExpenses ?? 0);

  return data.grossReceipts - (data.costOfGoodsSold ?? 0) - totalExpenses + (data.otherIncome ?? 0);
}

/**
 * Compute total income (Form 1040 Line 9).
 * Sums all income sources before adjustments.
 */
export function computeTotalIncome(input: TaxInput): number {
  // 1. W-2 wages (Box 1)
  const wages = input.w2s.reduce((sum, w2) => sum + w2.wages, 0);

  // 2. Taxable interest (1099-INT Box 1 minus tax-exempt Box 8)
  const interest = input.form1099INTs.reduce(
    (sum, f) => sum + f.interest - (f.taxExemptInterest ?? 0),
    0,
  );

  // 3. Ordinary dividends (1099-DIV Box 1a)
  const dividends = input.form1099DIVs.reduce(
    (sum, f) => sum + f.ordinaryDividends,
    0,
  );

  // 4. 1099-NEC non-employee compensation
  const necIncome = input.form1099NECs.reduce(
    (sum, f) => sum + f.nonemployeeCompensation,
    0,
  );

  // 5. Unemployment (1099-G Box 1)
  const unemployment = input.form1099Gs.reduce(
    (sum, f) => sum + f.unemployment,
    0,
  );

  // 6. Retirement distributions (1099-R Box 2a taxable amount)
  const retirement = input.form1099Rs.reduce(
    (sum, f) => sum + f.taxableAmount,
    0,
  );

  // 7. Schedule C net profit/loss
  const scheduleCNet = computeScheduleCNet(input);

  // 8. Other income
  const other = input.otherIncome ?? 0;

  // Note: Capital gains are NOT included here — they are added by the
  // orchestrator after computeCapitalGains() determines the deductible amount.
  // The orchestrator adds the net capital gain/loss (limited to -$3k) to total income.

  return wages + interest + dividends + necIncome + unemployment + retirement + scheduleCNet + other;
}

/**
 * Compute phase-out reduction for student loan interest deduction.
 * Returns the allowable deduction amount after phase-out.
 */
function phaseOutStudentLoanInterest(
  amount: number,
  totalIncome: number,
  filingStatus: string,
  config: FederalConfig,
): number {
  if (amount <= 0) return 0;

  const capped = Math.min(amount, config.studentLoanInterest.maxDeduction);

  // MFS cannot claim this deduction
  if (filingStatus === 'married_filing_separately') return 0;

  const isMFJ = filingStatus === 'married_filing_jointly' || filingStatus === 'qualifying_surviving_spouse';
  const phaseOut = isMFJ
    ? config.studentLoanInterest.phaseOut.mfj
    : config.studentLoanInterest.phaseOut.single;

  if (totalIncome <= phaseOut.begin) return capped;
  if (totalIncome >= phaseOut.end) return 0;

  // Proportional reduction
  const range = phaseOut.end - phaseOut.begin;
  const excess = totalIncome - phaseOut.begin;
  const reductionRatio = excess / range;
  const reduced = Math.round(capped * (1 - reductionRatio));
  return Math.max(0, reduced);
}

/**
 * Compute above-the-line adjustments (Schedule 1 Part II).
 * Returns total adjustments in cents.
 *
 * @param input - Tax return input data
 * @param totalIncome - Computed total income (for phase-out calculations; used as proxy for MAGI)
 * @param halfSETax - Half of self-employment tax (from SE module)
 * @param config - Federal tax config
 */
export function computeAdjustments(
  input: TaxInput,
  totalIncome: number,
  halfSETax: number,
  config: FederalConfig,
): number {
  let adjustments = 0;

  // 1. Half of self-employment tax (Schedule SE, Line 13)
  adjustments += halfSETax;

  // 2. Student loan interest deduction (max $2,500, with phase-out)
  if (input.studentLoanInterest && input.studentLoanInterest > 0) {
    adjustments += phaseOutStudentLoanInterest(
      input.studentLoanInterest,
      totalIncome,
      input.filingStatus,
      config,
    );
  }

  // 3. Educator expenses (max $300)
  if (input.educatorExpenses && input.educatorExpenses > 0) {
    adjustments += Math.min(input.educatorExpenses, config.educatorExpensesMax);
  }

  // 4. HSA deduction
  if (input.hsaDeduction && input.hsaDeduction > 0) {
    adjustments += input.hsaDeduction;
  }

  // 5. IRA deduction
  if (input.iraDeduction && input.iraDeduction > 0) {
    adjustments += input.iraDeduction;
  }

  return adjustments;
}

/**
 * Compute Adjusted Gross Income (Form 1040 Line 11).
 * AGI = Total Income - Adjustments
 */
export function computeAGI(
  input: TaxInput,
  halfSETax: number,
  config: FederalConfig,
): { totalIncome: number; adjustments: number; agi: number } {
  const totalIncome = computeTotalIncome(input);
  const adjustments = computeAdjustments(input, totalIncome, halfSETax, config);
  const agi = totalIncome - adjustments;

  return { totalIncome, adjustments, agi };
}

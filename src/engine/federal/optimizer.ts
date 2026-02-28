// Tax Opportunity Detector
//
// Scans the user's return for common missed deductions and credits.
// Returns a prioritized list of actionable suggestions.
//
// All monetary values are integers in CENTS.
// Marginal rate estimates use the computed federal marginal rate.

import type { TaxInput, TaxResult } from '../types';

export interface TaxOpportunity {
  id: string;
  title: string;
  description: string;
  /** Estimated tax savings in cents. 0 = unquantifiable but still worth noting. */
  estimatedSavings: number;
  /** Page slug to navigate to */
  actionPage?: string;
  /** Call-to-action label for the link */
  actionLabel?: string;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Compute tax opportunities for the given return.
 * Returns only actionable suggestions that apply to the user's situation.
 */
export function computeOpportunities(
  input: TaxInput,
  result: TaxResult,
): TaxOpportunity[] {
  const opportunities: TaxOpportunity[] = [];
  const agi = result.adjustedGrossIncome;
  const marginalRate = result.marginalTaxRate / 100; // convert % to decimal

  // Earned income: wages + self-employment net profit
  const wages = input.w2s.reduce((s, w) => s + w.wages, 0);
  const seProfit = result.selfEmploymentResult?.scheduleCNetProfit ?? 0;
  const earnedIncome = wages + seProfit;

  // ---------------------------------------------------------------------------
  // AOTC — American Opportunity Tax Credit
  // ---------------------------------------------------------------------------
  const hasAOTCEducation = (input.educationExpenses ?? []).some(
    (e) => e.type === 'american_opportunity',
  );
  if (!hasAOTCEducation && earnedIncome > 0 && agi < 9_000_000) {
    // Suggest AOTC if AGI is under the phase-out and no AOTC entered.
    // Full $2,500 credit at $4,000 expenses; $1,000 of that is refundable.
    opportunities.push({
      id: 'aotc_unclaimed',
      title: 'American Opportunity Credit (AOTC)',
      description:
        'If you (or a dependent) are in the first 4 years of college, you may qualify for up to a $2,500 credit — $1,000 of which is refundable even if you owe no tax. Eligible expenses include tuition, books, and required supplies.',
      estimatedSavings: 250000, // Up to $2,500
      actionPage: 'credits',
      actionLabel: 'Add education expenses',
    });
  }

  // ---------------------------------------------------------------------------
  // Traditional IRA deduction
  // ---------------------------------------------------------------------------
  const maxIRAContrib = 700000; // $7,000 for 2025
  const iraEnteredCents = input.iraDeduction ?? 0;
  const iraHeadroom = Math.max(0, maxIRAContrib - iraEnteredCents);
  const hasWorkplacePlan = input.hasWorkplaceRetirementPlan ?? false;

  // Phase-out for single with workplace plan: $79k–$89k
  const singlePlanPhaseOutEnd = 8_900_000;
  const isSingle =
    input.filingStatus === 'single' || input.filingStatus === 'head_of_household';
  const fullyPhasedOut = hasWorkplacePlan && isSingle && agi >= singlePlanPhaseOutEnd;

  if (iraHeadroom > 0 && earnedIncome > 0 && !fullyPhasedOut) {
    const savings = Math.round(iraHeadroom * marginalRate);
    opportunities.push({
      id: 'ira_traditional',
      title: 'Traditional IRA Deduction',
      description:
        `You can contribute up to $7,000 to a Traditional IRA (2025). At your marginal rate, a $${(iraHeadroom / 100).toLocaleString()} contribution saves approximately $${(savings / 100).toLocaleString()} in federal taxes.`,
      estimatedSavings: savings,
      actionPage: 'adjustments',
      actionLabel: 'Enter IRA contribution',
    });
  }

  // ---------------------------------------------------------------------------
  // Student loan interest
  // ---------------------------------------------------------------------------
  const studentLoanDeduction = input.studentLoanInterest ?? 0;
  // Phase-out ends at $95k single (2025 approximate)
  if (studentLoanDeduction === 0 && agi < 9_500_000) {
    const potentialDeduction = 250000; // Max $2,500
    const savings = Math.round(potentialDeduction * marginalRate);
    opportunities.push({
      id: 'student_loan_interest',
      title: 'Student Loan Interest Deduction',
      description:
        `Paid interest on qualifying student loans? You can deduct up to $2,500 above the line — no need to itemize. At your marginal rate, that saves up to $${(savings / 100).toLocaleString()}.`,
      estimatedSavings: savings,
      actionPage: 'adjustments',
      actionLabel: 'Add student loan interest',
    });
  }

  // ---------------------------------------------------------------------------
  // W-4 adjustment — underpayment warning
  // ---------------------------------------------------------------------------
  const federalOwed = -(result.refundOrOwed); // positive = owed
  if (federalOwed > 100000) {
    // Owed more than $1,000
    opportunities.push({
      id: 'withholding_adjust',
      title: 'Adjust Your W-4 Withholding',
      description:
        `You owe $${(federalOwed / 100).toLocaleString()} this year. Adjusting your W-4 with your employer will increase withholding, avoiding an underpayment penalty next April.`,
      estimatedSavings: 0,
      actionPage: 'income',
      actionLabel: 'Update W-2 withholding',
    });
  }

  // Sort by estimated savings descending; informational items last
  return opportunities.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
}

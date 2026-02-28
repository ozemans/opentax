// Wisconsin State Tax Module
//
// WI uses progressive brackets 3.50%–7.65% for 2025.
// Starting point: federal AGI.
// Key features:
// - Standard deduction phases out at higher incomes (computed inline)
// - Personal exemption: $700 per person
// - Social Security income largely exempt (simplified: fully exempt)
//
// Standard deduction phase-out (single 2025):
//   - Full $13,350 deduction at income ≤ $16,580
//   - Phases out linearly to $0 at income ≥ $33,530
//   - Phase-out rate ≈ 0.7876 per dollar ($13,350 / $16,950 range)
// MFJ (2025):
//   - Full $24,590 at income ≤ $22,360; $0 at income ≥ $71,250
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import type { TaxBracket } from '../types';
import type { FilingStatus } from '../types';
import {
  computeStateBracketTax,
  computePersonalExemptions,
  computeStateStandardDeduction,
  getStateMarginalRate,
} from './common';

// Phase-out thresholds in cents: [phaseOutBegin, phaseOutEnd]
const WI_SD_PHASE_OUT: Record<FilingStatus, [number, number]> = {
  single:                     [1658000, 3353000],
  married_filing_jointly:     [2236000, 7125000],
  married_filing_separately:  [1118000, 3562500],
  head_of_household:          [1658000, 4900000],
  qualifying_surviving_spouse:[2236000, 7125000],
};

function computeWIStandardDeduction(
  filingStatus: FilingStatus,
  config: StateConfig,
  wiAGI: number,
): number {
  const baseDeduction = computeStateStandardDeduction(filingStatus, config);
  if (baseDeduction === 0) return 0;

  const [phaseOutBegin, phaseOutEnd] = WI_SD_PHASE_OUT[filingStatus] ?? [0, 0];

  if (wiAGI <= phaseOutBegin) return baseDeduction;
  if (wiAGI >= phaseOutEnd) return 0;

  const phaseOutRange = phaseOutEnd - phaseOutBegin;
  const excess = wiAGI - phaseOutBegin;
  const reductionRatio = excess / phaseOutRange;
  return Math.max(0, Math.round(baseDeduction * (1 - reductionRatio)));
}

export const wisconsin: StateModule = {
  stateCode: 'WI',
  stateName: 'Wisconsin',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const brackets = config.brackets?.[input.filingStatus] as TaxBracket[] | undefined;
    if (!brackets) {
      throw new Error(`No WI brackets configured for filing status: ${input.filingStatus}`);
    }

    let wiAGI = input.federalAGI;

    // Social Security exempt in WI
    const ssSubtraction = config.socialSecurityExempt ? input.socialSecurityIncome : 0;
    wiAGI -= ssSubtraction;

    // Standard deduction with phase-out
    const deduction = computeWIStandardDeduction(input.filingStatus, config, wiAGI);

    // Personal exemptions
    const exemptions = computePersonalExemptions(input, config);

    const taxableIncome = Math.max(0, wiAGI - deduction - exemptions);

    const taxBeforeCredits = computeStateBracketTax(taxableIncome, brackets);
    const taxAfterCredits = taxBeforeCredits;

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((taxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    const marginalRate = getStateMarginalRate(taxableIncome, brackets);

    return {
      stateCode: 'WI',
      stateName: 'Wisconsin',
      hasIncomeTax: true,
      stateAGI: wiAGI,
      stateAdditions: 0,
      stateSubtractions: ssSubtraction,
      stateDeduction: deduction,
      stateExemptions: exemptions,
      stateTaxableIncome: taxableIncome,
      stateTaxBeforeCredits: taxBeforeCredits,
      stateCredits: 0,
      stateSurtax: 0,
      localTax: 0,
      stateTaxAfterCredits: taxAfterCredits,
      stateWithheld: input.stateWithheld,
      stateEstimatedPayments: input.stateEstimatedPayments,
      stateRefundOrOwed: input.stateWithheld + input.stateEstimatedPayments - taxAfterCredits,
      effectiveRate,
      marginalRate: marginalRate * 100,
      creditBreakdown: {},
      formData: {
        federalAGI: input.federalAGI,
        wiAGI,
        deduction,
        exemptions,
        taxableIncome,
        taxBeforeCredits,
      },
      formId: config.formId,
    };
  },
};

// Maryland State Tax Module
//
// MD uses progressive brackets 2%–5.75% plus a county/city addon tax.
// Starting point: federal AGI.
// Key features:
// - Standard deduction: 15% of Maryland AGI, min $1,800 / max $4,000 (single);
//   min $3,200 / max $8,000 (MFJ)
// - Personal exemption: $3,200 per person (taxpayer, spouse, dependents)
// - County/city tax: statewide weighted average 2.96% applied to taxable income
// - Social Security fully exempt
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import type { TaxBracket } from '../types';
import type { FilingStatus } from '../types';
import {
  computeStateBracketTax,
  computePersonalExemptions,
  getStateMarginalRate,
} from './common';

// Maryland standard deduction: 15% of MD AGI, clamped to min/max
const MD_SD_MIN: Record<FilingStatus, number> = {
  single:                     180000,  // $1,800
  married_filing_jointly:     320000,  // $3,200
  married_filing_separately:  180000,
  head_of_household:          180000,
  qualifying_surviving_spouse:320000,
};

const MD_SD_MAX: Record<FilingStatus, number> = {
  single:                     400000,  // $4,000
  married_filing_jointly:     800000,  // $8,000
  married_filing_separately:  400000,
  head_of_household:          400000,
  qualifying_surviving_spouse:800000,
};

function computeMDStandardDeduction(filingStatus: FilingStatus, mdAGI: number): number {
  const calculated = Math.round(mdAGI * 0.15);
  const min = MD_SD_MIN[filingStatus] ?? 180000;
  const max = MD_SD_MAX[filingStatus] ?? 400000;
  return Math.max(min, Math.min(max, calculated));
}

// Default county rate (statewide weighted average)
const DEFAULT_COUNTY_RATE = 0.0296;

export const maryland: StateModule = {
  stateCode: 'MD',
  stateName: 'Maryland',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const brackets = config.brackets?.[input.filingStatus] as TaxBracket[] | undefined;
    if (!brackets) {
      throw new Error(`No MD brackets configured for filing status: ${input.filingStatus}`);
    }

    let mdAGI = input.federalAGI;

    // Social Security fully exempt
    const ssSubtraction = config.socialSecurityExempt ? input.socialSecurityIncome : 0;
    mdAGI -= ssSubtraction;

    // Standard deduction: 15% of MD AGI, clamped
    const deduction = computeMDStandardDeduction(input.filingStatus, mdAGI);

    // Personal exemptions
    const exemptions = computePersonalExemptions(input, config);

    const taxableIncome = Math.max(0, mdAGI - deduction - exemptions);

    // State tax
    const taxBeforeCredits = computeStateBracketTax(taxableIncome, brackets);

    // County/city tax (statewide average — actual varies by county)
    const countyTax = Math.round(taxableIncome * DEFAULT_COUNTY_RATE);

    const taxAfterCredits = taxBeforeCredits;
    const totalTax = taxAfterCredits + countyTax;

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((totalTax / input.federalAGI) * 10000) / 100
        : 0;

    const marginalRate = getStateMarginalRate(taxableIncome, brackets);

    return {
      stateCode: 'MD',
      stateName: 'Maryland',
      hasIncomeTax: true,
      stateAGI: mdAGI,
      stateAdditions: 0,
      stateSubtractions: ssSubtraction,
      stateDeduction: deduction,
      stateExemptions: exemptions,
      stateTaxableIncome: taxableIncome,
      stateTaxBeforeCredits: taxBeforeCredits,
      stateCredits: 0,
      stateSurtax: 0,
      localTax: countyTax,
      stateTaxAfterCredits: taxAfterCredits,
      stateWithheld: input.stateWithheld,
      stateEstimatedPayments: input.stateEstimatedPayments,
      stateRefundOrOwed: input.stateWithheld + input.stateEstimatedPayments - totalTax,
      effectiveRate,
      marginalRate: (marginalRate + DEFAULT_COUNTY_RATE) * 100,
      creditBreakdown: {},
      formData: {
        federalAGI: input.federalAGI,
        mdAGI,
        deduction,
        exemptions,
        taxableIncome,
        taxBeforeCredits,
        countyTax,
      },
      formId: config.formId,
    };
  },
};

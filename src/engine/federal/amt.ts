/**
 * Alternative Minimum Tax (AMT) — IRS Form 6251
 *
 * The AMT is a parallel tax system designed to ensure that high-income
 * taxpayers who benefit from certain deductions still pay a minimum amount
 * of tax. The main AMT preference item for most filers is the SALT deduction.
 *
 * All monetary values are in CENTS (integers).
 */

import type { FederalConfig, FilingStatus } from '../types';

export interface AMTParams {
  taxableIncome: number;
  itemizedSALT: number;
  regularTax: number;
  filingStatus: FilingStatus;
  usedItemized: boolean;
}

/**
 * Compute the Alternative Minimum Tax.
 *
 * Steps (per IRS Form 6251):
 *   1. Start with taxable income
 *   2. Add back SALT deduction (only if taxpayer itemized)
 *   3. Result = AMTI (Alternative Minimum Taxable Income)
 *   4. Subtract AMT exemption (phased out for high earners)
 *   5. Apply AMT rates (26% / 28%) to the AMT base
 *   6. AMT = max(0, tentative minimum tax − regular tax)
 */
export function computeAMT(
  params: AMTParams,
  config: FederalConfig,
): number {
  const { taxableIncome, itemizedSALT, regularTax, filingStatus, usedItemized } = params;

  // Step 1-2: Compute AMTI
  // Only add back SALT if the taxpayer actually itemized deductions.
  const saltAddBack = usedItemized ? itemizedSALT : 0;
  const amti = taxableIncome + saltAddBack;

  if (amti <= 0) return 0;

  // Step 3: Compute AMT exemption with phase-out
  const exemption = computeAMTExemption(amti, filingStatus, config);

  // Step 4: AMT base (cannot be negative)
  const amtBase = Math.max(0, amti - exemption);

  if (amtBase === 0) return 0;

  // Step 5: Apply AMT rates
  const tentativeMinTax = computeTentativeMinimumTax(amtBase, filingStatus, config);

  // Step 6: AMT = max(0, tentative minimum tax - regular tax)
  return Math.max(0, tentativeMinTax - regularTax);
}

/**
 * Compute the AMT exemption amount after phase-out.
 *
 * The exemption is reduced by 25 cents for every dollar of AMTI
 * above the phase-out threshold. The exemption cannot go below $0.
 *
 * Ref: IRS Form 6251, Part II
 */
function computeAMTExemption(
  amti: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): number {
  const baseExemption = config.amt.exemption[filingStatus];
  const phaseOutBegins = config.amt.phaseOutBegins[filingStatus];

  if (amti <= phaseOutBegins) {
    return baseExemption;
  }

  // Reduction = 25% of excess AMTI over the phase-out threshold
  const excess = amti - phaseOutBegins;
  const reduction = Math.round(excess * 0.25);

  return Math.max(0, baseExemption - reduction);
}

/**
 * Compute the tentative minimum tax by applying the two-tier AMT rate structure.
 *
 * - 26% on the first portion up to the breakpoint
 * - 28% on amounts above the breakpoint
 *
 * The breakpoint differs for MFS filers ($119,550) vs. others ($239,100).
 *
 * Ref: IRS Form 6251, Part III
 */
function computeTentativeMinimumTax(
  amtBase: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): number {
  const { low: lowRate, high: highRate, breakpoint } = config.amt.rates;
  const bp = breakpoint[filingStatus];

  if (amtBase <= bp) {
    return Math.round(amtBase * lowRate);
  }

  // Two-tier calculation
  const lowPortion = Math.round(bp * lowRate);
  const highPortion = Math.round((amtBase - bp) * highRate);

  return lowPortion + highPortion;
}

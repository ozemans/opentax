/**
 * Net Investment Income Tax (NIIT) — IRS Form 8960
 *
 * A 3.8% surtax on the lesser of:
 *   - Net investment income, OR
 *   - MAGI exceeding the filing-status-specific threshold
 *
 * Investment income includes: interest, dividends, capital gains,
 * rental income, and other passive income.
 *
 * Does NOT include: wages, SE income, Social Security, retirement distributions.
 *
 * All monetary values are in CENTS (integers).
 */

import type { FederalConfig, FilingStatus, TaxInput } from '../types';

export interface NIITParams {
  magi: number;
  investmentIncome: number;
  filingStatus: FilingStatus;
}

/**
 * Compute the Net Investment Income Tax.
 *
 * NIIT = 3.8% * min(net investment income, MAGI - threshold)
 * If MAGI <= threshold, NIIT = $0.
 *
 * Ref: IRS Form 8960, Line 17
 */
export function computeNIIT(
  params: NIITParams,
  config: FederalConfig,
): number {
  const { magi, investmentIncome, filingStatus } = params;

  const threshold = config.niit.threshold[filingStatus];

  // If MAGI is at or below the threshold, no NIIT applies
  if (magi <= threshold) return 0;

  // If no investment income, no NIIT
  if (investmentIncome <= 0) return 0;

  // NIIT applies to the lesser of:
  //   1. Net investment income
  //   2. MAGI exceeding the threshold
  const excess = magi - threshold;
  const taxableAmount = Math.min(investmentIncome, excess);

  return Math.round(taxableAmount * config.niit.rate);
}

/**
 * Compute total net investment income from a TaxInput.
 *
 * Includes:
 *   - All 1099-INT interest (Box 1)
 *   - All 1099-DIV ordinary dividends (Box 1a)
 *   - Net capital gains from 1099-B (if positive; negative net gains are NOT included)
 *   - Other passive income (otherIncome field)
 *
 * Excludes:
 *   - Wages (W-2)
 *   - Self-employment income (1099-NEC, Schedule C)
 *   - Social Security benefits
 *   - Retirement distributions (1099-R)
 *   - Unemployment compensation (1099-G)
 *
 * Ref: IRS Form 8960, Lines 1-4
 */
export function computeInvestmentIncome(input: TaxInput): number {
  // 1. Sum all 1099-INT interest
  const totalInterest = input.form1099INTs.reduce(
    (sum, f) => sum + f.interest,
    0,
  );

  // 2. Sum all 1099-DIV ordinary dividends
  const totalDividends = input.form1099DIVs.reduce(
    (sum, f) => sum + f.ordinaryDividends,
    0,
  );

  // 3. Net capital gains (only if positive)
  const netCapitalGains = input.form1099Bs.reduce(
    (sum, f) => sum + f.gainLoss,
    0,
  );
  const capitalGainsComponent = Math.max(0, netCapitalGains);

  // 4. Other passive income
  const otherPassiveIncome = input.otherIncome ?? 0;

  return totalInterest + totalDividends + capitalGainsComponent + otherPassiveIncome;
}

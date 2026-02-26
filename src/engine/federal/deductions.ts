// Federal Deductions — Standard vs Itemized
// References: IRS Form 1040 Lines 12-15, Schedule A

import type { FilingStatus, FederalConfig, ItemizedDeductions, DeductionBreakdown } from '../types';

/**
 * Compute standard deduction including additional amounts for age 65+ and blind.
 * IRS Form 1040 Line 12
 */
export function computeStandardDeduction(
  filingStatus: FilingStatus,
  config: FederalConfig,
  taxpayer65OrOlder: boolean,
  taxpayerBlind: boolean,
  spouse65OrOlder: boolean,
  spouseBlind: boolean,
  agi: number = 0,
): number {
  let deduction = config.standardDeduction[filingStatus];

  const isMarried =
    filingStatus === 'married_filing_jointly' ||
    filingStatus === 'married_filing_separately' ||
    filingStatus === 'qualifying_surviving_spouse';

  const additionalAmount = isMarried
    ? config.additionalStandardDeduction.married
    : config.additionalStandardDeduction.single;

  // Taxpayer additions
  if (taxpayer65OrOlder) deduction += additionalAmount;
  if (taxpayerBlind) deduction += additionalAmount;

  // Spouse additions (only for married statuses)
  if (isMarried) {
    if (spouse65OrOlder) deduction += additionalAmount;
    if (spouseBlind) deduction += additionalAmount;
  }

  // OBBBA §70102 — Senior deduction for age 65+
  if (config.seniorDeduction) {
    const sd = config.seniorDeduction;
    const phaseOut = sd.phaseOut[filingStatus];
    const numSeniors =
      (taxpayer65OrOlder ? 1 : 0) +
      (isMarried && spouse65OrOlder ? 1 : 0);

    if (numSeniors > 0) {
      let seniorAmount = sd.amount;
      // Phase-out: reduce by phaseOutRate per dollar of AGI over begin threshold
      if (agi > phaseOut.begin) {
        const excess = agi - phaseOut.begin;
        const reduction = Math.round(excess * sd.phaseOutRate);
        seniorAmount = Math.max(0, seniorAmount - reduction);
      }
      deduction += seniorAmount * numSeniors;
    }
  }

  return deduction;
}

/**
 * Compute the SALT deduction cap based on MAGI and filing status.
 * OBBBA 2025: Base cap $40,000 ($20k MFS), phases down to $10,000 ($5k MFS) floor
 * at 30 cents per dollar of MAGI over $500,000 ($250k MFS).
 */
export function computeSaltCap(
  magi: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): number {
  const baseCap = config.salt.baseCap[filingStatus];
  const phaseOutBegins = config.salt.phaseOutBegins[filingStatus];
  const floor = config.salt.floor[filingStatus];

  if (magi <= phaseOutBegins) return baseCap;

  const excess = magi - phaseOutBegins;
  const reduction = Math.round(excess * config.salt.phaseOutRate);
  const phasedCap = baseCap - reduction;

  return Math.max(floor, phasedCap);
}

/**
 * Compute itemized deductions (Schedule A).
 * Returns total and the SALT amount after cap.
 */
export function computeItemizedDeductions(
  itemized: ItemizedDeductions,
  agi: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): { total: number; saltCapped: number } {
  let total = 0;

  // 1. Medical expenses exceeding 7.5% of AGI (Schedule A Line 4)
  const medicalThreshold = Math.round(agi * config.medicalExpenseThreshold);
  const medicalDeduction = Math.max(0, itemized.medicalExpenses - medicalThreshold);
  total += medicalDeduction;

  // 2. SALT: state/local income + property taxes, capped (Schedule A Line 5d-7)
  const totalSALT = itemized.stateLocalTaxesPaid + itemized.realEstateTaxes;
  const saltCap = computeSaltCap(agi, filingStatus, config);
  const saltCapped = Math.min(totalSALT, saltCap);
  total += saltCapped;

  // 3. Mortgage interest (Schedule A Line 8a)
  // For simplicity, assume debt is within the $750k limit
  total += itemized.mortgageInterest;

  // 4. Mortgage insurance premiums
  total += itemized.mortgageInsurancePremiums ?? 0;

  // 5. Charitable contributions (Schedule A Lines 11-14)
  // Cash: limited to 60% of AGI
  const cashCharityLimit = Math.round(agi * config.charitableLimits.cashPercentAGI);
  const cashCharity = Math.min(itemized.charitableCash, cashCharityLimit);
  total += cashCharity;

  // Non-cash: limited to 30% of AGI
  const nonCashCharityLimit = Math.round(agi * config.charitableLimits.nonCashPercentAGI);
  const nonCashCharity = Math.min(itemized.charitableNonCash, nonCashCharityLimit);
  total += nonCashCharity;

  // 6. Casualty losses (federally declared disasters only)
  total += itemized.casualtyLosses ?? 0;

  // 7. Other deductions
  total += itemized.otherDeductions ?? 0;

  return { total, saltCapped };
}

/**
 * Compute deductions — determines standard vs itemized and returns breakdown.
 * IRS Form 1040 Lines 12-13
 */
export function computeDeductions(
  filingStatus: FilingStatus,
  agi: number,
  useItemized: boolean,
  itemized: ItemizedDeductions | undefined,
  config: FederalConfig,
  taxpayer65OrOlder: boolean,
  taxpayerBlind: boolean,
  spouse65OrOlder: boolean,
  spouseBlind: boolean,
): DeductionBreakdown {
  const standardAmount = computeStandardDeduction(
    filingStatus,
    config,
    taxpayer65OrOlder,
    taxpayerBlind,
    spouse65OrOlder,
    spouseBlind,
    agi,
  );

  let itemizedAmount = 0;
  let saltCapped = 0;
  if (itemized) {
    const result = computeItemizedDeductions(itemized, agi, filingStatus, config);
    itemizedAmount = result.total;
    saltCapped = result.saltCapped;
  }

  const useItemizedFinal = useItemized && itemized !== undefined;

  return {
    type: useItemizedFinal ? 'itemized' : 'standard',
    amount: useItemizedFinal ? itemizedAmount : standardAmount,
    standardAmount,
    itemizedAmount,
    itemizedDetails: itemized ? { ...itemized, saltCapped } : undefined,
  };
}

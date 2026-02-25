// Self-Employment Tax Module
// Handles Schedule C net profit, SE tax (Social Security + Medicare),
// and Qualified Business Income (QBI / Section 199A) deduction.
//
// All monetary values are integers in CENTS.
// References: IRS Schedule C, Schedule SE, Form 8995/8995-A

import type {
  ScheduleCData,
  ScheduleCExpenses,
  FederalConfig,
  FilingStatus,
  SelfEmploymentResult,
} from '../types';

// ---------------------------------------------------------------------------
// Schedule C — Net Profit / Loss
// ---------------------------------------------------------------------------

/**
 * Computes Schedule C net profit and home office deduction.
 *
 * Net profit = grossReceipts + otherIncome - COGS - expenses - homeOfficeDeduction
 *
 * Home office (simplified method): $5/sqft * min(sqft, 300) = max $1,500
 * If useSimplifiedMethod is false, home office deduction is 0 (actual method not yet implemented).
 */
export function computeScheduleC(
  data: ScheduleCData,
  config: FederalConfig,
): { netProfit: number; homeOfficeDeduction: number } {
  const { selfEmployment: seConfig } = config;

  // Home office deduction (simplified method)
  let homeOfficeDeduction = 0;
  if (data.homeOffice?.useSimplifiedMethod) {
    const cappedSqFt = Math.min(data.homeOffice.squareFootage, seConfig.homeOfficeMaxSqFt);
    homeOfficeDeduction = cappedSqFt * seConfig.homeOfficeSimplifiedRate;
  }

  // Sum all Schedule C expenses
  const expenses = data.expenses;
  const totalExpenses = sumExpenses(expenses);

  // Cost of goods sold
  const cogs = data.costOfGoodsSold ?? 0;

  // Other income (line 6 of Schedule C)
  const otherIncome = data.otherIncome ?? 0;

  // Net profit (or loss)
  const netProfit = data.grossReceipts + otherIncome - cogs - totalExpenses - homeOfficeDeduction;

  return { netProfit, homeOfficeDeduction };
}

/**
 * Sums all optional expense fields in ScheduleCExpenses.
 * Undefined fields default to 0.
 */
function sumExpenses(expenses: ScheduleCExpenses): number {
  return (
    (expenses.advertising ?? 0) +
    (expenses.carAndTruck ?? 0) +
    (expenses.commissions ?? 0) +
    (expenses.insurance ?? 0) +
    (expenses.legalAndProfessional ?? 0) +
    (expenses.officeExpenses ?? 0) +
    (expenses.supplies ?? 0) +
    (expenses.utilities ?? 0) +
    (expenses.otherExpenses ?? 0)
  );
}

// ---------------------------------------------------------------------------
// Self-Employment Tax (Schedule SE)
// ---------------------------------------------------------------------------

/**
 * Computes Self-Employment Tax: Social Security (12.4%) + Medicare (2.9%).
 *
 * - SE taxable income = netSEIncome * 92.35% (deductible employer-equivalent half)
 * - Social Security: 12.4% on SE taxable income up to (wage base - W-2 SS wages)
 * - Medicare: 2.9% on all SE taxable income
 * - Additional Medicare Tax (0.9%) is computed separately by the main orchestrator
 * - Half of total SE tax is an above-the-line deduction (reduces AGI)
 *
 * Reference: IRS Schedule SE, Part I
 */
export function computeSelfEmploymentTax(
  netSEIncome: number,
  w2SocialSecurityWages: number,
  _filingStatus: FilingStatus,
  config: FederalConfig,
): {
  seTaxableIncome: number;
  socialSecurityTax: number;
  medicareTax: number;
  totalSETax: number;
  halfSETaxDeduction: number;
} {
  const { selfEmployment: seConfig } = config;

  // If net SE income is zero or negative, no SE tax
  if (netSEIncome <= 0) {
    return {
      seTaxableIncome: 0,
      socialSecurityTax: 0,
      medicareTax: 0,
      totalSETax: 0,
      halfSETaxDeduction: 0,
    };
  }

  // Step 1: SE taxable income = 92.35% of net SE income
  // This represents the "employer equivalent" deduction — you only pay SE tax on 92.35%
  const seTaxableIncome = Math.round(netSEIncome * seConfig.seTaxableRate);

  // Step 2: Social Security tax
  // Remaining wage base after W-2 wages
  const remainingWageBase = Math.max(0, seConfig.wageBase - w2SocialSecurityWages);
  const ssSubjectIncome = Math.min(seTaxableIncome, remainingWageBase);
  const socialSecurityTax = Math.round(ssSubjectIncome * seConfig.socialSecurityRate);

  // Step 3: Medicare tax (on ALL SE taxable income, no cap)
  const medicareTax = Math.round(seTaxableIncome * seConfig.medicareRate);

  // Step 4: Total and half deduction
  const totalSETax = socialSecurityTax + medicareTax;
  const halfSETaxDeduction = Math.round(totalSETax / 2);

  return {
    seTaxableIncome,
    socialSecurityTax,
    medicareTax,
    totalSETax,
    halfSETaxDeduction,
  };
}

// ---------------------------------------------------------------------------
// QBI Deduction (Section 199A)
// ---------------------------------------------------------------------------

/**
 * Computes the Qualified Business Income deduction.
 *
 * - Below phase-out threshold: deduction = 20% of QBI
 * - In phase-out range: deduction is reduced linearly
 * - Above phase-out: limited to greater of (50% W-2 wages) or (25% W-2 wages + 2.5% UBIA)
 *   For a solo self-employed person with no employees (no W-2 wages paid), this is $0.
 * - Deduction never exceeds 20% of taxable income (before QBI deduction)
 *
 * Reference: IRS Form 8995 (simplified), Form 8995-A (detailed)
 */
export function computeQBIDeduction(
  qbi: number,
  taxableIncomeBeforeQBI: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): number {
  // No deduction for zero/negative QBI or zero/negative taxable income
  if (qbi <= 0 || taxableIncomeBeforeQBI <= 0) {
    return 0;
  }

  const { qbi: qbiConfig } = config;

  // Determine phase-out thresholds based on filing status
  const phaseOut = getQBIPhaseOut(filingStatus, qbiConfig);
  const phaseOutBegin = phaseOut.begin;
  const phaseOutEnd = phaseOut.end;

  // Full tentative deduction: 20% of QBI
  const fullDeduction = Math.round(qbi * qbiConfig.deductionRate);

  let deduction: number;

  if (taxableIncomeBeforeQBI <= phaseOutBegin) {
    // Below phase-out: full 20% deduction
    deduction = fullDeduction;
  } else if (taxableIncomeBeforeQBI >= phaseOutEnd) {
    // Above phase-out: limited to W-2 wages / UBIA test
    // For a solo self-employed person with no W-2 wages paid to employees, this is $0
    deduction = 0;
  } else {
    // In phase-out range: reduce deduction linearly
    // Reduction factor = (income - begin) / (end - begin)
    const phaseOutRange = phaseOutEnd - phaseOutBegin;
    const incomeOverBegin = taxableIncomeBeforeQBI - phaseOutBegin;
    const reductionFactor = incomeOverBegin / phaseOutRange;

    // The reduction amount is the full deduction * reduction factor
    const reduction = Math.round(fullDeduction * reductionFactor);
    deduction = fullDeduction - reduction;
  }

  // Cap at 20% of taxable income before QBI deduction
  const taxableIncomeCap = Math.round(taxableIncomeBeforeQBI * qbiConfig.deductionRate);
  deduction = Math.min(deduction, taxableIncomeCap);

  return Math.max(0, deduction);
}

/**
 * Returns the QBI phase-out begin/end thresholds for the given filing status.
 * MFS uses the single thresholds (per IRS rules, MFS = half of MFJ, which matches single).
 */
function getQBIPhaseOut(
  filingStatus: FilingStatus,
  qbiConfig: FederalConfig['qbi'],
): { begin: number; end: number } {
  if (
    filingStatus === 'married_filing_jointly' ||
    filingStatus === 'qualifying_surviving_spouse'
  ) {
    return qbiConfig.phaseOut.mfj;
  }
  // Single, HoH, and MFS all use the single threshold
  return qbiConfig.phaseOut.single;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Orchestrates all self-employment computations.
 *
 * 1. Computes Schedule C net profit and home office deduction
 * 2. Computes SE tax (Social Security + Medicare)
 * 3. Computes QBI deduction
 *
 * Returns a complete SelfEmploymentResult.
 * If no ScheduleCData is provided, returns a zero result.
 */
export function computeSelfEmployment(
  data: ScheduleCData | undefined,
  w2SocialSecurityWages: number,
  filingStatus: FilingStatus,
  taxableIncomeBeforeQBI: number,
  config: FederalConfig,
): SelfEmploymentResult {
  // No self-employment data → zero result
  if (!data) {
    return {
      scheduleCNetProfit: 0,
      homeOfficeDeduction: 0,
      seTaxableIncome: 0,
      socialSecurityTax: 0,
      medicareTax: 0,
      totalSETax: 0,
      halfSETaxDeduction: 0,
      qbiDeduction: 0,
    };
  }

  // Step 1: Schedule C
  const scheduleC = computeScheduleC(data, config);

  // Step 2: SE Tax (only on positive net profit)
  const seTax = computeSelfEmploymentTax(
    scheduleC.netProfit,
    w2SocialSecurityWages,
    filingStatus,
    config,
  );

  // Step 3: QBI Deduction
  // QBI = net profit from Schedule C (only if positive)
  const qbi = Math.max(0, scheduleC.netProfit);
  const qbiDeduction = computeQBIDeduction(
    qbi,
    taxableIncomeBeforeQBI,
    filingStatus,
    config,
  );

  return {
    scheduleCNetProfit: scheduleC.netProfit,
    homeOfficeDeduction: scheduleC.homeOfficeDeduction,
    seTaxableIncome: seTax.seTaxableIncome,
    socialSecurityTax: seTax.socialSecurityTax,
    medicareTax: seTax.medicareTax,
    totalSETax: seTax.totalSETax,
    halfSETaxDeduction: seTax.halfSETaxDeduction,
    qbiDeduction,
  };
}

// State Tax Common Utilities
//
// Shared computation functions used by all state tax modules.
// Follows the same pattern as federal/brackets.ts for progressive bracket math.
//
// All monetary values are integers in CENTS. $50,000 = 5_000_000 cents.
// NEVER use floating point for money — only integers + Math.round().

import type { TaxInput, TaxResult, TaxBracket, FilingStatus } from '../types';
import type { StateTaxInput, StateTaxResult, StateConfig } from './interface';

// ---------------------------------------------------------------------------
// Progressive Bracket Tax
// ---------------------------------------------------------------------------

/**
 * Compute state income tax using progressive brackets.
 * Same algorithm as federal computeOrdinaryTax but takes brackets directly.
 *
 * @param taxableIncome Taxable income in cents
 * @param brackets      Progressive tax brackets
 * @returns Tax in cents (rounded)
 */
export function computeStateBracketTax(
  taxableIncome: number,
  brackets: TaxBracket[],
): number {
  if (taxableIncome <= 0) return 0;

  let tax = 0;

  for (const bracket of brackets) {
    const lower = bracket.min;
    const upper = bracket.max ?? Infinity;

    if (taxableIncome <= lower) break;

    const taxableInBracket = Math.min(taxableIncome, upper) - lower;
    tax += taxableInBracket * bracket.rate;
  }

  return Math.round(tax);
}

// ---------------------------------------------------------------------------
// Flat Tax
// ---------------------------------------------------------------------------

/**
 * Compute flat rate tax.
 *
 * @param taxableIncome Taxable income in cents
 * @param rate          Tax rate as decimal (e.g. 0.0307 for 3.07%)
 * @returns Tax in cents (rounded)
 */
export function computeFlatTax(taxableIncome: number, rate: number): number {
  if (taxableIncome <= 0) return 0;
  return Math.round(taxableIncome * rate);
}

// ---------------------------------------------------------------------------
// Marginal Rate Lookup
// ---------------------------------------------------------------------------

/**
 * Get the marginal tax rate for a given taxable income and bracket schedule.
 *
 * @param taxableIncome Taxable income in cents
 * @param brackets      Progressive tax brackets
 * @returns Marginal rate as decimal (e.g. 0.0575 for 5.75%)
 */
export function getStateMarginalRate(
  taxableIncome: number,
  brackets: TaxBracket[],
): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncome >= brackets[i].min) {
      return brackets[i].rate;
    }
  }
  return brackets[0]?.rate ?? 0;
}

// ---------------------------------------------------------------------------
// Personal Exemptions
// ---------------------------------------------------------------------------

/**
 * Compute total personal exemptions for a state.
 *
 * @param input  State tax input
 * @param config State config
 * @returns Total exemptions in cents
 */
export function computePersonalExemptions(
  input: StateTaxInput,
  config: StateConfig,
): number {
  if (!config.personalExemption) return 0;

  const pe = config.personalExemption;
  let total = 0;

  // Taxpayer exemption
  const taxpayerExemption = pe.taxpayer[input.filingStatus] ?? 0;
  total += taxpayerExemption;

  // Spouse exemption (only for MFJ / QSS)
  if (
    input.filingStatus === 'married_filing_jointly' ||
    input.filingStatus === 'qualifying_surviving_spouse'
  ) {
    total += pe.spouse;
  }

  // Dependent exemptions
  total += input.numDependents * pe.dependent;

  // Age 65+ additional
  if (pe.age65Additional) {
    if (input.taxpayerAge65OrOlder) total += pe.age65Additional;
    if (
      input.spouseAge65OrOlder &&
      (input.filingStatus === 'married_filing_jointly' ||
        input.filingStatus === 'qualifying_surviving_spouse')
    ) {
      total += pe.age65Additional;
    }
  }

  // Blind additional
  if (pe.blindAdditional) {
    if (input.taxpayerBlind) total += pe.blindAdditional;
    if (
      input.spouseBlind &&
      (input.filingStatus === 'married_filing_jointly' ||
        input.filingStatus === 'qualifying_surviving_spouse')
    ) {
      total += pe.blindAdditional;
    }
  }

  return total;
}

// ---------------------------------------------------------------------------
// Standard Deduction
// ---------------------------------------------------------------------------

/**
 * Get the state standard deduction for a filing status.
 *
 * @param filingStatus Filing status
 * @param config       State config
 * @returns Standard deduction in cents, or 0 if not configured
 */
export function computeStateStandardDeduction(
  filingStatus: FilingStatus,
  config: StateConfig,
): number {
  if (!config.standardDeduction) return 0;
  return config.standardDeduction[filingStatus] ?? 0;
}

// ---------------------------------------------------------------------------
// State EITC
// ---------------------------------------------------------------------------

/**
 * Compute state EITC as a percentage of federal EITC.
 *
 * @param federalEITC        Federal EITC amount in cents
 * @param percentOfFederal   State EITC percentage as decimal (e.g. 0.20 for 20%)
 * @returns State EITC in cents (rounded)
 */
export function computeStateEITC(
  federalEITC: number,
  percentOfFederal: number,
): number {
  if (federalEITC <= 0) return 0;
  return Math.round(federalEITC * percentOfFederal);
}

// ---------------------------------------------------------------------------
// Surtax
// ---------------------------------------------------------------------------

/**
 * Compute surtax on income exceeding a threshold.
 *
 * @param taxableIncome  Total taxable income in cents
 * @param filingStatus   Filing status
 * @param surtaxConfig   Surtax configuration from state config
 * @returns Surtax in cents (rounded)
 */
export function computeSurtax(
  taxableIncome: number,
  filingStatus: FilingStatus,
  surtaxConfig: NonNullable<StateConfig['surtax']>,
): number {
  const threshold = surtaxConfig.threshold[filingStatus] ?? Infinity;
  if (taxableIncome <= threshold) return 0;
  return Math.round((taxableIncome - threshold) * surtaxConfig.rate);
}

// ---------------------------------------------------------------------------
// No-Tax Result Builder
// ---------------------------------------------------------------------------

/**
 * Build a zero-filled StateTaxResult for states with no income tax.
 *
 * @param stateCode State abbreviation
 * @param stateName Full state name
 * @param input     State tax input
 * @returns StateTaxResult with all tax fields zeroed
 */
export function buildNoTaxResult(
  stateCode: string,
  stateName: string,
  input: StateTaxInput,
): StateTaxResult {
  return {
    stateCode,
    stateName,
    hasIncomeTax: false,
    stateAGI: 0,
    stateAdditions: 0,
    stateSubtractions: 0,
    stateDeduction: 0,
    stateExemptions: 0,
    stateTaxableIncome: 0,
    stateTaxBeforeCredits: 0,
    stateCredits: 0,
    stateSurtax: 0,
    localTax: 0,
    stateTaxAfterCredits: 0,
    stateWithheld: input.stateWithheld,
    stateEstimatedPayments: input.stateEstimatedPayments,
    stateRefundOrOwed: input.stateWithheld + input.stateEstimatedPayments,
    effectiveRate: 0,
    marginalRate: 0,
    creditBreakdown: {},
    formData: {},
    formId: 'none',
  };
}

// ---------------------------------------------------------------------------
// Build StateTaxInput from TaxInput + Federal TaxResult
// ---------------------------------------------------------------------------

/**
 * Extract state-specific input from the federal return data.
 * Maps federal fields to the StateTaxInput interface.
 *
 * @param input         Original tax input
 * @param federalResult Computed federal tax result
 * @param stateCode     State code to filter W-2 state wages/withholding
 * @returns StateTaxInput for the state module
 */
export function buildStateTaxInput(
  input: TaxInput,
  federalResult: TaxResult,
  stateCode: string,
): StateTaxInput {
  // Sum all W-2 wages
  const wages = input.w2s.reduce((sum, w2) => sum + w2.wages, 0);

  // Sum state-specific W-2 fields (Box 16/17) where stateCode matches
  const stateWages = input.w2s
    .filter((w2) => w2.stateCode === stateCode)
    .reduce((sum, w2) => sum + w2.stateWages, 0);

  const stateWithheld = input.w2s
    .filter((w2) => w2.stateCode === stateCode)
    .reduce((sum, w2) => sum + w2.stateWithheld, 0);

  // Sum 1099-INT interest
  const taxableInterest = input.form1099INTs.reduce(
    (sum, f) => sum + f.interest - (f.taxExemptInterest ?? 0),
    0,
  );

  // Sum 1099-DIV dividends
  const ordinaryDividends = input.form1099DIVs.reduce(
    (sum, f) => sum + f.ordinaryDividends,
    0,
  );
  const qualifiedDividends = input.form1099DIVs.reduce(
    (sum, f) => sum + f.qualifiedDividends,
    0,
  );

  // Capital gains from federal result
  const shortTermCapitalGains = Math.max(
    0,
    federalResult.capitalGainsResult.netShortTerm,
  );
  const longTermCapitalGains = Math.max(
    0,
    federalResult.capitalGainsResult.netLongTerm,
  );
  const netCapitalGainLoss =
    federalResult.capitalGainsResult.netCapitalGainLoss;

  // Self-employment income
  const selfEmploymentIncome =
    federalResult.selfEmploymentResult?.scheduleCNetProfit ?? 0;

  // Federal itemized deductions
  const federalItemizedDeductions =
    federalResult.deductionBreakdown.itemizedAmount;

  // Locality from first matching W-2
  const locality = input.w2s.find(
    (w) => w.stateCode === stateCode,
  )?.locality;

  return {
    federalAGI: federalResult.adjustedGrossIncome,
    federalTaxableIncome: federalResult.taxableIncome,
    federalTotalIncome: federalResult.totalIncome,
    filingStatus: input.filingStatus,
    taxYear: input.taxYear,
    taxpayerAge65OrOlder: input.taxpayerAge65OrOlder ?? false,
    taxpayerBlind: input.taxpayerBlind ?? false,
    spouseAge65OrOlder: input.spouseAge65OrOlder ?? false,
    spouseBlind: input.spouseBlind ?? false,
    numDependents: input.dependents.length,
    numQualifyingChildren: input.dependents.filter(
      (d) => d.qualifiesForCTC,
    ).length,
    wages,
    taxableInterest,
    ordinaryDividends,
    qualifiedDividends,
    shortTermCapitalGains,
    longTermCapitalGains,
    netCapitalGainLoss,
    selfEmploymentIncome,
    unemployment: federalResult.incomeBreakdown.unemployment,
    retirementDistributions:
      federalResult.incomeBreakdown.retirementDistributions,
    socialSecurityIncome: 0, // Not tracked separately yet; default to 0
    otherIncome: federalResult.incomeBreakdown.otherIncome,
    federalEITC: federalResult.creditBreakdown.earnedIncomeCredit,
    federalChildTaxCredit: federalResult.creditBreakdown.childTaxCredit,
    stateWages,
    stateWithheld,
    stateEstimatedPayments: input.estimatedTaxPayments, // Simplified: use total estimated payments
    federalItemizedDeductions,
    usedFederalItemized: federalResult.deductionBreakdown.type === 'itemized',
    propertyTaxes: input.itemizedDeductions?.stateLocalTaxesPaid ?? 0,
    mortgageInterest: input.itemizedDeductions?.mortgageInterest ?? 0,
    charitableContributions:
      (input.itemizedDeductions?.charitableCash ?? 0) +
      (input.itemizedDeductions?.charitableNonCash ?? 0),
    medicalExpenses: input.itemizedDeductions?.medicalExpenses ?? 0,
    stateLocalTaxesPaid: input.itemizedDeductions?.stateLocalTaxesPaid ?? 0,
    isRenter: false,
    rentPaid: 0,
    locality,
  };
}

// Federal Tax Credits
// References: IRS Form 1040 Lines 19-32, Schedule 8812, Schedule EIC

import type { FilingStatus, FederalConfig, Dependent } from '../types';

/**
 * Child Tax Credit (CTC) and Additional Child Tax Credit (ACTC).
 * 2025 (OBBBA): $2,200 per qualifying child, $1,700 refundable per child.
 * Phase-out: $50 per $1,000 of AGI over threshold.
 * IRS Schedule 8812
 */
export function computeChildTaxCredit(
  dependents: Dependent[],
  agi: number,
  filingStatus: FilingStatus,
  taxLiability: number,
  config: FederalConfig,
): { nonrefundable: number; refundable: number } {
  const qualifyingChildren = dependents.filter(d => d.qualifiesForCTC);
  const numChildren = qualifyingChildren.length;
  if (numChildren === 0) return { nonrefundable: 0, refundable: 0 };

  const maxCredit = numChildren * config.ctc.maxCreditPerChild;
  const threshold = config.ctc.phaseOutThreshold[filingStatus];

  // Phase-out: reduce by $50 per $1,000 (or fraction thereof) of AGI over threshold
  let credit = maxCredit;
  if (agi > threshold) {
    const excessDollars = Math.ceil((agi - threshold) / 100000); // $1,000 increments in cents
    const reduction = excessDollars * 5000; // $50 per increment in cents
    credit = Math.max(0, credit - reduction);
  }

  if (credit === 0) return { nonrefundable: 0, refundable: 0 };

  // Nonrefundable portion: limited to tax liability
  const nonrefundable = Math.min(credit, taxLiability);

  // Refundable portion (Additional CTC): remaining credit, capped at $1,700 per child
  const maxRefundable = numChildren * config.ctc.refundablePerChild;
  const remaining = credit - nonrefundable;
  const refundable = Math.min(remaining, maxRefundable);

  return { nonrefundable, refundable };
}

/**
 * Other Dependents Credit (ODC).
 * $500 per qualifying dependent who doesn't qualify for CTC.
 * Same phase-out thresholds as CTC.
 */
export function computeOtherDependentCredit(
  dependents: Dependent[],
  agi: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): number {
  const qualifyingDeps = dependents.filter(d => d.qualifiesForODC);
  const numDeps = qualifyingDeps.length;
  if (numDeps === 0) return 0;

  const maxCredit = numDeps * config.odc.creditPerDependent;
  const threshold = config.ctc.phaseOutThreshold[filingStatus];

  if (agi <= threshold) return maxCredit;

  const excessDollars = Math.ceil((agi - threshold) / 100000);
  const reduction = excessDollars * 5000;
  return Math.max(0, maxCredit - reduction);
}

/**
 * Child and Dependent Care Credit.
 * 20-35% of qualifying expenses.
 * Max expenses: $3,000 (one child) / $6,000 (two+).
 * IRS Form 2441
 */
export function computeChildCareCredit(
  expenses: number,
  numDependents: number,
  agi: number,
  config: FederalConfig,
): number {
  if (expenses <= 0 || numDependents <= 0) return 0;

  const maxExpenses = numDependents >= 2
    ? config.childCareCredit.maxExpensesTwoPlus
    : config.childCareCredit.maxExpensesOneChild;

  const qualifyingExpenses = Math.min(expenses, maxExpenses);

  // Rate: starts at 35%, decreases by 1% per $2,000 of AGI over $15,000, min 20%
  let rate = config.childCareCredit.maxRate;
  if (agi > config.childCareCredit.incomeThreshold) {
    const excess = agi - config.childCareCredit.incomeThreshold;
    const reductions = Math.floor(excess / config.childCareCredit.incomeIncrement);
    rate = Math.max(
      config.childCareCredit.minRate,
      rate - reductions * config.childCareCredit.rateReductionPerIncrement,
    );
  }

  return Math.round(qualifyingExpenses * rate);
}

/**
 * Earned Income Tax Credit (EITC).
 * Complex calculation based on earned income, AGI, children, filing status.
 * IRS Schedule EIC, Publication 596
 */
export function computeEITC(
  earnedIncome: number,
  agi: number,
  numQualifyingChildren: number,
  filingStatus: FilingStatus,
  investmentIncome: number,
  config: FederalConfig,
): number {
  // MFS cannot claim EITC (with limited exception we don't model)
  if (filingStatus === 'married_filing_separately') return 0;

  // Investment income limit
  if (investmentIncome > config.eitcInvestmentIncomeLimit) return 0;

  const childKey = String(Math.min(numQualifyingChildren, 3));
  const params = config.eitc[childKey];
  if (!params) return 0;

  const isMFJ = filingStatus === 'married_filing_jointly' ||
                filingStatus === 'qualifying_surviving_spouse';

  // Phase-in: credit = earnedIncome * phaseInRate (up to max)
  const phaseInCredit = Math.min(
    Math.round(earnedIncome * params.phaseInRate),
    params.maxCredit,
  );

  // Phase-out: use the greater of earned income or AGI
  const phaseOutIncome = Math.max(earnedIncome, agi);
  const phaseOutBegins = isMFJ ? params.phaseOutBeginsMFJ : params.phaseOutBeginsSingle;

  if (phaseOutIncome <= phaseOutBegins) return phaseInCredit;

  const excess = phaseOutIncome - phaseOutBegins;
  const reduction = Math.round(excess * params.phaseOutRate);
  const phaseOutCredit = Math.max(0, params.maxCredit - reduction);

  // EITC = min of phase-in and phase-out amounts
  return Math.min(phaseInCredit, phaseOutCredit);
}

/**
 * Education Credits: AOTC and Lifetime Learning.
 * IRS Form 8863
 */
export function computeEducationCredits(
  expenses: { type: 'american_opportunity' | 'lifetime_learning'; qualifiedExpenses: number; studentSSN: string }[] | undefined,
  agi: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): number {
  if (!expenses || expenses.length === 0) return 0;

  let totalCredit = 0;

  const isMFJ = filingStatus === 'married_filing_jointly' ||
                filingStatus === 'qualifying_surviving_spouse';

  for (const exp of expenses) {
    if (exp.type === 'american_opportunity') {
      const aotcConfig = config.educationCredits.aotc;
      const phaseOut = isMFJ ? aotcConfig.phaseOut.mfj : aotcConfig.phaseOut.single;

      // 100% of first $2,000 + 25% of next $2,000
      const firstTier = Math.min(exp.qualifiedExpenses, aotcConfig.firstTierExpenses);
      const secondTier = Math.min(
        Math.max(0, exp.qualifiedExpenses - aotcConfig.firstTierExpenses),
        aotcConfig.secondTierExpenses,
      );
      let credit = firstTier + Math.round(secondTier * aotcConfig.secondTierRate);
      credit = Math.min(credit, aotcConfig.maxCredit);

      // Phase-out
      credit = applyPhaseOut(credit, agi, phaseOut.begin, phaseOut.end);
      totalCredit += credit;
    } else {
      // Lifetime Learning Credit
      const llcConfig = config.educationCredits.llc;
      const phaseOut = isMFJ ? llcConfig.phaseOut.mfj : llcConfig.phaseOut.single;

      const qualifiedExp = Math.min(exp.qualifiedExpenses, llcConfig.maxExpenses);
      let credit = Math.round(qualifiedExp * llcConfig.rate);
      credit = Math.min(credit, llcConfig.maxCredit);

      // Phase-out
      credit = applyPhaseOut(credit, agi, phaseOut.begin, phaseOut.end);
      totalCredit += credit;
    }
  }

  return totalCredit;
}

/**
 * Apply a linear phase-out to an amount.
 */
function applyPhaseOut(
  amount: number,
  income: number,
  begin: number,
  end: number,
): number {
  if (income <= begin) return amount;
  if (income >= end) return 0;
  const ratio = (income - begin) / (end - begin);
  return Math.round(amount * (1 - ratio));
}

/**
 * Retirement Savings Contributions Credit (Saver's Credit).
 * IRS Form 8880
 */
export function computeSaversCredit(
  contributions: number,
  agi: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): number {
  if (contributions <= 0) return 0;

  const maxContrib = config.saversCredit.maxContribution[filingStatus];
  const qualifiedContrib = Math.min(contributions, maxContrib);

  // Determine rate from brackets
  let rate = 0;
  for (const bracket of config.saversCredit.brackets) {
    let threshold: number;
    if (filingStatus === 'married_filing_jointly' || filingStatus === 'qualifying_surviving_spouse') {
      threshold = bracket.mfj;
    } else if (filingStatus === 'head_of_household') {
      threshold = bracket.hoh;
    } else {
      threshold = bracket.single;
    }

    if (agi <= threshold) {
      rate = bracket.rate;
      break;
    }
  }

  return Math.round(qualifiedContrib * rate);
}

/**
 * Compute all credits. Returns nonrefundable and refundable totals.
 */
export function computeAllCredits(params: {
  dependents: Dependent[];
  agi: number;
  filingStatus: FilingStatus;
  taxLiability: number;
  earnedIncome: number;
  investmentIncome: number;
  numQualifyingChildrenForEITC: number;
  childCareExpenses: number;
  numChildCareQualifying: number;
  educationExpenses?: { type: 'american_opportunity' | 'lifetime_learning'; qualifiedExpenses: number; studentSSN: string }[];
  saversContributions: number;
  config: FederalConfig;
}): {
  nonrefundable: number;
  refundable: number;
  childTaxCredit: number;
  additionalChildTaxCredit: number;
  otherDependentCredit: number;
  earnedIncomeCredit: number;
  childCareCareCredit: number;
  educationCredits: number;
  saversCredit: number;
} {
  const {
    dependents, agi, filingStatus, taxLiability, earnedIncome,
    investmentIncome, numQualifyingChildrenForEITC, childCareExpenses,
    numChildCareQualifying, educationExpenses, saversContributions, config,
  } = params;

  const ctc = computeChildTaxCredit(dependents, agi, filingStatus, taxLiability, config);
  const odc = computeOtherDependentCredit(dependents, agi, filingStatus, config);
  const childCare = computeChildCareCredit(childCareExpenses, numChildCareQualifying, agi, config);
  const education = computeEducationCredits(educationExpenses, agi, filingStatus, config);
  const savers = computeSaversCredit(saversContributions, agi, filingStatus, config);
  const eitc = computeEITC(earnedIncome, agi, numQualifyingChildrenForEITC, filingStatus, investmentIncome, config);

  const nonrefundable = ctc.nonrefundable + odc + childCare + education + savers;
  const refundable = ctc.refundable + eitc;

  return {
    nonrefundable,
    refundable,
    childTaxCredit: ctc.nonrefundable,
    additionalChildTaxCredit: ctc.refundable,
    otherDependentCredit: odc,
    earnedIncomeCredit: eitc,
    childCareCareCredit: childCare,
    educationCredits: education,
    saversCredit: savers,
  };
}

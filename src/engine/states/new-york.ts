// New York State Tax Module
//
// NY tax structure:
// - 9 progressive NYS brackets (4% through 10.9%)
// - Standard deduction
// - NYC local tax if locality === 'NYC' (4 brackets: 3.078%–3.876%)
// - NYS EITC = 30% of federal EITC (refundable)
// - NYC EITC = 5% of federal EITC (refundable, NYC residents only)
// - Empire State child credit: $1,000/child under 4, $330/child 4-16, gradual phase-out
// - NYC School Tax Credit: $63/person for NYC residents with AGI < $250k
// - NY pension exclusion: up to $20k of qualifying pension/annuity income
// - NY 529 deduction: up to $5k single / $10k MFJ
// - Box 14 subtractions: 414(h), NYPFL, IRC 125 — reduce NY taxable income
// - NY childcare credit: % of federal child/dep care credit, based on NY AGI
// - Social Security is exempt
//
// NYC residents pay BOTH NYS and NYC income tax.
//
// All monetary values are integers in CENTS.

import type { StateModule, StateTaxInput, StateTaxResult, StateConfig } from './interface';
import type { TaxBracket } from '../types';
import {
  computeStateBracketTax,
  getStateMarginalRate,
  computeStateStandardDeduction,
  computeStateEITC,
} from './common';

/**
 * Compute NY Empire State child credit.
 * $1,000 per child under 4, $330 per child ages 4-16.
 * Gradual phase-out: $16.50 reduction per $1,000 of AGI over threshold
 * (round up partial $1,000 increments).
 */
function computeNYChildCredit(
  input: StateTaxInput,
  config: StateConfig,
): number {
  if (input.numQualifyingChildren <= 0) return 0;
  if (!config.credits?.childCredit) return 0;

  const { amountPerChild, amountPerChildUnder4, agiPhaseOut } = config.credits.childCredit;
  const threshold = agiPhaseOut[input.filingStatus] ?? Infinity;

  // Under-4 children get higher amount; remaining qualifying children get standard
  const numUnder4 = Math.min(input.numChildrenUnder4 ?? 0, input.numQualifyingChildren);
  const numOlder = input.numQualifyingChildren - numUnder4;

  const under4Amount = amountPerChildUnder4 ?? amountPerChild;
  let totalCredit = (numUnder4 * under4Amount) + (numOlder * amountPerChild);

  // Gradual phase-out: $16.50 per $1,000 over threshold (in cents: 1650 per 100000)
  if (input.federalAGI > threshold) {
    const excess = input.federalAGI - threshold;
    const increments = Math.ceil(excess / 100_000); // Round up partial $1,000
    const reduction = increments * 1650; // $16.50 = 1650 cents per increment
    totalCredit = Math.max(0, totalCredit - reduction);
  }

  return totalCredit;
}

/**
 * Look up NY childcare credit multiplier from the config table.
 * Table entries are sorted ascending by maxAgi; last entry has maxAgi = null.
 */
function getNYChildcareMultiplier(
  agi: number,
  table: NonNullable<StateConfig['nyChildcareCreditTable']>,
): number {
  for (const row of table) {
    if (row.maxAgi === null || agi <= row.maxAgi) return row.nyMultiplier;
  }
  return table[table.length - 1]?.nyMultiplier ?? 0;
}

export const newYork: StateModule = {
  stateCode: 'NY',
  stateName: 'New York',
  hasIncomeTax: true,

  compute(input: StateTaxInput, config: StateConfig): StateTaxResult {
    const brackets = config.brackets?.[input.filingStatus] as TaxBracket[] | undefined;
    if (!brackets) {
      throw new Error(`No NY brackets configured for filing status: ${input.filingStatus}`);
    }

    const isNonResident = input.residencyType === 'nonresident';
    const isNYC = !isNonResident && input.locality === 'NYC';

    // Non-residents (IT-203): tax applies only to NY-sourced income.
    // If stateWages from NY-coded W-2s are available, use that; otherwise fall back to federalAGI.
    const baseIncome = isNonResident
      ? (input.nySourceIncome != null && input.nySourceIncome > 0
          ? input.nySourceIncome
          : input.federalAGI)
      : input.federalAGI;

    // Social Security exempt in NY — only subtract for residents (non-residents likely have $0 SS)
    const ssSubtraction = isNonResident ? 0 : input.socialSecurityIncome;
    let income = baseIncome - ssSubtraction;

    // NY pension exclusion: up to $20k of qualifying pension/annuity income (residents only)
    const pensionExclusion = isNonResident ? 0 :
      Math.min(input.retirementIncome ?? 0, config.retirementExemption?.[input.filingStatus] ?? 0);
    income -= pensionExclusion;

    // Box 14 subtractions: 414(h) pension, NYPFL, IRC 125 — reduce NY taxable income
    const box14Subtraction = isNonResident ? 0 : (input.box14TotalSubtraction ?? 0);
    income -= box14Subtraction;

    // NY 529 deduction (residents only, up to limit by filing status)
    const ny529Deduction = isNonResident ? 0 :
      Math.min(input.ny529Contributions ?? 0, config.ny529DeductionLimit?.[input.filingStatus] ?? 0);
    income -= ny529Deduction;

    // Standard deduction
    const standardDeduction = computeStateStandardDeduction(input.filingStatus, config);
    income -= standardDeduction;

    const taxableIncome = Math.max(0, income);

    // NYS bracket tax
    const nysTax = computeStateBracketTax(taxableIncome, brackets);

    // NYC local tax — non-residents do NOT owe NYC resident tax (IT-203 filers only owe NYS tax)
    let nycTax = 0;
    let nycMarginalRate = 0;
    if (isNYC && config.localTax?.NYC) {
      const nycBracketsConfig = config.localTax.NYC.brackets;
      const nycBrackets = Array.isArray(nycBracketsConfig)
        ? nycBracketsConfig as TaxBracket[]
        : ((nycBracketsConfig as Partial<Record<string, TaxBracket[]>>)[input.filingStatus]
          ?? (nycBracketsConfig as Partial<Record<string, TaxBracket[]>>)['single']
          ?? []) as TaxBracket[];
      nycTax = computeStateBracketTax(taxableIncome, nycBrackets);
      nycMarginalRate = getStateMarginalRate(taxableIncome, nycBrackets);
    }

    const taxBeforeCredits = nysTax;

    // ── Credits ──
    const creditBreakdown: Record<string, number> = {};
    let totalNYSCredits = 0; // Applied against NYS tax (refundable excess)
    let totalNYCCredits = 0; // Applied against NYC tax

    // NY EITC = 30% of federal EITC (refundable)
    const eitcCfg = config.credits?.eitc;
    const eitcPercent = eitcCfg?.type === 'percent_of_federal' ? eitcCfg.percentOfFederal : 0;
    const stateEITC = computeStateEITC(input.federalEITC, eitcPercent);
    if (stateEITC > 0) {
      creditBreakdown.eitc = stateEITC;
      totalNYSCredits += stateEITC;
    }

    // NYC EITC = 5% of federal EITC (refundable, NYC residents only)
    const nycEITC = isNYC ? computeStateEITC(input.federalEITC, config.nycEitcPercent ?? 0) : 0;
    if (nycEITC > 0) {
      creditBreakdown.nycEitc = nycEITC;
      totalNYCCredits += nycEITC;
    }

    // NY Empire State Child Credit (refundable)
    const childCredit = computeNYChildCredit(input, config);
    if (childCredit > 0) {
      creditBreakdown.childCredit = childCredit;
      totalNYSCredits += childCredit;
    }

    // NYC School Tax Credit: $63/person for NYC residents with AGI < $250k (non-refundable)
    let nycSchoolTaxCredit = 0;
    if (isNYC && config.nycSchoolTaxCredit) {
      const { amountPerPerson, agiLimit } = config.nycSchoolTaxCredit;
      if (input.federalAGI < agiLimit) {
        const numPersons = input.filingStatus === 'married_filing_jointly' ? 2 : 1;
        nycSchoolTaxCredit = numPersons * amountPerPerson;
      }
    }
    if (nycSchoolTaxCredit > 0) {
      creditBreakdown.nycSchoolTaxCredit = nycSchoolTaxCredit;
      totalNYCCredits += nycSchoolTaxCredit;
    }

    // NY childcare credit: % of federal child/dep care credit, based on NY AGI
    let nyChildcareCredit = 0;
    const fedChildCareCredit = input.federalChildCareCredit ?? 0;
    if (!isNonResident && config.nyChildcareCreditTable && fedChildCareCredit > 0) {
      const multiplier = getNYChildcareMultiplier(input.federalAGI, config.nyChildcareCreditTable);
      nyChildcareCredit = Math.round(fedChildCareCredit * multiplier);
    }
    if (nyChildcareCredit > 0) {
      creditBreakdown.nyChildcareCredit = nyChildcareCredit;
      totalNYSCredits += nyChildcareCredit;
    }

    // Apply NYS credits against NYS tax; excess is refundable
    const nysAfterCredits = Math.max(0, taxBeforeCredits - totalNYSCredits);
    const refundableNYS = Math.max(0, totalNYSCredits - taxBeforeCredits);

    // Apply NYC credits against NYC tax (non-refundable portion)
    const nycAfterCredits = Math.max(0, nycTax - totalNYCCredits);

    const totalTaxAfterCredits = nysAfterCredits + nycAfterCredits;
    const totalCredits = totalNYSCredits + totalNYCCredits;
    const totalSubtractions = ssSubtraction + pensionExclusion + box14Subtraction + ny529Deduction;

    const effectiveRate =
      input.federalAGI > 0
        ? Math.round((totalTaxAfterCredits / input.federalAGI) * 10000) / 100
        : 0;

    const marginalRate = getStateMarginalRate(taxableIncome, brackets);

    // Flag if income is in the NY supplemental tax recapture range (>$107,650)
    // Full computation requires a fixed-dollar table lookup; flagged for future implementation.
    const hasSupplementalTaxRange = taxableIncome > 10765000 ? 1 : 0;

    return {
      stateCode: 'NY',
      stateName: 'New York',
      hasIncomeTax: true,
      stateAGI: baseIncome,
      stateAdditions: 0,
      stateSubtractions: totalSubtractions,
      stateDeduction: standardDeduction,
      stateExemptions: 0,
      stateTaxableIncome: taxableIncome,
      stateTaxBeforeCredits: taxBeforeCredits,
      stateCredits: totalCredits,
      stateSurtax: 0,
      localTax: nycTax,
      stateTaxAfterCredits: totalTaxAfterCredits,
      stateWithheld: input.stateWithheld,
      stateEstimatedPayments: input.stateEstimatedPayments,
      stateRefundOrOwed:
        input.stateWithheld +
        input.stateEstimatedPayments +
        (input.localWithheld ?? 0) +
        (input.nycEstimatedPayments ?? 0) +
        refundableNYS -
        totalTaxAfterCredits,
      effectiveRate,
      marginalRate: marginalRate * 100,
      creditBreakdown,
      formData: {
        federalAGI: input.federalAGI,
        nySourceIncome: baseIncome,
        ssSubtraction,
        pensionExclusion,
        box14Subtraction,
        ny529Deduction,
        standardDeduction,
        taxableIncome,
        nysTax,
        nycTax,
        stateEITC,
        nycEITC,
        childCredit,
        nycSchoolTaxCredit,
        nyChildcareCredit,
        locality: input.locality ?? '',
        residencyType: input.residencyType ?? 'resident',
        nycMarginalRate: nycMarginalRate * 100,
        hasSupplementalTaxRange,
      },
      // Non-residents file IT-203; residents file IT-201
      formId: isNonResident ? 'IT-203' : config.formId,
    };
  },
};

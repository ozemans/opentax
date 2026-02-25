// Tests for src/engine/states/common.ts
//
// All monetary values are in CENTS. $50,000 = 5_000_000 cents.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  computeStateBracketTax,
  computeFlatTax,
  getStateMarginalRate,
  computePersonalExemptions,
  computeStateStandardDeduction,
  computeStateEITC,
  computeSurtax,
  buildNoTaxResult,
  buildStateTaxInput,
} from '../../src/engine/states/common';
import type { TaxBracket, FilingStatus, TaxInput, TaxResult } from '../../src/engine/types';
import type { StateTaxInput, StateConfig } from '../../src/engine/states/interface';

// ---------------------------------------------------------------------------
// Test Brackets (Virginia-like: 2%, 3%, 5%, 5.75%)
// ---------------------------------------------------------------------------
const testBrackets: TaxBracket[] = [
  { min: 0, max: 300_000, rate: 0.02 },
  { min: 300_000, max: 500_000, rate: 0.03 },
  { min: 500_000, max: 1_700_000, rate: 0.05 },
  { min: 1_700_000, max: null, rate: 0.0575 },
];

// ---------------------------------------------------------------------------
// computeStateBracketTax
// ---------------------------------------------------------------------------
describe('computeStateBracketTax', () => {
  it('returns $0 for zero income', () => {
    expect(computeStateBracketTax(0, testBrackets)).toBe(0);
  });

  it('returns $0 for negative income', () => {
    expect(computeStateBracketTax(-100_000, testBrackets)).toBe(0);
  });

  it('computes tax entirely within first bracket', () => {
    // $2,000 (200_000 cents) at 2% = $40 (4_000 cents)
    expect(computeStateBracketTax(200_000, testBrackets)).toBe(4_000);
  });

  it('computes tax at first bracket boundary', () => {
    // $3,000 (300_000 cents) at 2% = $60 (6_000 cents)
    expect(computeStateBracketTax(300_000, testBrackets)).toBe(6_000);
  });

  it('computes tax spanning two brackets', () => {
    // First $3,000 at 2% = $60, next $1,000 at 3% = $30 => $90 total
    expect(computeStateBracketTax(400_000, testBrackets)).toBe(9_000);
  });

  it('computes tax spanning all brackets', () => {
    // $3,000 at 2% = $60.00 (6_000)
    // $2,000 at 3% = $60.00 (6_000)
    // $12,000 at 5% = $600.00 (60_000)
    // $3,000 at 5.75% = $172.50 (17_250)
    // Total = $892.50 (89_250)
    expect(computeStateBracketTax(2_000_000, testBrackets)).toBe(89_250);
  });

  it('handles single bracket with no cap', () => {
    const flatBrackets: TaxBracket[] = [{ min: 0, max: null, rate: 0.05 }];
    expect(computeStateBracketTax(1_000_000, flatBrackets)).toBe(50_000);
  });

  // Property-based test: monotonicity
  it('is monotonically non-decreasing', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100_000_000 }),
        fc.nat({ max: 100_000_000 }),
        (a, b) => {
          const low = Math.min(a, b);
          const high = Math.max(a, b);
          expect(computeStateBracketTax(high, testBrackets)).toBeGreaterThanOrEqual(
            computeStateBracketTax(low, testBrackets),
          );
        },
      ),
    );
  });

  // Property-based test: non-negativity
  it('always returns non-negative values', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10_000_000, max: 100_000_000 }), (income) => {
        expect(computeStateBracketTax(income, testBrackets)).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// computeFlatTax
// ---------------------------------------------------------------------------
describe('computeFlatTax', () => {
  it('returns $0 for zero income', () => {
    expect(computeFlatTax(0, 0.0307)).toBe(0);
  });

  it('returns $0 for negative income', () => {
    expect(computeFlatTax(-500_000, 0.0307)).toBe(0);
  });

  it('computes PA flat tax (3.07%)', () => {
    // $50,000 at 3.07% = $1,535.00 (153_500 cents)
    expect(computeFlatTax(5_000_000, 0.0307)).toBe(153_500);
  });

  it('computes IL flat tax (4.95%)', () => {
    // $75,000 at 4.95% = $3,712.50 (371_250 cents)
    expect(computeFlatTax(7_500_000, 0.0495)).toBe(371_250);
  });

  it('rounds correctly', () => {
    // $100.01 (10_001) at 3.07% = 307.0307 cents → 307
    expect(computeFlatTax(10_001, 0.0307)).toBe(307);
  });

  // Property-based: non-negative
  it('always returns non-negative', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10_000_000, max: 100_000_000 }), (income) => {
        expect(computeFlatTax(income, 0.05)).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// getStateMarginalRate
// ---------------------------------------------------------------------------
describe('getStateMarginalRate', () => {
  it('returns first bracket rate for zero income', () => {
    expect(getStateMarginalRate(0, testBrackets)).toBe(0.02);
  });

  it('returns first bracket rate for income within first bracket', () => {
    expect(getStateMarginalRate(200_000, testBrackets)).toBe(0.02);
  });

  it('returns second bracket rate at exact boundary', () => {
    expect(getStateMarginalRate(300_000, testBrackets)).toBe(0.03);
  });

  it('returns top bracket rate for high income', () => {
    expect(getStateMarginalRate(5_000_000, testBrackets)).toBe(0.0575);
  });

  it('returns 0 for empty brackets', () => {
    expect(getStateMarginalRate(100_000, [])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computePersonalExemptions
// ---------------------------------------------------------------------------
describe('computePersonalExemptions', () => {
  const makeInput = (overrides: Partial<StateTaxInput> = {}): StateTaxInput => ({
    federalAGI: 5_000_000,
    federalTaxableIncome: 3_500_000,
    federalTotalIncome: 5_000_000,
    filingStatus: 'single',
    taxYear: 2025,
    taxpayerAge65OrOlder: false,
    taxpayerBlind: false,
    spouseAge65OrOlder: false,
    spouseBlind: false,
    numDependents: 0,
    numQualifyingChildren: 0,
    wages: 5_000_000,
    taxableInterest: 0,
    ordinaryDividends: 0,
    qualifiedDividends: 0,
    shortTermCapitalGains: 0,
    longTermCapitalGains: 0,
    netCapitalGainLoss: 0,
    selfEmploymentIncome: 0,
    unemployment: 0,
    retirementDistributions: 0,
    socialSecurityIncome: 0,
    otherIncome: 0,
    federalEITC: 0,
    federalChildTaxCredit: 0,
    stateWages: 5_000_000,
    stateWithheld: 0,
    stateEstimatedPayments: 0,
    federalItemizedDeductions: 0,
    usedFederalItemized: false,
    propertyTaxes: 0,
    mortgageInterest: 0,
    charitableContributions: 0,
    medicalExpenses: 0,
    stateLocalTaxesPaid: 0,
    isRenter: false,
    rentPaid: 0,
    ...overrides,
  });

  const makeConfig = (overrides: Partial<StateConfig> = {}): StateConfig => ({
    stateCode: 'VA',
    stateName: 'Virginia',
    taxYear: 2025,
    hasIncomeTax: true,
    startingPoint: 'federal_agi',
    socialSecurityExempt: true,
    capitalGainsTreatment: 'ordinary',
    formId: 'VA-760',
    formName: 'Virginia Income Tax Return',
    personalExemption: {
      taxpayer: { single: 93_000, married_filing_jointly: 93_000 },
      spouse: 93_000,
      dependent: 93_000,
    },
    ...overrides,
  });

  it('returns 0 when no personal exemption configured', () => {
    const config = makeConfig({ personalExemption: undefined });
    expect(computePersonalExemptions(makeInput(), config)).toBe(0);
  });

  it('returns taxpayer exemption for single filer', () => {
    expect(computePersonalExemptions(makeInput(), makeConfig())).toBe(93_000);
  });

  it('returns taxpayer + spouse exemption for MFJ', () => {
    const input = makeInput({ filingStatus: 'married_filing_jointly' });
    expect(computePersonalExemptions(input, makeConfig())).toBe(186_000);
  });

  it('includes dependent exemptions', () => {
    const input = makeInput({ numDependents: 3 });
    // taxpayer: 93_000 + 3 deps * 93_000 = 372_000
    expect(computePersonalExemptions(input, makeConfig())).toBe(372_000);
  });

  it('includes age 65+ additional', () => {
    const config = makeConfig({
      personalExemption: {
        taxpayer: { single: 93_000, married_filing_jointly: 93_000 },
        spouse: 93_000,
        dependent: 93_000,
        age65Additional: 80_000,
      },
    });
    const input = makeInput({ taxpayerAge65OrOlder: true });
    // taxpayer: 93_000 + age65: 80_000 = 173_000
    expect(computePersonalExemptions(input, config)).toBe(173_000);
  });

  it('includes spouse age 65+ for MFJ', () => {
    const config = makeConfig({
      personalExemption: {
        taxpayer: { single: 93_000, married_filing_jointly: 93_000 },
        spouse: 93_000,
        dependent: 93_000,
        age65Additional: 80_000,
      },
    });
    const input = makeInput({
      filingStatus: 'married_filing_jointly',
      taxpayerAge65OrOlder: true,
      spouseAge65OrOlder: true,
    });
    // taxpayer: 93_000 + spouse: 93_000 + age65: 80_000 * 2 = 346_000
    expect(computePersonalExemptions(input, config)).toBe(346_000);
  });

  it('includes blind additional', () => {
    const config = makeConfig({
      personalExemption: {
        taxpayer: { single: 93_000, married_filing_jointly: 93_000 },
        spouse: 93_000,
        dependent: 93_000,
        blindAdditional: 80_000,
      },
    });
    const input = makeInput({ taxpayerBlind: true });
    expect(computePersonalExemptions(input, config)).toBe(173_000);
  });
});

// ---------------------------------------------------------------------------
// computeStateStandardDeduction
// ---------------------------------------------------------------------------
describe('computeStateStandardDeduction', () => {
  const config: StateConfig = {
    stateCode: 'VA',
    stateName: 'Virginia',
    taxYear: 2025,
    hasIncomeTax: true,
    startingPoint: 'federal_agi',
    socialSecurityExempt: true,
    capitalGainsTreatment: 'ordinary',
    formId: 'VA-760',
    formName: 'Virginia Income Tax Return',
    standardDeduction: {
      single: 800_000,
      married_filing_jointly: 1_600_000,
    },
  };

  it('returns single standard deduction', () => {
    expect(computeStateStandardDeduction('single', config)).toBe(800_000);
  });

  it('returns MFJ standard deduction', () => {
    expect(computeStateStandardDeduction('married_filing_jointly', config)).toBe(1_600_000);
  });

  it('returns 0 for unconfigured filing status', () => {
    expect(computeStateStandardDeduction('head_of_household', config)).toBe(0);
  });

  it('returns 0 when no standard deduction configured', () => {
    const noDeductionConfig = { ...config, standardDeduction: undefined };
    expect(computeStateStandardDeduction('single', noDeductionConfig)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeStateEITC
// ---------------------------------------------------------------------------
describe('computeStateEITC', () => {
  it('returns $0 for zero federal EITC', () => {
    expect(computeStateEITC(0, 0.20)).toBe(0);
  });

  it('computes 20% of federal EITC (Virginia)', () => {
    // Federal EITC $3,000 (300_000) at 20% = $600 (60_000)
    expect(computeStateEITC(300_000, 0.20)).toBe(60_000);
  });

  it('computes 40% of federal EITC (NJ)', () => {
    // Federal EITC $5,000 (500_000) at 40% = $2,000 (200_000)
    expect(computeStateEITC(500_000, 0.40)).toBe(200_000);
  });

  it('computes 45% of federal EITC (California)', () => {
    // Federal EITC $4,328 (432_800) at 45% = $1,947.60 → 194_760
    expect(computeStateEITC(432_800, 0.45)).toBe(194_760);
  });

  it('returns 0 for negative federal EITC', () => {
    expect(computeStateEITC(-100, 0.20)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeSurtax
// ---------------------------------------------------------------------------
describe('computeSurtax', () => {
  const surtaxConfig = {
    threshold: {
      single: 100_000_000,
      married_filing_jointly: 100_000_000,
    } as Partial<Record<FilingStatus, number>>,
    rate: 0.04,
    description: 'Millionaire surtax',
  };

  it('returns $0 below threshold', () => {
    expect(computeSurtax(50_000_000, 'single', surtaxConfig)).toBe(0);
  });

  it('returns $0 at exactly threshold', () => {
    expect(computeSurtax(100_000_000, 'single', surtaxConfig)).toBe(0);
  });

  it('computes surtax above threshold', () => {
    // $1,100,000 = 110_000_000, excess = 10_000_000, surtax = 10_000_000 * 0.04 = 400_000
    expect(computeSurtax(110_000_000, 'single', surtaxConfig)).toBe(400_000);
  });

  it('returns $0 for unconfigured filing status (uses Infinity threshold)', () => {
    expect(computeSurtax(200_000_000, 'head_of_household', surtaxConfig)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildNoTaxResult
// ---------------------------------------------------------------------------
describe('buildNoTaxResult', () => {
  const makeInput = (): StateTaxInput => ({
    federalAGI: 5_000_000,
    federalTaxableIncome: 3_500_000,
    federalTotalIncome: 5_000_000,
    filingStatus: 'single',
    taxYear: 2025,
    taxpayerAge65OrOlder: false,
    taxpayerBlind: false,
    spouseAge65OrOlder: false,
    spouseBlind: false,
    numDependents: 0,
    numQualifyingChildren: 0,
    wages: 5_000_000,
    taxableInterest: 0,
    ordinaryDividends: 0,
    qualifiedDividends: 0,
    shortTermCapitalGains: 0,
    longTermCapitalGains: 0,
    netCapitalGainLoss: 0,
    selfEmploymentIncome: 0,
    unemployment: 0,
    retirementDistributions: 0,
    socialSecurityIncome: 0,
    otherIncome: 0,
    federalEITC: 0,
    federalChildTaxCredit: 0,
    stateWages: 5_000_000,
    stateWithheld: 200_000,
    stateEstimatedPayments: 50_000,
    federalItemizedDeductions: 0,
    usedFederalItemized: false,
    propertyTaxes: 0,
    mortgageInterest: 0,
    charitableContributions: 0,
    medicalExpenses: 0,
    stateLocalTaxesPaid: 0,
    isRenter: false,
    rentPaid: 0,
  });

  it('returns correct metadata', () => {
    const result = buildNoTaxResult('TX', 'Texas', makeInput());
    expect(result.stateCode).toBe('TX');
    expect(result.stateName).toBe('Texas');
    expect(result.hasIncomeTax).toBe(false);
    expect(result.formId).toBe('none');
  });

  it('zeroes all tax fields', () => {
    const result = buildNoTaxResult('TX', 'Texas', makeInput());
    expect(result.stateAGI).toBe(0);
    expect(result.stateTaxableIncome).toBe(0);
    expect(result.stateTaxBeforeCredits).toBe(0);
    expect(result.stateTaxAfterCredits).toBe(0);
    expect(result.effectiveRate).toBe(0);
    expect(result.marginalRate).toBe(0);
  });

  it('preserves withholding and estimated payments', () => {
    const result = buildNoTaxResult('TX', 'Texas', makeInput());
    expect(result.stateWithheld).toBe(200_000);
    expect(result.stateEstimatedPayments).toBe(50_000);
    expect(result.stateRefundOrOwed).toBe(250_000);
  });
});

// ---------------------------------------------------------------------------
// buildStateTaxInput
// ---------------------------------------------------------------------------
describe('buildStateTaxInput', () => {
  const makeTaxInput = (): TaxInput => ({
    taxYear: 2025,
    filingStatus: 'single',
    taxpayer: { firstName: 'John', lastName: 'Doe', ssn: '123-45-6789', dateOfBirth: '1990-01-01' },
    dependents: [
      {
        firstName: 'Jane', lastName: 'Doe', ssn: '987-65-4321',
        relationship: 'child', dateOfBirth: '2015-06-15', monthsLivedWithYou: 12,
        isStudent: false, isDisabled: false, qualifiesForCTC: true, qualifiesForODC: false,
      },
    ],
    address: { street: '123 Main St', city: 'Austin', state: 'TX', zip: '78701' },
    w2s: [
      {
        employerEIN: '12-3456789', employerName: 'Acme Corp', wages: 7_500_000,
        federalWithheld: 1_000_000, socialSecurityWages: 7_500_000, socialSecurityWithheld: 465_000,
        medicareWages: 7_500_000, medicareWithheld: 108_750, stateWages: 7_500_000,
        stateWithheld: 300_000, stateCode: 'CA', locality: 'Los Angeles',
      },
    ],
    form1099INTs: [{ payerName: 'Bank', interest: 100_000 }],
    form1099DIVs: [
      {
        payerName: 'Vanguard', ordinaryDividends: 200_000, qualifiedDividends: 150_000,
        totalCapitalGain: 50_000,
      },
    ],
    form1099Bs: [],
    form1099NECs: [],
    form1099Gs: [{ unemployment: 80_000 }],
    form1099Rs: [{ grossDistribution: 500_000, taxableAmount: 400_000, distributionCode: '7' }],
    form1099Ks: [],
    estimatedTaxPayments: 50_000,
    useItemizedDeductions: false,
    stateOfResidence: 'CA',
    itemizedDeductions: {
      medicalExpenses: 200_000,
      stateLocalTaxesPaid: 300_000,
      realEstateTaxes: 0,
      mortgageInterest: 500_000,
      charitableCash: 100_000,
      charitableNonCash: 25_000,
    },
    taxpayerAge65OrOlder: false,
    taxpayerBlind: false,
  });

  // Minimal mock federal result
  const makeFederalResult = (): TaxResult => ({
    totalIncome: 8_280_000,
    adjustedGrossIncome: 8_000_000,
    taxableIncome: 6_500_000,
    totalTax: 1_000_000,
    totalCredits: 220_000,
    totalPayments: 1_050_000,
    refundOrOwed: 50_000,
    effectiveTaxRate: 12.1,
    marginalTaxRate: 22,
    incomeBreakdown: {
      wages: 7_500_000,
      interest: 100_000,
      ordinaryDividends: 200_000,
      qualifiedDividends: 150_000,
      shortTermCapitalGains: 0,
      longTermCapitalGains: 50_000,
      selfEmploymentIncome: 0,
      unemployment: 80_000,
      retirementDistributions: 400_000,
      otherIncome: 0,
    },
    deductionBreakdown: {
      type: 'standard',
      amount: 1_500_000,
      standardAmount: 1_500_000,
      itemizedAmount: 900_000,
    },
    taxBreakdown: {
      ordinaryIncomeTax: 900_000,
      capitalGainsTax: 0,
      selfEmploymentTax: 0,
      additionalMedicareTax: 0,
      netInvestmentIncomeTax: 0,
      amt: 0,
    },
    creditBreakdown: {
      childTaxCredit: 200_000,
      additionalChildTaxCredit: 0,
      otherDependentCredit: 0,
      earnedIncomeCredit: 0,
      childCareCareCredit: 0,
      educationCredits: 0,
      saversCredit: 0,
    },
    capitalGainsResult: {
      shortTermGains: 0,
      shortTermLosses: 0,
      netShortTerm: 0,
      longTermGains: 50_000,
      longTermLosses: 0,
      netLongTerm: 50_000,
      netCapitalGainLoss: 50_000,
      deductibleLoss: 0,
      carryforwardLoss: 0,
      collectiblesGain: 0,
      section1250Gain: 0,
      categorized: {
        '8949_A': [], '8949_B': [], '8949_C': [],
        '8949_D': [], '8949_E': [], '8949_F': [],
      },
    },
    forms: { f1040: {} },
    needsSchedule1: false,
    needsSchedule2: false,
    needsSchedule3: false,
    needsScheduleA: false,
    needsScheduleB: false,
    needsScheduleC: false,
    needsScheduleD: false,
    needsScheduleSE: false,
    needsForm8949: false,
    needsForm8959: false,
    needsForm8960: false,
    stateResults: {},
  });

  it('maps federal AGI correctly', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'CA');
    expect(result.federalAGI).toBe(8_000_000);
  });

  it('maps wages from all W-2s', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'CA');
    expect(result.wages).toBe(7_500_000);
  });

  it('filters state wages by stateCode', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'CA');
    expect(result.stateWages).toBe(7_500_000);
    expect(result.stateWithheld).toBe(300_000);
  });

  it('returns 0 state wages for non-matching stateCode', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'TX');
    expect(result.stateWages).toBe(0);
    expect(result.stateWithheld).toBe(0);
  });

  it('maps taxable interest', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'CA');
    expect(result.taxableInterest).toBe(100_000);
  });

  it('maps dividends', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'CA');
    expect(result.ordinaryDividends).toBe(200_000);
    expect(result.qualifiedDividends).toBe(150_000);
  });

  it('maps capital gains from federal result', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'CA');
    expect(result.shortTermCapitalGains).toBe(0);
    expect(result.longTermCapitalGains).toBe(50_000);
    expect(result.netCapitalGainLoss).toBe(50_000);
  });

  it('maps unemployment and retirement', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'CA');
    expect(result.unemployment).toBe(80_000);
    expect(result.retirementDistributions).toBe(400_000);
  });

  it('maps federal credits', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'CA');
    expect(result.federalChildTaxCredit).toBe(200_000);
    expect(result.federalEITC).toBe(0);
  });

  it('maps charitable contributions', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'CA');
    expect(result.charitableContributions).toBe(125_000);
  });

  it('maps locality from W-2', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'CA');
    expect(result.locality).toBe('Los Angeles');
  });

  it('maps dependents count', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'CA');
    expect(result.numDependents).toBe(1);
    expect(result.numQualifyingChildren).toBe(1);
  });

  it('maps filing status and tax year', () => {
    const result = buildStateTaxInput(makeTaxInput(), makeFederalResult(), 'CA');
    expect(result.filingStatus).toBe('single');
    expect(result.taxYear).toBe(2025);
  });
});

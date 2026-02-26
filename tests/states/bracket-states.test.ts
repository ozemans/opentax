// Tests for bracket states: Virginia (VA) and Ohio (OH)
//
// VA: Progressive brackets (2%/3%/5%/5.75%), std deduction, personal exemptions, EITC
// OH: Progressive brackets (0%/2.75%/3.125%), exemption credits
//
// All monetary values are in CENTS.

import { describe, it, expect } from 'vitest';
import { virginia } from '../../src/engine/states/virginia';
import { ohio } from '../../src/engine/states/ohio';
import type { StateTaxInput, StateConfig } from '../../src/engine/states/interface';
import vaConfigJson from '../../config/states/state-VA-2025.json';
import ohConfigJson from '../../config/states/state-OH-2025.json';

const vaConfig = vaConfigJson as unknown as StateConfig;
const ohConfig = ohConfigJson as unknown as StateConfig;

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
  stateWithheld: 150_000,
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

// ===========================================================================
// Virginia (VA)
// ===========================================================================
describe('Virginia (VA) — progressive brackets', () => {
  it('has correct module metadata', () => {
    expect(virginia.stateCode).toBe('VA');
    expect(virginia.stateName).toBe('Virginia');
    expect(virginia.hasIncomeTax).toBe(true);
  });

  it('computes tax for income in first bracket only', () => {
    // AGI $2,000 - std deduction $8,000 = negative → $0 taxable
    const input = makeInput({ wages: 200_000, federalAGI: 200_000, federalTotalIncome: 200_000 });
    const result = virginia.compute(input, vaConfig);
    expect(result.stateTaxableIncome).toBe(0);
    expect(result.stateTaxBeforeCredits).toBe(0);
  });

  it('applies standard deduction and personal exemption', () => {
    // AGI $50,000 - std deduction $8,750 - exemption $930 = $40,320 (4_032_000)
    const result = virginia.compute(makeInput(), vaConfig);
    expect(result.stateDeduction).toBe(875_000);
    expect(result.stateExemptions).toBe(93_000);
    expect(result.stateTaxableIncome).toBe(5_000_000 - 875_000 - 93_000);
  });

  it('computes bracket tax spanning multiple brackets', () => {
    // Taxable income: $40,320 (4_032_000)
    // $3,000 at 2% = $60 (6_000)
    // $2,000 at 3% = $60 (6_000)
    // $12,000 at 5% = $600 (60_000)
    // $23,320 at 5.75% = $1,340.90
    const result = virginia.compute(makeInput(), vaConfig);
    expect(result.stateTaxBeforeCredits).toBe(
      Math.round(
        300_000 * 0.02 + 200_000 * 0.03 + 1_200_000 * 0.05 + 2_332_000 * 0.0575,
      ),
    );
  });

  it('applies MFJ standard deduction and spouse exemption', () => {
    const input = makeInput({ filingStatus: 'married_filing_jointly', federalAGI: 10_000_000 });
    const result = virginia.compute(input, vaConfig);
    // MFJ std deduction: $17,500 (1_750_000), exemptions: $930 * 2 = $1,860 (186_000)
    expect(result.stateDeduction).toBe(1_750_000);
    expect(result.stateExemptions).toBe(186_000);
  });

  it('includes dependent exemptions', () => {
    const input = makeInput({ numDependents: 2 });
    const result = virginia.compute(input, vaConfig);
    // Single: taxpayer $930 + 2 deps * $930 = $2,790 (279_000)
    expect(result.stateExemptions).toBe(279_000);
  });

  it('includes age 65+ additional exemption', () => {
    const input = makeInput({ taxpayerAge65OrOlder: true });
    const result = virginia.compute(input, vaConfig);
    // $930 + $800 = $1,730 (173_000)
    expect(result.stateExemptions).toBe(173_000);
  });

  it('computes VA EITC as 20% of federal', () => {
    const input = makeInput({
      wages: 2_000_000,
      federalAGI: 2_000_000,
      federalTotalIncome: 2_000_000,
      federalEITC: 432_800,
    });
    const result = virginia.compute(input, vaConfig);
    expect(result.creditBreakdown.eitc).toBe(Math.round(432_800 * 0.20));
  });

  it('EITC is refundable', () => {
    const input = makeInput({
      wages: 500_000,
      federalAGI: 500_000,
      federalTotalIncome: 500_000,
      federalEITC: 300_000,
      stateWithheld: 0,
    });
    const result = virginia.compute(input, vaConfig);
    // Very low income, EITC should exceed small tax → refund
    expect(result.stateRefundOrOwed).toBeGreaterThanOrEqual(0);
  });

  it('returns zero tax for zero AGI', () => {
    const input = makeInput({ wages: 0, federalAGI: 0, federalTotalIncome: 0 });
    const result = virginia.compute(input, vaConfig);
    expect(result.stateTaxableIncome).toBe(0);
    expect(result.stateTaxBeforeCredits).toBe(0);
  });

  it('marginal rate is 5.75% for high income', () => {
    const input = makeInput({ federalAGI: 50_000_000 });
    const result = virginia.compute(input, vaConfig);
    expect(result.marginalRate).toBeCloseTo(5.75, 2);
  });

  it('marginal rate is 2% for very low taxable income', () => {
    const input = makeInput({
      wages: 900_000,
      federalAGI: 900_000,
      federalTotalIncome: 900_000,
    });
    const result = virginia.compute(input, vaConfig);
    // AGI $9,000 - std ded $8,750 - exemption $930 = -$680 → 0 taxable
    expect(result.marginalRate).toBeCloseTo(2, 2);
  });
});

// ===========================================================================
// Ohio (OH)
// ===========================================================================
describe('Ohio (OH) — progressive brackets with exemption credits', () => {
  it('has correct module metadata', () => {
    expect(ohio.stateCode).toBe('OH');
    expect(ohio.stateName).toBe('Ohio');
    expect(ohio.hasIncomeTax).toBe(true);
  });

  it('returns $0 tax for income in 0% bracket', () => {
    // AGI $20,000 — entirely in 0% bracket ($0–$26,050)
    const input = makeInput({
      wages: 2_000_000,
      federalAGI: 2_000_000,
      federalTotalIncome: 2_000_000,
    });
    const result = ohio.compute(input, ohConfig);
    expect(result.stateTaxBeforeCredits).toBe(0);
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('computes tax in second bracket (2.75%)', () => {
    // AGI $35,000 (3_500_000)
    // 0% on first $26,050 = $0
    // 2.75% on $8,950 ($35,000 - $26,050) = $246.125 → 24_613
    const input = makeInput({
      wages: 3_500_000,
      federalAGI: 3_500_000,
      federalTotalIncome: 3_500_000,
    });
    const result = ohio.compute(input, ohConfig);
    const expectedTax = Math.round((3_500_000 - 2_605_000) * 0.0275);
    // After exemption credit of $2,400 for taxpayer
    expect(result.stateTaxBeforeCredits).toBe(expectedTax);
    expect(result.stateTaxAfterCredits).toBe(Math.max(0, expectedTax - 240_000));
  });

  it('computes tax spanning multiple brackets', () => {
    // AGI $75,000 (7_500_000)
    // 0% on $26,050 = $0
    // 2.75% on $48,950 ($75,000 - $26,050) = $1,346.125
    const input = makeInput({
      wages: 7_500_000,
      federalAGI: 7_500_000,
      federalTotalIncome: 7_500_000,
    });
    const result = ohio.compute(input, ohConfig);
    const expectedTax = Math.round(
      0 + (7_500_000 - 2_605_000) * 0.0275,
    );
    expect(result.stateTaxBeforeCredits).toBe(expectedTax);
  });

  it('applies exemption credits (taxpayer only, tier 2)', () => {
    const input = makeInput({
      wages: 7_500_000,
      federalAGI: 7_500_000,
    });
    const result = ohio.compute(input, ohConfig);
    // Single taxpayer: 1 exemption. Ohio AGI $75k → tier 2 ($40k < $75k ≤ $80k) = $2,150
    expect(result.stateCredits).toBe(215_000);
  });

  it('applies exemption credits for MFJ + dependents (tier 3)', () => {
    const input = makeInput({
      filingStatus: 'married_filing_jointly',
      numDependents: 2,
      federalAGI: 10_000_000,
    });
    const result = ohio.compute(input, ohConfig);
    // MFJ: taxpayer + spouse + 2 deps = 4. Ohio AGI $100k → tier 3 ($80k < $100k ≤ $750k) = $1,900
    // 4 * $1,900 = $7,600 (760_000)
    expect(result.stateCredits).toBe(760_000);
  });

  it('exemption credits cannot make tax negative', () => {
    const input = makeInput({
      wages: 3_000_000,
      federalAGI: 3_000_000,
      numDependents: 5,
    });
    const result = ohio.compute(input, ohConfig);
    // Small tax, large credits → tax after credits = 0
    expect(result.stateTaxAfterCredits).toBeGreaterThanOrEqual(0);
  });

  it('computes tax for high income in top bracket', () => {
    // AGI $200,000 (20_000_000)
    // 0% on $26,050, 2.75% on $73,950 ($100k-$26,050), 3.125% on $100,000 ($200k-$100k)
    const input = makeInput({
      wages: 20_000_000,
      federalAGI: 20_000_000,
      federalTotalIncome: 20_000_000,
    });
    const result = ohio.compute(input, ohConfig);
    const expectedTax = Math.round(
      0 +
      (10_000_000 - 2_605_000) * 0.0275 +
      (20_000_000 - 10_000_000) * 0.03125,
    );
    expect(result.stateTaxBeforeCredits).toBe(expectedTax);
    expect(result.marginalRate).toBeCloseTo(3.125, 2);
  });

  it('returns zero tax for zero income', () => {
    const input = makeInput({
      wages: 0,
      federalAGI: 0,
      federalTotalIncome: 0,
    });
    const result = ohio.compute(input, ohConfig);
    expect(result.stateTaxableIncome).toBe(0);
    expect(result.stateTaxBeforeCredits).toBe(0);
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('marginal rate is 0% for income in first bracket', () => {
    const input = makeInput({
      wages: 2_000_000,
      federalAGI: 2_000_000,
    });
    const result = ohio.compute(input, ohConfig);
    expect(result.marginalRate).toBe(0);
  });

  it('Social Security is subtracted', () => {
    const input = makeInput({
      federalAGI: 5_000_000,
      socialSecurityIncome: 1_000_000,
    });
    const result = ohio.compute(input, ohConfig);
    expect(result.stateSubtractions).toBe(1_000_000);
    expect(result.stateTaxableIncome).toBe(4_000_000);
  });
});

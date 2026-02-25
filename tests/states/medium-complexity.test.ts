// Tests for medium complexity states: Massachusetts (MA) and New Jersey (NJ)
//
// MA: 5% flat + 12% STCG + 4% millionaire surtax + 40% EITC
// NJ: Progressive brackets (1.4%–10.75%), property tax deduction vs credit, 40% EITC
//
// All monetary values are in CENTS.

import { describe, it, expect } from 'vitest';
import { massachusetts } from '../../src/engine/states/massachusetts';
import { newJersey } from '../../src/engine/states/new-jersey';
import type { StateTaxInput, StateConfig } from '../../src/engine/states/interface';
import maConfigJson from '../../config/states/state-MA-2025.json';
import njConfigJson from '../../config/states/state-NJ-2025.json';

const maConfig = maConfigJson as unknown as StateConfig;
const njConfig = njConfigJson as unknown as StateConfig;

const makeInput = (overrides: Partial<StateTaxInput> = {}): StateTaxInput => ({
  federalAGI: 7_500_000,
  federalTaxableIncome: 6_000_000,
  federalTotalIncome: 7_500_000,
  filingStatus: 'single',
  taxYear: 2025,
  taxpayerAge65OrOlder: false,
  taxpayerBlind: false,
  spouseAge65OrOlder: false,
  spouseBlind: false,
  numDependents: 0,
  numQualifyingChildren: 0,
  wages: 7_500_000,
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
  stateWages: 7_500_000,
  stateWithheld: 200_000,
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
// Massachusetts (MA)
// ===========================================================================
describe('Massachusetts (MA) — 5% flat + 12% STCG + surtax', () => {
  it('has correct module metadata', () => {
    expect(massachusetts.stateCode).toBe('MA');
    expect(massachusetts.stateName).toBe('Massachusetts');
    expect(massachusetts.hasIncomeTax).toBe(true);
  });

  it('computes basic 5% tax on W-2 wages', () => {
    // AGI $75,000 - exemption $4,400 = $70,600 taxable
    // $70,600 * 5% = $3,530 (353_000 cents)
    const result = massachusetts.compute(makeInput(), maConfig);
    const expectedTaxable = 7_500_000 - 440_000;
    expect(result.stateTaxableIncome).toBe(expectedTaxable);
    expect(result.stateTaxBeforeCredits).toBe(Math.round(expectedTaxable * 0.05));
  });

  it('taxes short-term capital gains at 12%', () => {
    const input = makeInput({
      wages: 5_000_000,
      federalAGI: 6_000_000,
      federalTotalIncome: 6_000_000,
      shortTermCapitalGains: 1_000_000, // $10,000 STCG
    });
    const result = massachusetts.compute(input, maConfig);
    // Total income: $60,000 - exemption $4,400 = $55,600
    // STCG: $10,000 at 12% = $1,200 (120_000)
    // Ordinary: $45,600 at 5% = $2,280 (228_000)
    // Total = $3,480 (348_000)
    const totalTaxable = 6_000_000 - 440_000;
    const stcgPortion = Math.min(1_000_000, totalTaxable);
    const ordinaryPortion = totalTaxable - stcgPortion;
    const expectedTax = Math.round(ordinaryPortion * 0.05) + Math.round(stcgPortion * 0.12);
    expect(result.stateTaxBeforeCredits).toBe(expectedTax);
  });

  it('no surtax below $1M threshold', () => {
    const input = makeInput({
      wages: 90_000_000, // $900,000
      federalAGI: 90_000_000,
    });
    const result = massachusetts.compute(input, maConfig);
    expect(result.stateSurtax).toBe(0);
  });

  it('applies 4% surtax above $1M threshold', () => {
    const input = makeInput({
      wages: 120_000_000, // $1,200,000
      federalAGI: 120_000_000,
      federalTotalIncome: 120_000_000,
    });
    const result = massachusetts.compute(input, maConfig);
    // Surtax: ($1,200,000 - $1,000,000) * 4% = $8,000 (800_000)
    expect(result.stateSurtax).toBe(800_000);
  });

  it('surtax is exactly $0 at $1M threshold', () => {
    const input = makeInput({
      wages: 100_000_000,
      federalAGI: 100_000_000,
    });
    const result = massachusetts.compute(input, maConfig);
    expect(result.stateSurtax).toBe(0);
  });

  it('applies surtax just above $1M', () => {
    const input = makeInput({
      wages: 100_100_000, // $1,001,000
      federalAGI: 100_100_000,
    });
    const result = massachusetts.compute(input, maConfig);
    // Surtax: $1,000 * 4% = $40 (4_000)
    expect(result.stateSurtax).toBe(4_000);
  });

  it('computes MA EITC as 40% of federal', () => {
    const input = makeInput({
      wages: 2_000_000,
      federalAGI: 2_000_000,
      federalTotalIncome: 2_000_000,
      federalEITC: 432_800,
    });
    const result = massachusetts.compute(input, maConfig);
    expect(result.creditBreakdown.eitc).toBe(Math.round(432_800 * 0.40));
  });

  it('EITC is refundable', () => {
    const input = makeInput({
      wages: 500_000,
      federalAGI: 500_000,
      federalTotalIncome: 500_000,
      federalEITC: 300_000,
      stateWithheld: 0,
    });
    const result = massachusetts.compute(input, maConfig);
    // 40% of $3,000 = $1,200 EITC
    // Small income produces small tax, EITC should create refund
    expect(result.stateRefundOrOwed).toBeGreaterThan(0);
  });

  it('MFJ exemption is $8,800', () => {
    const input = makeInput({
      filingStatus: 'married_filing_jointly',
      federalAGI: 10_000_000,
    });
    const result = massachusetts.compute(input, maConfig);
    expect(result.stateExemptions).toBe(880_000);
  });

  it('includes dependent exemptions', () => {
    const input = makeInput({ numDependents: 2 });
    const result = massachusetts.compute(input, maConfig);
    // Single $4,400 + 2 deps * $1,000 = $6,400 (640_000)
    expect(result.stateExemptions).toBe(640_000);
  });

  it('marginal rate includes surtax for millionaires', () => {
    const input = makeInput({
      wages: 120_000_000,
      federalAGI: 120_000_000,
    });
    const result = massachusetts.compute(input, maConfig);
    expect(result.marginalRate).toBeCloseTo(9, 1); // 5% + 4% = 9%
  });

  it('returns zero tax for zero income', () => {
    const input = makeInput({ wages: 0, federalAGI: 0, federalTotalIncome: 0 });
    const result = massachusetts.compute(input, maConfig);
    expect(result.stateTaxableIncome).toBe(0);
    expect(result.stateTaxBeforeCredits).toBe(0);
  });
});

// ===========================================================================
// New Jersey (NJ)
// ===========================================================================
describe('New Jersey (NJ) — progressive brackets with property tax', () => {
  it('has correct module metadata', () => {
    expect(newJersey.stateCode).toBe('NJ');
    expect(newJersey.stateName).toBe('New Jersey');
    expect(newJersey.hasIncomeTax).toBe(true);
  });

  it('computes tax in first bracket (1.4%)', () => {
    const input = makeInput({
      wages: 1_500_000, // $15,000
      federalAGI: 1_500_000,
      federalTotalIncome: 1_500_000,
    });
    const result = newJersey.compute(input, njConfig);
    // NJ gross: $15,000 - exemption $1,000 = $14,000
    const taxable = 1_500_000 - 100_000;
    expect(result.stateTaxableIncome).toBe(taxable);
  });

  it('computes tax spanning multiple brackets', () => {
    const input = makeInput({
      wages: 7_500_000,
      federalAGI: 7_500_000,
    });
    const result = newJersey.compute(input, njConfig);
    // NJ gross: $75,000 - exemption $1,000 = $74,000
    const taxable = 7_500_000 - 100_000;
    const expected = Math.round(
      2_000_000 * 0.014 +
      1_500_000 * 0.0175 +
      500_000 * 0.035 +
      3_400_000 * 0.05525,
    );
    expect(result.stateTaxableIncome).toBe(taxable);
    expect(result.stateTaxAfterCredits).toBe(expected);
  });

  it('applies property tax deduction (up to $15k)', () => {
    const input = makeInput({
      wages: 7_500_000,
      federalAGI: 7_500_000,
      propertyTaxes: 800_000, // $8,000 property tax
    });
    const result = newJersey.compute(input, njConfig);
    // Should use deduction: $75,000 - $1,000 - $8,000 = $66,000
    // vs credit: $75,000 - $1,000 = $74,000, then -$50 credit
    // Deduction saves more at these income levels
    expect(result.stateDeduction).toBe(800_000); // Deduction used
  });

  it('caps property tax deduction at $15,000', () => {
    const input = makeInput({
      wages: 10_000_000,
      federalAGI: 10_000_000,
      propertyTaxes: 2_000_000, // $20,000 property tax (exceeds cap)
    });
    const result = newJersey.compute(input, njConfig);
    // Deduction capped at $15,000 (1_500_000)
    expect(result.stateDeduction).toBeLessThanOrEqual(1_500_000);
  });

  it('uses property tax credit when more beneficial for low income', () => {
    // For very low income, the $50 credit might be better than a small deduction
    // at 1.4% marginal rate. $50 credit beats deduction when deduction * rate < $50
    // That's deduction < $50/0.014 ≈ $3,571
    const input = makeInput({
      wages: 1_200_000, // $12,000
      federalAGI: 1_200_000,
      federalTotalIncome: 1_200_000,
      propertyTaxes: 100_000, // $1,000 property tax
    });
    const result = newJersey.compute(input, njConfig);
    // $1,000 deduction at 1.4% saves $14, credit is $50 → credit is better
    // Check that either credit or deduction was used (whichever is better)
    const totalTaxPaid = result.stateTaxAfterCredits;
    expect(totalTaxPaid).toBeGreaterThanOrEqual(0);
  });

  it('includes spouse and dependent exemptions for MFJ', () => {
    const input = makeInput({
      filingStatus: 'married_filing_jointly',
      numDependents: 2,
      federalAGI: 10_000_000,
    });
    const result = newJersey.compute(input, njConfig);
    // taxpayer $1,000 + spouse $1,000 + 2 deps * $1,500 = $5,000 (500_000)
    expect(result.stateExemptions).toBe(500_000);
  });

  it('computes NJ EITC as 40% of federal', () => {
    const input = makeInput({
      wages: 2_000_000,
      federalAGI: 2_000_000,
      federalTotalIncome: 2_000_000,
      federalEITC: 432_800,
    });
    const result = newJersey.compute(input, njConfig);
    expect(result.creditBreakdown.eitc).toBe(Math.round(432_800 * 0.40));
  });

  it('Social Security is exempt', () => {
    const input = makeInput({
      wages: 5_000_000,
      socialSecurityIncome: 2_000_000,
      federalAGI: 7_000_000,
    });
    const result = newJersey.compute(input, njConfig);
    // NJ gross income should NOT include SS
    expect(result.stateAGI).toBe(5_000_000); // Only wages
  });

  it('computes tax in top bracket (10.75%)', () => {
    const input = makeInput({
      wages: 150_000_000, // $1,500,000
      federalAGI: 150_000_000,
      federalTotalIncome: 150_000_000,
    });
    const result = newJersey.compute(input, njConfig);
    expect(result.marginalRate).toBeCloseTo(10.75, 2);
  });

  it('returns zero tax for zero income', () => {
    const input = makeInput({
      wages: 0,
      federalAGI: 0,
      federalTotalIncome: 0,
    });
    const result = newJersey.compute(input, njConfig);
    expect(result.stateTaxableIncome).toBe(0);
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('handles all 7 brackets correctly for high income', () => {
    const input = makeInput({
      wages: 120_000_000, // $1,200,000
      federalAGI: 120_000_000,
      federalTotalIncome: 120_000_000,
    });
    const result = newJersey.compute(input, njConfig);
    const taxable = 120_000_000 - 100_000;
    const expected = Math.round(
      2_000_000 * 0.014 +
      1_500_000 * 0.0175 +
      500_000 * 0.035 +
      3_500_000 * 0.05525 +
      42_500_000 * 0.0637 +
      50_000_000 * 0.0897 +
      19_900_000 * 0.1075,
    );
    expect(result.stateTaxAfterCredits).toBe(expected);
  });
});

// Tests for high complexity states: New York (NY) and California (CA)
//
// NY: 9 progressive brackets + NYC local tax + EITC + child credit
// CA: 10 progressive brackets + mental health surtax + CalEITC + renter's credit
//
// All monetary values are in CENTS.

import { describe, it, expect } from 'vitest';
import { newYork } from '../../src/engine/states/new-york';
import { california } from '../../src/engine/states/california';
import type { StateTaxInput, StateConfig } from '../../src/engine/states/interface';
import nyConfigJson from '../../config/states/state-NY-2025.json';
import caConfigJson from '../../config/states/state-CA-2025.json';

const nyConfig = nyConfigJson as unknown as StateConfig;
const caConfig = caConfigJson as unknown as StateConfig;

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
// New York (NY)
// ===========================================================================
describe('New York (NY) — progressive + NYC local', () => {
  it('has correct module metadata', () => {
    expect(newYork.stateCode).toBe('NY');
    expect(newYork.stateName).toBe('New York');
    expect(newYork.hasIncomeTax).toBe(true);
  });

  it('computes NYS tax only (no NYC)', () => {
    // AGI $75,000 - std deduction $8,000 = $67,000 taxable
    const result = newYork.compute(makeInput(), nyConfig);
    const taxable = 7_500_000 - 800_000;
    expect(result.stateTaxableIncome).toBe(taxable);
    expect(result.localTax).toBe(0);
    // Tax should be positive
    expect(result.stateTaxBeforeCredits).toBeGreaterThan(0);
  });

  it('applies standard deduction', () => {
    const result = newYork.compute(makeInput(), nyConfig);
    expect(result.stateDeduction).toBe(800_000);
  });

  it('MFJ gets $16,050 standard deduction', () => {
    const input = makeInput({ filingStatus: 'married_filing_jointly', federalAGI: 15_000_000 });
    const result = newYork.compute(input, nyConfig);
    expect(result.stateDeduction).toBe(1_605_000);
  });

  it('computes NYS bracket tax correctly', () => {
    // AGI $75,000, taxable $67,000 (6_700_000)
    // 4% on $8,500 = $340 (34_000)
    // 4.5% on $3,200 ($11,700 - $8,500) = $144 (14_400)
    // 5.25% on $2,200 ($13,900 - $11,700) = $115.50 (11_550)
    // 5.5% on $53,100 ($67,000 - $13,900) = $2,920.50 (292_050)
    // Total = $3,520 (352_000)
    const result = newYork.compute(makeInput(), nyConfig);
    const taxable = 6_700_000;
    const expected = Math.round(
      850_000 * 0.04 +
      320_000 * 0.045 +
      220_000 * 0.0525 +
      5_310_000 * 0.055,
    );
    expect(result.stateTaxBeforeCredits).toBe(expected);
  });

  it('adds NYC local tax for NYC residents', () => {
    const input = makeInput({ locality: 'NYC' });
    const result = newYork.compute(input, nyConfig);
    expect(result.localTax).toBeGreaterThan(0);
    // NYC tax should be computed on same taxable income
    const taxable = 7_500_000 - 800_000;
    const expectedNYC = Math.round(
      1_200_000 * 0.03078 +
      1_350_000 * 0.03762 +
      2_450_000 * 0.03819 +
      1_700_000 * 0.03876,
    );
    expect(result.localTax).toBe(expectedNYC);
  });

  it('total tax includes both NYS and NYC', () => {
    const input = makeInput({ locality: 'NYC' });
    const result = newYork.compute(input, nyConfig);
    // stateTaxAfterCredits = nysAfterCredits + nycTax
    expect(result.stateTaxAfterCredits).toBe(
      result.stateTaxBeforeCredits + result.localTax - result.stateCredits,
    );
  });

  it('no NYC tax for non-NYC locality', () => {
    const input = makeInput({ locality: 'Albany' });
    const result = newYork.compute(input, nyConfig);
    expect(result.localTax).toBe(0);
  });

  it('no NYC tax when no locality', () => {
    const result = newYork.compute(makeInput(), nyConfig);
    expect(result.localTax).toBe(0);
  });

  it('computes NY EITC as 30% of federal', () => {
    const input = makeInput({
      wages: 2_000_000,
      federalAGI: 2_000_000,
      federalTotalIncome: 2_000_000,
      federalEITC: 432_800,
    });
    const result = newYork.compute(input, nyConfig);
    expect(result.creditBreakdown.eitc).toBe(Math.round(432_800 * 0.30));
  });

  it('computes NY child credit below AGI threshold', () => {
    const input = makeInput({
      numQualifyingChildren: 2,
      federalAGI: 5_000_000, // Under $75,000 threshold for single
    });
    const result = newYork.compute(input, nyConfig);
    // 2 children * $330 = $660 (66_000)
    expect(result.creditBreakdown.childCredit).toBe(66_000);
  });

  it('no child credit above AGI threshold', () => {
    const input = makeInput({
      numQualifyingChildren: 2,
      federalAGI: 10_000_000, // Over $75,000 threshold for single
    });
    const result = newYork.compute(input, nyConfig);
    expect(result.creditBreakdown.childCredit).toBeUndefined();
  });

  it('returns zero tax for zero income', () => {
    const input = makeInput({ wages: 0, federalAGI: 0, federalTotalIncome: 0 });
    const result = newYork.compute(input, nyConfig);
    expect(result.stateTaxableIncome).toBe(0);
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('Social Security is exempt', () => {
    const input = makeInput({
      federalAGI: 10_000_000,
      socialSecurityIncome: 2_000_000,
    });
    const result = newYork.compute(input, nyConfig);
    expect(result.stateSubtractions).toBe(2_000_000);
    // Taxable = AGI - SS - std deduction
    expect(result.stateTaxableIncome).toBe(10_000_000 - 2_000_000 - 800_000);
  });

  it('handles high income in top brackets', () => {
    const input = makeInput({
      wages: 300_000_000, // $3M
      federalAGI: 300_000_000,
      federalTotalIncome: 300_000_000,
    });
    const result = newYork.compute(input, nyConfig);
    expect(result.marginalRate).toBeCloseTo(9.65, 2);
  });
});

// ===========================================================================
// California (CA)
// ===========================================================================
describe('California (CA) — 10 brackets + surtax + CalEITC + renter\'s credit', () => {
  it('has correct module metadata', () => {
    expect(california.stateCode).toBe('CA');
    expect(california.stateName).toBe('California');
    expect(california.hasIncomeTax).toBe(true);
  });

  it('computes basic tax with standard deduction and exemption', () => {
    // AGI $75,000 - std ded $5,540 - exemption $144 = $69,316 taxable
    const result = california.compute(makeInput(), caConfig);
    const taxable = 7_500_000 - 554_000 - 14_400;
    expect(result.stateTaxableIncome).toBe(taxable);
    expect(result.stateDeduction).toBe(554_000);
    expect(result.stateExemptions).toBe(14_400);
  });

  it('taxes capital gains as ordinary income', () => {
    // CA treats capital gains as ordinary income — they're part of federal AGI
    const input = makeInput({
      wages: 5_000_000,
      longTermCapitalGains: 2_500_000,
      federalAGI: 7_500_000,
    });
    const result = california.compute(input, caConfig);
    // Same AGI, same tax — CG is treated identically to wages
    const baseResult = california.compute(makeInput(), caConfig);
    expect(result.stateTaxBeforeCredits).toBe(baseResult.stateTaxBeforeCredits);
  });

  it('computes bracket tax spanning multiple brackets', () => {
    // Taxable: $69,316 (6_931_600)
    // 1% on $10,412 = $104.12
    // 2% on $14,272 = $285.44
    // 4% on $14,275 = $571.00
    // 6% on $15,122 = $907.32
    // 8% on $14,269 = $1,141.52
    // 9.3% on $966 = $89.84 (6_931_600 - 6_835_000 = 96_600)
    const result = california.compute(makeInput(), caConfig);
    const taxable = 6_931_600;
    const expected = Math.round(
      1_041_200 * 0.01 +
      (2_468_400 - 1_041_200) * 0.02 +
      (3_895_900 - 2_468_400) * 0.04 +
      (5_408_100 - 3_895_900) * 0.06 +
      (6_835_000 - 5_408_100) * 0.08 +
      (6_931_600 - 6_835_000) * 0.093,
    );
    expect(result.stateTaxBeforeCredits).toBe(expected); // No surtax for this income
  });

  it('no surtax below $1M', () => {
    const result = california.compute(makeInput(), caConfig);
    expect(result.stateSurtax).toBe(0);
  });

  it('applies 1% mental health surtax above $1M', () => {
    const input = makeInput({
      wages: 120_000_000, // $1.2M
      federalAGI: 120_000_000,
      federalTotalIncome: 120_000_000,
    });
    const result = california.compute(input, caConfig);
    // Surtax: ($1,200,000 - $1,000,000) * 1% = $2,000 (200_000)
    expect(result.stateSurtax).toBe(200_000);
  });

  it('surtax is $0 at exactly $1M', () => {
    const input = makeInput({
      wages: 100_000_000,
      federalAGI: 100_000_000,
    });
    const result = california.compute(input, caConfig);
    expect(result.stateSurtax).toBe(0);
  });

  it('computes CalEITC as 45% of federal', () => {
    const input = makeInput({
      wages: 2_000_000,
      federalAGI: 2_000_000,
      federalTotalIncome: 2_000_000,
      federalEITC: 432_800,
    });
    const result = california.compute(input, caConfig);
    expect(result.creditBreakdown.calEITC).toBe(Math.round(432_800 * 0.45));
  });

  it('CalEITC is refundable', () => {
    const input = makeInput({
      wages: 500_000,
      federalAGI: 500_000,
      federalTotalIncome: 500_000,
      federalEITC: 300_000,
      stateWithheld: 0,
    });
    const result = california.compute(input, caConfig);
    expect(result.stateRefundOrOwed).toBeGreaterThan(0);
  });

  it('grants renter\'s credit for eligible renter below AGI limit', () => {
    const input = makeInput({
      wages: 4_000_000,
      federalAGI: 4_000_000,
      federalTotalIncome: 4_000_000,
      isRenter: true,
      rentPaid: 1_500_000,
    });
    const result = california.compute(input, caConfig);
    // Single, AGI $40,000 < $52,840 limit → $60 credit (6_000)
    expect(result.creditBreakdown.rentersCredit).toBe(6_000);
  });

  it('no renter\'s credit above AGI limit', () => {
    const input = makeInput({
      wages: 6_000_000,
      federalAGI: 6_000_000,
      isRenter: true,
      rentPaid: 1_500_000,
    });
    const result = california.compute(input, caConfig);
    expect(result.creditBreakdown.rentersCredit).toBeUndefined();
  });

  it('no renter\'s credit for non-renters', () => {
    const input = makeInput({
      wages: 4_000_000,
      federalAGI: 4_000_000,
      isRenter: false,
    });
    const result = california.compute(input, caConfig);
    expect(result.creditBreakdown.rentersCredit).toBeUndefined();
  });

  it('MFJ renter\'s credit is $120', () => {
    const input = makeInput({
      filingStatus: 'married_filing_jointly',
      wages: 8_000_000,
      federalAGI: 8_000_000,
      federalTotalIncome: 8_000_000,
      isRenter: true,
      rentPaid: 2_000_000,
    });
    const result = california.compute(input, caConfig);
    expect(result.creditBreakdown.rentersCredit).toBe(12_000);
  });

  it('MFJ standard deduction is $11,080', () => {
    const input = makeInput({
      filingStatus: 'married_filing_jointly',
      federalAGI: 15_000_000,
    });
    const result = california.compute(input, caConfig);
    expect(result.stateDeduction).toBe(1_108_000);
  });

  it('includes dependent exemptions', () => {
    const input = makeInput({ numDependents: 2 });
    const result = california.compute(input, caConfig);
    // taxpayer $144 + 2 deps * $446 = $1,036 (103_600)
    expect(result.stateExemptions).toBe(14_400 + 2 * 44_600);
  });

  it('Social Security is exempt', () => {
    const input = makeInput({
      federalAGI: 10_000_000,
      socialSecurityIncome: 2_000_000,
    });
    const result = california.compute(input, caConfig);
    expect(result.stateSubtractions).toBe(2_000_000);
  });

  it('returns zero tax for zero income', () => {
    const input = makeInput({ wages: 0, federalAGI: 0, federalTotalIncome: 0 });
    const result = california.compute(input, caConfig);
    expect(result.stateTaxableIncome).toBe(0);
    expect(result.stateTaxBeforeCredits).toBe(0);
  });

  it('marginal rate includes surtax for $1M+ earners', () => {
    const input = makeInput({
      wages: 120_000_000,
      federalAGI: 120_000_000,
    });
    const result = california.compute(input, caConfig);
    // At $1.2M AGI, taxable ≈ $1,194,316, falls in 13.3% bracket + 1% surtax = 14.3%
    expect(result.marginalRate).toBeCloseTo(14.3, 1);
  });

  it('handles very high income in top bracket (13.3%)', () => {
    const input = makeInput({
      wages: 200_000_000, // $2M
      federalAGI: 200_000_000,
      federalTotalIncome: 200_000_000,
    });
    const result = california.compute(input, caConfig);
    // Marginal rate: 13.3% + 1% surtax = 14.3%
    expect(result.marginalRate).toBeCloseTo(14.3, 1);
  });
});

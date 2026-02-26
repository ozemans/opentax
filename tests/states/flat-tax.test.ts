// Tests for flat tax states: Pennsylvania (PA) and Illinois (IL)
//
// PA: 3.07% flat tax on own computation (SS and retirement exempt)
// IL: 4.95% flat tax from federal AGI (SS and retirement exempt, personal exemptions, EITC)
//
// All monetary values are in CENTS.

import { describe, it, expect } from 'vitest';
import { pennsylvania } from '../../src/engine/states/pennsylvania';
import { illinois } from '../../src/engine/states/illinois';
import type { StateTaxInput, StateConfig } from '../../src/engine/states/interface';
import paConfigJson from '../../config/states/state-PA-2025.json';
import ilConfigJson from '../../config/states/state-IL-2025.json';

const paConfig = paConfigJson as unknown as StateConfig;
const ilConfig = ilConfigJson as unknown as StateConfig;

// ---------------------------------------------------------------------------
// Helper to create StateTaxInput
// ---------------------------------------------------------------------------
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
// Pennsylvania (PA)
// ===========================================================================
describe('Pennsylvania (PA) — 3.07% flat tax', () => {
  it('has correct module metadata', () => {
    expect(pennsylvania.stateCode).toBe('PA');
    expect(pennsylvania.stateName).toBe('Pennsylvania');
    expect(pennsylvania.hasIncomeTax).toBe(true);
  });

  it('computes tax on W-2 wages only', () => {
    // $75,000 wages at 3.07% = $2,302.50 = 230_250 cents
    const result = pennsylvania.compute(makeInput(), paConfig);
    expect(result.stateTaxableIncome).toBe(7_500_000);
    expect(result.stateTaxBeforeCredits).toBe(230_250);
    expect(result.stateTaxAfterCredits).toBe(230_250);
  });

  it('includes interest income', () => {
    const input = makeInput({ taxableInterest: 500_000 }); // $5,000 interest
    const result = pennsylvania.compute(input, paConfig);
    // $75,000 + $5,000 = $80,000 → $80,000 * 0.0307 = $2,456 = 245_600
    expect(result.stateTaxableIncome).toBe(8_000_000);
    expect(result.stateTaxBeforeCredits).toBe(245_600);
  });

  it('includes dividends', () => {
    const input = makeInput({ ordinaryDividends: 200_000 });
    const result = pennsylvania.compute(input, paConfig);
    expect(result.stateTaxableIncome).toBe(7_700_000);
  });

  it('includes self-employment income', () => {
    const input = makeInput({ selfEmploymentIncome: 2_000_000 });
    const result = pennsylvania.compute(input, paConfig);
    // $75,000 + $20,000 = $95,000
    expect(result.stateTaxableIncome).toBe(9_500_000);
    expect(result.stateTaxBeforeCredits).toBe(Math.round(9_500_000 * 0.0307));
  });

  it('includes positive capital gains', () => {
    const input = makeInput({ netCapitalGainLoss: 1_000_000 }); // $10,000 gain
    const result = pennsylvania.compute(input, paConfig);
    expect(result.stateTaxableIncome).toBe(8_500_000);
  });

  it('excludes capital losses (negative net)', () => {
    const input = makeInput({ netCapitalGainLoss: -300_000 }); // $3,000 loss
    const result = pennsylvania.compute(input, paConfig);
    // Capital loss not deductible — only wages
    expect(result.stateTaxableIncome).toBe(7_500_000);
  });

  it('exempts retirement distributions', () => {
    const input = makeInput({ retirementDistributions: 2_000_000 });
    const result = pennsylvania.compute(input, paConfig);
    // Retirement is exempt — only wages count
    expect(result.stateTaxableIncome).toBe(7_500_000);
  });

  it('exempts Social Security income', () => {
    const input = makeInput({ socialSecurityIncome: 1_500_000 });
    const result = pennsylvania.compute(input, paConfig);
    // SS is exempt — only wages count
    expect(result.stateTaxableIncome).toBe(7_500_000);
  });

  it('includes unemployment income', () => {
    const input = makeInput({ unemployment: 300_000 });
    const result = pennsylvania.compute(input, paConfig);
    expect(result.stateTaxableIncome).toBe(7_800_000);
  });

  it('computes refund correctly', () => {
    const result = pennsylvania.compute(makeInput(), paConfig);
    // Withholding $2,000 - tax $2,302.50 = -$302.50 owed
    expect(result.stateRefundOrOwed).toBe(200_000 - 230_250);
  });

  it('returns zero tax for zero income', () => {
    const input = makeInput({ wages: 0, federalAGI: 0, federalTotalIncome: 0 });
    const result = pennsylvania.compute(input, paConfig);
    expect(result.stateTaxableIncome).toBe(0);
    expect(result.stateTaxBeforeCredits).toBe(0);
  });

  it('marginal rate is always 3.07%', () => {
    const result = pennsylvania.compute(makeInput(), paConfig);
    expect(result.marginalRate).toBeCloseTo(3.07, 2);
  });
});

// ===========================================================================
// Illinois (IL)
// ===========================================================================
describe('Illinois (IL) — 4.95% flat tax', () => {
  it('has correct module metadata', () => {
    expect(illinois.stateCode).toBe('IL');
    expect(illinois.stateName).toBe('Illinois');
    expect(illinois.hasIncomeTax).toBe(true);
  });

  it('computes tax on W-2 wages with personal exemption', () => {
    // Federal AGI $75,000 - exemption $2,850 = $72,150 taxable
    // $72,150 * 0.0495 = $3,582.5625 → 358_256 cents
    const result = illinois.compute(makeInput(), ilConfig);
    const expectedTaxable = 7_500_000 - 285_000;
    expect(result.stateTaxableIncome).toBe(expectedTaxable);
    expect(result.stateTaxBeforeCredits).toBe(Math.round(expectedTaxable * 0.0495));
  });

  it('subtracts retirement distributions', () => {
    const input = makeInput({
      retirementDistributions: 1_000_000,
      federalAGI: 8_500_000,
    });
    const result = illinois.compute(input, ilConfig);
    // AGI $85,000 - retirement $10,000 - exemption $2,850 = $72,150
    const expectedTaxable = 8_500_000 - 1_000_000 - 285_000;
    expect(result.stateTaxableIncome).toBe(expectedTaxable);
  });

  it('subtracts Social Security income', () => {
    const input = makeInput({
      socialSecurityIncome: 500_000,
      federalAGI: 8_000_000,
    });
    const result = illinois.compute(input, ilConfig);
    const expectedTaxable = 8_000_000 - 500_000 - 285_000;
    expect(result.stateTaxableIncome).toBe(expectedTaxable);
  });

  it('adds spouse exemption for MFJ', () => {
    const input = makeInput({ filingStatus: 'married_filing_jointly' });
    const result = illinois.compute(input, ilConfig);
    // Exemptions: taxpayer $2,850 + spouse $2,850 = $5,700 (570_000)
    const expectedTaxable = 7_500_000 - 570_000;
    expect(result.stateExemptions).toBe(570_000);
    expect(result.stateTaxableIncome).toBe(expectedTaxable);
  });

  it('adds dependent exemptions', () => {
    const input = makeInput({ numDependents: 3 });
    const result = illinois.compute(input, ilConfig);
    // taxpayer $2,850 + 3 deps * $2,850 = $11,400 (1_140_000)
    const expectedExemptions = 285_000 + 3 * 285_000;
    expect(result.stateExemptions).toBe(expectedExemptions);
  });

  it('computes IL EITC as 20% of federal EITC', () => {
    const input = makeInput({
      wages: 2_000_000,
      federalAGI: 2_000_000,
      federalTotalIncome: 2_000_000,
      federalEITC: 432_800, // Federal EITC $4,328
    });
    const result = illinois.compute(input, ilConfig);
    // 20% of $4,328 = $865.60 → 86_560 cents
    expect(result.creditBreakdown.eitc).toBe(86_560);
  });

  it('taxable income cannot go negative', () => {
    const input = makeInput({
      wages: 100_000, // $1,000 wages
      federalAGI: 100_000,
      federalTotalIncome: 100_000,
    });
    const result = illinois.compute(input, ilConfig);
    // AGI $1,000 - exemption $2,850 = -$1,850 → 0
    expect(result.stateTaxableIncome).toBe(0);
    expect(result.stateTaxBeforeCredits).toBe(0);
  });

  it('marginal rate is always 4.95%', () => {
    const result = illinois.compute(makeInput(), ilConfig);
    expect(result.marginalRate).toBeCloseTo(4.95, 2);
  });

  it('computes refund with EITC correctly', () => {
    const input = makeInput({
      wages: 1_500_000,
      federalAGI: 1_500_000,
      federalTotalIncome: 1_500_000,
      stateWithheld: 50_000,
      federalEITC: 300_000,
    });
    const result = illinois.compute(input, ilConfig);
    const stateEITC = Math.round(300_000 * 0.20); // 60_000
    const taxable = Math.max(0, 1_500_000 - 285_000);
    const tax = Math.round(taxable * 0.0495);
    const refundableCredits = Math.max(0, stateEITC - tax);
    const taxAfterCredits = Math.max(0, tax - stateEITC);
    expect(result.stateRefundOrOwed).toBe(50_000 + refundableCredits - taxAfterCredits);
  });
});

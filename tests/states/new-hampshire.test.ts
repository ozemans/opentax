// Tests for New Hampshire (NH) — Interest & Dividends tax (repealed 2025, rate = 0%)
//
// NH technically has an income tax framework (hasIncomeTax: true) but the
// I&D tax rate was set to 0% starting in 2025.
// Only interest and dividends are ever subject to this tax.
//
// All monetary values are in CENTS.

import { describe, it, expect } from 'vitest';
import { newHampshire } from '../../src/engine/states/new-hampshire';
import type { StateTaxInput, StateConfig } from '../../src/engine/states/interface';
import nhConfigJson from '../../config/states/state-NH-2025.json';

const nhConfig = nhConfigJson as unknown as StateConfig;

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

describe('New Hampshire (NH) — I&D tax (0% in 2025)', () => {
  it('has correct module metadata', () => {
    expect(newHampshire.stateCode).toBe('NH');
    expect(newHampshire.stateName).toBe('New Hampshire');
    expect(newHampshire.hasIncomeTax).toBe(true);
  });

  it('returns $0 tax on W-2 wages (wages not subject to NH I&D)', () => {
    const result = newHampshire.compute(
      makeInput({ wages: 10_000_000 }),
      nhConfig,
    );
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('returns $0 tax on interest income (0% rate in 2025)', () => {
    const result = newHampshire.compute(
      makeInput({ taxableInterest: 500_000 }),
      nhConfig,
    );
    expect(result.stateTaxableIncome).toBe(500_000);
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('returns $0 tax on dividend income (0% rate in 2025)', () => {
    const result = newHampshire.compute(
      makeInput({ ordinaryDividends: 800_000 }),
      nhConfig,
    );
    expect(result.stateTaxableIncome).toBe(800_000);
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('returns $0 tax on combined interest and dividends', () => {
    const result = newHampshire.compute(
      makeInput({ taxableInterest: 300_000, ordinaryDividends: 400_000 }),
      nhConfig,
    );
    expect(result.stateTaxableIncome).toBe(700_000);
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('returns $0 tax regardless of total income amount', () => {
    const result = newHampshire.compute(
      makeInput({
        wages: 50_000_000,
        taxableInterest: 10_000_000,
        ordinaryDividends: 5_000_000,
        longTermCapitalGains: 20_000_000,
      }),
      nhConfig,
    );
    // Only I&D is taxable in NH, but rate is 0%
    expect(result.stateTaxableIncome).toBe(15_000_000); // interest + dividends
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('returns $0 tax for self-employment income', () => {
    const result = newHampshire.compute(
      makeInput({ selfEmploymentIncome: 5_000_000 }),
      nhConfig,
    );
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('returns $0 tax for capital gains', () => {
    const result = newHampshire.compute(
      makeInput({ longTermCapitalGains: 10_000_000 }),
      nhConfig,
    );
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('refunds any mistaken withholding', () => {
    const result = newHampshire.compute(
      makeInput({ stateWithheld: 100_000 }),
      nhConfig,
    );
    expect(result.stateRefundOrOwed).toBe(100_000);
  });

  it('marginal rate is 0%', () => {
    const result = newHampshire.compute(makeInput(), nhConfig);
    expect(result.marginalRate).toBe(0);
  });
});

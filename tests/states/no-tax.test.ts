// Tests for no-tax states: Texas (TX) and Florida (FL)
//
// Both states have no income tax. The modules should return zero-filled results.
// All monetary values are in CENTS.

import { describe, it, expect } from 'vitest';
import { texas } from '../../src/engine/states/texas';
import { florida } from '../../src/engine/states/florida';
import type { StateTaxInput, StateConfig } from '../../src/engine/states/interface';
import txConfig from '../../config/states/state-TX-2025.json';
import flConfig from '../../config/states/state-FL-2025.json';

// ---------------------------------------------------------------------------
// Helpers
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

// ---------------------------------------------------------------------------
// Texas
// ---------------------------------------------------------------------------
describe('Texas (TX) — no income tax', () => {
  it('has correct module metadata', () => {
    expect(texas.stateCode).toBe('TX');
    expect(texas.stateName).toBe('Texas');
    expect(texas.hasIncomeTax).toBe(false);
  });

  it('returns $0 tax for W-2 earner', () => {
    const result = texas.compute(makeInput(), txConfig as unknown as StateConfig);
    expect(result.stateCode).toBe('TX');
    expect(result.stateName).toBe('Texas');
    expect(result.hasIncomeTax).toBe(false);
    expect(result.stateTaxableIncome).toBe(0);
    expect(result.stateTaxBeforeCredits).toBe(0);
    expect(result.stateTaxAfterCredits).toBe(0);
    expect(result.effectiveRate).toBe(0);
    expect(result.marginalRate).toBe(0);
  });

  it('returns $0 tax for high income earner', () => {
    const result = texas.compute(
      makeInput({ wages: 100_000_000, federalAGI: 100_000_000 }),
      txConfig as unknown as StateConfig,
    );
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('returns withholding as refund when withheld by mistake', () => {
    const result = texas.compute(
      makeInput({ stateWithheld: 50_000 }),
      txConfig as unknown as StateConfig,
    );
    expect(result.stateWithheld).toBe(50_000);
    expect(result.stateRefundOrOwed).toBe(50_000);
  });
});

// ---------------------------------------------------------------------------
// Florida
// ---------------------------------------------------------------------------
describe('Florida (FL) — no income tax', () => {
  it('has correct module metadata', () => {
    expect(florida.stateCode).toBe('FL');
    expect(florida.stateName).toBe('Florida');
    expect(florida.hasIncomeTax).toBe(false);
  });

  it('returns $0 tax for W-2 earner', () => {
    const result = florida.compute(makeInput(), flConfig as unknown as StateConfig);
    expect(result.stateCode).toBe('FL');
    expect(result.stateName).toBe('Florida');
    expect(result.hasIncomeTax).toBe(false);
    expect(result.stateTaxableIncome).toBe(0);
    expect(result.stateTaxBeforeCredits).toBe(0);
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('returns $0 tax for self-employment income', () => {
    const result = florida.compute(
      makeInput({ selfEmploymentIncome: 5_000_000 }),
      flConfig as unknown as StateConfig,
    );
    expect(result.stateTaxAfterCredits).toBe(0);
  });

  it('returns $0 tax for capital gains', () => {
    const result = florida.compute(
      makeInput({ longTermCapitalGains: 10_000_000, netCapitalGainLoss: 10_000_000 }),
      flConfig as unknown as StateConfig,
    );
    expect(result.stateTaxAfterCredits).toBe(0);
  });
});

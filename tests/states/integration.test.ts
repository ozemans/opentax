// State Tax Engine Integration Tests
//
// Tests the full pipeline: TaxInput → Federal computation → State computation
// using computeStateTaxes and computeFullReturn.
//
// All monetary values are in CENTS.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeFederalTax } from '../../src/engine/federal/index';
import { computeStateTaxes, getSupportedStates, getStateModule } from '../../src/engine/states/index';
import { computeFullReturn } from '../../src/engine/index';
import type { TaxInput, FederalConfig } from '../../src/engine/types';
import federalConfig from '../../config/federal-2025.json';

const config = federalConfig as unknown as FederalConfig;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<TaxInput> = {}): TaxInput {
  return {
    taxYear: 2025,
    filingStatus: 'single',
    taxpayer: {
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
    },
    dependents: [],
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '90210',
    },
    w2s: [],
    form1099INTs: [],
    form1099DIVs: [],
    form1099Bs: [],
    form1099NECs: [],
    form1099Gs: [],
    form1099Rs: [],
    form1099Ks: [],
    estimatedTaxPayments: 0,
    useItemizedDeductions: false,
    stateOfResidence: 'CA',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Registry Tests
// ---------------------------------------------------------------------------

describe('State Registry', () => {
  it('supports 21 states', () => {
    const states = getSupportedStates();
    expect(states).toHaveLength(21);
    // Original 11
    expect(states).toContain('TX');
    expect(states).toContain('FL');
    expect(states).toContain('PA');
    expect(states).toContain('IL');
    expect(states).toContain('NH');
    expect(states).toContain('VA');
    expect(states).toContain('OH');
    expect(states).toContain('MA');
    expect(states).toContain('NJ');
    expect(states).toContain('NY');
    expect(states).toContain('CA');
    // 10 new states
    expect(states).toContain('GA');
    expect(states).toContain('NC');
    expect(states).toContain('MI');
    expect(states).toContain('WA');
    expect(states).toContain('AZ');
    expect(states).toContain('TN');
    expect(states).toContain('IN');
    expect(states).toContain('MO');
    expect(states).toContain('MD');
    expect(states).toContain('WI');
  });

  it('getStateModule returns module for supported state', () => {
    const tx = getStateModule('TX');
    expect(tx).toBeDefined();
    expect(tx?.stateCode).toBe('TX');
  });

  it('getStateModule is case-insensitive', () => {
    expect(getStateModule('ca')?.stateCode).toBe('CA');
    expect(getStateModule('Ca')?.stateCode).toBe('CA');
  });

  it('getStateModule returns undefined for unsupported state', () => {
    expect(getStateModule('ZZ')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Scenario 1: Single W-2 CA filer ($75k)
// ---------------------------------------------------------------------------

describe('Integration: Single W-2 CA filer ($75k)', () => {
  const input = makeInput({
    filingStatus: 'single',
    stateOfResidence: 'CA',
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Acme Corp',
      wages: 7_500_000,
      federalWithheld: 900_000,
      socialSecurityWages: 7_500_000,
      socialSecurityWithheld: 465_000,
      medicareWages: 7_500_000,
      medicareWithheld: 108_750,
      stateWages: 7_500_000,
      stateWithheld: 300_000,
      stateCode: 'CA',
    }],
  });

  const federalResult = computeFederalTax(input, config);
  const stateResults = computeStateTaxes(input, federalResult);

  it('returns CA state result', () => {
    expect(stateResults.CA).toBeDefined();
    expect(stateResults.CA.stateCode).toBe('CA');
    expect(stateResults.CA.hasIncomeTax).toBe(true);
  });

  it('CA taxable income is positive', () => {
    expect(stateResults.CA.stateTaxableIncome).toBeGreaterThan(0);
  });

  it('CA tax is reasonable for $75k income', () => {
    // CA tax on $75k should be roughly $2,500-$3,500
    expect(stateResults.CA.stateTaxAfterCredits).toBeGreaterThan(200_000); // >$2,000
    expect(stateResults.CA.stateTaxAfterCredits).toBeLessThan(500_000);   // <$5,000
  });

  it('CA effective rate is reasonable', () => {
    expect(stateResults.CA.effectiveRate).toBeGreaterThan(1);
    expect(stateResults.CA.effectiveRate).toBeLessThan(10);
  });

  it('CA state withholding is mapped correctly', () => {
    expect(stateResults.CA.stateWithheld).toBe(300_000);
  });

  it('only one state result returned', () => {
    expect(Object.keys(stateResults)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: NYC resident (NY + NYC local tax)
// ---------------------------------------------------------------------------

describe('Integration: NYC resident ($100k)', () => {
  const input = makeInput({
    filingStatus: 'single',
    stateOfResidence: 'NY',
    w2s: [{
      employerEIN: '98-7654321',
      employerName: 'NYC Corp',
      wages: 10_000_000,
      federalWithheld: 1_500_000,
      socialSecurityWages: 10_000_000,
      socialSecurityWithheld: 620_000,
      medicareWages: 10_000_000,
      medicareWithheld: 145_000,
      stateWages: 10_000_000,
      stateWithheld: 500_000,
      stateCode: 'NY',
      locality: 'NYC',
    }],
  });

  const federalResult = computeFederalTax(input, config);
  const stateResults = computeStateTaxes(input, federalResult);

  it('returns NY state result', () => {
    expect(stateResults.NY).toBeDefined();
    expect(stateResults.NY.stateCode).toBe('NY');
  });

  it('includes NYC local tax', () => {
    expect(stateResults.NY.localTax).toBeGreaterThan(0);
  });

  it('total NY tax includes both NYS and NYC', () => {
    expect(stateResults.NY.stateTaxAfterCredits).toBeGreaterThan(
      stateResults.NY.stateTaxBeforeCredits, // Credits might reduce NYS portion
    );
    // stateTaxAfterCredits includes localTax
  });

  it('NY + NYC combined is reasonable for $100k', () => {
    // Combined NY+NYC tax on $100k should be roughly $5k-$8k
    expect(stateResults.NY.stateTaxAfterCredits).toBeGreaterThan(400_000);
    expect(stateResults.NY.stateTaxAfterCredits).toBeLessThan(1_000_000);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: TX filer (no tax)
// ---------------------------------------------------------------------------

describe('Integration: TX filer ($150k)', () => {
  const input = makeInput({
    filingStatus: 'married_filing_jointly',
    stateOfResidence: 'TX',
    w2s: [{
      employerEIN: '11-2222333',
      employerName: 'Texas Inc',
      wages: 15_000_000,
      federalWithheld: 2_000_000,
      socialSecurityWages: 15_000_000,
      socialSecurityWithheld: 930_000,
      medicareWages: 15_000_000,
      medicareWithheld: 217_500,
      stateWages: 0,
      stateWithheld: 0,
      stateCode: 'TX',
    }],
  });

  const federalResult = computeFederalTax(input, config);
  const stateResults = computeStateTaxes(input, federalResult);

  it('returns TX result with $0 tax', () => {
    expect(stateResults.TX).toBeDefined();
    expect(stateResults.TX.hasIncomeTax).toBe(false);
    expect(stateResults.TX.stateTaxAfterCredits).toBe(0);
    expect(stateResults.TX.stateTaxableIncome).toBe(0);
  });

  it('effective rate is 0%', () => {
    expect(stateResults.TX.effectiveRate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Multi-state
// ---------------------------------------------------------------------------

describe('Integration: Multi-state filer (CA + NY)', () => {
  const input = makeInput({
    filingStatus: 'single',
    stateOfResidence: 'CA',
    additionalStates: ['NY'],
    w2s: [
      {
        employerEIN: '12-3456789',
        employerName: 'CA Corp',
        wages: 5_000_000,
        federalWithheld: 600_000,
        socialSecurityWages: 5_000_000,
        socialSecurityWithheld: 310_000,
        medicareWages: 5_000_000,
        medicareWithheld: 72_500,
        stateWages: 5_000_000,
        stateWithheld: 200_000,
        stateCode: 'CA',
      },
      {
        employerEIN: '98-7654321',
        employerName: 'NY Corp',
        wages: 3_000_000,
        federalWithheld: 400_000,
        socialSecurityWages: 3_000_000,
        socialSecurityWithheld: 186_000,
        medicareWages: 3_000_000,
        medicareWithheld: 43_500,
        stateWages: 3_000_000,
        stateWithheld: 150_000,
        stateCode: 'NY',
      },
    ],
  });

  const federalResult = computeFederalTax(input, config);
  const stateResults = computeStateTaxes(input, federalResult);

  it('returns results for both CA and NY', () => {
    expect(stateResults.CA).toBeDefined();
    expect(stateResults.NY).toBeDefined();
    expect(Object.keys(stateResults)).toHaveLength(2);
  });

  it('CA state wages are filtered to CA W-2s', () => {
    expect(stateResults.CA.stateWithheld).toBe(200_000);
  });

  it('NY state wages are filtered to NY W-2s', () => {
    expect(stateResults.NY.stateWithheld).toBe(150_000);
  });

  it('both states have positive tax', () => {
    expect(stateResults.CA.stateTaxAfterCredits).toBeGreaterThan(0);
    expect(stateResults.NY.stateTaxAfterCredits).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: computeFullReturn combines federal + state
// ---------------------------------------------------------------------------

describe('Integration: computeFullReturn', () => {
  const input = makeInput({
    filingStatus: 'single',
    stateOfResidence: 'VA',
    w2s: [{
      employerEIN: '55-1234567',
      employerName: 'VA Corp',
      wages: 6_000_000,
      federalWithheld: 700_000,
      socialSecurityWages: 6_000_000,
      socialSecurityWithheld: 372_000,
      medicareWages: 6_000_000,
      medicareWithheld: 87_000,
      stateWages: 6_000_000,
      stateWithheld: 200_000,
      stateCode: 'VA',
    }],
  });

  const result = computeFullReturn(input, config);

  it('includes federal results', () => {
    expect(result.totalIncome).toBe(6_000_000);
    expect(result.adjustedGrossIncome).toBe(6_000_000);
    expect(result.totalTax).toBeGreaterThan(0);
  });

  it('includes VA state results', () => {
    expect(result.stateResults.VA).toBeDefined();
    expect(result.stateResults.VA.stateCode).toBe('VA');
    expect(result.stateResults.VA.stateTaxAfterCredits).toBeGreaterThan(0);
  });

  it('state results are properly typed', () => {
    const vaResult = result.stateResults.VA;
    expect(typeof vaResult.stateTaxableIncome).toBe('number');
    expect(typeof vaResult.effectiveRate).toBe('number');
    expect(typeof vaResult.creditBreakdown).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: Unsupported state is silently skipped
// ---------------------------------------------------------------------------

describe('Integration: Unsupported state', () => {
  const input = makeInput({
    stateOfResidence: 'HI', // Hawaii — not supported
  });

  const federalResult = computeFederalTax(input, config);
  const stateResults = computeStateTaxes(input, federalResult);

  it('returns empty results for unsupported state', () => {
    expect(Object.keys(stateResults)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('Property-based: state tax invariants', () => {
  const supportedStates = getSupportedStates();
  const filingStatuses = [
    'single',
    'married_filing_jointly',
    'married_filing_separately',
    'head_of_household',
  ] as const;

  it('tax is always non-negative', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50_000_000 }), // Wages up to $500k
        fc.constantFrom(...supportedStates),
        fc.constantFrom(...filingStatuses),
        (wages, stateCode, filingStatus) => {
          const input = makeInput({
            filingStatus,
            stateOfResidence: stateCode,
            w2s: [{
              employerEIN: '12-3456789',
              employerName: 'Test Corp',
              wages,
              federalWithheld: Math.round(wages * 0.15),
              socialSecurityWages: wages,
              socialSecurityWithheld: Math.round(wages * 0.062),
              medicareWages: wages,
              medicareWithheld: Math.round(wages * 0.0145),
              stateWages: wages,
              stateWithheld: Math.round(wages * 0.05),
              stateCode,
            }],
          });

          const federalResult = computeFederalTax(input, config);
          const stateResults = computeStateTaxes(input, federalResult);

          if (stateResults[stateCode]) {
            expect(stateResults[stateCode].stateTaxAfterCredits).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('effective rate is between 0% and 15% for reasonable incomes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000, max: 50_000_000 }), // $10k to $500k
        fc.constantFrom(...supportedStates),
        (wages, stateCode) => {
          const input = makeInput({
            stateOfResidence: stateCode,
            w2s: [{
              employerEIN: '12-3456789',
              employerName: 'Test Corp',
              wages,
              federalWithheld: Math.round(wages * 0.15),
              socialSecurityWages: wages,
              socialSecurityWithheld: Math.round(wages * 0.062),
              medicareWages: wages,
              medicareWithheld: Math.round(wages * 0.0145),
              stateWages: wages,
              stateWithheld: Math.round(wages * 0.05),
              stateCode,
            }],
          });

          const federalResult = computeFederalTax(input, config);
          const stateResults = computeStateTaxes(input, federalResult);

          if (stateResults[stateCode]) {
            expect(stateResults[stateCode].effectiveRate).toBeGreaterThanOrEqual(0);
            expect(stateResults[stateCode].effectiveRate).toBeLessThan(15);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('no-tax states always return $0 tax', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100_000_000 }),
        fc.constantFrom('TX', 'FL'),
        (wages, stateCode) => {
          const input = makeInput({
            stateOfResidence: stateCode,
            w2s: [{
              employerEIN: '12-3456789',
              employerName: 'Test Corp',
              wages,
              federalWithheld: Math.round(wages * 0.15),
              socialSecurityWages: wages,
              socialSecurityWithheld: Math.round(wages * 0.062),
              medicareWages: wages,
              medicareWithheld: Math.round(wages * 0.0145),
              stateWages: 0,
              stateWithheld: 0,
              stateCode,
            }],
          });

          const federalResult = computeFederalTax(input, config);
          const stateResults = computeStateTaxes(input, federalResult);

          expect(stateResults[stateCode].stateTaxAfterCredits).toBe(0);
          expect(stateResults[stateCode].hasIncomeTax).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// Tests for NYC tax fix — verifying that the NYC checkbox in additionalStates
// properly triggers NYC local tax computation.
//
// Bug: The NYC checkbox on StatePage sets additionalStates: ['NYC'] but this
// was silently ignored because (1) no state module exists for 'NYC' and
// (2) buildStateTaxInput only read locality from W-2 data.
//
// Fix:
//   - buildStateTaxInput overrides locality to 'NYC' when input.additionalStates
//     includes 'NYC' and stateCode is 'NY'
//   - computeStateTaxes skips 'NYC' in the additionalStates loop (it's a locality,
//     not a separate state)
//
// All monetary values are in CENTS.

import { describe, it, expect } from 'vitest';
import { buildStateTaxInput } from '../../src/engine/states/common';
import { computeStateTaxes } from '../../src/engine/states/index';
import { computeFederalTax } from '../../src/engine/federal/index';
import { newYork } from '../../src/engine/states/new-york';
import type { TaxInput, TaxResult, FederalConfig } from '../../src/engine/types';
import type { StateConfig } from '../../src/engine/states/interface';
import federalConfig from '../../config/federal-2025.json';
import nyConfigJson from '../../config/states/state-NY-2025.json';

const fedConfig = federalConfig as unknown as FederalConfig;
const nyConfig = nyConfigJson as unknown as StateConfig;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBaseTaxInput(overrides: Partial<TaxInput> = {}): TaxInput {
  return {
    taxYear: 2025,
    filingStatus: 'single',
    taxpayer: {
      firstName: 'Alice',
      lastName: 'Smith',
      ssn: '111-22-3333',
      dateOfBirth: '1990-05-15',
    },
    dependents: [],
    address: {
      street: '456 Broadway',
      city: 'New York',
      state: 'NY',
      zip: '10013',
    },
    w2s: [
      {
        employerEIN: '99-8877665',
        employerName: 'NYC Employer',
        wages: 10_000_000, // $100,000
        federalWithheld: 1_500_000,
        socialSecurityWages: 10_000_000,
        socialSecurityWithheld: 620_000,
        medicareWages: 10_000_000,
        medicareWithheld: 145_000,
        stateWages: 10_000_000,
        stateWithheld: 500_000,
        stateCode: 'NY',
        // NOTE: no locality field — simulates a W-2 without NYC locality
      },
    ],
    form1099INTs: [],
    form1099DIVs: [],
    form1099Bs: [],
    form1099NECs: [],
    form1099Gs: [],
    form1099Rs: [],
    form1099Ks: [],
    estimatedTaxPayments: 0,
    useItemizedDeductions: false,
    stateOfResidence: 'NY',
    ...overrides,
  };
}

function makeFederalResult(input: TaxInput): TaxResult {
  return computeFederalTax(input, fedConfig);
}

// ---------------------------------------------------------------------------
// Test 1: buildStateTaxInput locality override
// ---------------------------------------------------------------------------

describe('buildStateTaxInput — NYC locality override', () => {
  it('sets locality to NYC when additionalStates includes NYC, even without W-2 locality', () => {
    const input = makeBaseTaxInput({
      additionalStates: ['NYC'],
    });
    const federalResult = makeFederalResult(input);
    const stateInput = buildStateTaxInput(input, federalResult, 'NY');

    expect(stateInput.locality).toBe('NYC');
  });

  it('preserves W-2 locality when no additionalStates', () => {
    const input = makeBaseTaxInput({
      w2s: [
        {
          employerEIN: '99-8877665',
          employerName: 'NYC Employer',
          wages: 10_000_000,
          federalWithheld: 1_500_000,
          socialSecurityWages: 10_000_000,
          socialSecurityWithheld: 620_000,
          medicareWages: 10_000_000,
          medicareWithheld: 145_000,
          stateWages: 10_000_000,
          stateWithheld: 500_000,
          stateCode: 'NY',
          locality: 'Albany',
        },
      ],
    });
    const federalResult = makeFederalResult(input);
    const stateInput = buildStateTaxInput(input, federalResult, 'NY');

    expect(stateInput.locality).toBe('Albany');
  });

  it('overrides W-2 locality with NYC when additionalStates includes NYC', () => {
    const input = makeBaseTaxInput({
      additionalStates: ['NYC'],
      w2s: [
        {
          employerEIN: '99-8877665',
          employerName: 'NYC Employer',
          wages: 10_000_000,
          federalWithheld: 1_500_000,
          socialSecurityWages: 10_000_000,
          socialSecurityWithheld: 620_000,
          medicareWages: 10_000_000,
          medicareWithheld: 145_000,
          stateWages: 10_000_000,
          stateWithheld: 500_000,
          stateCode: 'NY',
          locality: 'Yonkers', // Not NYC, but checkbox overrides
        },
      ],
    });
    const federalResult = makeFederalResult(input);
    const stateInput = buildStateTaxInput(input, federalResult, 'NY');

    expect(stateInput.locality).toBe('NYC');
  });

  it('does not set NYC locality for non-NY states', () => {
    const input = makeBaseTaxInput({
      stateOfResidence: 'CA',
      additionalStates: ['NYC'], // Shouldn't affect CA
      w2s: [
        {
          employerEIN: '12-3456789',
          employerName: 'CA Corp',
          wages: 10_000_000,
          federalWithheld: 1_500_000,
          socialSecurityWages: 10_000_000,
          socialSecurityWithheld: 620_000,
          medicareWages: 10_000_000,
          medicareWithheld: 145_000,
          stateWages: 10_000_000,
          stateWithheld: 400_000,
          stateCode: 'CA',
        },
      ],
    });
    const federalResult = makeFederalResult(input);
    const stateInput = buildStateTaxInput(input, federalResult, 'CA');

    expect(stateInput.locality).toBeUndefined();
  });

  it('returns undefined locality when no W-2 locality and no additionalStates', () => {
    const input = makeBaseTaxInput();
    const federalResult = makeFederalResult(input);
    const stateInput = buildStateTaxInput(input, federalResult, 'NY');

    expect(stateInput.locality).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Test 2: computeStateTaxes does NOT create a separate result for 'NYC'
// ---------------------------------------------------------------------------

describe('computeStateTaxes — NYC is not a separate state', () => {
  it('does not create a result keyed by NYC', () => {
    const input = makeBaseTaxInput({
      additionalStates: ['NYC'],
    });
    const federalResult = makeFederalResult(input);
    const results = computeStateTaxes(input, federalResult);

    expect(results['NYC']).toBeUndefined();
    expect(results['NY']).toBeDefined();
    expect(Object.keys(results)).toHaveLength(1);
  });

  it('still processes other additional states normally', () => {
    const input = makeBaseTaxInput({
      additionalStates: ['NYC', 'CA'],
      w2s: [
        {
          employerEIN: '99-8877665',
          employerName: 'NYC Employer',
          wages: 7_000_000,
          federalWithheld: 1_000_000,
          socialSecurityWages: 7_000_000,
          socialSecurityWithheld: 434_000,
          medicareWages: 7_000_000,
          medicareWithheld: 101_500,
          stateWages: 7_000_000,
          stateWithheld: 350_000,
          stateCode: 'NY',
        },
        {
          employerEIN: '12-3456789',
          employerName: 'CA Corp',
          wages: 3_000_000,
          federalWithheld: 400_000,
          socialSecurityWages: 3_000_000,
          socialSecurityWithheld: 186_000,
          medicareWages: 3_000_000,
          medicareWithheld: 43_500,
          stateWages: 3_000_000,
          stateWithheld: 150_000,
          stateCode: 'CA',
        },
      ],
    });
    const federalResult = makeFederalResult(input);
    const results = computeStateTaxes(input, federalResult);

    expect(results['NY']).toBeDefined();
    expect(results['CA']).toBeDefined();
    expect(results['NYC']).toBeUndefined();
    expect(Object.keys(results)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Integration — full computation with NYC checkbox produces nycTax > 0
// ---------------------------------------------------------------------------

describe('Integration: NYC checkbox triggers NYC local tax', () => {
  it('NYC checkbox with no W-2 locality produces nycTax > 0', () => {
    const input = makeBaseTaxInput({
      additionalStates: ['NYC'],
    });
    const federalResult = makeFederalResult(input);
    const results = computeStateTaxes(input, federalResult);

    expect(results['NY']).toBeDefined();
    expect(results['NY'].localTax).toBeGreaterThan(0);
    expect(results['NY'].formData.nycTax).toBeGreaterThan(0);
    expect(results['NY'].formData.locality).toBe('NYC');
  });

  it('without NYC checkbox and no W-2 locality, nycTax is 0', () => {
    const input = makeBaseTaxInput();
    const federalResult = makeFederalResult(input);
    const results = computeStateTaxes(input, federalResult);

    expect(results['NY']).toBeDefined();
    expect(results['NY'].localTax).toBe(0);
  });

  it('NYC tax amount is reasonable for $100k income', () => {
    const input = makeBaseTaxInput({
      additionalStates: ['NYC'],
    });
    const federalResult = makeFederalResult(input);
    const results = computeStateTaxes(input, federalResult);

    // Taxable income = $100,000 - $8,000 std ded = $92,000
    // NYC tax on $92,000 should be roughly $2,800-$3,200
    expect(results['NY'].localTax).toBeGreaterThan(200_000); // > $2,000
    expect(results['NY'].localTax).toBeLessThan(400_000);   // < $4,000
  });

  it('NYC checkbox matches W-2 locality behavior', () => {
    // Scenario A: locality comes from checkbox
    const inputCheckbox = makeBaseTaxInput({
      additionalStates: ['NYC'],
    });
    const fedA = makeFederalResult(inputCheckbox);
    const resultsA = computeStateTaxes(inputCheckbox, fedA);

    // Scenario B: locality comes from W-2
    const inputW2 = makeBaseTaxInput({
      w2s: [
        {
          employerEIN: '99-8877665',
          employerName: 'NYC Employer',
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
        },
      ],
    });
    const fedB = makeFederalResult(inputW2);
    const resultsB = computeStateTaxes(inputW2, fedB);

    // Both should produce the same NYC local tax
    expect(resultsA['NY'].localTax).toBe(resultsB['NY'].localTax);
    expect(resultsA['NY'].localTax).toBeGreaterThan(0);
  });

  it('combined NYS + NYC tax for single $100k filer is in expected range', () => {
    const input = makeBaseTaxInput({
      additionalStates: ['NYC'],
    });
    const federalResult = makeFederalResult(input);
    const results = computeStateTaxes(input, federalResult);

    // NYS + NYC combined on $100k should be roughly $5,500-$8,500
    expect(results['NY'].stateTaxAfterCredits).toBeGreaterThan(500_000); // > $5,000
    expect(results['NY'].stateTaxAfterCredits).toBeLessThan(900_000);   // < $9,000
  });
});

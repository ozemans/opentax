// Tests for src/engine/federal/brackets.ts
// Written FIRST per TDD — implementation follows.
//
// All monetary values are in CENTS. $50,000 = 5_000_000 cents.
// Hand-computed expected values verified against IRS 2025 tax tables.
//
// Source: Rev. Proc. 2024-40 §3.01(1)(a) — 2025 bracket thresholds
// Source: IRS.gov/filing/federal-income-tax-rates-and-brackets
// Verified: 2026-02-25

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  computeOrdinaryTax,
  computeQualifiedDividendAndCapGainTax,
  getMarginalRate,
} from '../../src/engine/federal/brackets';
import type { FilingStatus, FederalConfig } from '../../src/engine/types';
import config from '../../config/federal-2025.json';

// Cast the JSON config to FederalConfig for type safety
const federalConfig = config as unknown as FederalConfig;

// ───────────────────────────────────────────────────────────────────────────
// Helper: all filing statuses for exhaustive testing
// ───────────────────────────────────────────────────────────────────────────
const allStatuses: FilingStatus[] = [
  'single',
  'married_filing_jointly',
  'married_filing_separately',
  'head_of_household',
  'qualifying_surviving_spouse',
];

// ───────────────────────────────────────────────────────────────────────────
// computeOrdinaryTax
// ───────────────────────────────────────────────────────────────────────────
describe('computeOrdinaryTax', () => {
  // --- Zero income --------------------------------------------------------
  describe('zero income', () => {
    it.each(allStatuses)(
      'returns $0 tax for $0 income — %s',
      (status) => {
        expect(computeOrdinaryTax(0, status, federalConfig)).toBe(0);
      },
    );
  });

  // --- Income entirely within the 10% bracket ----------------------------
  describe('income entirely within 10% bracket', () => {
    it('single: $10,000 income (1_000_000 cents) → $1,000 tax', () => {
      // 1_000_000 * 0.10 = 100_000
      expect(computeOrdinaryTax(1_000_000, 'single', federalConfig)).toBe(100_000);
    });

    it('MFJ: $20,000 income (2_000_000 cents) → $2,000 tax', () => {
      // 2_000_000 * 0.10 = 200_000
      expect(computeOrdinaryTax(2_000_000, 'married_filing_jointly', federalConfig)).toBe(200_000);
    });

    it('HoH: $15,000 income (1_500_000 cents) → $1,500 tax', () => {
      // 1_500_000 * 0.10 = 150_000
      expect(computeOrdinaryTax(1_500_000, 'head_of_household', federalConfig)).toBe(150_000);
    });
  });

  // --- Income crossing multiple brackets ---------------------------------
  describe('income crossing multiple brackets', () => {
    it('single: $50,000 income crosses into 22% bracket', () => {
      // 10% on first 1_192_500 = 119_250
      // 12% on (4_847_500 - 1_192_500) = 3_655_000 * 0.12 = 438_600
      // 22% on (5_000_000 - 4_847_500) = 152_500 * 0.22 = 33_550
      // Total = 119_250 + 438_600 + 33_550 = 591_400
      expect(computeOrdinaryTax(5_000_000, 'single', federalConfig)).toBe(591_400);
    });

    it('MFJ: $150,000 income crosses into 22% bracket', () => {
      // 10% on 2_385_000 = 238_500
      // 12% on (9_695_000 - 2_385_000) = 7_310_000 * 0.12 = 877_200
      // 22% on (15_000_000 - 9_695_000) = 5_305_000 * 0.22 = 1_167_100
      // Total = 238_500 + 877_200 + 1_167_100 = 2_282_800
      expect(computeOrdinaryTax(15_000_000, 'married_filing_jointly', federalConfig)).toBe(2_282_800);
    });

    it('HoH: $75,000 income crosses into 22% bracket', () => {
      // 10% on 1_700_000 = 170_000
      // 12% on (6_485_000 - 1_700_000) = 4_785_000 * 0.12 = 574_200
      // 22% on (7_500_000 - 6_485_000) = 1_015_000 * 0.22 = 223_300
      // Total = 170_000 + 574_200 + 223_300 = 967_500
      expect(computeOrdinaryTax(7_500_000, 'head_of_household', federalConfig)).toBe(967_500);
    });
  });

  // --- Exact bracket boundaries ------------------------------------------
  describe('exact bracket boundaries', () => {
    it('single: exactly at 10%/12% boundary ($11,925 = 1_192_500 cents)', () => {
      // Entirely 10%: 1_192_500 * 0.10 = 119_250
      expect(computeOrdinaryTax(1_192_500, 'single', federalConfig)).toBe(119_250);
    });

    it('single: $1 over 10%/12% boundary (1_192_501 cents)', () => {
      // 10% on 1_192_500 = 119_250
      // 12% on 1 cent = 0 (rounded)
      // Actually 1 * 0.12 = 0.12 → Math.round(0.12) = 0
      // BUT we need to think about how we accumulate. The function should
      // compute tax on each bracket portion exactly.
      // Tax = 119_250 + Math.round(1 * 0.12) = 119_250 + 0 = 119_250
      // Wait — need to reconsider. We should compute each bracket's tax
      // as Math.round(amount * rate) since we're working in cents.
      // Actually, the standard approach is to sum the exact amounts and
      // only round at the end, since IRS rounds to nearest dollar.
      // 1_192_500 * 0.10 + 1 * 0.12 = 119_250 + 0.12 = 119_250.12
      // Math.round(119_250.12) = 119_250
      expect(computeOrdinaryTax(1_192_501, 'single', federalConfig)).toBe(119_250);
    });

    it('MFJ: exactly at 10%/12% boundary ($23,850 = 2_385_000 cents)', () => {
      // 2_385_000 * 0.10 = 238_500
      expect(computeOrdinaryTax(2_385_000, 'married_filing_jointly', federalConfig)).toBe(238_500);
    });

    it('single: exactly at 12%/22% boundary ($48,475 = 4_847_500 cents)', () => {
      // 10% on 1_192_500 = 119_250
      // 12% on (4_847_500 - 1_192_500) = 3_655_000 * 0.12 = 438_600
      // Total = 119_250 + 438_600 = 557_850
      expect(computeOrdinaryTax(4_847_500, 'single', federalConfig)).toBe(557_850);
    });
  });

  // --- Very high income (37% bracket) ------------------------------------
  describe('very high income in 37% bracket', () => {
    it('single: $700,000 income', () => {
      // 10% on 1_192_500                     = 119_250
      // 12% on (4_847_500 - 1_192_500)       = 3_655_000 * 0.12 = 438_600
      // 22% on (10_335_000 - 4_847_500)      = 5_487_500 * 0.22 = 1_207_250
      // 24% on (19_730_000 - 10_335_000)     = 9_395_000 * 0.24 = 2_254_800
      // 32% on (25_052_500 - 19_730_000)     = 5_322_500 * 0.32 = 1_703_200
      // 35% on (62_635_000 - 25_052_500)     = 37_582_500 * 0.35 = 13_153_875
      // 37% on (70_000_000 - 62_635_000)     = 7_365_000 * 0.37 = 2_725_050
      // Total = 119_250 + 438_600 + 1_207_250 + 2_254_800 + 1_703_200
      //       + 13_153_875 + 2_725_050 = 21_602_025
      expect(computeOrdinaryTax(70_000_000, 'single', federalConfig)).toBe(21_602_025);
    });

    it('MFJ: $1,000,000 income', () => {
      // 10% on 2_385_000                     = 238_500
      // 12% on (9_695_000 - 2_385_000)       = 7_310_000 * 0.12 = 877_200
      // 22% on (20_670_000 - 9_695_000)      = 10_975_000 * 0.22 = 2_414_500
      // 24% on (39_460_000 - 20_670_000)     = 18_790_000 * 0.24 = 4_509_600
      // 32% on (50_105_000 - 39_460_000)     = 10_645_000 * 0.32 = 3_406_400
      // 35% on (75_160_000 - 50_105_000)     = 25_055_000 * 0.35 = 8_769_250
      // 37% on (100_000_000 - 75_160_000)    = 24_840_000 * 0.37 = 9_190_800
      // Total = 238_500 + 877_200 + 2_414_500 + 4_509_600 + 3_406_400
      //       + 8_769_250 + 9_190_800 = 29_406_250
      expect(computeOrdinaryTax(100_000_000, 'married_filing_jointly', federalConfig)).toBe(29_406_250);
    });
  });

  // --- All 5 filing statuses at the same income --------------------------
  describe('all filing statuses at $100,000 income (10_000_000 cents)', () => {
    it('single: $100,000', () => {
      // 10% on 1_192_500                     = 119_250
      // 12% on (4_847_500 - 1_192_500)       = 3_655_000 * 0.12 = 438_600
      // 22% on (10_000_000 - 4_847_500)      = 5_152_500 * 0.22 = 1_133_550
      // Total = 119_250 + 438_600 + 1_133_550 = 1_691_400
      expect(computeOrdinaryTax(10_000_000, 'single', federalConfig)).toBe(1_691_400);
    });

    it('married_filing_jointly: $100,000', () => {
      // 10% on 2_385_000                     = 238_500
      // 12% on (9_695_000 - 2_385_000)       = 7_310_000 * 0.12 = 877_200
      // 22% on (10_000_000 - 9_695_000)      = 305_000 * 0.22 = 67_100
      // Total = 238_500 + 877_200 + 67_100 = 1_182_800
      expect(computeOrdinaryTax(10_000_000, 'married_filing_jointly', federalConfig)).toBe(1_182_800);
    });

    it('married_filing_separately: $100,000', () => {
      // Same brackets as single for MFS in 2025
      // 10% on 1_192_500                     = 119_250
      // 12% on (4_847_500 - 1_192_500)       = 3_655_000 * 0.12 = 438_600
      // 22% on (10_000_000 - 4_847_500)      = 5_152_500 * 0.22 = 1_133_550
      // Total = 119_250 + 438_600 + 1_133_550 = 1_691_400
      expect(computeOrdinaryTax(10_000_000, 'married_filing_separately', federalConfig)).toBe(1_691_400);
    });

    it('head_of_household: $100,000', () => {
      // 10% on 1_700_000                     = 170_000
      // 12% on (6_485_000 - 1_700_000)       = 4_785_000 * 0.12 = 574_200
      // 22% on (10_000_000 - 6_485_000)      = 3_515_000 * 0.22 = 773_300
      // Total = 170_000 + 574_200 + 773_300 = 1_517_500
      expect(computeOrdinaryTax(10_000_000, 'head_of_household', federalConfig)).toBe(1_517_500);
    });

    it('qualifying_surviving_spouse: $100,000 (same brackets as MFJ)', () => {
      // Same brackets as MFJ
      // Total = 238_500 + 877_200 + 67_100 = 1_182_800
      expect(computeOrdinaryTax(10_000_000, 'qualifying_surviving_spouse', federalConfig)).toBe(1_182_800);
    });
  });

  // --- Negative/invalid input --------------------------------------------
  describe('edge cases', () => {
    it('negative income returns $0 tax', () => {
      expect(computeOrdinaryTax(-1_000_000, 'single', federalConfig)).toBe(0);
    });

    it('very small income: $1 (100 cents)', () => {
      // 100 * 0.10 = 10
      expect(computeOrdinaryTax(100, 'single', federalConfig)).toBe(10);
    });
  });

  // --- Property-based tests with fast-check ------------------------------
  describe('property-based tests', () => {
    it('tax is always non-negative', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 200_000_000 }),
          fc.constantFrom(...allStatuses),
          (income, status) => {
            expect(computeOrdinaryTax(income, status, federalConfig)).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('tax is monotonically non-decreasing with income', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100_000_000 }),
          fc.integer({ min: 0, max: 100_000_000 }),
          fc.constantFrom(...allStatuses),
          (a, b, status) => {
            const low = Math.min(a, b);
            const high = Math.max(a, b);
            expect(computeOrdinaryTax(high, status, federalConfig))
              .toBeGreaterThanOrEqual(computeOrdinaryTax(low, status, federalConfig));
          },
        ),
        { numRuns: 500 },
      );
    });

    it('effective tax rate never exceeds 37%', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 500_000_000 }),
          fc.constantFrom(...allStatuses),
          (income, status) => {
            const tax = computeOrdinaryTax(income, status, federalConfig);
            expect(tax / income).toBeLessThanOrEqual(0.37);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('tax is less than income', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 500_000_000 }),
          fc.constantFrom(...allStatuses),
          (income, status) => {
            const tax = computeOrdinaryTax(income, status, federalConfig);
            expect(tax).toBeLessThan(income);
          },
        ),
        { numRuns: 500 },
      );
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// getMarginalRate
// ───────────────────────────────────────────────────────────────────────────
describe('getMarginalRate', () => {
  it('returns 0.10 for $0 income (first bracket)', () => {
    expect(getMarginalRate(0, 'single', federalConfig)).toBe(0.10);
  });

  it('returns 0.10 for income within 10% bracket', () => {
    expect(getMarginalRate(500_000, 'single', federalConfig)).toBe(0.10);
  });

  it('returns 0.12 for income in 12% bracket (single)', () => {
    expect(getMarginalRate(2_000_000, 'single', federalConfig)).toBe(0.12);
  });

  it('returns 0.22 for income in 22% bracket (single)', () => {
    expect(getMarginalRate(5_000_000, 'single', federalConfig)).toBe(0.22);
  });

  it('returns 0.24 for income in 24% bracket (single)', () => {
    expect(getMarginalRate(15_000_000, 'single', federalConfig)).toBe(0.24);
  });

  it('returns 0.32 for income in 32% bracket (single)', () => {
    expect(getMarginalRate(20_000_000, 'single', federalConfig)).toBe(0.32);
  });

  it('returns 0.35 for income in 35% bracket (single)', () => {
    expect(getMarginalRate(30_000_000, 'single', federalConfig)).toBe(0.35);
  });

  it('returns 0.37 for income in 37% bracket (single)', () => {
    expect(getMarginalRate(70_000_000, 'single', federalConfig)).toBe(0.37);
  });

  it('returns correct rate at exact bracket boundaries', () => {
    // At exactly the boundary, income is in the bracket whose min equals that value
    // Single: 10%/12% boundary is at 1_192_500
    // Income of 1_192_500 means the next dollar goes to 12%
    expect(getMarginalRate(1_192_500, 'single', federalConfig)).toBe(0.12);
  });

  it('MFJ: returns 0.10 for income in first bracket', () => {
    expect(getMarginalRate(1_000_000, 'married_filing_jointly', federalConfig)).toBe(0.10);
  });

  it('MFJ: returns 0.22 for $100,000 income', () => {
    // MFJ 22% bracket: 9_695_000 to 20_670_000
    expect(getMarginalRate(10_000_000, 'married_filing_jointly', federalConfig)).toBe(0.22);
  });

  it('HoH: returns 0.12 for $30,000 income', () => {
    // HoH 12% bracket: 1_700_000 to 6_485_000
    expect(getMarginalRate(3_000_000, 'head_of_household', federalConfig)).toBe(0.12);
  });

  it('returns 0.10 for $0 income regardless of filing status', () => {
    for (const status of allStatuses) {
      expect(getMarginalRate(0, status, federalConfig)).toBe(0.10);
    }
  });

  it('returns 0.37 for very high income regardless of filing status', () => {
    for (const status of allStatuses) {
      expect(getMarginalRate(200_000_000, status, federalConfig)).toBe(0.37);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// computeQualifiedDividendAndCapGainTax
// ───────────────────────────────────────────────────────────────────────────
describe('computeQualifiedDividendAndCapGainTax', () => {
  // --- All ordinary income (no preferential income) ----------------------
  describe('all ordinary income', () => {
    it('returns same as computeOrdinaryTax when no preferential income', () => {
      const taxableIncome = 10_000_000; // $100,000
      const ordinaryTax = computeOrdinaryTax(taxableIncome, 'single', federalConfig);
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome,
        ordinaryIncome: taxableIncome,
        qualifiedDividends: 0,
        netLTCG: 0,
        collectiblesGain: 0,
        section1250Gain: 0,
        filingStatus: 'single',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(ordinaryTax);
    });
  });

  // --- Ordinary income + LTCG at 0% rate ---------------------------------
  describe('LTCG in the 0% rate zone', () => {
    it('single: $40,000 income all from LTCG pays $0 tax', () => {
      // Single 0% cap gains threshold: 4_835_000
      // $40,000 = 4_000_000 cents — entirely within 0% zone
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome: 4_000_000,
        ordinaryIncome: 0,
        qualifiedDividends: 0,
        netLTCG: 4_000_000,
        collectiblesGain: 0,
        section1250Gain: 0,
        filingStatus: 'single',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(0);
    });
  });

  // --- Mix of ordinary income + LTCG --------------------------------------
  describe('mixed ordinary income and LTCG', () => {
    it('single: $30,000 ordinary + $20,000 LTCG', () => {
      // taxableIncome = 5_000_000 (50,000 total)
      // ordinaryIncome = 3_000_000
      // netLTCG = 2_000_000
      //
      // IRS Qualified Dividends and Capital Gain Tax Worksheet logic:
      // Line 1: taxableIncome = 5_000_000
      // Line 2: qualifiedDividends = 0
      // Line 3: netLTCG = 2_000_000 (Form 1040, line 7 = Schedule D line 15 if > 0)
      // Line 4: sum of lines 2+3 = 2_000_000
      // Line 5: taxableIncome - line 4 = 5_000_000 - 2_000_000 = 3_000_000 (ordinary portion)
      // Line 6: 0% cap gains threshold single = 4_835_000
      // Line 7: min(line 1, line 6) = min(5_000_000, 4_835_000) = 4_835_000
      // Line 8: min(line 5, line 7) = min(3_000_000, 4_835_000) = 3_000_000
      // Line 9: line 7 - line 8 = 4_835_000 - 3_000_000 = 1_835_000 (LTCG taxed at 0%)
      // Line 10: min(line 1, line 4) = min(5_000_000, 2_000_000) = 2_000_000
      // Line 11: line 9 = 1_835_000
      // Line 12: line 10 - line 11 = 2_000_000 - 1_835_000 = 165_000 (LTCG taxed at 15%)
      // Line 13: 15% cap gains threshold single = 53_340_000
      // Line 14: min(line 1, line 13) = min(5_000_000, 53_340_000) = 5_000_000
      // Line 15: line 5 + line 9 = 3_000_000 + 1_835_000 = 4_835_000
      // Line 16: line 14 - line 15 = 5_000_000 - 4_835_000 = 165_000
      // Line 17: min(line 12, line 16) = min(165_000, 165_000) = 165_000
      // Line 18: line 17 * 0.15 = 24_750
      // Line 19: line 9 + line 17 = 1_835_000 + 165_000 = 2_000_000
      // Line 20: line 10 - line 19 = 2_000_000 - 2_000_000 = 0 (20% portion)
      // Line 21: line 20 * 0.20 = 0
      // Line 22: tax on line 5 (ordinary portion = 3_000_000) at ordinary rates
      //          = 1_192_500 * 0.10 + (3_000_000 - 1_192_500) * 0.12
      //          = 119_250 + 1_807_500 * 0.12 = 119_250 + 216_900 = 336_150
      // Line 23: line 18 + line 21 + line 22 = 24_750 + 0 + 336_150 = 360_900
      // Line 24: tax on full taxableIncome at ordinary rates = 591_400
      // Line 25: min(line 23, line 24) = min(360_900, 591_400) = 360_900
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome: 5_000_000,
        ordinaryIncome: 3_000_000,
        qualifiedDividends: 0,
        netLTCG: 2_000_000,
        collectiblesGain: 0,
        section1250Gain: 0,
        filingStatus: 'single',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(360_900);
    });
  });

  // --- Qualified dividends -----------------------------------------------
  describe('qualified dividends', () => {
    it('single: $40,000 ordinary + $10,000 qualified dividends', () => {
      // taxableIncome = 5_000_000
      // ordinaryIncome = 4_000_000 (wages)
      // qualifiedDividends = 1_000_000
      // netLTCG = 0
      //
      // Line 4: qualifiedDividends + netLTCG = 1_000_000
      // Line 5: 5_000_000 - 1_000_000 = 4_000_000 (ordinary portion)
      // Line 6: 0% threshold = 4_835_000
      // Line 7: min(5_000_000, 4_835_000) = 4_835_000
      // Line 8: min(4_000_000, 4_835_000) = 4_000_000
      // Line 9: 4_835_000 - 4_000_000 = 835_000 (QD at 0%)
      // Line 10: min(5_000_000, 1_000_000) = 1_000_000
      // Line 11: 835_000
      // Line 12: 1_000_000 - 835_000 = 165_000 (QD at 15%)
      // Line 13: 15% threshold = 53_340_000
      // Line 14: min(5_000_000, 53_340_000) = 5_000_000
      // Line 15: 4_000_000 + 835_000 = 4_835_000
      // Line 16: 5_000_000 - 4_835_000 = 165_000
      // Line 17: min(165_000, 165_000) = 165_000
      // Line 18: 165_000 * 0.15 = 24_750
      // Line 19: 835_000 + 165_000 = 1_000_000
      // Line 20: 1_000_000 - 1_000_000 = 0
      // Line 21: 0
      // Line 22: tax on 4_000_000 = 1_192_500*0.10 + (4_000_000-1_192_500)*0.12
      //          = 119_250 + 2_807_500 * 0.12 = 119_250 + 336_900 = 456_150
      // Line 23: 24_750 + 0 + 456_150 = 480_900
      // Line 24: full ordinary = 591_400
      // Result: min(480_900, 591_400) = 480_900
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome: 5_000_000,
        ordinaryIncome: 4_000_000,
        qualifiedDividends: 1_000_000,
        netLTCG: 0,
        collectiblesGain: 0,
        section1250Gain: 0,
        filingStatus: 'single',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(480_900);
    });
  });

  // --- Collectibles gain at 28% max rate ---------------------------------
  describe('collectibles gain', () => {
    it('single: $50,000 ordinary + $10,000 collectibles gain', () => {
      // taxableIncome = 6_000_000
      // ordinaryIncome = 5_000_000
      // collectiblesGain = 1_000_000
      // netLTCG = 1_000_000 (collectibles are a subset of LTCG)
      //
      // The worksheet handles collectibles separately:
      // Collectibles are taxed at min(marginal ordinary rate, 28%).
      // For someone at $60k total income, marginal rate is 22%.
      // So collectibles would be taxed at 22% (less than 28% cap).
      //
      // Actually, the IRS worksheet for collectibles (Schedule D Tax Worksheet)
      // taxes collectibles at the lesser of 28% or the ordinary rate that
      // would apply. Since the 28% cap means collectibles get their own treatment:
      //
      // Approach: ordinary portion taxed at ordinary rates, collectibles at
      // min(28%, applicable rate), remaining LTCG at preferential rates.
      //
      // For this test: $50k ordinary + $10k collectibles
      // Ordinary portion: $50k → ordinary tax = 591_400
      // Collectibles: taxed at min(28%, marginal rate on next $10k)
      //   At $50k (single), we're in the 22% bracket
      //   So collectibles taxed at 22% (less than 28%)
      //   $10k * 22% = 220_000
      //   But this isn't quite right — need to use proper Schedule D worksheet
      //
      // Let me re-compute using the Schedule D Tax Worksheet approach:
      //
      // Adjusted net capital gain = netLTCG - collectiblesGain - section1250Gain + remaining
      // For just collectibles, the adjusted net cap gain for preferential rates = 0
      //
      // Step 1: Tax on ordinary income portion = tax on 5_000_000
      //         = 591_400 (from earlier computation)
      // Wait — the ordinary income is actually the total taxable income minus
      // all cap gains/QD. ordinaryIncome = 5_000_000 here.
      //
      // Step 2: Collectibles are taxed at min(28%, rate that would apply).
      //         The rate that would apply is determined by stacking on top of
      //         the ordinary income.
      //
      // Collectibles gain = 1_000_000, stacking from 5_000_000 to 6_000_000
      // At 5_000_000 we're in 22% bracket (bracket goes to 10_335_000)
      // So the entire 1_000_000 is at 22%, which is < 28%
      // Collectibles tax = 1_000_000 * 0.22 = 220_000
      //
      // No preferential-rate LTCG in this scenario
      //
      // Total via worksheet: 591_400 (ordinary) + 220_000 (collectibles) = 811_400
      //                      (no 0%/15%/20% LTCG, no QD)
      //
      // Ordinary tax on full 6_000_000:
      //   10% on 1_192_500 = 119_250
      //   12% on 3_655_000 = 438_600
      //   22% on (6_000_000 - 4_847_500) = 1_152_500 * 0.22 = 253_550
      //   = 119_250 + 438_600 + 253_550 = 811_400
      //
      // min(811_400, 811_400) = 811_400
      // In this case the two methods give the same result because the
      // collectibles rate (22%) equals the ordinary rate in that bracket.
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome: 6_000_000,
        ordinaryIncome: 5_000_000,
        qualifiedDividends: 0,
        netLTCG: 1_000_000,
        collectiblesGain: 1_000_000,
        section1250Gain: 0,
        filingStatus: 'single',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(811_400);
    });

    it('single: high income where collectibles 28% cap applies', () => {
      // $400,000 ordinary income + $100,000 collectibles
      // At $400k ordinary (40_000_000), we're in 35% bracket
      //   single 35% bracket: 25_052_500 to 62_635_000
      // Collectibles: 10_000_000, stacking from 40_000_000 to 50_000_000
      //   Still in 35% bracket, but 28% cap kicks in
      //   Collectibles tax = 10_000_000 * 0.28 = 2_800_000
      //
      // Tax on ordinary 40_000_000:
      //   10% on 1_192_500                  = 119_250
      //   12% on 3_655_000                  = 438_600
      //   22% on 5_487_500                  = 1_207_250
      //   24% on 9_395_000                  = 2_254_800
      //   32% on 5_322_500                  = 1_703_200
      //   35% on (40_000_000 - 25_052_500)  = 14_947_500 * 0.35 = 5_231_625
      //   Total = 119_250 + 438_600 + 1_207_250 + 2_254_800 + 1_703_200 + 5_231_625 = 10_954_725
      //
      // Worksheet total: 10_954_725 + 2_800_000 = 13_754_725
      //
      // Ordinary tax on full 50_000_000:
      //   ...through 35% bracket up to 50_000_000
      //   35% on (50_000_000 - 25_052_500) = 24_947_500 * 0.35 = 8_731_625
      //   Total = 119_250 + 438_600 + 1_207_250 + 2_254_800 + 1_703_200 + 8_731_625 = 14_454_725
      //
      // min(13_754_725, 14_454_725) = 13_754_725
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome: 50_000_000,
        ordinaryIncome: 40_000_000,
        qualifiedDividends: 0,
        netLTCG: 10_000_000,
        collectiblesGain: 10_000_000,
        section1250Gain: 0,
        filingStatus: 'single',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(13_754_725);
    });

    it('single: 10% bracket filer with collectibles taxed at 10% (min of 28% and marginal)', () => {
      // $5,000 ordinary income + $2,000 collectibles = $7,000 total
      // Entire income is in the 10% bracket (below $11,925 threshold)
      // collectibles rate = min(28%, 10%) = 10%
      // collectibles tax = 200_000 * 0.10 = 20_000
      // ordinary tax = 500_000 * 0.10 = 50_000
      // total = 70_000
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome: 700_000,
        ordinaryIncome: 500_000,
        qualifiedDividends: 0,
        netLTCG: 200_000,
        collectiblesGain: 200_000,
        section1250Gain: 0,
        filingStatus: 'single',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(70_000);
    });
  });

  // --- Section 1250 gain at 25% max rate ---------------------------------
  describe('section 1250 (unrecaptured) gain', () => {
    it('single: $50,000 ordinary + $10,000 section 1250 gain', () => {
      // At $50k ordinary, marginal rate is 22% — less than 25% cap
      // So section 1250 is taxed at 22%
      // Same result as ordinary on the full amount: 811_400
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome: 6_000_000,
        ordinaryIncome: 5_000_000,
        qualifiedDividends: 0,
        netLTCG: 1_000_000,
        collectiblesGain: 0,
        section1250Gain: 1_000_000,
        filingStatus: 'single',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(811_400);
    });

    it('single: high income where section 1250 25% cap applies', () => {
      // $400,000 ordinary + $100,000 section 1250
      // At 35% bracket, 25% cap kicks in
      // Section 1250 tax = 10_000_000 * 0.25 = 2_500_000
      // Tax on ordinary 40_000_000 = 10_954_725
      // Worksheet total: 10_954_725 + 2_500_000 = 13_454_725
      // Ordinary on full 50_000_000 = 14_454_725
      // min(13_454_725, 14_454_725) = 13_454_725
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome: 50_000_000,
        ordinaryIncome: 40_000_000,
        qualifiedDividends: 0,
        netLTCG: 10_000_000,
        collectiblesGain: 0,
        section1250Gain: 10_000_000,
        filingStatus: 'single',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(13_454_725);
    });
  });

  // --- Combined: ordinary + LTCG + qualified dividends + collectibles ----
  describe('combined preferential income types', () => {
    it('single: $80k ordinary + $5k QD + $10k LTCG + $5k collectibles', () => {
      // taxableIncome = 10_000_000 ($100k)
      // ordinaryIncome = 8_000_000
      // qualifiedDividends = 500_000
      // netLTCG = 1_500_000 (includes 500_000 collectibles)
      // collectiblesGain = 500_000
      // section1250Gain = 0
      //
      // Preferential LTCG (excl collectibles/1250) = 1_500_000 - 500_000 = 1_000_000
      // Total preferential for 0/15/20 rates = qualifiedDividends + preferentialLTCG
      //   = 500_000 + 1_000_000 = 1_500_000
      //
      // Step 1: Ordinary tax on 8_000_000
      //   10% on 1_192_500 = 119_250
      //   12% on 3_655_000 = 438_600
      //   22% on (8_000_000 - 4_847_500) = 3_152_500 * 0.22 = 693_550
      //   = 119_250 + 438_600 + 693_550 = 1_251_400
      //
      // Step 2: Collectibles tax (stacking from 8_000_000)
      //   At 8_000_000 we're in 22% bracket (goes to 10_335_000)
      //   500_000 collectibles at min(28%, 22%) = 22%
      //   = 500_000 * 0.22 = 110_000
      //
      // Step 3: 0/15/20% LTCG + QD (stacking from 8_000_000 + 500_000 = 8_500_000)
      //   Need to use the worksheet approach:
      //   0% threshold (single) = 4_835_000
      //   At this point, we've used up 8_500_000 of stacking space
      //   Since 8_500_000 > 4_835_000, no room in 0% zone
      //   15% threshold = 53_340_000
      //   Since 8_500_000 + 1_500_000 = 10_000_000 < 53_340_000, all at 15%
      //   = 1_500_000 * 0.15 = 225_000
      //
      // Worksheet total: 1_251_400 + 110_000 + 225_000 = 1_586_400
      //
      // Ordinary tax on full 10_000_000 = 1_691_400 (from earlier)
      //
      // min(1_586_400, 1_691_400) = 1_586_400
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome: 10_000_000,
        ordinaryIncome: 8_000_000,
        qualifiedDividends: 500_000,
        netLTCG: 1_500_000,
        collectiblesGain: 500_000,
        section1250Gain: 0,
        filingStatus: 'single',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(1_586_400);
    });
  });

  // --- Result should never exceed ordinary tax on everything --------------
  describe('result never exceeds ordinary tax', () => {
    it('property: worksheet result <= straight ordinary rates', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50_000_000 }),
          fc.integer({ min: 0, max: 20_000_000 }),
          fc.integer({ min: 0, max: 10_000_000 }),
          fc.constantFrom(...allStatuses),
          (ordinaryIncome, ltcg, qd, status) => {
            const taxableIncome = ordinaryIncome + ltcg + qd;
            if (taxableIncome === 0) return; // skip trivial case

            const ordinaryTax = computeOrdinaryTax(taxableIncome, status, federalConfig);
            const qdcgTax = computeQualifiedDividendAndCapGainTax({
              taxableIncome,
              ordinaryIncome,
              qualifiedDividends: qd,
              netLTCG: ltcg,
              collectiblesGain: 0,
              section1250Gain: 0,
              filingStatus: status,
              config: federalConfig,
            });
            expect(qdcgTax).toBeLessThanOrEqual(ordinaryTax);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('property: result is non-negative', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50_000_000 }),
          fc.integer({ min: 0, max: 20_000_000 }),
          fc.integer({ min: 0, max: 10_000_000 }),
          fc.constantFrom(...allStatuses),
          (ordinaryIncome, ltcg, qd, status) => {
            const taxableIncome = ordinaryIncome + ltcg + qd;
            const qdcgTax = computeQualifiedDividendAndCapGainTax({
              taxableIncome,
              ordinaryIncome,
              qualifiedDividends: qd,
              netLTCG: ltcg,
              collectiblesGain: 0,
              section1250Gain: 0,
              filingStatus: status,
              config: federalConfig,
            });
            expect(qdcgTax).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // --- MFJ tests --------------------------------------------------------
  describe('married filing jointly', () => {
    it('MFJ: $80,000 ordinary + $20,000 LTCG', () => {
      // taxableIncome = 10_000_000
      // ordinaryIncome = 8_000_000
      // netLTCG = 2_000_000
      //
      // MFJ 0% threshold = 9_670_000
      // Line 5: ordinary portion = 8_000_000
      // Line 7: min(10_000_000, 9_670_000) = 9_670_000
      // Line 8: min(8_000_000, 9_670_000) = 8_000_000
      // Line 9: 9_670_000 - 8_000_000 = 1_670_000 (LTCG at 0%)
      // Line 10: min(10_000_000, 2_000_000) = 2_000_000
      // Line 12: 2_000_000 - 1_670_000 = 330_000 (at 15%)
      // Line 13: MFJ 15% threshold = 60_005_000
      // Line 14: min(10_000_000, 60_005_000) = 10_000_000
      // Line 15: 8_000_000 + 1_670_000 = 9_670_000
      // Line 16: 10_000_000 - 9_670_000 = 330_000
      // Line 17: min(330_000, 330_000) = 330_000
      // Line 18: 330_000 * 0.15 = 49_500
      // Line 19: 1_670_000 + 330_000 = 2_000_000
      // Line 20: 2_000_000 - 2_000_000 = 0
      //
      // Tax on ordinary (8_000_000 MFJ):
      //   10% on 2_385_000 = 238_500
      //   12% on (8_000_000 - 2_385_000) = 5_615_000 * 0.12 = 673_800
      //   = 238_500 + 673_800 = 912_300
      //
      // Worksheet total: 912_300 + 49_500 = 961_800
      // Ordinary on full 10_000_000 MFJ = 1_182_800
      // min(961_800, 1_182_800) = 961_800
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome: 10_000_000,
        ordinaryIncome: 8_000_000,
        qualifiedDividends: 0,
        netLTCG: 2_000_000,
        collectiblesGain: 0,
        section1250Gain: 0,
        filingStatus: 'married_filing_jointly',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(961_800);
    });
  });

  // --- LTCG hitting 20% rate zone ----------------------------------------
  describe('LTCG at 20% rate', () => {
    it('single: very high income with LTCG in 20% zone', () => {
      // $500,000 ordinary + $200,000 LTCG
      // taxableIncome = 70_000_000
      // ordinaryIncome = 50_000_000
      //
      // Single 0% threshold: 4_835_000
      // Single 15% threshold: 53_340_000
      //
      // Line 5: ordinary = 50_000_000
      // Line 7: min(70_000_000, 4_835_000) = 4_835_000
      // Line 8: min(50_000_000, 4_835_000) = 4_835_000
      // Line 9: 4_835_000 - 4_835_000 = 0 (0% zone full)
      // Line 10: min(70_000_000, 20_000_000) = 20_000_000
      // Line 12: 20_000_000 - 0 = 20_000_000
      // Line 13: 15% threshold = 53_340_000
      // Line 14: min(70_000_000, 53_340_000) = 53_340_000
      // Line 15: 50_000_000 + 0 = 50_000_000
      // Line 16: 53_340_000 - 50_000_000 = 3_340_000
      // Line 17: min(20_000_000, 3_340_000) = 3_340_000 (at 15%)
      // Line 18: 3_340_000 * 0.15 = 501_000
      // Line 19: 0 + 3_340_000 = 3_340_000
      // Line 20: 20_000_000 - 3_340_000 = 16_660_000 (at 20%)
      // Line 21: 16_660_000 * 0.20 = 3_332_000
      //
      // Tax on ordinary 50_000_000:
      //   10% on 1_192_500 = 119_250
      //   12% on 3_655_000 = 438_600
      //   22% on 5_487_500 = 1_207_250
      //   24% on 9_395_000 = 2_254_800
      //   32% on 5_322_500 = 1_703_200
      //   35% on (50_000_000 - 25_052_500) = 24_947_500 * 0.35 = 8_731_625
      //   Total = 14_454_725
      //
      // Worksheet total: 14_454_725 + 501_000 + 3_332_000 = 18_287_725
      //
      // Ordinary on full 70_000_000 = 21_602_025 (from earlier)
      // min(18_287_725, 21_602_025) = 18_287_725
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome: 70_000_000,
        ordinaryIncome: 50_000_000,
        qualifiedDividends: 0,
        netLTCG: 20_000_000,
        collectiblesGain: 0,
        section1250Gain: 0,
        filingStatus: 'single',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(18_287_725);
    });
  });

  // --- Zero taxable income -----------------------------------------------
  describe('zero taxable income', () => {
    it('returns $0 for $0 taxable income', () => {
      const qdcgTax = computeQualifiedDividendAndCapGainTax({
        taxableIncome: 0,
        ordinaryIncome: 0,
        qualifiedDividends: 0,
        netLTCG: 0,
        collectiblesGain: 0,
        section1250Gain: 0,
        filingStatus: 'single',
        config: federalConfig,
      });
      expect(qdcgTax).toBe(0);
    });
  });
});

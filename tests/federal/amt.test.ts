// Source: Rev. Proc. 2024-40 §3.01(3) — AMT exemption, phase-out, and 26%/28% breakpoint
// Source: IRC §55–§59 — alternative minimum tax computation
// Verified: 2026-02-25

import { describe, it, expect } from 'vitest';
import { computeAMT } from '../../src/engine/federal/amt';
import type { FederalConfig, FilingStatus } from '../../src/engine/types';
import federalConfig from '../../config/federal-2025.json';

const config = federalConfig as unknown as FederalConfig;

// Helper to build AMT params with defaults
function amtParams(overrides: {
  taxableIncome?: number;
  itemizedSALT?: number;
  regularTax?: number;
  filingStatus?: FilingStatus;
  usedItemized?: boolean;
}) {
  return {
    taxableIncome: overrides.taxableIncome ?? 0,
    itemizedSALT: overrides.itemizedSALT ?? 0,
    regularTax: overrides.regularTax ?? 0,
    filingStatus: overrides.filingStatus ?? 'single' as FilingStatus,
    usedItemized: overrides.usedItemized ?? false,
  };
}

describe('computeAMT', () => {
  // -----------------------------------------------------------------------
  // Basic / edge cases
  // -----------------------------------------------------------------------

  it('should return $0 for zero income', () => {
    const result = computeAMT(
      amtParams({ taxableIncome: 0, regularTax: 0 }),
      config,
    );
    expect(result).toBe(0);
  });

  it('should return $0 for standard deduction filer (no SALT preference)', () => {
    // Standard deduction filer with $80k income, ~$9k regular tax
    // No SALT add-back means AMTI = taxable income
    // With exemption of $88,100, AMTI of $80k is fully sheltered
    const result = computeAMT(
      amtParams({
        taxableIncome: 8_000_000, // $80,000
        regularTax: 900_000,      // ~$9,000
        usedItemized: false,
        filingStatus: 'single',
      }),
      config,
    );
    expect(result).toBe(0);
  });

  it('should return $0 when regular tax exceeds tentative minimum tax', () => {
    // Moderate income itemizer: taxable income $100k, SALT add-back $10k
    // AMTI = $100k + $10k = $110k
    // Exemption = $88,100 (single) — no phase-out since $110k < $626,350
    // AMT base = $110k - $88,100 = $21,900
    // Tentative min tax = $21,900 * 26% = $5,694
    // If regular tax is $15,000, that's way higher → AMT = 0
    const result = computeAMT(
      amtParams({
        taxableIncome: 10_000_000,  // $100,000
        itemizedSALT: 1_000_000,    // $10,000
        regularTax: 1_500_000,      // $15,000
        usedItemized: true,
        filingStatus: 'single',
      }),
      config,
    );
    expect(result).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Moderate income itemizer with high SALT — may trigger AMT
  // -----------------------------------------------------------------------

  it('should compute AMT for moderate income itemizer with high SALT', () => {
    // Single filer:
    //   taxableIncome = $200,000
    //   SALT deduction used = $40,000 (the SALT cap is $10k but they might have
    //   claimed up to the cap — what matters is the itemizedSALT add-back amount)
    //   Actually, the itemizedSALT param represents the SALT amount actually deducted
    //   on Schedule A (after SALT cap). Let's say $10,000 (the cap).
    //
    //   AMTI = $200,000 + $10,000 = $210,000
    //   Exemption = $88,100 (no phase-out, $210k < $626,350)
    //   AMT base = $210,000 - $88,100 = $121,900
    //   Tentative min tax = $121,900 * 26% = $31,694
    //   regularTax needs to be less than $31,694 for AMT to kick in.
    //   Let's set regularTax = $30,000
    //   AMT = $31,694 - $30,000 = $1,694
    //
    // In cents:
    //   AMTI = 20_000_000 + 1_000_000 = 21_000_000
    //   Exemption = 8_810_000
    //   AMT base = 21_000_000 - 8_810_000 = 12_190_000
    //   Tentative min tax = Math.round(12_190_000 * 0.26) = 3_169_400
    //   AMT = 3_169_400 - 3_000_000 = 169_400
    const result = computeAMT(
      amtParams({
        taxableIncome: 20_000_000,  // $200,000
        itemizedSALT: 1_000_000,    // $10,000
        regularTax: 3_000_000,      // $30,000
        usedItemized: true,
        filingStatus: 'single',
      }),
      config,
    );
    expect(result).toBe(169_400);
  });

  // -----------------------------------------------------------------------
  // High income — exemption partially phased out
  // -----------------------------------------------------------------------

  it('should partially phase out exemption for high income single filer', () => {
    // Single filer:
    //   taxableIncome = $700,000, SALT = $10,000, itemized
    //   AMTI = $700,000 + $10,000 = $710,000
    //   Phase-out begins at $626,350
    //   Excess = $710,000 - $626,350 = $83,650
    //   Exemption reduction = $83,650 * 0.25 = $20,912.50 → Math.round = $20,913 (in dollars)
    //   Wait — we are in cents:
    //   AMTI = 70_000_000 + 1_000_000 = 71_000_000
    //   Phase-out begins = 62_635_000
    //   Excess = 71_000_000 - 62_635_000 = 8_365_000
    //   Reduction = Math.round(8_365_000 * 0.25) = 2_091_250
    //   Exemption = 8_810_000 - 2_091_250 = 6_718_750
    //   AMT base = 71_000_000 - 6_718_750 = 64_281_250
    //
    //   26% rate bracket up to 23_910_000:
    //     lowTax = Math.round(23_910_000 * 0.26) = 6_216_600
    //   28% on remainder: 64_281_250 - 23_910_000 = 40_371_250
    //     highTax = Math.round(40_371_250 * 0.28) = 11_303_950
    //   Tentative min = 6_216_600 + 11_303_950 = 17_520_550
    //
    //   regularTax = $170,000 = 17_000_000
    //   AMT = 17_520_550 - 17_000_000 = 520_550
    const result = computeAMT(
      amtParams({
        taxableIncome: 70_000_000,
        itemizedSALT: 1_000_000,
        regularTax: 17_000_000,
        usedItemized: true,
        filingStatus: 'single',
      }),
      config,
    );
    expect(result).toBe(520_550);
  });

  // -----------------------------------------------------------------------
  // Very high income — exemption fully phased out
  // -----------------------------------------------------------------------

  it('should fully phase out exemption for very high income', () => {
    // Single filer:
    //   taxableIncome = $1,000,000, no SALT (standard deduction)
    //   AMTI = $1,000,000 (no add-back)
    //   Phase-out begins = $626,350
    //   Excess = $1,000,000 - $626,350 = $373,650
    //   Reduction = $373,650 * 0.25 = $93,412.50
    //   $93,412.50 > $88,100 → exemption = $0
    //
    //   In cents:
    //   AMTI = 100_000_000
    //   Excess = 100_000_000 - 62_635_000 = 37_365_000
    //   Reduction = Math.round(37_365_000 * 0.25) = 9_341_250
    //   9_341_250 > 8_810_000 → exemption = 0
    //   AMT base = 100_000_000
    //
    //   26% on first 23_910_000 = Math.round(23_910_000 * 0.26) = 6_216_600
    //   28% on (100_000_000 - 23_910_000) = 76_090_000
    //     = Math.round(76_090_000 * 0.28) = 21_305_200
    //   Tentative min = 6_216_600 + 21_305_200 = 27_521_800
    //
    //   regularTax = $260,000 = 26_000_000
    //   AMT = 27_521_800 - 26_000_000 = 1_521_800
    const result = computeAMT(
      amtParams({
        taxableIncome: 100_000_000,
        regularTax: 26_000_000,
        usedItemized: false,
        filingStatus: 'single',
      }),
      config,
    );
    expect(result).toBe(1_521_800);
  });

  // -----------------------------------------------------------------------
  // MFJ vs Single at same income
  // -----------------------------------------------------------------------

  it('should produce different AMT for MFJ vs Single at same income', () => {
    // Both at $500k taxable income, $10k SALT, itemized
    // Single:
    //   AMTI = 50_000_000 + 1_000_000 = 51_000_000
    //   Below phase-out (62_635_000), so exemption = 8_810_000
    //   AMT base = 51_000_000 - 8_810_000 = 42_190_000
    //   26% on 23_910_000 = 6_216_600
    //   28% on (42_190_000 - 23_910_000) = 18_280_000 → Math.round(18_280_000 * 0.28) = 5_118_400
    //   Tentative min = 6_216_600 + 5_118_400 = 11_335_000
    //
    // MFJ:
    //   AMTI = 51_000_000
    //   Below phase-out (125_270_000), so exemption = 13_700_000
    //   AMT base = 51_000_000 - 13_700_000 = 37_300_000
    //   26% on 23_910_000 = 6_216_600
    //   28% on (37_300_000 - 23_910_000) = 13_390_000 → Math.round(13_390_000 * 0.28) = 3_749_200
    //   Tentative min = 6_216_600 + 3_749_200 = 9_965_800

    const regularTax = 12_000_000; // $120,000

    const singleAMT = computeAMT(
      amtParams({
        taxableIncome: 50_000_000,
        itemizedSALT: 1_000_000,
        regularTax,
        usedItemized: true,
        filingStatus: 'single',
      }),
      config,
    );

    const mfjAMT = computeAMT(
      amtParams({
        taxableIncome: 50_000_000,
        itemizedSALT: 1_000_000,
        regularTax,
        usedItemized: true,
        filingStatus: 'married_filing_jointly',
      }),
      config,
    );

    // Single tentative min = 11_335_000, AMT = max(0, 11_335_000 - 12_000_000) = 0
    expect(singleAMT).toBe(0);

    // MFJ tentative min = 9_965_800, AMT = max(0, 9_965_800 - 12_000_000) = 0
    expect(mfjAMT).toBe(0);

    // Both happen to be 0 at this regularTax. Let's use a lower regularTax.
    const lowRegularTax = 8_000_000; // $80,000

    const singleAMT2 = computeAMT(
      amtParams({
        taxableIncome: 50_000_000,
        itemizedSALT: 1_000_000,
        regularTax: lowRegularTax,
        usedItemized: true,
        filingStatus: 'single',
      }),
      config,
    );

    const mfjAMT2 = computeAMT(
      amtParams({
        taxableIncome: 50_000_000,
        itemizedSALT: 1_000_000,
        regularTax: lowRegularTax,
        usedItemized: true,
        filingStatus: 'married_filing_jointly',
      }),
      config,
    );

    // Single: 11_335_000 - 8_000_000 = 3_335_000
    expect(singleAMT2).toBe(3_335_000);
    // MFJ: 9_965_800 - 8_000_000 = 1_965_800
    expect(mfjAMT2).toBe(1_965_800);

    // Single pays more AMT because of smaller exemption
    expect(singleAMT2).toBeGreaterThan(mfjAMT2);
  });

  // -----------------------------------------------------------------------
  // SALT not added back for standard deduction filers
  // -----------------------------------------------------------------------

  it('should NOT add back SALT when usedItemized is false', () => {
    // Even if itemizedSALT is non-zero, should not be added back
    // taxableIncome = $80,000 (well below exemption)
    const result = computeAMT(
      amtParams({
        taxableIncome: 8_000_000,
        itemizedSALT: 2_000_000,  // $20,000 — but shouldn't matter
        regularTax: 900_000,
        usedItemized: false,
        filingStatus: 'single',
      }),
      config,
    );
    expect(result).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Exact exemption phase-out boundary
  // -----------------------------------------------------------------------

  it('should have full exemption at exactly the phase-out threshold', () => {
    // Single, AMTI exactly at phase-out threshold = $626,350
    // AMTI = 62_635_000
    // Excess = 0 → exemption = 8_810_000
    // AMT base = 62_635_000 - 8_810_000 = 53_825_000
    // 26% on 23_910_000 = 6_216_600
    // 28% on (53_825_000 - 23_910_000) = 29_915_000 → Math.round(29_915_000 * 0.28) = 8_376_200
    // Tentative min = 6_216_600 + 8_376_200 = 14_592_800
    //
    // We'll set regularTax high enough that AMT = 0 to just verify exemption boundary
    // Or we can set it lower to verify the exact tentative min.
    // regularTax = $140,000 = 14_000_000
    // AMT = 14_592_800 - 14_000_000 = 592_800

    // Need taxableIncome + SALT = 62_635_000
    // Let's use taxableIncome = 61_635_000, SALT = 1_000_000, itemized
    const result = computeAMT(
      amtParams({
        taxableIncome: 61_635_000,
        itemizedSALT: 1_000_000,
        regularTax: 14_000_000,
        usedItemized: true,
        filingStatus: 'single',
      }),
      config,
    );
    expect(result).toBe(592_800);
  });

  it('should begin phase-out $1 over the threshold', () => {
    // Single, AMTI = $626,351 = 62_635_100 cents
    // Excess = 100 cents ($1)
    // Reduction = Math.round(100 * 0.25) = 25
    // Exemption = 8_810_000 - 25 = 8_809_975
    // AMT base = 62_635_100 - 8_809_975 = 53_825_125
    // 26% on 23_910_000 = 6_216_600
    // 28% on (53_825_125 - 23_910_000) = 29_915_125 → Math.round(29_915_125 * 0.28) = 8_376_235
    // Tentative min = 6_216_600 + 8_376_235 = 14_592_835
    // regularTax = 14_000_000
    // AMT = 14_592_835 - 14_000_000 = 592_835

    // AMTI = 62_635_100, taxableIncome + SALT = 62_635_100
    // taxableIncome = 61_635_100, SALT = 1_000_000
    const result = computeAMT(
      amtParams({
        taxableIncome: 61_635_100,
        itemizedSALT: 1_000_000,
        regularTax: 14_000_000,
        usedItemized: true,
        filingStatus: 'single',
      }),
      config,
    );
    expect(result).toBe(592_835);
  });

  // -----------------------------------------------------------------------
  // MFS filing status with different breakpoint
  // -----------------------------------------------------------------------

  it('should use MFS breakpoint ($119,550) for married filing separately', () => {
    // MFS:
    //   taxableIncome = $300,000 = 30_000_000, SALT = $10,000 = 1_000_000
    //   AMTI = 31_000_000
    //   Below MFS phase-out (62_635_000), exemption = 6_850_000
    //   AMT base = 31_000_000 - 6_850_000 = 24_150_000
    //   MFS breakpoint = 11_955_000
    //   26% on 11_955_000 = Math.round(11_955_000 * 0.26) = 3_108_300
    //   28% on (24_150_000 - 11_955_000) = 12_195_000 → Math.round(12_195_000 * 0.28) = 3_414_600
    //   Tentative min = 3_108_300 + 3_414_600 = 6_522_900
    //   regularTax = $60,000 = 6_000_000
    //   AMT = 6_522_900 - 6_000_000 = 522_900
    const result = computeAMT(
      amtParams({
        taxableIncome: 30_000_000,
        itemizedSALT: 1_000_000,
        regularTax: 6_000_000,
        usedItemized: true,
        filingStatus: 'married_filing_separately',
      }),
      config,
    );
    expect(result).toBe(522_900);
  });

  // -----------------------------------------------------------------------
  // AMT base within the 26% bracket only (below breakpoint)
  // -----------------------------------------------------------------------

  it('should apply only the 26% rate when AMT base is below breakpoint', () => {
    // Single:
    //   taxableIncome = $150,000, SALT = $10,000, itemized
    //   AMTI = 15_000_000 + 1_000_000 = 16_000_000
    //   Below phase-out, exemption = 8_810_000
    //   AMT base = 16_000_000 - 8_810_000 = 7_190_000
    //   7_190_000 < 23_910_000 (breakpoint), so all at 26%
    //   Tentative min = Math.round(7_190_000 * 0.26) = 1_869_400
    //   regularTax = $18,000 = 1_800_000
    //   AMT = 1_869_400 - 1_800_000 = 69_400
    const result = computeAMT(
      amtParams({
        taxableIncome: 15_000_000,
        itemizedSALT: 1_000_000,
        regularTax: 1_800_000,
        usedItemized: true,
        filingStatus: 'single',
      }),
      config,
    );
    expect(result).toBe(69_400);
  });

  // -----------------------------------------------------------------------
  // Negative AMT base (income below exemption) → $0
  // -----------------------------------------------------------------------

  it('should return $0 when income is below AMT exemption', () => {
    // Single, AMTI = $50,000 = 5_000_000 (below $88,100 exemption)
    // AMT base = max(0, 5_000_000 - 8_810_000) = 0
    // Tentative min = 0
    // AMT = 0
    const result = computeAMT(
      amtParams({
        taxableIncome: 5_000_000,
        itemizedSALT: 0,
        regularTax: 500_000,
        usedItemized: false,
        filingStatus: 'single',
      }),
      config,
    );
    expect(result).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Head of household
  // -----------------------------------------------------------------------

  it('should handle head_of_household filing status', () => {
    // HoH uses same AMT config as single:
    //   exemption = 8_810_000, phase-out = 62_635_000, breakpoint = 23_910_000
    //   taxableIncome = $200,000, SALT = $10,000, itemized
    //   AMTI = 21_000_000
    //   Exemption = 8_810_000
    //   AMT base = 12_190_000
    //   26% * 12_190_000 = 3_169_400
    //   regularTax = $30,000 = 3_000_000
    //   AMT = 3_169_400 - 3_000_000 = 169_400
    const result = computeAMT(
      amtParams({
        taxableIncome: 20_000_000,
        itemizedSALT: 1_000_000,
        regularTax: 3_000_000,
        usedItemized: true,
        filingStatus: 'head_of_household',
      }),
      config,
    );
    expect(result).toBe(169_400);
  });
});

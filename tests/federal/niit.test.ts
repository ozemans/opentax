import { describe, it, expect } from 'vitest';
import { computeNIIT, computeInvestmentIncome } from '../../src/engine/federal/niit';
import type { FederalConfig, FilingStatus, TaxInput } from '../../src/engine/types';
import federalConfig from '../../config/federal-2025.json';

const config = federalConfig as unknown as FederalConfig;

// ---------------------------------------------------------------------------
// Helper to build a minimal TaxInput for computeInvestmentIncome tests
// ---------------------------------------------------------------------------
function makeTaxInput(overrides: Partial<TaxInput> = {}): TaxInput {
  return {
    taxYear: 2025,
    filingStatus: 'single',
    taxpayer: {
      firstName: 'Test',
      lastName: 'User',
      ssn: '000-00-0000',
      dateOfBirth: '1990-01-01',
    },
    dependents: [],
    address: { street: '123 Main', city: 'Anytown', state: 'CA', zip: '90210' },
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
// computeNIIT tests
// ---------------------------------------------------------------------------

describe('computeNIIT', () => {
  // -----------------------------------------------------------------------
  // MAGI below threshold → $0
  // -----------------------------------------------------------------------

  it('should return $0 when MAGI is below the single threshold', () => {
    // Single threshold = $200,000 = 20_000_000
    const result = computeNIIT(
      { magi: 19_000_000, investmentIncome: 5_000_000, filingStatus: 'single' },
      config,
    );
    expect(result).toBe(0);
  });

  it('should return $0 when MAGI is below the MFJ threshold', () => {
    // MFJ threshold = $250,000 = 25_000_000
    const result = computeNIIT(
      { magi: 24_000_000, investmentIncome: 5_000_000, filingStatus: 'married_filing_jointly' },
      config,
    );
    expect(result).toBe(0);
  });

  it('should return $0 when MAGI is below the MFS threshold', () => {
    // MFS threshold = $125,000 = 12_500_000
    const result = computeNIIT(
      { magi: 12_000_000, investmentIncome: 5_000_000, filingStatus: 'married_filing_separately' },
      config,
    );
    expect(result).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Exactly at threshold → $0
  // -----------------------------------------------------------------------

  it('should return $0 when MAGI is exactly at the single threshold', () => {
    const result = computeNIIT(
      { magi: 20_000_000, investmentIncome: 5_000_000, filingStatus: 'single' },
      config,
    );
    expect(result).toBe(0);
  });

  it('should return $0 when MAGI is exactly at the MFJ threshold', () => {
    const result = computeNIIT(
      { magi: 25_000_000, investmentIncome: 5_000_000, filingStatus: 'married_filing_jointly' },
      config,
    );
    expect(result).toBe(0);
  });

  // -----------------------------------------------------------------------
  // $1 over threshold with large investment income → tax on $1
  // -----------------------------------------------------------------------

  it('should tax on excess MAGI when $1 over threshold with large investment income', () => {
    // Single: MAGI = $200,001 = 20_000_100
    // Excess = 100 cents ($1)
    // Investment income = $50,000 = 5_000_000
    // Tax on lesser: min($1, $50,000) = $1
    // NIIT = Math.round(100 * 0.038) = 4
    const result = computeNIIT(
      { magi: 20_000_100, investmentIncome: 5_000_000, filingStatus: 'single' },
      config,
    );
    expect(result).toBe(4);
  });

  // -----------------------------------------------------------------------
  // MAGI above threshold, investment income > excess → tax on excess MAGI
  // -----------------------------------------------------------------------

  it('should tax on excess MAGI when investment income exceeds the excess', () => {
    // Single: MAGI = $250,000, investment income = $80,000
    // Excess = $250,000 - $200,000 = $50,000
    // Lesser of ($80,000, $50,000) = $50,000
    // NIIT = $50,000 * 3.8% = $1,900
    //
    // In cents:
    // Excess = 25_000_000 - 20_000_000 = 5_000_000
    // Lesser = min(8_000_000, 5_000_000) = 5_000_000
    // NIIT = Math.round(5_000_000 * 0.038) = 190_000
    const result = computeNIIT(
      { magi: 25_000_000, investmentIncome: 8_000_000, filingStatus: 'single' },
      config,
    );
    expect(result).toBe(190_000);
  });

  // -----------------------------------------------------------------------
  // MAGI above threshold, investment income < excess → tax on investment income
  // -----------------------------------------------------------------------

  it('should tax on investment income when it is less than the excess', () => {
    // Single: MAGI = $300,000, investment income = $20,000
    // Excess = $300,000 - $200,000 = $100,000
    // Lesser of ($20,000, $100,000) = $20,000
    // NIIT = $20,000 * 3.8% = $760
    //
    // In cents:
    // Excess = 30_000_000 - 20_000_000 = 10_000_000
    // Lesser = min(2_000_000, 10_000_000) = 2_000_000
    // NIIT = Math.round(2_000_000 * 0.038) = 76_000
    const result = computeNIIT(
      { magi: 30_000_000, investmentIncome: 2_000_000, filingStatus: 'single' },
      config,
    );
    expect(result).toBe(76_000);
  });

  // -----------------------------------------------------------------------
  // All filing statuses
  // -----------------------------------------------------------------------

  it('should use correct thresholds for all filing statuses', () => {
    const testCases: Array<{ status: FilingStatus; threshold: number }> = [
      { status: 'single', threshold: 20_000_000 },
      { status: 'married_filing_jointly', threshold: 25_000_000 },
      { status: 'married_filing_separately', threshold: 12_500_000 },
      { status: 'head_of_household', threshold: 20_000_000 },
      { status: 'qualifying_surviving_spouse', threshold: 25_000_000 },
    ];

    for (const { status, threshold } of testCases) {
      // At threshold → $0
      const atThreshold = computeNIIT(
        { magi: threshold, investmentIncome: 5_000_000, filingStatus: status },
        config,
      );
      expect(atThreshold).toBe(0);

      // $10,000 above threshold, $10,000 investment income
      const aboveThreshold = computeNIIT(
        { magi: threshold + 1_000_000, investmentIncome: 1_000_000, filingStatus: status },
        config,
      );
      // Both excess and investment income = $10,000, so min = $10,000
      // NIIT = Math.round(1_000_000 * 0.038) = 38_000
      expect(aboveThreshold).toBe(38_000);
    }
  });

  // -----------------------------------------------------------------------
  // Zero investment income, high MAGI → $0
  // -----------------------------------------------------------------------

  it('should return $0 when investment income is zero even with high MAGI', () => {
    const result = computeNIIT(
      { magi: 50_000_000, investmentIncome: 0, filingStatus: 'single' },
      config,
    );
    expect(result).toBe(0);
  });

  // -----------------------------------------------------------------------
  // High investment income, low MAGI → $0
  // -----------------------------------------------------------------------

  it('should return $0 when MAGI is below threshold even with high investment income', () => {
    const result = computeNIIT(
      { magi: 15_000_000, investmentIncome: 50_000_000, filingStatus: 'single' },
      config,
    );
    expect(result).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Large amounts — verify no floating point issues
  // -----------------------------------------------------------------------

  it('should handle large amounts without floating point drift', () => {
    // MFJ: MAGI = $1,000,000, investment = $800,000
    // Excess = $1,000,000 - $250,000 = $750,000
    // Lesser = min($800,000, $750,000) = $750,000
    // NIIT = $750,000 * 3.8% = $28,500
    //
    // In cents:
    // Excess = 100_000_000 - 25_000_000 = 75_000_000
    // Lesser = min(80_000_000, 75_000_000) = 75_000_000
    // NIIT = Math.round(75_000_000 * 0.038) = 2_850_000
    const result = computeNIIT(
      { magi: 100_000_000, investmentIncome: 80_000_000, filingStatus: 'married_filing_jointly' },
      config,
    );
    expect(result).toBe(2_850_000);
  });
});

// ---------------------------------------------------------------------------
// computeInvestmentIncome tests
// ---------------------------------------------------------------------------

describe('computeInvestmentIncome', () => {
  it('should return 0 for empty income sources', () => {
    const input = makeTaxInput();
    expect(computeInvestmentIncome(input)).toBe(0);
  });

  it('should sum all 1099-INT interest amounts', () => {
    const input = makeTaxInput({
      form1099INTs: [
        { payerName: 'Bank A', interest: 100_000 },
        { payerName: 'Bank B', interest: 200_000 },
      ],
    });
    expect(computeInvestmentIncome(input)).toBe(300_000);
  });

  it('should sum all 1099-DIV ordinary dividends', () => {
    const input = makeTaxInput({
      form1099DIVs: [
        {
          payerName: 'Fund A',
          ordinaryDividends: 500_000,
          qualifiedDividends: 300_000,
          totalCapitalGain: 0,
        },
        {
          payerName: 'Fund B',
          ordinaryDividends: 200_000,
          qualifiedDividends: 100_000,
          totalCapitalGain: 0,
        },
      ],
    });
    // Ordinary dividends: 500_000 + 200_000 = 700_000
    expect(computeInvestmentIncome(input)).toBe(700_000);
  });

  it('should include net capital gains when positive', () => {
    const input = makeTaxInput({
      form1099Bs: [
        {
          description: 'Stock A',
          dateAcquired: '2024-01-01',
          dateSold: '2025-06-01',
          proceeds: 10_000_000,
          costBasis: 5_000_000,
          gainLoss: 5_000_000,
          isLongTerm: true,
          basisReportedToIRS: true,
          category: '8949_D',
        },
        {
          description: 'Stock B',
          dateAcquired: '2025-01-01',
          dateSold: '2025-03-01',
          proceeds: 3_000_000,
          costBasis: 4_000_000,
          gainLoss: -1_000_000,
          isLongTerm: false,
          basisReportedToIRS: true,
          category: '8949_A',
        },
      ],
    });
    // Net capital gains: 5_000_000 + (-1_000_000) = 4_000_000 (positive)
    expect(computeInvestmentIncome(input)).toBe(4_000_000);
  });

  it('should NOT include negative net capital gains', () => {
    const input = makeTaxInput({
      form1099Bs: [
        {
          description: 'Stock A',
          dateAcquired: '2025-01-01',
          dateSold: '2025-03-01',
          proceeds: 3_000_000,
          costBasis: 8_000_000,
          gainLoss: -5_000_000,
          isLongTerm: false,
          basisReportedToIRS: true,
          category: '8949_A',
        },
      ],
    });
    // Net capital gains: -5_000_000 → use 0 (not negative)
    expect(computeInvestmentIncome(input)).toBe(0);
  });

  it('should include other passive income (otherIncome)', () => {
    const input = makeTaxInput({
      otherIncome: 1_500_000,
    });
    expect(computeInvestmentIncome(input)).toBe(1_500_000);
  });

  it('should sum all investment income types together', () => {
    const input = makeTaxInput({
      form1099INTs: [
        { payerName: 'Bank A', interest: 100_000 },
      ],
      form1099DIVs: [
        {
          payerName: 'Fund A',
          ordinaryDividends: 200_000,
          qualifiedDividends: 100_000,
          totalCapitalGain: 0,
        },
      ],
      form1099Bs: [
        {
          description: 'Stock A',
          dateAcquired: '2024-01-01',
          dateSold: '2025-06-01',
          proceeds: 10_000_000,
          costBasis: 7_000_000,
          gainLoss: 3_000_000,
          isLongTerm: true,
          basisReportedToIRS: true,
          category: '8949_D',
        },
      ],
      otherIncome: 500_000,
    });
    // Interest: 100_000
    // Dividends: 200_000
    // Capital gains: 3_000_000
    // Other: 500_000
    // Total: 3_800_000
    expect(computeInvestmentIncome(input)).toBe(3_800_000);
  });

  it('should NOT include wages (W2s are not investment income)', () => {
    const input = makeTaxInput({
      w2s: [
        {
          employerEIN: '12-3456789',
          employerName: 'Acme Corp',
          wages: 10_000_000,
          federalWithheld: 2_000_000,
          socialSecurityWages: 10_000_000,
          socialSecurityWithheld: 620_000,
          medicareWages: 10_000_000,
          medicareWithheld: 145_000,
          stateWages: 10_000_000,
          stateWithheld: 500_000,
          stateCode: 'CA',
        },
      ],
      form1099INTs: [
        { payerName: 'Bank', interest: 50_000 },
      ],
    });
    // Only interest counts, not wages
    expect(computeInvestmentIncome(input)).toBe(50_000);
  });

  it('should NOT include self-employment income', () => {
    const input = makeTaxInput({
      form1099NECs: [
        { payerName: 'Client A', nonemployeeCompensation: 5_000_000 },
      ],
    });
    // 1099-NEC is SE income, not investment income
    expect(computeInvestmentIncome(input)).toBe(0);
  });

  it('should NOT include retirement distributions', () => {
    const input = makeTaxInput({
      form1099Rs: [
        {
          grossDistribution: 3_000_000,
          taxableAmount: 3_000_000,
          distributionCode: '7',
        },
      ],
    });
    expect(computeInvestmentIncome(input)).toBe(0);
  });

  it('should NOT include unemployment compensation', () => {
    const input = makeTaxInput({
      form1099Gs: [
        { unemployment: 2_000_000 },
      ],
    });
    expect(computeInvestmentIncome(input)).toBe(0);
  });
});

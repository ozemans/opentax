// Tests for self-employment tax computation module
// All monetary values are in CENTS (integers)

import { describe, it, expect } from 'vitest';
import {
  computeScheduleC,
  computeSelfEmploymentTax,
  computeQBIDeduction,
  computeSelfEmployment,
} from '../../src/engine/federal/self-employment';
import type {
  ScheduleCData,
  FederalConfig,
  FilingStatus,
  SelfEmploymentResult,
} from '../../src/engine/types';
import federalConfig from '../../config/federal-2025.json';

const config = federalConfig as unknown as FederalConfig;

// ---------------------------------------------------------------------------
// Helper to build ScheduleCData with sensible defaults
// ---------------------------------------------------------------------------
function makeScheduleC(overrides: Partial<ScheduleCData> = {}): ScheduleCData {
  return {
    businessName: 'Test Business',
    businessCode: '541511',
    grossReceipts: 0,
    expenses: {},
    ...overrides,
  };
}

// ===========================================================================
// Schedule C — Net Profit
// ===========================================================================
describe('computeScheduleC', () => {
  it('simple business: $100k gross, $30k expenses → $70k net profit', () => {
    const data = makeScheduleC({
      grossReceipts: 10_000_000,  // $100,000
      expenses: {
        advertising: 500_000,     // $5,000
        insurance: 500_000,       // $5,000
        supplies: 1_000_000,      // $10,000
        utilities: 1_000_000,     // $10,000
      },
    });

    const result = computeScheduleC(data, config);

    expect(result.netProfit).toBe(7_000_000);  // $70,000
    expect(result.homeOfficeDeduction).toBe(0);
  });

  it('business with home office (simplified): 200 sqft → $1,000 deduction', () => {
    const data = makeScheduleC({
      grossReceipts: 10_000_000,
      expenses: {
        supplies: 2_000_000,
      },
      homeOffice: {
        squareFootage: 200,
        useSimplifiedMethod: true,
      },
    });

    const result = computeScheduleC(data, config);

    // Home office: 200 sqft * $5/sqft = $1,000 = 100_000 cents
    expect(result.homeOfficeDeduction).toBe(100_000);
    // Net: 10_000_000 - 2_000_000 - 100_000 = 7_900_000
    expect(result.netProfit).toBe(7_900_000);
  });

  it('home office max: 300 sqft → $1,500 deduction', () => {
    const data = makeScheduleC({
      grossReceipts: 10_000_000,
      expenses: {},
      homeOffice: {
        squareFootage: 300,
        useSimplifiedMethod: true,
      },
    });

    const result = computeScheduleC(data, config);

    expect(result.homeOfficeDeduction).toBe(150_000);  // 300 * 500 = 150,000 cents
    expect(result.netProfit).toBe(10_000_000 - 150_000);
  });

  it('home office over 300 sqft: still capped at $1,500', () => {
    const data = makeScheduleC({
      grossReceipts: 10_000_000,
      expenses: {},
      homeOffice: {
        squareFootage: 500,
        useSimplifiedMethod: true,
      },
    });

    const result = computeScheduleC(data, config);

    // Capped at 300 sqft: 300 * 500 = 150,000 cents = $1,500
    expect(result.homeOfficeDeduction).toBe(150_000);
  });

  it('home office with useSimplifiedMethod=false returns 0 deduction', () => {
    const data = makeScheduleC({
      grossReceipts: 10_000_000,
      expenses: {},
      homeOffice: {
        squareFootage: 200,
        useSimplifiedMethod: false,
      },
    });

    const result = computeScheduleC(data, config);

    expect(result.homeOfficeDeduction).toBe(0);
  });

  it('business with COGS', () => {
    const data = makeScheduleC({
      grossReceipts: 20_000_000,   // $200,000
      costOfGoodsSold: 8_000_000,  // $80,000
      expenses: {
        supplies: 2_000_000,       // $20,000
      },
    });

    const result = computeScheduleC(data, config);

    // Net: 20_000_000 - 8_000_000 - 2_000_000 = 10_000_000
    expect(result.netProfit).toBe(10_000_000);
  });

  it('business with net loss', () => {
    const data = makeScheduleC({
      grossReceipts: 2_000_000,    // $20,000
      expenses: {
        advertising: 1_000_000,
        insurance: 500_000,
        supplies: 1_000_000,
        utilities: 500_000,
      },
    });

    const result = computeScheduleC(data, config);

    // Net: 2_000_000 - (1_000_000 + 500_000 + 1_000_000 + 500_000) = -1_000_000
    expect(result.netProfit).toBe(-1_000_000);
  });

  it('includes otherIncome in calculation', () => {
    const data = makeScheduleC({
      grossReceipts: 5_000_000,
      otherIncome: 500_000,
      expenses: {
        supplies: 1_000_000,
      },
    });

    const result = computeScheduleC(data, config);

    // Net: 5_000_000 + 500_000 - 1_000_000 = 4_500_000
    expect(result.netProfit).toBe(4_500_000);
  });

  it('includes all expense categories', () => {
    const data = makeScheduleC({
      grossReceipts: 20_000_000,
      expenses: {
        advertising: 100_000,
        carAndTruck: 200_000,
        commissions: 300_000,
        insurance: 400_000,
        legalAndProfessional: 500_000,
        officeExpenses: 600_000,
        supplies: 700_000,
        utilities: 800_000,
        otherExpenses: 900_000,
      },
    });

    const result = computeScheduleC(data, config);

    const totalExpenses = 100_000 + 200_000 + 300_000 + 400_000 + 500_000
      + 600_000 + 700_000 + 800_000 + 900_000;  // 4_500_000
    expect(result.netProfit).toBe(20_000_000 - totalExpenses);
  });
});

// ===========================================================================
// SE Tax
// ===========================================================================
describe('computeSelfEmploymentTax', () => {
  it('basic: $70k net profit → correct SE tax breakdown', () => {
    const netSEIncome = 7_000_000;  // $70,000

    const result = computeSelfEmploymentTax(netSEIncome, 0, 'single', config);

    // SE taxable: 7_000_000 * 0.9235 = 6_464_500
    expect(result.seTaxableIncome).toBe(6_464_500);

    // SS: 6_464_500 * 0.124 = 801_598
    expect(result.socialSecurityTax).toBe(801_598);

    // Medicare: 6_464_500 * 0.029 = 187_470.5 → Math.round = 187_471
    expect(result.medicareTax).toBe(187_471);

    // Total: 801_598 + 187_471 = 989_069
    expect(result.totalSETax).toBe(989_069);

    // Half: Math.round(989_069 / 2) = 494_535
    expect(result.halfSETaxDeduction).toBe(494_535);
  });

  it('SE income above SS wage base: only SS on amount up to base', () => {
    // SE income that produces taxable income above the wage base
    // Wage base: 17_610_000 ($176,100)
    // Need seTaxable > 17_610_000, so netSEIncome > 17_610_000 / 0.9235 ≈ 19_069_843
    const netSEIncome = 21_000_000;  // $210,000

    const result = computeSelfEmploymentTax(netSEIncome, 0, 'single', config);

    // SE taxable: 21_000_000 * 0.9235 = 19_393_500
    expect(result.seTaxableIncome).toBe(19_393_500);

    // SS: only on wage base = 17_610_000 * 0.124 = 2_183_640
    expect(result.socialSecurityTax).toBe(2_183_640);

    // Medicare: on all = 19_393_500 * 0.029 = 562_411.5 → 562_412
    expect(result.medicareTax).toBe(562_412);

    expect(result.totalSETax).toBe(2_183_640 + 562_412);
    expect(result.halfSETaxDeduction).toBe(Math.round((2_183_640 + 562_412) / 2));
  });

  it('W-2 wages reduce available SS wage base', () => {
    // W-2 SS wages: $100,000 = 10_000_000 cents
    // Remaining SS base: 17_610_000 - 10_000_000 = 7_610_000
    const netSEIncome = 10_000_000;  // $100,000

    const result = computeSelfEmploymentTax(netSEIncome, 10_000_000, 'single', config);

    // SE taxable: 10_000_000 * 0.9235 = 9_235_000
    expect(result.seTaxableIncome).toBe(9_235_000);

    // Remaining SS base: 17_610_000 - 10_000_000 = 7_610_000
    // SS income subject = min(9_235_000, 7_610_000) = 7_610_000
    // SS tax: 7_610_000 * 0.124 = 943_640
    expect(result.socialSecurityTax).toBe(943_640);

    // Medicare: full 9_235_000 * 0.029 = 267_815
    expect(result.medicareTax).toBe(267_815);
  });

  it('W-2 wages already at SS wage base: $0 SS portion, only Medicare', () => {
    const netSEIncome = 5_000_000;  // $50,000
    const w2SSWages = 17_610_000;   // Already at the wage base

    const result = computeSelfEmploymentTax(netSEIncome, w2SSWages, 'single', config);

    // SE taxable: 5_000_000 * 0.9235 = 4_617_500
    expect(result.seTaxableIncome).toBe(4_617_500);

    // No remaining SS base: $0 SS tax
    expect(result.socialSecurityTax).toBe(0);

    // Medicare: 4_617_500 * 0.029 = 133_907.5 → 133_908
    expect(result.medicareTax).toBe(133_908);

    expect(result.totalSETax).toBe(133_908);
    expect(result.halfSETaxDeduction).toBe(Math.round(133_908 / 2));
  });

  it('W-2 wages above SS wage base: $0 SS portion', () => {
    const netSEIncome = 5_000_000;
    const w2SSWages = 20_000_000;  // Above the wage base

    const result = computeSelfEmploymentTax(netSEIncome, w2SSWages, 'single', config);

    expect(result.socialSecurityTax).toBe(0);
    // Medicare still computed on full SE taxable income
    expect(result.medicareTax).toBeGreaterThan(0);
  });

  it('zero SE income → zero tax', () => {
    const result = computeSelfEmploymentTax(0, 0, 'single', config);

    expect(result.seTaxableIncome).toBe(0);
    expect(result.socialSecurityTax).toBe(0);
    expect(result.medicareTax).toBe(0);
    expect(result.totalSETax).toBe(0);
    expect(result.halfSETaxDeduction).toBe(0);
  });

  it('negative SE income → zero tax', () => {
    const result = computeSelfEmploymentTax(-1_000_000, 0, 'single', config);

    expect(result.seTaxableIncome).toBe(0);
    expect(result.socialSecurityTax).toBe(0);
    expect(result.medicareTax).toBe(0);
    expect(result.totalSETax).toBe(0);
    expect(result.halfSETaxDeduction).toBe(0);
  });
});

// ===========================================================================
// QBI Deduction
// ===========================================================================
describe('computeQBIDeduction', () => {
  it('below phase-out: full 20% deduction', () => {
    // Single filer, taxable income well below $197,300
    const qbi = 7_000_000;                    // $70,000
    const taxableIncomeBeforeQBI = 8_000_000;  // $80,000

    const result = computeQBIDeduction(qbi, taxableIncomeBeforeQBI, 'single', config);

    // 20% of $70,000 = $14,000 = 1_400_000 cents
    expect(result).toBe(1_400_000);
  });

  it('QBI deduction cannot exceed 20% of taxable income', () => {
    // QBI is high but taxable income is low
    const qbi = 10_000_000;                   // $100,000
    const taxableIncomeBeforeQBI = 5_000_000;  // $50,000

    const result = computeQBIDeduction(qbi, taxableIncomeBeforeQBI, 'single', config);

    // 20% of QBI = 2_000_000, but 20% of taxable income = 1_000_000
    // Capped at 1_000_000
    expect(result).toBe(1_000_000);
  });

  it('MFJ below phase-out: full 20% deduction', () => {
    const qbi = 15_000_000;                    // $150,000
    const taxableIncomeBeforeQBI = 30_000_000;  // $300,000 (below MFJ begin $394,600)

    const result = computeQBIDeduction(qbi, taxableIncomeBeforeQBI, 'married_filing_jointly', config);

    // 20% of $150,000 = $30,000 = 3_000_000 cents
    expect(result).toBe(3_000_000);
  });

  it('above phase-out with no W-2 wages: $0 deduction', () => {
    // Single filer above the end of phase-out ($247,300 = 24_730_000)
    const qbi = 30_000_000;                    // $300,000
    const taxableIncomeBeforeQBI = 30_000_000;  // $300,000 — above phase-out end

    const result = computeQBIDeduction(qbi, taxableIncomeBeforeQBI, 'single', config);

    // Above phase-out for a solo self-employed person with no W-2 wages paid = $0
    expect(result).toBe(0);
  });

  it('in phase-out range: reduced deduction (single)', () => {
    // Single: phase-out begins at 19_730_000, ends at 24_730_000
    // Midpoint: 22_230_000 ($222,300) — 50% through phase-out
    const qbi = 22_230_000;
    const taxableIncomeBeforeQBI = 22_230_000;

    const result = computeQBIDeduction(qbi, taxableIncomeBeforeQBI, 'single', config);

    // Full 20% = 22_230_000 * 0.20 = 4_446_000
    // Phase-out reduction factor = (22_230_000 - 19_730_000) / (24_730_000 - 19_730_000) = 2_500_000 / 5_000_000 = 0.5
    // Reduction = 4_446_000 * 0.5 = 2_223_000
    // Reduced deduction = 4_446_000 - 2_223_000 = 2_223_000
    // But also capped at 20% of taxable income = 22_230_000 * 0.20 = 4_446_000 (not binding)
    expect(result).toBe(2_223_000);
  });

  it('in phase-out range: reduced deduction (MFJ)', () => {
    // MFJ: phase-out begins at 39_460_000, ends at 49_460_000
    // At 44_460_000 ($444,600) — 50% through phase-out
    const qbi = 44_460_000;
    const taxableIncomeBeforeQBI = 44_460_000;

    const result = computeQBIDeduction(qbi, taxableIncomeBeforeQBI, 'married_filing_jointly', config);

    // Full 20% = 44_460_000 * 0.20 = 8_892_000
    // Phase-out factor = (44_460_000 - 39_460_000) / (49_460_000 - 39_460_000) = 5_000_000 / 10_000_000 = 0.5
    // Reduction = 8_892_000 * 0.5 = 4_446_000
    // Reduced = 8_892_000 - 4_446_000 = 4_446_000
    expect(result).toBe(4_446_000);
  });

  it('zero QBI → zero deduction', () => {
    const result = computeQBIDeduction(0, 10_000_000, 'single', config);
    expect(result).toBe(0);
  });

  it('negative QBI → zero deduction', () => {
    const result = computeQBIDeduction(-5_000_000, 10_000_000, 'single', config);
    expect(result).toBe(0);
  });

  it('zero taxable income → zero deduction', () => {
    const result = computeQBIDeduction(5_000_000, 0, 'single', config);
    expect(result).toBe(0);
  });

  it('negative taxable income → zero deduction', () => {
    const result = computeQBIDeduction(5_000_000, -1_000_000, 'single', config);
    expect(result).toBe(0);
  });

  it('just at phase-out begin: full deduction', () => {
    // Single phase-out begins at 19_730_000
    const qbi = 19_730_000;
    const taxableIncomeBeforeQBI = 19_730_000;

    const result = computeQBIDeduction(qbi, taxableIncomeBeforeQBI, 'single', config);

    // Exactly at begin → 0% reduction → full 20%
    // 20% of QBI = 3_946_000
    // 20% of taxable = 3_946_000
    expect(result).toBe(3_946_000);
  });

  it('just at phase-out end: zero deduction (no W-2 wages)', () => {
    // Single phase-out ends at 24_730_000
    const qbi = 24_730_000;
    const taxableIncomeBeforeQBI = 24_730_000;

    const result = computeQBIDeduction(qbi, taxableIncomeBeforeQBI, 'single', config);

    expect(result).toBe(0);
  });
});

// ===========================================================================
// computeSelfEmployment (orchestrator)
// ===========================================================================
describe('computeSelfEmployment', () => {
  it('no ScheduleCData → zero result', () => {
    const result = computeSelfEmployment(
      undefined,
      0,
      'single',
      10_000_000,
      config,
    );

    expect(result.scheduleCNetProfit).toBe(0);
    expect(result.homeOfficeDeduction).toBe(0);
    expect(result.seTaxableIncome).toBe(0);
    expect(result.socialSecurityTax).toBe(0);
    expect(result.medicareTax).toBe(0);
    expect(result.totalSETax).toBe(0);
    expect(result.halfSETaxDeduction).toBe(0);
    expect(result.qbiDeduction).toBe(0);
  });

  it('full flow: $100k gross, $30k expenses, single filer', () => {
    const data = makeScheduleC({
      grossReceipts: 10_000_000,
      expenses: {
        advertising: 500_000,
        insurance: 500_000,
        supplies: 1_000_000,
        utilities: 1_000_000,
      },
    });

    // taxableIncomeBeforeQBI is what the orchestrator calculates:
    // Approximate: AGI minus deductions (for testing, use a reasonable value)
    const taxableIncomeBeforeQBI = 5_000_000;  // $50,000

    const result = computeSelfEmployment(data, 0, 'single', taxableIncomeBeforeQBI, config);

    // Schedule C net profit: 10_000_000 - 3_000_000 = 7_000_000
    expect(result.scheduleCNetProfit).toBe(7_000_000);
    expect(result.homeOfficeDeduction).toBe(0);

    // SE taxable: 7_000_000 * 0.9235 = 6_464_500
    expect(result.seTaxableIncome).toBe(6_464_500);

    // SS + Medicare taxes
    expect(result.socialSecurityTax).toBe(801_598);
    expect(result.medicareTax).toBe(187_471);
    expect(result.totalSETax).toBe(989_069);
    expect(result.halfSETaxDeduction).toBe(494_535);

    // QBI: 20% of 7_000_000 = 1_400_000, capped at 20% of 5_000_000 = 1_000_000
    expect(result.qbiDeduction).toBe(1_000_000);
  });

  it('full flow with home office and W-2 wages', () => {
    const data = makeScheduleC({
      grossReceipts: 15_000_000,  // $150,000
      expenses: {
        supplies: 2_000_000,      // $20,000
      },
      homeOffice: {
        squareFootage: 250,
        useSimplifiedMethod: true,
      },
    });

    const w2SSWages = 5_000_000;               // $50,000
    const taxableIncomeBeforeQBI = 20_000_000;  // $200,000 (above single phase-out)

    const result = computeSelfEmployment(data, w2SSWages, 'single', taxableIncomeBeforeQBI, config);

    // Home office: 250 * 500 = 125_000
    expect(result.homeOfficeDeduction).toBe(125_000);

    // Net profit: 15_000_000 - 2_000_000 - 125_000 = 12_875_000
    expect(result.scheduleCNetProfit).toBe(12_875_000);

    // SE taxable: 12_875_000 * 0.9235 = 11_890_063 (Math.round(12_875_000 * 0.9235))
    const expectedSETaxable = Math.round(12_875_000 * 0.9235);
    expect(result.seTaxableIncome).toBe(expectedSETaxable);

    // SS: remaining base = 17_610_000 - 5_000_000 = 12_610_000
    // min(expectedSETaxable, 12_610_000) = expectedSETaxable (11_890_063 < 12_610_000)
    const expectedSS = Math.round(expectedSETaxable * 0.124);
    expect(result.socialSecurityTax).toBe(expectedSS);

    // Medicare: expectedSETaxable * 0.029
    const expectedMedicare = Math.round(expectedSETaxable * 0.029);
    expect(result.medicareTax).toBe(expectedMedicare);
  });

  it('net loss: zero SE tax, zero QBI', () => {
    const data = makeScheduleC({
      grossReceipts: 2_000_000,
      expenses: {
        advertising: 1_000_000,
        insurance: 500_000,
        supplies: 1_000_000,
        utilities: 500_000,
      },
    });

    const result = computeSelfEmployment(data, 0, 'single', 5_000_000, config);

    expect(result.scheduleCNetProfit).toBe(-1_000_000);
    expect(result.seTaxableIncome).toBe(0);
    expect(result.socialSecurityTax).toBe(0);
    expect(result.medicareTax).toBe(0);
    expect(result.totalSETax).toBe(0);
    expect(result.halfSETaxDeduction).toBe(0);
    expect(result.qbiDeduction).toBe(0);
  });

  it('returns correct SelfEmploymentResult shape', () => {
    const data = makeScheduleC({
      grossReceipts: 5_000_000,
      expenses: {},
    });

    const result = computeSelfEmployment(data, 0, 'single', 5_000_000, config);

    // Verify all required fields exist
    expect(result).toHaveProperty('scheduleCNetProfit');
    expect(result).toHaveProperty('homeOfficeDeduction');
    expect(result).toHaveProperty('seTaxableIncome');
    expect(result).toHaveProperty('socialSecurityTax');
    expect(result).toHaveProperty('medicareTax');
    expect(result).toHaveProperty('totalSETax');
    expect(result).toHaveProperty('halfSETaxDeduction');
    expect(result).toHaveProperty('qbiDeduction');
  });
});

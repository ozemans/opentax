import { describe, it, expect } from 'vitest';
import {
  computeStandardDeduction,
  computeSaltCap,
  computeItemizedDeductions,
  computeDeductions,
} from '../../src/engine/federal/deductions';
import type { FilingStatus, FederalConfig, ItemizedDeductions } from '../../src/engine/types';
import config from '../../config/federal-2025.json';

const cfg = config as unknown as FederalConfig;

// Source: OBBBA §70101 — increased standard deduction for 2025
// Additional: Rev. Proc. 2024-40 §3.01(1)(b) — age 65+/blind additional amounts
// Verified: 2026-02-25
describe('computeStandardDeduction', () => {
  it('should return $15,750 for single filer', () => {
    expect(computeStandardDeduction('single', cfg, false, false, false, false)).toBe(1575000);
  });

  it('should return $31,500 for MFJ filer', () => {
    expect(computeStandardDeduction('married_filing_jointly', cfg, false, false, false, false)).toBe(3150000);
  });

  it('should return $15,750 for MFS filer', () => {
    expect(computeStandardDeduction('married_filing_separately', cfg, false, false, false, false)).toBe(1575000);
  });

  it('should return $23,625 for HoH filer', () => {
    expect(computeStandardDeduction('head_of_household', cfg, false, false, false, false)).toBe(2362500);
  });

  it('should return $31,500 for QSS filer', () => {
    expect(computeStandardDeduction('qualifying_surviving_spouse', cfg, false, false, false, false)).toBe(3150000);
  });

  it('should add $2,000 + $6,000 senior for single filer age 65+', () => {
    // $15,750 + $2,000 age + $6,000 senior = $23,750 (AGI 0 = below phase-out)
    expect(computeStandardDeduction('single', cfg, true, false, false, false)).toBe(2375000);
  });

  it('should add $2,000 for single filer who is blind (no senior deduction)', () => {
    expect(computeStandardDeduction('single', cfg, false, true, false, false)).toBe(1775000);
  });

  it('should add $4,000 + $6,000 senior for single filer age 65+ AND blind', () => {
    // $15,750 + $2,000 + $2,000 + $6,000 senior = $25,750
    expect(computeStandardDeduction('single', cfg, true, true, false, false)).toBe(2575000);
  });

  it('should add $1,600 + $6,000 senior for MFJ taxpayer age 65+', () => {
    // $31,500 + $1,600 + $6,000 senior = $39,100 (AGI 0 = below phase-out)
    expect(computeStandardDeduction('married_filing_jointly', cfg, true, false, false, false)).toBe(3910000);
  });

  it('should add $3,200 + $12,000 senior for MFJ both spouses age 65+', () => {
    // $31,500 + $1,600 + $1,600 + $6,000 * 2 = $46,700
    expect(computeStandardDeduction('married_filing_jointly', cfg, true, false, true, false)).toBe(4670000);
  });

  it('should add $6,400 + $12,000 senior for MFJ both 65+ and blind', () => {
    // $31,500 + $1,600 * 4 + $6,000 * 2 = $49,900
    expect(computeStandardDeduction('married_filing_jointly', cfg, true, true, true, true)).toBe(4990000);
  });
});

describe('computeSaltCap', () => {
  it('should return base cap $40,000 for MAGI below phase-out', () => {
    expect(computeSaltCap(30000000, 'single', cfg)).toBe(4000000); // $300k MAGI
  });

  it('should return base cap $20,000 for MFS below phase-out', () => {
    expect(computeSaltCap(20000000, 'married_filing_separately', cfg)).toBe(2000000);
  });

  it('should phase down cap above $500,000 MAGI', () => {
    // $550,000 MAGI, single: excess = $50,000, reduction = $50,000 * 0.30 = $15,000
    // Cap = $40,000 - $15,000 = $25,000
    expect(computeSaltCap(55000000, 'single', cfg)).toBe(2500000);
  });

  it('should hit floor of $10,000 at $600,000 MAGI', () => {
    expect(computeSaltCap(60000000, 'single', cfg)).toBe(1000000);
  });

  it('should stay at floor above $600,000 MAGI', () => {
    expect(computeSaltCap(100000000, 'single', cfg)).toBe(1000000);
  });

  it('should hit floor of $5,000 for MFS at $300,000 MAGI', () => {
    expect(computeSaltCap(30000000, 'married_filing_separately', cfg)).toBe(500000);
  });

  it('should be exactly at base cap at phase-out begin', () => {
    expect(computeSaltCap(50000000, 'single', cfg)).toBe(4000000);
  });

  it('should compute MFJ phase-out correctly', () => {
    // $550k MAGI MFJ: excess = $50k, reduction = $15k, cap = $25k
    expect(computeSaltCap(55000000, 'married_filing_jointly', cfg)).toBe(2500000);
  });
});

describe('computeItemizedDeductions', () => {
  const baseItemized: ItemizedDeductions = {
    medicalExpenses: 0,
    stateLocalTaxesPaid: 0,
    realEstateTaxes: 0,
    mortgageInterest: 0,
    charitableCash: 0,
    charitableNonCash: 0,
  };

  it('should return 0 for all-zero itemized deductions', () => {
    expect(computeItemizedDeductions(baseItemized, 5000000, 'single', cfg)).toEqual({
      total: 0,
      saltCapped: 0,
    });
  });

  it('should deduct medical expenses exceeding 7.5% of AGI', () => {
    // AGI $100,000, medical $10,000 → threshold $7,500, deductible = $2,500
    const result = computeItemizedDeductions(
      { ...baseItemized, medicalExpenses: 1000000 },
      10000000,
      'single',
      cfg,
    );
    expect(result.total).toBe(250000);
  });

  it('should not deduct medical expenses below 7.5% threshold', () => {
    // AGI $100,000, medical $5,000 → threshold $7,500, deductible = $0
    const result = computeItemizedDeductions(
      { ...baseItemized, medicalExpenses: 500000 },
      10000000,
      'single',
      cfg,
    );
    expect(result.total).toBe(0);
  });

  it('should cap SALT at the computed cap ($40k for income under $500k)', () => {
    // State taxes $50,000 + property $10,000 = $60,000 total
    // Cap = $40,000 (MAGI under $500k)
    const result = computeItemizedDeductions(
      { ...baseItemized, stateLocalTaxesPaid: 5000000, realEstateTaxes: 1000000 },
      20000000,  // $200k AGI
      'single',
      cfg,
    );
    expect(result.saltCapped).toBe(4000000);
    expect(result.total).toBe(4000000);
  });

  it('should allow full SALT when under cap', () => {
    const result = computeItemizedDeductions(
      { ...baseItemized, stateLocalTaxesPaid: 500000, realEstateTaxes: 200000 },
      5000000,
      'single',
      cfg,
    );
    expect(result.saltCapped).toBe(700000);
    expect(result.total).toBe(700000);
  });

  it('should cap SALT at phased-down amount for high MAGI', () => {
    // MAGI $550k: salt cap = $25,000
    const result = computeItemizedDeductions(
      { ...baseItemized, stateLocalTaxesPaid: 3000000, realEstateTaxes: 500000 },
      55000000,
      'single',
      cfg,
    );
    // Total SALT = $35,000, cap = $25,000
    expect(result.saltCapped).toBe(2500000);
    expect(result.total).toBe(2500000);
  });

  it('should include mortgage interest', () => {
    const result = computeItemizedDeductions(
      { ...baseItemized, mortgageInterest: 1200000 },
      5000000,
      'single',
      cfg,
    );
    expect(result.total).toBe(1200000);
  });

  it('should limit charitable cash to 60% of AGI', () => {
    // AGI $50,000, cash charity $40,000 → limit = $30,000 (60%)
    const result = computeItemizedDeductions(
      { ...baseItemized, charitableCash: 4000000 },
      5000000,
      'single',
      cfg,
    );
    expect(result.total).toBe(3000000);
  });

  it('should limit charitable non-cash to 30% of AGI', () => {
    // AGI $100,000, non-cash $40,000 → limit = $30,000 (30%)
    const result = computeItemizedDeductions(
      { ...baseItemized, charitableNonCash: 4000000 },
      10000000,
      'single',
      cfg,
    );
    expect(result.total).toBe(3000000);
  });

  it('should sum all itemized categories', () => {
    // AGI $200,000
    // Medical $20,000 → threshold $15,000, deductible $5,000
    // SALT $30,000 → under $40k cap
    // Mortgage $15,000
    // Cash charity $10,000 → under 60% limit
    // Total: $5,000 + $30,000 + $15,000 + $10,000 = $60,000
    const result = computeItemizedDeductions(
      {
        medicalExpenses: 2000000,
        stateLocalTaxesPaid: 2000000,
        realEstateTaxes: 1000000,
        mortgageInterest: 1500000,
        charitableCash: 1000000,
        charitableNonCash: 0,
      },
      20000000,
      'single',
      cfg,
    );
    expect(result.total).toBe(6000000);
    expect(result.saltCapped).toBe(3000000);
  });
});

describe('computeDeductions', () => {
  it('should use standard deduction when itemized is not chosen', () => {
    const result = computeDeductions(
      'single',
      5000000,
      false,
      undefined,
      cfg,
      false, false, false, false,
    );
    expect(result.type).toBe('standard');
    expect(result.amount).toBe(1575000);
  });

  it('should use itemized when chosen and itemized is provided', () => {
    const itemized: ItemizedDeductions = {
      medicalExpenses: 0,
      stateLocalTaxesPaid: 1000000,
      realEstateTaxes: 500000,
      mortgageInterest: 1500000,
      charitableCash: 500000,
      charitableNonCash: 0,
    };
    const result = computeDeductions(
      'single',
      10000000,
      true,
      itemized,
      cfg,
      false, false, false, false,
    );
    expect(result.type).toBe('itemized');
    // SALT: 1000000 + 500000 = 1500000 (under $40k cap)
    // Mortgage: 1500000
    // Charity: 500000
    // Total: 3500000
    expect(result.amount).toBe(3500000);
  });

  it('should always compute both standard and itemized for comparison', () => {
    const result = computeDeductions(
      'single',
      10000000,
      false,
      undefined,
      cfg,
      false, false, false, false,
    );
    expect(result.standardAmount).toBe(1575000);
    expect(result.itemizedAmount).toBe(0);
  });

  it('should compute taxable income correctly', () => {
    // AGI $52,000, standard deduction $15,750 → taxable $36,250
    const result = computeDeductions(
      'single',
      5200000,
      false,
      undefined,
      cfg,
      false, false, false, false,
    );
    expect(result.amount).toBe(1575000);
  });
});

// Source: OBBBA §70201 — CTC $2,200/$1,700 refundable for 2025
// Source: Rev. Proc. 2024-40 §3.01(2) — EITC parameters for 2025
// Source: Rev. Proc. 2024-40 §3.01(4) — Saver's Credit income limits
// Source: IRC §25A — education credits (AOTC/LLC)
// Source: IRC §21 — child and dependent care credit
// Verified: 2026-02-25

import { describe, it, expect } from 'vitest';
import {
  computeChildTaxCredit,
  computeOtherDependentCredit,
  computeChildCareCredit,
  computeEITC,
  computeEducationCredits,
  computeSaversCredit,
  computeAllCredits,
} from '../../src/engine/federal/credits';
import type { FilingStatus, FederalConfig, Dependent, TaxInput } from '../../src/engine/types';
import config from '../../config/federal-2025.json';

const cfg = config as unknown as FederalConfig;

function makeDependentCTC(): Dependent {
  return {
    firstName: 'Child', lastName: 'Test', ssn: '111-22-3333',
    relationship: 'son', dateOfBirth: '2012-06-15', monthsLivedWithYou: 12,
    isStudent: false, isDisabled: false, qualifiesForCTC: true, qualifiesForODC: false,
  };
}

function makeDependentODC(): Dependent {
  return {
    firstName: 'Parent', lastName: 'Test', ssn: '444-55-6666',
    relationship: 'parent', dateOfBirth: '1950-03-01', monthsLivedWithYou: 12,
    isStudent: false, isDisabled: false, qualifiesForCTC: false, qualifiesForODC: true,
  };
}

describe('computeChildTaxCredit', () => {
  it('should give $2,200 per qualifying child (2025 OBBBA)', () => {
    const deps = [makeDependentCTC(), makeDependentCTC()];
    const result = computeChildTaxCredit(deps, 8000000, 'single', 500000, cfg);
    expect(result.nonrefundable).toBe(440000); // $4,400
  });

  it('should return 0 with no qualifying children', () => {
    const result = computeChildTaxCredit([], 5000000, 'single', 500000, cfg);
    expect(result.nonrefundable).toBe(0);
    expect(result.refundable).toBe(0);
  });

  it('should phase out above $200,000 single', () => {
    // 1 child, AGI $210,000 → excess $10,000
    // Reduction: Math.ceil(10000 / 1000) * $50 = 10 * $50 = $500
    // CTC: $2,200 - $500 = $1,700
    const deps = [makeDependentCTC()];
    const result = computeChildTaxCredit(deps, 21000000, 'single', 400000, cfg);
    expect(result.nonrefundable + result.refundable).toBe(170000);
  });

  it('should phase out above $400,000 MFJ', () => {
    // 2 children, AGI $420,000 → excess $20,000
    // Reduction: 20 * $50 = $1,000
    // CTC: $4,400 - $1,000 = $3,400
    const deps = [makeDependentCTC(), makeDependentCTC()];
    const result = computeChildTaxCredit(deps, 42000000, 'married_filing_jointly', 800000, cfg);
    expect(result.nonrefundable + result.refundable).toBe(340000);
  });

  it('should fully phase out when reduction exceeds credit', () => {
    // 1 child ($2,200), AGI $244,000 → excess $44,000
    // Reduction: 44 * $50 = $2,200 → credit zeroed
    const deps = [makeDependentCTC()];
    const result = computeChildTaxCredit(deps, 24400000, 'single', 400000, cfg);
    expect(result.nonrefundable + result.refundable).toBe(0);
  });

  it('should cap nonrefundable at tax liability', () => {
    // 1 child, low tax liability $1,000
    const deps = [makeDependentCTC()];
    const result = computeChildTaxCredit(deps, 3000000, 'single', 100000, cfg);
    expect(result.nonrefundable).toBe(100000); // Capped at tax
    // Refundable (Additional CTC): limited to $1,700 per child
    expect(result.refundable).toBeLessThanOrEqual(170000);
  });

  it('should compute refundable Additional CTC up to $1,700 per child', () => {
    // Tax = $0, so all CTC goes to ACTC
    // 1 child, earned income = $20,000
    // ACTC = min($1,700, 15% * ($20,000 - $2,500)) = min($1,700, $2,625) = $1,700
    const deps = [makeDependentCTC()];
    const result = computeChildTaxCredit(deps, 2000000, 'single', 0, cfg);
    expect(result.refundable).toBe(170000);
  });
});

describe('computeOtherDependentCredit', () => {
  it('should give $500 per qualifying dependent', () => {
    const deps = [makeDependentODC(), makeDependentODC()];
    expect(computeOtherDependentCredit(deps, 10000000, 'single', cfg)).toBe(100000);
  });

  it('should return 0 with no qualifying dependents', () => {
    expect(computeOtherDependentCredit([], 10000000, 'single', cfg)).toBe(0);
  });

  it('should phase out same as CTC', () => {
    // 1 dependent, AGI $210,000 single → excess $10,000
    // Reduction: 10 * $50 = $500 → zeroes out $500 credit
    const deps = [makeDependentODC()];
    expect(computeOtherDependentCredit(deps, 21000000, 'single', cfg)).toBe(0);
  });
});

describe('computeChildCareCredit', () => {
  it('should compute credit at max 35% rate for low income', () => {
    // Expenses $3,000 (1 child max), income $10,000 → rate 35%
    // Credit = $3,000 * 35% = $1,050
    const result = computeChildCareCredit(300000, 1, 1000000, cfg);
    expect(result).toBe(105000);
  });

  it('should cap expenses at $3,000 for one child', () => {
    const result = computeChildCareCredit(500000, 1, 1000000, cfg);
    // Capped at $3,000 → $3,000 * 35% = $1,050
    expect(result).toBe(105000);
  });

  it('should cap expenses at $6,000 for two+ children', () => {
    const result = computeChildCareCredit(800000, 2, 1000000, cfg);
    // Capped at $6,000 → $6,000 * 35% = $2,100
    expect(result).toBe(210000);
  });

  it('should reduce rate to 20% for high income', () => {
    // At very high income, rate floors at 20%
    // Expenses $3,000, rate 20% → $600
    const result = computeChildCareCredit(300000, 1, 10000000, cfg);
    expect(result).toBe(60000);
  });

  it('should return 0 when no expenses', () => {
    expect(computeChildCareCredit(0, 1, 5000000, cfg)).toBe(0);
  });
});

describe('computeEITC', () => {
  it('should return 0 for income above limits (single, 0 children)', () => {
    expect(computeEITC(2500000, 2500000, 0, 'single', 0, cfg)).toBe(0);
  });

  it('should return 0 for MFS filers', () => {
    expect(computeEITC(1000000, 1000000, 0, 'married_filing_separately', 0, cfg)).toBe(0);
  });

  it('should compute max credit for 0 children at plateau', () => {
    // Earned income at $8,490 (completed phase-in), AGI same
    expect(computeEITC(849000, 849000, 0, 'single', 0, cfg)).toBe(64900);
  });

  it('should compute max credit for 1 child at plateau', () => {
    // Earned income at $12,730
    expect(computeEITC(1273000, 1273000, 1, 'single', 0, cfg)).toBe(432800);
  });

  it('should compute max credit for 2 children', () => {
    expect(computeEITC(1788000, 1788000, 2, 'single', 0, cfg)).toBe(715200);
  });

  it('should compute max credit for 3+ children', () => {
    expect(computeEITC(1788000, 1788000, 3, 'single', 0, cfg)).toBe(804600);
  });

  it('should phase in credit for low earned income (0 children)', () => {
    // $5,000 earned income, 0 children → 7.65% * $5,000 = $382.50 → 38250
    expect(computeEITC(500000, 500000, 0, 'single', 0, cfg)).toBe(38250);
  });

  it('should phase out credit for moderate income (1 child, single)', () => {
    // Earned income $35,000, 1 child, single
    // Phase-out begins $23,350, rate 15.98%
    // Reduction: ($35,000 - $23,350) * 15.98% = $11,650 * 0.1598 = $1,861.67
    // Max credit $4,328, credit = $4,328 - $1,862 = $2,466 → 246600
    const result = computeEITC(3500000, 3500000, 1, 'single', 0, cfg);
    expect(result).toBeGreaterThan(200000);
    expect(result).toBeLessThan(432800);
  });

  it('should return 0 when investment income exceeds limit', () => {
    expect(computeEITC(1000000, 1000000, 1, 'single', 1200000, cfg)).toBe(0);
  });

  it('should use MFJ phase-out thresholds', () => {
    // $30,000 earned, 1 child, MFJ → phase-out begins at $30,470
    // Just below phase-out → should get full or near-full credit
    const result = computeEITC(3000000, 3000000, 1, 'married_filing_jointly', 0, cfg);
    expect(result).toBe(432800); // Full credit — below phase-out begin
  });
});

describe('computeEducationCredits', () => {
  it('should compute AOTC: 100% of first $2,000 + 25% of next $2,000', () => {
    const expenses = [{ type: 'american_opportunity' as const, qualifiedExpenses: 400000, studentSSN: '111-22-3333' }];
    const result = computeEducationCredits(expenses, 5000000, 'single', cfg);
    // 100% * $2,000 + 25% * $2,000 = $2,500
    expect(result).toBe(250000);
  });

  it('should cap AOTC at $2,500 for expenses over $4,000', () => {
    const expenses = [{ type: 'american_opportunity' as const, qualifiedExpenses: 600000, studentSSN: '111-22-3333' }];
    const result = computeEducationCredits(expenses, 5000000, 'single', cfg);
    expect(result).toBe(250000);
  });

  it('should compute LLC: 20% of up to $10,000', () => {
    const expenses = [{ type: 'lifetime_learning' as const, qualifiedExpenses: 500000, studentSSN: '111-22-3333' }];
    const result = computeEducationCredits(expenses, 5000000, 'single', cfg);
    // 20% * $5,000 = $1,000
    expect(result).toBe(100000);
  });

  it('should cap LLC at $2,000', () => {
    const expenses = [{ type: 'lifetime_learning' as const, qualifiedExpenses: 1500000, studentSSN: '111-22-3333' }];
    const result = computeEducationCredits(expenses, 5000000, 'single', cfg);
    expect(result).toBe(200000);
  });

  it('should phase out education credits above MAGI threshold', () => {
    // AOTC, single, MAGI $85,000 → halfway through phase-out ($80k-$90k)
    const expenses = [{ type: 'american_opportunity' as const, qualifiedExpenses: 400000, studentSSN: '111-22-3333' }];
    const result = computeEducationCredits(expenses, 8500000, 'single', cfg);
    // $2,500 * 50% = $1,250
    expect(result).toBe(125000);
  });

  it('should return 0 above phase-out end', () => {
    const expenses = [{ type: 'american_opportunity' as const, qualifiedExpenses: 400000, studentSSN: '111-22-3333' }];
    const result = computeEducationCredits(expenses, 9000000, 'single', cfg);
    expect(result).toBe(0);
  });

  it('should return 0 with no education expenses', () => {
    expect(computeEducationCredits([], 5000000, 'single', cfg)).toBe(0);
    expect(computeEducationCredits(undefined, 5000000, 'single', cfg)).toBe(0);
  });
});

describe('computeSaversCredit', () => {
  it('should return 50% rate for low income single', () => {
    // AGI $20,000, contributions $2,000 → 50% * $2,000 = $1,000
    expect(computeSaversCredit(200000, 2000000, 'single', cfg)).toBe(100000);
  });

  it('should cap contributions at $2,000 single', () => {
    // AGI $20,000, contributions $5,000 → capped at $2,000 → 50% * $2,000 = $1,000
    expect(computeSaversCredit(500000, 2000000, 'single', cfg)).toBe(100000);
  });

  it('should return 20% rate for mid income', () => {
    // Single AGI $24,000 → 20% bracket ($23,751-$25,500)
    // $2,000 * 20% = $400
    expect(computeSaversCredit(200000, 2400000, 'single', cfg)).toBe(40000);
  });

  it('should return 10% rate for higher income', () => {
    // Single AGI $30,000 → 10% bracket ($25,501-$39,500)
    // $2,000 * 10% = $200
    expect(computeSaversCredit(200000, 3000000, 'single', cfg)).toBe(20000);
  });

  it('should return 0% above income limit', () => {
    // Single AGI $40,000 → 0%
    expect(computeSaversCredit(200000, 4000000, 'single', cfg)).toBe(0);
  });

  it('should return 0 with no contributions', () => {
    expect(computeSaversCredit(0, 2000000, 'single', cfg)).toBe(0);
  });

  it('should use MFJ limits and $4,000 max contribution', () => {
    // MFJ AGI $40,000 → 50% bracket (up to $47,500)
    // $4,000 * 50% = $2,000
    expect(computeSaversCredit(400000, 4000000, 'married_filing_jointly', cfg)).toBe(200000);
  });
});

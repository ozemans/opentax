import { describe, it, expect } from 'vitest';
import type {
  Form1099B,
  Form1099DIV,
  Form8949Category,
  FederalConfig,
  FilingStatus,
  CapitalGainsResult,
} from '../../src/engine/types.ts';
import {
  categorizeTransactions,
  computeCapitalGains,
} from '../../src/engine/federal/capital-gains.ts';
import federalConfig from '../../config/federal-2025.json';

const config = federalConfig as unknown as FederalConfig;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTx(overrides: Partial<Form1099B> & Pick<Form1099B, 'proceeds' | 'costBasis' | 'gainLoss'>): Form1099B {
  return {
    description: 'TEST STOCK',
    dateAcquired: '2024-01-15',
    dateSold: '2025-06-15',
    proceeds: overrides.proceeds,
    costBasis: overrides.costBasis,
    gainLoss: overrides.gainLoss,
    isLongTerm: overrides.isLongTerm ?? false,
    basisReportedToIRS: overrides.basisReportedToIRS ?? true,
    category: overrides.category ?? '8949_A',
    ...overrides,
  };
}

function makeShortTermGain(amount: number): Form1099B {
  return makeTx({
    proceeds: amount,
    costBasis: 0,
    gainLoss: amount,
    isLongTerm: false,
    basisReportedToIRS: true,
    category: '8949_A',
  });
}

function makeShortTermLoss(amount: number): Form1099B {
  // amount is the loss magnitude (positive number representing how much was lost)
  return makeTx({
    proceeds: 0,
    costBasis: amount,
    gainLoss: -amount,
    isLongTerm: false,
    basisReportedToIRS: true,
    category: '8949_A',
  });
}

function makeLongTermGain(amount: number): Form1099B {
  return makeTx({
    proceeds: amount,
    costBasis: 0,
    gainLoss: amount,
    isLongTerm: true,
    basisReportedToIRS: true,
    category: '8949_D',
  });
}

function makeLongTermLoss(amount: number): Form1099B {
  return makeTx({
    proceeds: 0,
    costBasis: amount,
    gainLoss: -amount,
    isLongTerm: true,
    basisReportedToIRS: true,
    category: '8949_D',
  });
}

// ---------------------------------------------------------------------------
// Tests: categorizeTransactions
// ---------------------------------------------------------------------------

describe('categorizeTransactions', () => {
  it('returns empty arrays for all 6 categories when no transactions provided', () => {
    const result = categorizeTransactions([]);
    const categories: Form8949Category[] = [
      '8949_A', '8949_B', '8949_C', '8949_D', '8949_E', '8949_F',
    ];
    for (const cat of categories) {
      expect(result[cat]).toEqual([]);
    }
  });

  it('categorizes short-term, basis reported to IRS → 8949_A', () => {
    const tx = makeTx({
      proceeds: 1000_00,
      costBasis: 500_00,
      gainLoss: 500_00,
      isLongTerm: false,
      basisReportedToIRS: true,
      category: '8949_A',
    });
    const result = categorizeTransactions([tx]);
    expect(result['8949_A']).toHaveLength(1);
    expect(result['8949_A'][0]).toBe(tx);
  });

  it('categorizes short-term, basis NOT reported → 8949_B', () => {
    const tx = makeTx({
      proceeds: 1000_00,
      costBasis: 500_00,
      gainLoss: 500_00,
      isLongTerm: false,
      basisReportedToIRS: false,
      category: '8949_B',
    });
    const result = categorizeTransactions([tx]);
    expect(result['8949_B']).toHaveLength(1);
  });

  it('categorizes short-term, no 1099-B → 8949_C', () => {
    const tx = makeTx({
      proceeds: 1000_00,
      costBasis: 500_00,
      gainLoss: 500_00,
      isLongTerm: false,
      basisReportedToIRS: false,
      category: '8949_C',
    });
    const result = categorizeTransactions([tx]);
    expect(result['8949_C']).toHaveLength(1);
  });

  it('categorizes long-term, basis reported → 8949_D', () => {
    const tx = makeTx({
      proceeds: 1000_00,
      costBasis: 500_00,
      gainLoss: 500_00,
      isLongTerm: true,
      basisReportedToIRS: true,
      category: '8949_D',
    });
    const result = categorizeTransactions([tx]);
    expect(result['8949_D']).toHaveLength(1);
  });

  it('categorizes long-term, basis NOT reported → 8949_E', () => {
    const tx = makeTx({
      proceeds: 1000_00,
      costBasis: 500_00,
      gainLoss: 500_00,
      isLongTerm: true,
      basisReportedToIRS: false,
      category: '8949_E',
    });
    const result = categorizeTransactions([tx]);
    expect(result['8949_E']).toHaveLength(1);
  });

  it('categorizes long-term, no 1099-B → 8949_F', () => {
    const tx = makeTx({
      proceeds: 1000_00,
      costBasis: 500_00,
      gainLoss: 500_00,
      isLongTerm: true,
      basisReportedToIRS: false,
      category: '8949_F',
    });
    const result = categorizeTransactions([tx]);
    expect(result['8949_F']).toHaveLength(1);
  });

  it('sorts a mixed bag of transactions into correct categories', () => {
    const txA = makeTx({ proceeds: 100_00, costBasis: 50_00, gainLoss: 50_00, isLongTerm: false, basisReportedToIRS: true, category: '8949_A' });
    const txB = makeTx({ proceeds: 100_00, costBasis: 50_00, gainLoss: 50_00, isLongTerm: false, basisReportedToIRS: false, category: '8949_B' });
    const txD1 = makeTx({ proceeds: 200_00, costBasis: 100_00, gainLoss: 100_00, isLongTerm: true, basisReportedToIRS: true, category: '8949_D' });
    const txD2 = makeTx({ proceeds: 300_00, costBasis: 150_00, gainLoss: 150_00, isLongTerm: true, basisReportedToIRS: true, category: '8949_D' });
    const txF = makeTx({ proceeds: 100_00, costBasis: 50_00, gainLoss: 50_00, isLongTerm: true, basisReportedToIRS: false, category: '8949_F' });

    const result = categorizeTransactions([txA, txB, txD1, txD2, txF]);
    expect(result['8949_A']).toHaveLength(1);
    expect(result['8949_B']).toHaveLength(1);
    expect(result['8949_C']).toHaveLength(0);
    expect(result['8949_D']).toHaveLength(2);
    expect(result['8949_E']).toHaveLength(0);
    expect(result['8949_F']).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: computeCapitalGains
// ---------------------------------------------------------------------------

describe('computeCapitalGains', () => {
  // -----------------------------------------------------------------------
  // No transactions
  // -----------------------------------------------------------------------
  it('returns all zeros when no transactions are provided', () => {
    const result = computeCapitalGains([], 0, 'single', config);
    expect(result.shortTermGains).toBe(0);
    expect(result.shortTermLosses).toBe(0);
    expect(result.netShortTerm).toBe(0);
    expect(result.longTermGains).toBe(0);
    expect(result.longTermLosses).toBe(0);
    expect(result.netLongTerm).toBe(0);
    expect(result.netCapitalGainLoss).toBe(0);
    expect(result.deductibleLoss).toBe(0);
    expect(result.carryforwardLoss).toBe(0);
    expect(result.collectiblesGain).toBe(0);
    expect(result.section1250Gain).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Single short-term gain
  // -----------------------------------------------------------------------
  it('computes a single short-term gain correctly', () => {
    const tx = makeShortTermGain(500_000); // $5,000 gain
    const result = computeCapitalGains([tx], 0, 'single', config);

    expect(result.shortTermGains).toBe(500_000);
    expect(result.shortTermLosses).toBe(0);
    expect(result.netShortTerm).toBe(500_000);
    expect(result.longTermGains).toBe(0);
    expect(result.longTermLosses).toBe(0);
    expect(result.netLongTerm).toBe(0);
    expect(result.netCapitalGainLoss).toBe(500_000);
    expect(result.deductibleLoss).toBe(0);
    expect(result.carryforwardLoss).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Single long-term gain
  // -----------------------------------------------------------------------
  it('computes a single long-term gain correctly', () => {
    const tx = makeLongTermGain(1_000_000); // $10,000 gain
    const result = computeCapitalGains([tx], 0, 'single', config);

    expect(result.shortTermGains).toBe(0);
    expect(result.longTermGains).toBe(1_000_000);
    expect(result.netLongTerm).toBe(1_000_000);
    expect(result.netCapitalGainLoss).toBe(1_000_000);
    expect(result.deductibleLoss).toBe(0);
    expect(result.carryforwardLoss).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Mix of short and long-term gains
  // -----------------------------------------------------------------------
  it('computes mix of short-term and long-term gains', () => {
    const transactions = [
      makeShortTermGain(200_000),  // $2,000 ST gain
      makeLongTermGain(300_000),   // $3,000 LT gain
    ];
    const result = computeCapitalGains(transactions, 0, 'single', config);

    expect(result.shortTermGains).toBe(200_000);
    expect(result.netShortTerm).toBe(200_000);
    expect(result.longTermGains).toBe(300_000);
    expect(result.netLongTerm).toBe(300_000);
    expect(result.netCapitalGainLoss).toBe(500_000);
    expect(result.deductibleLoss).toBe(0);
    expect(result.carryforwardLoss).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Net short-term loss + net long-term gain
  // -----------------------------------------------------------------------
  it('handles net short-term loss offset by net long-term gain', () => {
    const transactions = [
      makeShortTermLoss(500_000),   // -$5,000 ST loss
      makeLongTermGain(800_000),    // $8,000 LT gain
    ];
    const result = computeCapitalGains(transactions, 0, 'single', config);

    expect(result.shortTermGains).toBe(0);
    expect(result.shortTermLosses).toBe(500_000);
    expect(result.netShortTerm).toBe(-500_000);
    expect(result.longTermGains).toBe(800_000);
    expect(result.longTermLosses).toBe(0);
    expect(result.netLongTerm).toBe(800_000);
    // Net: -$5,000 + $8,000 = $3,000 net gain
    expect(result.netCapitalGainLoss).toBe(300_000);
    expect(result.deductibleLoss).toBe(0);
    expect(result.carryforwardLoss).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Net capital loss exceeding $3,000 → limited deduction + carryforward
  // -----------------------------------------------------------------------
  it('limits net capital loss deduction to $3,000 for single filer with carryforward', () => {
    // Total loss: -$10,000
    const transactions = [
      makeShortTermLoss(400_000),   // -$4,000
      makeLongTermLoss(600_000),    // -$6,000
    ];
    const result = computeCapitalGains(transactions, 0, 'single', config);

    expect(result.netShortTerm).toBe(-400_000);
    expect(result.netLongTerm).toBe(-600_000);
    expect(result.netCapitalGainLoss).toBe(-1_000_000);
    // $3,000 limit = 300_000 cents
    expect(result.deductibleLoss).toBe(-300_000);
    // Carryforward: $10,000 - $3,000 = $7,000
    expect(result.carryforwardLoss).toBe(700_000);
  });

  // -----------------------------------------------------------------------
  // Net capital loss exactly $3,000
  // -----------------------------------------------------------------------
  it('allows full deduction when net loss is exactly $3,000', () => {
    const transactions = [
      makeShortTermLoss(300_000),   // -$3,000 exactly
    ];
    const result = computeCapitalGains(transactions, 0, 'single', config);

    expect(result.netCapitalGainLoss).toBe(-300_000);
    expect(result.deductibleLoss).toBe(-300_000);
    expect(result.carryforwardLoss).toBe(0);
  });

  // -----------------------------------------------------------------------
  // MFS filer: $1,500 loss limit
  // -----------------------------------------------------------------------
  it('limits MFS filer loss deduction to $1,500', () => {
    const transactions = [
      makeLongTermLoss(500_000),    // -$5,000
    ];
    const result = computeCapitalGains(
      transactions, 0, 'married_filing_separately', config,
    );

    expect(result.netCapitalGainLoss).toBe(-500_000);
    // MFS limit = $1,500 = 150_000 cents
    expect(result.deductibleLoss).toBe(-150_000);
    // Carryforward: $5,000 - $1,500 = $3,500
    expect(result.carryforwardLoss).toBe(350_000);
  });

  // -----------------------------------------------------------------------
  // Prior year carryforward reducing gains
  // -----------------------------------------------------------------------
  it('applies prior year carryforward to reduce short-term gains first', () => {
    const transactions = [
      makeShortTermGain(500_000),   // $5,000 ST gain
      makeLongTermGain(300_000),    // $3,000 LT gain
    ];
    // Prior year carryforward of $4,000 = 400_000 cents
    const result = computeCapitalGains(transactions, 400_000, 'single', config);

    // Carryforward applied to short-term first:
    // ST: $5,000 - $4,000 = $1,000
    expect(result.netShortTerm).toBe(100_000);
    // LT: $3,000 (no carryforward remaining)
    expect(result.netLongTerm).toBe(300_000);
    expect(result.netCapitalGainLoss).toBe(400_000);
    expect(result.deductibleLoss).toBe(0);
    expect(result.carryforwardLoss).toBe(0);
  });

  it('applies prior year carryforward to short-term then long-term', () => {
    const transactions = [
      makeShortTermGain(200_000),   // $2,000 ST gain
      makeLongTermGain(500_000),    // $5,000 LT gain
    ];
    // Prior year carryforward of $3,000 = 300_000 cents
    // Exceeds ST gains, so remainder goes to LT
    const result = computeCapitalGains(transactions, 300_000, 'single', config);

    // ST: $2,000 - $2,000 (portion of carryforward) = $0
    // Actually, carryforward of $3,000 applied to ST $2,000 → ST becomes -$1,000
    // Then that -$1,000 nets against LT $5,000 → overall net = $4,000
    // But the function should track: netShortTerm after carryforward, netLongTerm after remaining carryforward
    expect(result.netShortTerm).toBe(-100_000);
    expect(result.netLongTerm).toBe(500_000);
    expect(result.netCapitalGainLoss).toBe(400_000);
    expect(result.deductibleLoss).toBe(0);
    expect(result.carryforwardLoss).toBe(0);
  });

  it('prior year carryforward exceeds all gains → creates net loss', () => {
    const transactions = [
      makeShortTermGain(100_000),   // $1,000 ST gain
      makeLongTermGain(100_000),    // $1,000 LT gain
    ];
    // Prior year carryforward of $10,000 = 1_000_000 cents
    const result = computeCapitalGains(transactions, 1_000_000, 'single', config);

    // Carryforward applied: ST $1,000 - $1,000 = $0, then LT: $1,000 - remaining $9,000
    // Net ST = -$9,000 (remaining carryforward applied to ST first, which becomes -$9,000)
    // Actually: carryforward applied to ST first: $1,000 - $10,000 = -$9,000 for ST
    // Wait, carryforward doesn't just reduce ST gains, it's applied as a loss to ST first.
    // Per IRS Capital Loss Carryover Worksheet, the carryforward reduces ST first, then LT.
    // ST: $1,000 (gain) - $10,000 (carryforward) = -$9,000
    // LT: $1,000
    // Net: -$9,000 + $1,000 = -$8,000
    // But actually carryforward should be split: reduce ST by carryforward amount, then if
    // carryforward remains, reduce LT.
    // So: ST net before carryforward = $1,000. Apply $10,000 carryforward to ST first.
    // ST becomes: $1,000 - $10,000 = -$9,000. Remaining carryforward: $0 (all applied to ST).
    // No wait — the carryforward is a loss, so we subtract it. But the logic is:
    // Per IRS worksheet, carryforward goes to ST first:
    //   netST = rawNetST - carryforward = $1,000 - $10,000 = -$9,000
    //   remaining carryforward = 0 (we applied all $10,000 to ST column)
    //   netLT = rawNetLT = $1,000
    //   totalNet = -$9,000 + $1,000 = -$8,000
    // Deductible = max(-$3,000, -$8,000) = -$3,000
    // Carryforward = $8,000 - $3,000 = $5,000
    expect(result.netShortTerm).toBe(-900_000);
    expect(result.netLongTerm).toBe(100_000);
    expect(result.netCapitalGainLoss).toBe(-800_000);
    expect(result.deductibleLoss).toBe(-300_000);
    expect(result.carryforwardLoss).toBe(500_000);
  });

  // -----------------------------------------------------------------------
  // Wash sale handling
  // -----------------------------------------------------------------------
  it('handles wash sale: washSaleDisallowed is already factored into gainLoss', () => {
    // Bought at $10,000, sold at $8,000 → $2,000 loss
    // But $500 is wash sale disallowed → only $1,500 loss is in gainLoss
    // The washSaleDisallowed field is informational; gainLoss already reflects the adjustment
    const tx = makeTx({
      description: 'WASH SALE STOCK',
      proceeds: 800_000,       // $8,000
      costBasis: 1_000_000,    // $10,000
      gainLoss: -150_000,      // -$1,500 (loss after wash sale adjustment)
      washSaleDisallowed: 50_000,  // $500 disallowed
      isLongTerm: false,
      basisReportedToIRS: true,
      category: '8949_A',
    });
    const result = computeCapitalGains([tx], 0, 'single', config);

    // gainLoss is -$1,500 (already adjusted for wash sale)
    expect(result.shortTermLosses).toBe(150_000);
    expect(result.netShortTerm).toBe(-150_000);
    expect(result.netCapitalGainLoss).toBe(-150_000);
    expect(result.deductibleLoss).toBe(-150_000);
    expect(result.carryforwardLoss).toBe(0);
  });

  it('handles wash sale with gain (washSaleDisallowed present but net gain)', () => {
    // A wash sale that still results in a gain
    const tx = makeTx({
      description: 'WASH SALE GAIN STOCK',
      proceeds: 1_500_000,     // $15,000
      costBasis: 1_000_000,    // $10,000
      gainLoss: 550_000,       // $5,500 gain (adjusted)
      washSaleDisallowed: 50_000,  // $500 disallowed (added to basis of replacement shares)
      isLongTerm: true,
      basisReportedToIRS: true,
      category: '8949_D',
    });
    const result = computeCapitalGains([tx], 0, 'single', config);

    expect(result.longTermGains).toBe(550_000);
    expect(result.netLongTerm).toBe(550_000);
    expect(result.netCapitalGainLoss).toBe(550_000);
  });

  // -----------------------------------------------------------------------
  // All gains → no carryforward
  // -----------------------------------------------------------------------
  it('produces no carryforward when all transactions are gains', () => {
    const transactions = [
      makeShortTermGain(1_000_000),  // $10,000
      makeLongTermGain(2_000_000),   // $20,000
    ];
    const result = computeCapitalGains(transactions, 0, 'single', config);

    expect(result.netCapitalGainLoss).toBe(3_000_000);
    expect(result.deductibleLoss).toBe(0);
    expect(result.carryforwardLoss).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Large number of mixed transactions
  // -----------------------------------------------------------------------
  it('handles a large number of mixed transactions correctly', () => {
    const transactions: Form1099B[] = [];

    // 50 short-term gains of $100 each = $5,000 total ST gain
    for (let i = 0; i < 50; i++) {
      transactions.push(makeShortTermGain(10_000));
    }
    // 30 short-term losses of $200 each = $6,000 total ST loss
    for (let i = 0; i < 30; i++) {
      transactions.push(makeShortTermLoss(20_000));
    }
    // 40 long-term gains of $150 each = $6,000 total LT gain
    for (let i = 0; i < 40; i++) {
      transactions.push(makeLongTermGain(15_000));
    }
    // 20 long-term losses of $100 each = $2,000 total LT loss
    for (let i = 0; i < 20; i++) {
      transactions.push(makeLongTermLoss(10_000));
    }

    const result = computeCapitalGains(transactions, 0, 'single', config);

    // ST: $5,000 - $6,000 = -$1,000
    expect(result.shortTermGains).toBe(500_000);
    expect(result.shortTermLosses).toBe(600_000);
    expect(result.netShortTerm).toBe(-100_000);

    // LT: $6,000 - $2,000 = $4,000
    expect(result.longTermGains).toBe(600_000);
    expect(result.longTermLosses).toBe(200_000);
    expect(result.netLongTerm).toBe(400_000);

    // Net: -$1,000 + $4,000 = $3,000
    expect(result.netCapitalGainLoss).toBe(300_000);
    expect(result.deductibleLoss).toBe(0);
    expect(result.carryforwardLoss).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Collectibles gain tracking from 1099-DIV
  // -----------------------------------------------------------------------
  it('tracks collectibles gain from transactions marked as collectible', () => {
    const tx = makeTx({
      description: 'GOLD ETF',
      proceeds: 2_000_000,
      costBasis: 1_500_000,
      gainLoss: 500_000,
      isLongTerm: true,
      isCollectible: true,
      basisReportedToIRS: true,
      category: '8949_D',
    });
    const result = computeCapitalGains([tx], 0, 'single', config);

    expect(result.collectiblesGain).toBe(500_000);
    expect(result.longTermGains).toBe(500_000);
    expect(result.netLongTerm).toBe(500_000);
  });

  // -----------------------------------------------------------------------
  // Edge cases for loss limit
  // -----------------------------------------------------------------------
  it('allows full deduction when net loss is less than $3,000', () => {
    const transactions = [
      makeShortTermLoss(200_000),   // -$2,000
    ];
    const result = computeCapitalGains(transactions, 0, 'single', config);

    expect(result.netCapitalGainLoss).toBe(-200_000);
    expect(result.deductibleLoss).toBe(-200_000);
    expect(result.carryforwardLoss).toBe(0);
  });

  it('handles zero net after gains and losses offset', () => {
    const transactions = [
      makeShortTermGain(500_000),
      makeShortTermLoss(500_000),
    ];
    const result = computeCapitalGains(transactions, 0, 'single', config);

    expect(result.netCapitalGainLoss).toBe(0);
    expect(result.deductibleLoss).toBe(0);
    expect(result.carryforwardLoss).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Filing status: all non-MFS filers use $3,000 limit
  // -----------------------------------------------------------------------
  it('uses $3,000 limit for married_filing_jointly', () => {
    const transactions = [makeLongTermLoss(1_000_000)]; // -$10,000
    const result = computeCapitalGains(
      transactions, 0, 'married_filing_jointly', config,
    );

    expect(result.deductibleLoss).toBe(-300_000);
    expect(result.carryforwardLoss).toBe(700_000);
  });

  it('uses $3,000 limit for head_of_household', () => {
    const transactions = [makeLongTermLoss(1_000_000)];
    const result = computeCapitalGains(
      transactions, 0, 'head_of_household', config,
    );

    expect(result.deductibleLoss).toBe(-300_000);
    expect(result.carryforwardLoss).toBe(700_000);
  });

  // -----------------------------------------------------------------------
  // Prior year carryforward with no current transactions
  // -----------------------------------------------------------------------
  it('handles prior year carryforward with no current transactions', () => {
    const result = computeCapitalGains([], 500_000, 'single', config);

    // Carryforward applied to ST first: 0 - $5,000 = -$5,000
    expect(result.netShortTerm).toBe(-500_000);
    expect(result.netLongTerm).toBe(0);
    expect(result.netCapitalGainLoss).toBe(-500_000);
    expect(result.deductibleLoss).toBe(-300_000);
    expect(result.carryforwardLoss).toBe(200_000);
  });

  // -----------------------------------------------------------------------
  // Prior year carryforward exactly used up by gains
  // -----------------------------------------------------------------------
  it('prior year carryforward exactly matches current gains', () => {
    const transactions = [
      makeShortTermGain(500_000),   // $5,000
    ];
    const result = computeCapitalGains(transactions, 500_000, 'single', config);

    expect(result.netShortTerm).toBe(0);
    expect(result.netCapitalGainLoss).toBe(0);
    expect(result.deductibleLoss).toBe(0);
    expect(result.carryforwardLoss).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Categorized field is populated
  // -----------------------------------------------------------------------
  it('populates categorized field in the result', () => {
    const txA = makeTx({ proceeds: 100_00, costBasis: 50_00, gainLoss: 50_00, isLongTerm: false, basisReportedToIRS: true, category: '8949_A' });
    const txD = makeTx({ proceeds: 200_00, costBasis: 100_00, gainLoss: 100_00, isLongTerm: true, basisReportedToIRS: true, category: '8949_D' });

    const result = computeCapitalGains([txA, txD], 0, 'single', config);

    expect(result.categorized['8949_A']).toHaveLength(1);
    expect(result.categorized['8949_D']).toHaveLength(1);
    expect(result.categorized['8949_B']).toHaveLength(0);
    expect(result.categorized['8949_C']).toHaveLength(0);
    expect(result.categorized['8949_E']).toHaveLength(0);
    expect(result.categorized['8949_F']).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Collectibles loss should not count as collectibles gain
  // -----------------------------------------------------------------------
  it('does not add negative collectibles to collectiblesGain', () => {
    const tx = makeTx({
      description: 'GOLD ETF LOSS',
      proceeds: 1_000_000,
      costBasis: 1_500_000,
      gainLoss: -500_000,
      isLongTerm: true,
      isCollectible: true,
      basisReportedToIRS: true,
      category: '8949_D',
    });
    const result = computeCapitalGains([tx], 0, 'single', config);

    // Collectibles gain should be 0 (or not negative) when there's a loss
    expect(result.collectiblesGain).toBe(0);
    expect(result.longTermLosses).toBe(500_000);
  });

  // -----------------------------------------------------------------------
  // Section 1250 gain is always 0 for 1099-B (comes from 1099-DIV)
  // -----------------------------------------------------------------------
  it('section1250Gain is 0 when no 1099-DIV data is present', () => {
    const tx = makeLongTermGain(1_000_000);
    const result = computeCapitalGains([tx], 0, 'single', config);

    expect(result.section1250Gain).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Short-term gains and short-term losses in same batch
  // -----------------------------------------------------------------------
  it('nets short-term gains against short-term losses within the same category', () => {
    const transactions = [
      makeShortTermGain(800_000),   // $8,000
      makeShortTermLoss(300_000),   // -$3,000
      makeShortTermGain(200_000),   // $2,000
      makeShortTermLoss(100_000),   // -$1,000
    ];
    const result = computeCapitalGains(transactions, 0, 'single', config);

    expect(result.shortTermGains).toBe(1_000_000);  // $10,000
    expect(result.shortTermLosses).toBe(400_000);    // $4,000
    expect(result.netShortTerm).toBe(600_000);       // $6,000
  });

  // -----------------------------------------------------------------------
  // MFS carryforward calculation
  // -----------------------------------------------------------------------
  it('MFS carryforward is correct with $1,500 limit', () => {
    const transactions = [
      makeShortTermLoss(500_000),   // -$5,000
      makeLongTermLoss(500_000),    // -$5,000
    ];
    const result = computeCapitalGains(
      transactions, 0, 'married_filing_separately', config,
    );

    expect(result.netCapitalGainLoss).toBe(-1_000_000);
    expect(result.deductibleLoss).toBe(-150_000);
    expect(result.carryforwardLoss).toBe(850_000);
  });

  // -----------------------------------------------------------------------
  // Prior year carryforward with losses: carryforward + current losses
  // -----------------------------------------------------------------------
  it('prior year carryforward combined with current year losses', () => {
    const transactions = [
      makeShortTermLoss(200_000),   // -$2,000 current year ST loss
    ];
    // Prior year carryforward of $5,000
    const result = computeCapitalGains(transactions, 500_000, 'single', config);

    // ST: -$2,000 - $5,000 (carryforward to ST) = -$7,000
    expect(result.netShortTerm).toBe(-700_000);
    expect(result.netCapitalGainLoss).toBe(-700_000);
    expect(result.deductibleLoss).toBe(-300_000);
    expect(result.carryforwardLoss).toBe(400_000);
  });

  // -----------------------------------------------------------------------
  // Verify gains/losses tracking is by absolute value for the breakdown fields
  // -----------------------------------------------------------------------
  it('shortTermLosses and longTermLosses are reported as positive magnitudes', () => {
    const transactions = [
      makeShortTermLoss(250_000),
      makeLongTermLoss(750_000),
    ];
    const result = computeCapitalGains(transactions, 0, 'single', config);

    // Losses are stored as positive magnitudes
    expect(result.shortTermLosses).toBe(250_000);
    expect(result.longTermLosses).toBe(750_000);
    // But netShortTerm and netLongTerm are negative
    expect(result.netShortTerm).toBe(-250_000);
    expect(result.netLongTerm).toBe(-750_000);
  });
});

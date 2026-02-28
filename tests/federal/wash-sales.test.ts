// Wash Sale Rule Tests
// IRS Publication 550 / IRC §1091
// Verified: 2026-02-28

import { describe, it, expect } from 'vitest';
import { detectWashSales, computeTotalWashSaleDisallowed } from '../../src/engine/federal/wash-sales';
import type { Form1099B } from '../../src/engine/types';

function makeTx(overrides: Partial<Form1099B>): Form1099B {
  return {
    description: 'AAPL',
    dateAcquired: '2024-01-01',
    dateSold: '2024-06-01',
    proceeds: 100000,   // $1,000
    costBasis: 100000,
    gainLoss: 0,
    isLongTerm: false,
    basisReportedToIRS: true,
    category: '8949_A',
    washSaleDisallowed: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeTotalWashSaleDisallowed
// ---------------------------------------------------------------------------

describe('computeTotalWashSaleDisallowed', () => {
  it('returns 0 for empty transactions', () => {
    expect(computeTotalWashSaleDisallowed([])).toBe(0);
  });

  it('returns 0 when no washSaleDisallowed fields', () => {
    const txs = [makeTx({ gainLoss: -50000 }), makeTx({ gainLoss: 30000 })];
    expect(computeTotalWashSaleDisallowed(txs)).toBe(0);
  });

  it('sums washSaleDisallowed from all transactions', () => {
    const txs = [
      makeTx({ washSaleDisallowed: 50000 }),   // $500
      makeTx({ washSaleDisallowed: 25000 }),   // $250
      makeTx({ washSaleDisallowed: 0 }),
    ];
    expect(computeTotalWashSaleDisallowed(txs)).toBe(75000);
  });

  it('handles missing washSaleDisallowed (undefined) gracefully', () => {
    const txs = [makeTx({ washSaleDisallowed: undefined as unknown as number })];
    expect(computeTotalWashSaleDisallowed(txs)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// detectWashSales
// ---------------------------------------------------------------------------

describe('detectWashSales', () => {
  it('returns empty array for no transactions', () => {
    expect(detectWashSales([])).toEqual([]);
  });

  it('returns empty array for all gains (no losses)', () => {
    const txs = [
      makeTx({ gainLoss: 50000 }),
      makeTx({ gainLoss: 20000 }),
    ];
    expect(detectWashSales(txs)).toHaveLength(0);
  });

  it('detects wash sale when same security purchased within 30 days after loss sale', () => {
    const txs = [
      makeTx({
        description: 'AAPL',
        dateSold: '2024-06-01',
        gainLoss: -50000,    // loss
        washSaleDisallowed: 0,
      }),
      makeTx({
        description: 'AAPL',
        dateAcquired: '2024-06-20',  // 19 days later — within 30-day window
        dateSold: '2024-09-01',
        gainLoss: 10000,
      }),
    ];
    const alerts = detectWashSales(txs);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].security).toBe('AAPL');
    expect(alerts[0].lossAmount).toBe(50000);
    expect(alerts[0].dateSold).toBe('2024-06-01');
    expect(alerts[0].triggerDate).toBe('2024-06-20');
  });

  it('detects wash sale when same security purchased within 30 days BEFORE loss sale', () => {
    const txs = [
      makeTx({
        description: 'TSLA',
        dateSold: '2024-06-15',
        gainLoss: -80000,
        washSaleDisallowed: 0,
      }),
      makeTx({
        description: 'TSLA',
        dateAcquired: '2024-06-01',  // 14 days before — within 30-day window
        dateSold: '2024-11-01',
        gainLoss: 5000,
      }),
    ];
    const alerts = detectWashSales(txs);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].security).toBe('TSLA');
  });

  it('does NOT flag loss transaction if repurchase is MORE than 30 days away', () => {
    const txs = [
      makeTx({
        description: 'MSFT',
        dateSold: '2024-06-01',
        gainLoss: -40000,
        washSaleDisallowed: 0,
      }),
      makeTx({
        description: 'MSFT',
        dateAcquired: '2024-07-15',  // 44 days later — outside 30-day window
        dateSold: '2024-10-01',
        gainLoss: 20000,
      }),
    ];
    expect(detectWashSales(txs)).toHaveLength(0);
  });

  it('skips loss transaction if Box 1g already reported (broker already flagged it)', () => {
    const txs = [
      makeTx({
        description: 'NVDA',
        dateSold: '2024-06-01',
        gainLoss: -60000,
        washSaleDisallowed: 60000,  // broker already reported
      }),
      makeTx({
        description: 'NVDA',
        dateAcquired: '2024-06-10',
        dateSold: '2024-12-01',
        gainLoss: 30000,
      }),
    ];
    // Should not double-flag — broker's Box 1g is authoritative
    expect(detectWashSales(txs)).toHaveLength(0);
  });

  it('only generates one alert per loss transaction (not one per matching purchase)', () => {
    const txs = [
      makeTx({
        description: 'GOOG',
        dateSold: '2024-06-01',
        gainLoss: -100000,
        washSaleDisallowed: 0,
      }),
      makeTx({
        description: 'GOOG',
        dateAcquired: '2024-06-10',
        dateSold: '2024-09-01',
        gainLoss: 0,
      }),
      makeTx({
        description: 'GOOG',
        dateAcquired: '2024-06-20',
        dateSold: '2024-10-01',
        gainLoss: 0,
      }),
    ];
    expect(detectWashSales(txs)).toHaveLength(1);
  });

  it('does not flag gain transactions', () => {
    const txs = [
      makeTx({ gainLoss: 50000 }),  // gain
    ];
    expect(detectWashSales(txs)).toHaveLength(0);
  });

  it('handles transactions with missing dates gracefully', () => {
    const txs = [
      makeTx({ dateSold: '', gainLoss: -20000 }),
      makeTx({ dateSold: '2024-06-01', gainLoss: 10000 }),
    ];
    expect(() => detectWashSales(txs)).not.toThrow();
    expect(detectWashSales(txs)).toHaveLength(0);
  });

  it('normalizes security names for matching (strips Corp/Inc suffixes)', () => {
    const txs = [
      makeTx({
        description: 'Apple Inc.',
        dateSold: '2024-06-01',
        gainLoss: -50000,
        washSaleDisallowed: 0,
      }),
      makeTx({
        description: 'Apple Inc',
        dateAcquired: '2024-06-10',
        dateSold: '2024-11-01',
        gainLoss: 20000,
      }),
    ];
    const alerts = detectWashSales(txs);
    expect(alerts).toHaveLength(1);
  });

  it('returns correct alert fields', () => {
    const txs = [
      makeTx({
        description: 'META',
        dateSold: '2024-05-15',
        gainLoss: -75000,
        washSaleDisallowed: 0,
        transactionIndex: 0,
      } as Partial<Form1099B> & { transactionIndex?: number }),
      makeTx({
        description: 'META',
        dateAcquired: '2024-05-25',
        dateSold: '2024-12-01',
        gainLoss: 0,
      }),
    ];
    const [alert] = detectWashSales(txs);
    expect(alert.transactionIndex).toBe(0);
    expect(alert.security).toBe('META');
    expect(alert.dateSold).toBe('2024-05-15');
    expect(alert.lossAmount).toBe(75000);
    expect(alert.triggerDate).toBe('2024-05-25');
    expect(typeof alert.note).toBe('string');
  });
});

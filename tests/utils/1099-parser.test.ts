// Tests for src/utils/1099-parser.ts and src/utils/parse-helpers.ts
//
// The parser uses a spatial bounding box approach. In IB-style PDFs the section
// header sits at the BOTTOM of its section (lower y value) and data extends
// UPWARD from the header (higher y values). Synthetic test items follow this
// convention:
//   - Section header: y = 100 (near page bottom)
//   - Labels / values: y = 400–700 (above header, within bounds)
//   - bounds: yMin = 70 (100 - HEADER_ROW_TOLERANCE), yMax = 800 (PAGE_TOP)
//
// All monetary values returned by the parser are in cents (integers).

import { describe, it, expect } from 'vitest';
import { parseDollarsToCents, parseDate, isLongTermHolding } from '../../src/utils/parse-helpers';
import { parse1099Pdf } from '../../src/utils/1099-parser';
import type { ExtractedTextItem } from '../../src/utils/pdf-extract';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a synthetic ExtractedTextItem for testing. */
function makeItem(text: string, x: number, y: number, page: number = 1): ExtractedTextItem {
  return { text, x, y, page };
}

// ---------------------------------------------------------------------------
// parseDollarsToCents (src/utils/parse-helpers.ts)
// ---------------------------------------------------------------------------

describe('parseDollarsToCents', () => {
  it('parses $1,234.56 → 123456', () => {
    expect(parseDollarsToCents('$1,234.56')).toBe(123456);
  });

  it('parses (500.00) → -50000 (parenthesized negative)', () => {
    expect(parseDollarsToCents('(500.00)')).toBe(-50000);
  });

  it('parses -123.45 → -12345 (leading minus)', () => {
    expect(parseDollarsToCents('-123.45')).toBe(-12345);
  });

  it('parses $1,000,000.00 → 100000000', () => {
    expect(parseDollarsToCents('$1,000,000.00')).toBe(100000000);
  });

  it('parses (1,234.56) → -123456', () => {
    expect(parseDollarsToCents('(1,234.56)')).toBe(-123456);
  });

  it('parses 0.00 → 0', () => {
    expect(parseDollarsToCents('0.00')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parseDollarsToCents('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(parseDollarsToCents('   ')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseDate (src/utils/parse-helpers.ts)
// ---------------------------------------------------------------------------

describe('parseDate', () => {
  it('converts MM/DD/YYYY to ISO format', () => {
    expect(parseDate('01/15/2023')).toBe('2023-01-15');
  });

  it('passes YYYY-MM-DD through unchanged', () => {
    expect(parseDate('2023-01-15')).toBe('2023-01-15');
  });

  it('handles single-digit month/day', () => {
    expect(parseDate('6/5/2024')).toBe('2024-06-05');
  });

  it('returns VARIOUS for VARIOUS input', () => {
    expect(parseDate('VARIOUS')).toBe('VARIOUS');
  });

  it('returns empty string for empty input', () => {
    expect(parseDate('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// isLongTermHolding (src/utils/parse-helpers.ts)
// ---------------------------------------------------------------------------

describe('isLongTermHolding', () => {
  it('returns true when held for more than one year', () => {
    expect(isLongTermHolding('2022-01-15', '2025-06-20')).toBe(true);
  });

  it('returns false when held for exactly one year', () => {
    // Must be MORE than one year; exactly one year is still short-term
    expect(isLongTermHolding('2024-06-20', '2025-06-20')).toBe(false);
  });

  it('returns false when held for less than one year', () => {
    expect(isLongTermHolding('2025-01-10', '2025-04-15')).toBe(false);
  });

  it('returns false for VARIOUS acquired date', () => {
    expect(isLongTermHolding('VARIOUS', '2025-06-20')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Section header detection (via parse1099Pdf)
// ---------------------------------------------------------------------------

describe('parse1099Pdf: section header detection', () => {
  it('detects "2025 1099-B" as a B section (produces transactions)', () => {
    // IB layout: header at bottom (y=100), data above (y=500-700)
    const items: ExtractedTextItem[] = [
      // Section header at bottom
      makeItem('2025 1099-B', 50, 100),
      // Column headers above
      makeItem('Description', 50, 500),
      makeItem('Proceeds', 200, 500),
      makeItem('Cost Basis', 350, 500),
      // Data row
      makeItem('100 AAPL', 50, 450),
      makeItem('$10,000.00', 200, 450),
      makeItem('$8,000.00', 350, 450),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099Bs.length).toBeGreaterThan(0);
  });

  it('does NOT detect "Applicable check box on Form 8949" as a section', () => {
    const items: ExtractedTextItem[] = [
      makeItem('Applicable check box on Form 8949', 50, 700),
      makeItem('$1,234.56', 200, 700),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099Bs).toHaveLength(0);
    expect(result.form1099INTs).toHaveLength(0);
  });

  it('does NOT detect a plain "Form 8949" reference in the middle of text', () => {
    const items: ExtractedTextItem[] = [
      makeItem('See Instructions for Form 8949 for information', 50, 500),
      makeItem('$500.00', 200, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099Bs).toHaveLength(0);
  });

  it('detects "2025 1099-INT" as an INT section', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-INT', 50, 100),
      makeItem('1 Interest income', 50, 500),
      makeItem('$500.00', 250, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099INTs).toHaveLength(1);
  });

  it('detects "2025 1099-DIV" as a DIV section', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-DIV', 50, 100),
      makeItem('1a Total ordinary dividends', 50, 500),
      makeItem('$100.00', 300, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099DIVs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 1099-INT section parsing
// ---------------------------------------------------------------------------

describe('parse1099Pdf: 1099-INT section', () => {
  it('extracts interest income from Box 1 label on the same line', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-INT', 50, 100),
      makeItem('1 Interest income', 50, 500),
      makeItem('$1,234.56', 250, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099INTs).toHaveLength(1);
    expect(result.form1099INTs[0].interest).toBe(123456);
  });

  it('extracts interest using "interest income" label fallback', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-INT', 50, 100),
      makeItem('Total interest income', 50, 500),
      makeItem('$250.00', 300, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099INTs).toHaveLength(1);
    expect(result.form1099INTs[0].interest).toBe(25000);
  });

  it('adds a warning when no amounts found in INT section', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-INT', 50, 100),
      makeItem('Some unrecognized text', 50, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099INTs).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('1099-INT'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 1099-DIV section parsing
// ---------------------------------------------------------------------------

describe('parse1099Pdf: 1099-DIV section', () => {
  it('extracts ordinary dividends from Box 1a', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-DIV', 50, 100),
      makeItem('1a Total ordinary dividends', 50, 500),
      makeItem('$500.00', 300, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099DIVs).toHaveLength(1);
    expect(result.form1099DIVs[0].ordinaryDividends).toBe(50000);
  });

  it('extracts capital gain distributions from Box 2a', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-DIV', 50, 100),
      makeItem('1a Total ordinary dividends', 50, 550),
      makeItem('$1,000.00', 300, 550),
      makeItem('2a Total capital gain distr.', 50, 500),
      makeItem('$400.00', 300, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099DIVs).toHaveLength(1);
    expect(result.form1099DIVs[0].ordinaryDividends).toBe(100000);
    expect(result.form1099DIVs[0].totalCapitalGain).toBe(40000);
  });

  it('adds a warning when no amounts found in DIV section', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-DIV', 50, 100),
      makeItem('No relevant content here', 50, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099DIVs).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('1099-DIV'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 1099-B standard table parsing
// ---------------------------------------------------------------------------

describe('parse1099Pdf: 1099-B standard table parsing', () => {
  // Build a standard columnar table with headers at y=500 and data at y=450
  // Section header is at the bottom (y=100) per IB spatial layout convention

  it('parses a single ST transaction from a tabular layout', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-B', 50, 100),
      // Column headers at y=500
      makeItem('Description', 50, 500),
      makeItem('Date Acquired', 150, 500),
      makeItem('Date Sold', 260, 500),
      makeItem('Proceeds', 360, 500),
      makeItem('Cost Basis', 460, 500),
      // Data row at y=450 (below column headers)
      makeItem('100 TSLA', 50, 450),
      makeItem('01/10/2025', 150, 450),
      makeItem('04/15/2025', 260, 450),
      makeItem('$10,000.00', 360, 450),
      makeItem('$8,000.00', 460, 450),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099Bs).toHaveLength(1);
    const tx = result.form1099Bs[0];
    expect(tx.description).toBe('100 TSLA');
    expect(tx.proceeds).toBe(1000000);
    expect(tx.costBasis).toBe(800000);
    expect(tx.gainLoss).toBe(200000);
  });

  it('infers long-term status when held >1 year', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-B', 50, 100),
      makeItem('Description', 50, 500),
      makeItem('Date Acquired', 150, 500),
      makeItem('Date Sold', 260, 500),
      makeItem('Proceeds', 360, 500),
      makeItem('Cost Basis', 460, 500),
      makeItem('100 AAPL', 50, 450),
      makeItem('01/15/2022', 150, 450),   // acquired 2022 — >1 year before 2025 sale
      makeItem('06/20/2025', 260, 450),
      makeItem('$20,000.00', 360, 450),
      makeItem('$15,000.00', 460, 450),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099Bs).toHaveLength(1);
    expect(result.form1099Bs[0].isLongTerm).toBe(true);
  });

  it('infers short-term status when held <1 year', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-B', 50, 100),
      makeItem('Description', 50, 500),
      makeItem('Date Acquired', 150, 500),
      makeItem('Date Sold', 260, 500),
      makeItem('Proceeds', 360, 500),
      makeItem('Cost Basis', 460, 500),
      makeItem('50 NVDA', 50, 450),
      makeItem('03/01/2025', 150, 450),
      makeItem('09/01/2025', 260, 450),
      makeItem('$5,000.00', 360, 450),
      makeItem('$4,000.00', 460, 450),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099Bs).toHaveLength(1);
    expect(result.form1099Bs[0].isLongTerm).toBe(false);
  });

  it('uses explicit gain/loss column when present', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-B', 50, 100),
      makeItem('Description', 50, 500),
      makeItem('Proceeds', 200, 500),
      makeItem('Cost Basis', 350, 500),
      makeItem('Gain/Loss', 500, 500),
      makeItem('50 GOOG', 50, 450),
      makeItem('$8,000.00', 200, 450),
      makeItem('$6,000.00', 350, 450),
      makeItem('$2,000.00', 500, 450),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099Bs).toHaveLength(1);
    expect(result.form1099Bs[0].gainLoss).toBe(200000);
  });
});

// ---------------------------------------------------------------------------
// Wash sale disallowed (Box 1g / "Wash Sale" column)
// ---------------------------------------------------------------------------

describe('parse1099Pdf: wash sale disallowed', () => {
  it('extracts washSaleDisallowed from a "Wash Sale" column', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-B', 50, 100),
      // Column headers at y=500
      makeItem('Description', 50, 500),
      makeItem('Proceeds', 200, 500),
      makeItem('Cost Basis', 350, 500),
      makeItem('Wash Sale', 500, 500),
      // Data row at y=450
      makeItem('100 XYZ', 50, 450),
      makeItem('$8,000.00', 200, 450),
      makeItem('$10,000.00', 350, 450),
      makeItem('$400.00', 500, 450),   // wash sale disallowed
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099Bs).toHaveLength(1);
    expect(result.form1099Bs[0].washSaleDisallowed).toBe(40000);
  });

  it('leaves washSaleDisallowed undefined when no wash sale column', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-B', 50, 100),
      makeItem('Description', 50, 500),
      makeItem('Proceeds', 200, 500),
      makeItem('Cost Basis', 350, 500),
      makeItem('100 ABC', 50, 450),
      makeItem('$5,000.00', 200, 450),
      makeItem('$4,000.00', 350, 450),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099Bs).toHaveLength(1);
    expect(result.form1099Bs[0].washSaleDisallowed).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Multi-section consolidated 1099
// ---------------------------------------------------------------------------

describe('parse1099Pdf: multi-section consolidated 1099', () => {
  it('parses INT + DIV sections from the same page into separate arrays', () => {
    // Two sections on page 1: INT at bottom-left, DIV at bottom-right
    // Each section header at y=100, with data above
    const items: ExtractedTextItem[] = [
      // INT section header (left column)
      makeItem('2025 1099-INT', 50, 100),
      makeItem('1 Interest income', 50, 500),
      makeItem('$500.00', 200, 500),
      // DIV section header (right column)
      makeItem('2025 1099-DIV', 330, 100),
      makeItem('1a Total ordinary dividends', 330, 500),
      makeItem('$300.00', 530, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099INTs).toHaveLength(1);
    expect(result.form1099INTs[0].interest).toBe(50000);
    expect(result.form1099DIVs).toHaveLength(1);
    expect(result.form1099DIVs[0].ordinaryDividends).toBe(30000);
  });

  it('parses INT + B from separate pages', () => {
    const items: ExtractedTextItem[] = [
      // Page 1: INT section
      makeItem('2025 1099-INT', 50, 100, 1),
      makeItem('1 Interest income', 50, 500, 1),
      makeItem('$750.00', 250, 500, 1),
      // Page 2: B section with tabular data
      makeItem('2025 1099-B', 50, 100, 2),
      makeItem('Description', 50, 500, 2),
      makeItem('Proceeds', 200, 500, 2),
      makeItem('Cost Basis', 350, 500, 2),
      makeItem('100 NVDA', 50, 450, 2),
      makeItem('$5,000.00', 200, 450, 2),
      makeItem('$3,000.00', 350, 450, 2),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099INTs).toHaveLength(1);
    expect(result.form1099INTs[0].interest).toBe(75000);
    expect(result.form1099Bs).toHaveLength(1);
    expect(result.form1099Bs[0].proceeds).toBe(500000);
    expect(result.form1099Bs[0].costBasis).toBe(300000);
  });

  it('returns empty arrays when no sections detected', () => {
    const items: ExtractedTextItem[] = [
      makeItem('This is not a 1099 document', 50, 500),
      makeItem('$1,234.56', 200, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.form1099INTs).toHaveLength(0);
    expect(result.form1099DIVs).toHaveLength(0);
    expect(result.form1099Bs).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('No 1099 sections'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Broker and tax year detection
// ---------------------------------------------------------------------------

describe('parse1099Pdf: broker and tax year detection', () => {
  it('detects tax year from a section header on page 1', () => {
    const items: ExtractedTextItem[] = [
      makeItem('2025 1099-INT', 50, 100),
      makeItem('1 Interest income', 50, 500),
      makeItem('$100.00', 250, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.taxYear).toBe('2025');
  });

  it('detects known broker name from page 1 text', () => {
    const items: ExtractedTextItem[] = [
      makeItem('FIDELITY INVESTMENTS', 50, 750),
      makeItem('2025 1099-INT', 50, 100),
      makeItem('1 Interest income', 50, 500),
      makeItem('$100.00', 250, 500),
    ];
    const result = parse1099Pdf(items);
    expect(result.brokerName).toBe('FIDELITY INVESTMENTS');
  });
});

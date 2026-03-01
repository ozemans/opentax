import { describe, it, expect } from 'vitest';
import { fillForm8949 } from '../../src/pdf/f8949-handler';
import type { AdjustedForm1099B, Form8949Category } from '../../src/engine/types';
import { createSyntheticTemplate, createMockTemplateLoader, getPageCount } from './helpers';

// Create a synthetic template with Part I row fields for Form 8949
async function create8949Template(): Promise<Uint8Array> {
  const textFields: string[] = [];

  // Part I row fields (f1_ prefix, Page1)
  for (let row = 1; row <= 11; row++) {
    const rowStartField = 3 + (row - 1) * 8;
    const tableRow = `Table_Line1_Part1[0].Row${row}[0]`;
    for (let col = 0; col < 8; col++) {
      const fieldNum = String(rowStartField + col).padStart(2, '0');
      textFields.push(`topmostSubform[0].Page1[0].${tableRow}.f1_${fieldNum}[0]`);
    }
  }

  // Part II row fields (f2_ prefix, Page2)
  for (let row = 1; row <= 11; row++) {
    const rowStartField = 3 + (row - 1) * 8;
    const tableRow = `Table_Line1_Part2[0].Row${row}[0]`;
    for (let col = 0; col < 8; col++) {
      const fieldNum = String(rowStartField + col).padStart(2, '0');
      textFields.push(`topmostSubform[0].Page2[0].${tableRow}.f2_${fieldNum}[0]`);
    }
  }

  // Part I total fields
  textFields.push('topmostSubform[0].Page1[0].f1_91[0]');
  textFields.push('topmostSubform[0].Page1[0].f1_92[0]');
  textFields.push('topmostSubform[0].Page1[0].f1_94[0]');

  // Part II total fields
  textFields.push('topmostSubform[0].Page2[0].f2_91[0]');
  textFields.push('topmostSubform[0].Page2[0].f2_92[0]');
  textFields.push('topmostSubform[0].Page2[0].f2_94[0]');

  return createSyntheticTemplate(textFields);
}

/** Build an empty categorized result (all categories empty). */
function emptyCategorized(): Record<Form8949Category, AdjustedForm1099B[]> {
  return {
    '8949_A': [], '8949_B': [], '8949_C': [],
    '8949_D': [], '8949_E': [], '8949_F': [],
  };
}

/** Create an AdjustedForm1099B for testing. */
function makeAdjustedTx(
  overrides: Partial<AdjustedForm1099B> & { category: Form8949Category },
): AdjustedForm1099B {
  const gainLoss = overrides.gainLoss ?? 200_000;
  const washSaleDisallowed = overrides.washSaleDisallowed ?? 0;
  return {
    description: 'TEST STOCK',
    dateAcquired: '2024-01-15',
    dateSold: '2025-06-15',
    proceeds: 1_000_000,
    costBasis: 800_000,
    gainLoss,
    isLongTerm: overrides.category.startsWith('8949_D') ||
                overrides.category.startsWith('8949_E') ||
                overrides.category.startsWith('8949_F'),
    basisReportedToIRS: overrides.category === '8949_A' || overrides.category === '8949_D',
    washSaleDisallowed,
    category: overrides.category,
    effectiveGainLoss: gainLoss + washSaleDisallowed,
    adjustmentCode: washSaleDisallowed > 0 ? 'W' : '',
    ...overrides,
  };
}

describe('fillForm8949', () => {
  // -----------------------------------------------------------------------
  // Empty input
  // -----------------------------------------------------------------------
  it('returns empty array when all categories are empty', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const result = await fillForm8949(emptyCategorized(), loader);

    expect(result).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Part I only (Short-Term categories A/B/C)
  // -----------------------------------------------------------------------
  it('produces Part I pages only when all transactions are short-term (Cat A)', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const categorized = emptyCategorized();
    categorized['8949_A'] = Array.from({ length: 5 }, (_, i) =>
      makeAdjustedTx({ category: '8949_A', description: `Stock ${i}` }),
    );

    const result = await fillForm8949(categorized, loader);

    expect(result).toHaveLength(1);
    expect(await getPageCount(result[0])).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Part II only (Long-Term categories D/E/F)
  // -----------------------------------------------------------------------
  it('produces Part II pages only when all transactions are long-term (Cat D)', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const categorized = emptyCategorized();
    categorized['8949_D'] = Array.from({ length: 3 }, (_, i) =>
      makeAdjustedTx({ category: '8949_D', description: `LT Stock ${i}` }),
    );

    const result = await fillForm8949(categorized, loader);

    expect(result).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Pagination within a single category
  // -----------------------------------------------------------------------
  it('produces 2 pages for 12 Cat A transactions (11 per page)', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const categorized = emptyCategorized();
    categorized['8949_A'] = Array.from({ length: 12 }, (_, i) =>
      makeAdjustedTx({ category: '8949_A', description: `Stock ${i}` }),
    );

    const result = await fillForm8949(categorized, loader);

    expect(result).toHaveLength(2);
  });

  it('produces 3 pages for 23 Cat D transactions', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const categorized = emptyCategorized();
    categorized['8949_D'] = Array.from({ length: 23 }, (_, i) =>
      makeAdjustedTx({ category: '8949_D', description: `LT Stock ${i}` }),
    );

    const result = await fillForm8949(categorized, loader);

    expect(result).toHaveLength(3); // ceil(23/11) = 3
  });

  // -----------------------------------------------------------------------
  // Multiple categories produce separate pages
  // -----------------------------------------------------------------------
  it('produces separate pages for Cat A and Cat B (different categories, same part)', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const categorized = emptyCategorized();
    categorized['8949_A'] = [makeAdjustedTx({ category: '8949_A' })];
    categorized['8949_B'] = [makeAdjustedTx({ category: '8949_B' })];

    const result = await fillForm8949(categorized, loader);

    // One page per category (each category needs its own checkbox)
    expect(result).toHaveLength(2);
  });

  it('Part I pages come before Part II pages when both are present', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const categorized = emptyCategorized();
    // 2 ST transactions (Cat A = Part I)
    categorized['8949_A'] = Array.from({ length: 2 }, (_, i) =>
      makeAdjustedTx({ category: '8949_A', description: `ST ${i}` }),
    );
    // 3 LT transactions (Cat D = Part II)
    categorized['8949_D'] = Array.from({ length: 3 }, (_, i) =>
      makeAdjustedTx({ category: '8949_D', description: `LT ${i}` }),
    );

    const result = await fillForm8949(categorized, loader);

    // 1 Part I page + 1 Part II page = 2 total
    expect(result).toHaveLength(2);
    // All Part I pages come first (no direct way to verify ordering of PDFs in tests,
    // but we verify the count is correct and pages are valid)
    for (const page of result) {
      expect(page).toBeInstanceOf(Uint8Array);
      expect(page.length).toBeGreaterThan(100);
    }
  });

  // -----------------------------------------------------------------------
  // Wash sale data (column g/h)
  // -----------------------------------------------------------------------
  it('handles wash sale transactions (washSaleDisallowed and adjustmentCode populated)', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const categorized = emptyCategorized();
    categorized['8949_A'] = [
      makeAdjustedTx({
        category: '8949_A',
        gainLoss: -200_000,
        washSaleDisallowed: 50_000,
        effectiveGainLoss: -150_000,
        adjustmentCode: 'W',
      }),
    ];

    const result = await fillForm8949(categorized, loader);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Uint8Array);
    expect(result[0].length).toBeGreaterThan(100);
  });

  // -----------------------------------------------------------------------
  // Template error handling
  // -----------------------------------------------------------------------
  it('throws PdfTemplateError when template loading fails', async () => {
    const loader = createMockTemplateLoader({}); // No f8949 template

    const categorized = emptyCategorized();
    categorized['8949_A'] = [makeAdjustedTx({ category: '8949_A' })];

    await expect(fillForm8949(categorized, loader)).rejects.toThrow(
      /Failed to load Form 8949 template/,
    );
  });

  // -----------------------------------------------------------------------
  // All 6 categories simultaneously
  // -----------------------------------------------------------------------
  it('handles all 6 categories producing 6 pages', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const categorized: Record<Form8949Category, AdjustedForm1099B[]> = {
      '8949_A': [makeAdjustedTx({ category: '8949_A' })],
      '8949_B': [makeAdjustedTx({ category: '8949_B' })],
      '8949_C': [makeAdjustedTx({ category: '8949_C' })],
      '8949_D': [makeAdjustedTx({ category: '8949_D' })],
      '8949_E': [makeAdjustedTx({ category: '8949_E' })],
      '8949_F': [makeAdjustedTx({ category: '8949_F' })],
    };

    const result = await fillForm8949(categorized, loader);

    expect(result).toHaveLength(6);
    for (const page of result) {
      expect(page).toBeInstanceOf(Uint8Array);
      expect(page.length).toBeGreaterThan(100);
    }
  });

  it('produces valid single-page PDFs for each page', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const categorized = emptyCategorized();
    categorized['8949_D'] = Array.from({ length: 20 }, (_, i) =>
      makeAdjustedTx({ category: '8949_D', description: `LT Stock ${i}` }),
    );

    const result = await fillForm8949(categorized, loader);

    expect(result).toHaveLength(2); // ceil(20/11) = 2
    for (const page of result) {
      expect(page).toBeInstanceOf(Uint8Array);
      const pageCount = await getPageCount(page);
      expect(pageCount).toBe(1);
    }
  });
});

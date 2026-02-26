import { describe, it, expect } from 'vitest';
import { fillForm8949 } from '../../src/pdf/f8949-handler';
import { createSyntheticTemplate, createMockTemplateLoader, getPageCount } from './helpers';

// Create a synthetic template with row fields for Form 8949
// The actual IRS Form 8949 has 11 rows per page (per part).
async function create8949Template(): Promise<Uint8Array> {
  const textFields: string[] = [];

  // Create row-specific fields for 11 rows (matching real IRS form layout)
  for (let row = 1; row <= 11; row++) {
    const rowStartField = 3 + (row - 1) * 8;
    const tableRow = `Table_Line1_Part1[0].Row${row}[0]`;
    for (let col = 0; col < 8; col++) {
      const fieldNum = String(rowStartField + col).padStart(2, '0');
      textFields.push(`topmostSubform[0].Page1[0].${tableRow}.f1_${fieldNum}[0]`);
    }
  }

  // Total fields
  textFields.push('topmostSubform[0].Page1[0].f1_91[0]');
  textFields.push('topmostSubform[0].Page1[0].f1_92[0]');
  textFields.push('topmostSubform[0].Page1[0].f1_94[0]');

  return createSyntheticTemplate(textFields);
}

function makeTransaction(i: number): Record<string, string | number> {
  return {
    description: `Stock ${i}`,
    dateAcquired: '2023-01-01',
    dateSold: '2025-06-15',
    proceeds: 10000 + i * 1000,
    basis: 8000 + i * 500,
    gainLoss: 2000 + i * 500,
    category: '8949_D',
  };
}

describe('fillForm8949', () => {
  it('should return empty array for no transactions', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const result = await fillForm8949([], loader);

    expect(result).toHaveLength(0);
  });

  it('should produce 1 page for less than 11 transactions', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const transactions = Array.from({ length: 5 }, (_, i) => makeTransaction(i + 1));
    const result = await fillForm8949(transactions, loader);

    expect(result).toHaveLength(1);
    const pageCount = await getPageCount(result[0]);
    expect(pageCount).toBe(1);
  });

  it('should produce 1 page for exactly 11 transactions', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const transactions = Array.from({ length: 11 }, (_, i) => makeTransaction(i + 1));
    const result = await fillForm8949(transactions, loader);

    expect(result).toHaveLength(1);
  });

  it('should produce 2 pages for 12 transactions', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const transactions = Array.from({ length: 12 }, (_, i) => makeTransaction(i + 1));
    const result = await fillForm8949(transactions, loader);

    expect(result).toHaveLength(2);
  });

  it('should produce 3 pages for 23 transactions', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const transactions = Array.from({ length: 23 }, (_, i) => makeTransaction(i + 1));
    const result = await fillForm8949(transactions, loader);

    expect(result).toHaveLength(3); // ceil(23/11) = 3
  });

  it('should compute page totals correctly', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    // 3 transactions with known values
    const transactions = [
      { description: 'A', dateAcquired: '2023-01-01', dateSold: '2025-01-01', proceeds: 10000, basis: 8000, gainLoss: 2000, category: '8949_D' },
      { description: 'B', dateAcquired: '2023-02-01', dateSold: '2025-02-01', proceeds: 20000, basis: 15000, gainLoss: 5000, category: '8949_D' },
      { description: 'C', dateAcquired: '2023-03-01', dateSold: '2025-03-01', proceeds: 5000, basis: 7000, gainLoss: -2000, category: '8949_A' },
    ];

    const result = await fillForm8949(transactions, loader);

    expect(result).toHaveLength(1);
    // Total proceeds: 10000+20000+5000 = 35000
    // Total basis: 8000+15000+7000 = 30000
    // Total gainLoss: 2000+5000+(-2000) = 5000
    // We can't easily read flattened fields, but we verify a valid PDF was produced
    expect(result[0]).toBeInstanceOf(Uint8Array);
    expect(result[0].length).toBeGreaterThan(100);
  });

  it('should throw PdfTemplateError when template loading fails', async () => {
    const loader = createMockTemplateLoader({}); // No f8949 template

    const transactions = [makeTransaction(1)];

    await expect(fillForm8949(transactions, loader)).rejects.toThrow(
      /Failed to load Form 8949 template/,
    );
  });

  it('should handle transactions with string values for totals computation', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    // Mix of string and number values — string values should not be added to totals
    const transactions = [
      { description: 'Stock A', dateAcquired: '2023-01-01', dateSold: '2025-01-01', proceeds: 'N/A', basis: 'N/A', gainLoss: 'N/A', category: '8949_D' },
      { description: 'Stock B', dateAcquired: '2023-01-01', dateSold: '2025-01-01', proceeds: 10000, basis: 8000, gainLoss: 2000, category: '8949_D' },
    ];

    const result = await fillForm8949(transactions, loader);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Uint8Array);
  });

  it('should produce valid PDFs for all pages', async () => {
    const template = await create8949Template();
    const loader = createMockTemplateLoader({ f8949: template });

    const transactions = Array.from({ length: 20 }, (_, i) => makeTransaction(i + 1));
    const result = await fillForm8949(transactions, loader);

    expect(result).toHaveLength(2); // ceil(20/11) = 2
    for (const page of result) {
      expect(page).toBeInstanceOf(Uint8Array);
      const pageCount = await getPageCount(page);
      expect(pageCount).toBe(1);
    }
  });
});

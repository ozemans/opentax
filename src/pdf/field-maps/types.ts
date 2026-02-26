// PDF Field Mapping Types
// Defines the structure for mapping engine form fields to PDF template field names.

export type PdfFieldType = 'text' | 'checkbox';

export interface PdfFieldMapping {
  pdfFieldName: string;
  type: PdfFieldType;
  transform?: (value: string | number) => string;
}

export type FieldMap = Record<string, PdfFieldMapping>;

/**
 * Transform cents (engine integer) to whole dollars (IRS form display).
 * Engine stores all money as integer cents ($50,000 = 5_000_000).
 * IRS forms expect whole dollar amounts.
 * Returns empty string for zero/NaN values (IRS convention: leave blank if zero).
 */
export const centsToDollars = (v: string | number): string => {
  const cents = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (isNaN(cents) || cents === 0) return '';
  return String(Math.round(cents / 100));
};

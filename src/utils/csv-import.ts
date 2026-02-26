/**
 * Parse brokerage CSV files into Form1099B arrays.
 *
 * Handles common CSV formats from major brokerages (Fidelity, Schwab,
 * TD Ameritrade, etc.) by being lenient with column name matching.
 * All dollar amounts are converted to cents (integers).
 */

import type { Form1099B, Form8949Category } from '../engine/types';

// ---------------------------------------------------------------------------
// Column name normalization
// ---------------------------------------------------------------------------

/** Map of canonical field name -> list of known column header variations */
const COLUMN_ALIASES: Record<string, string[]> = {
  description: [
    'description', 'security', 'security name', 'name', 'symbol',
    'asset', 'stock', 'investment',
  ],
  dateAcquired: [
    'date acquired', 'acquired', 'acquisition date', 'purchase date',
    'date purchased', 'buy date', 'open date',
  ],
  dateSold: [
    'date sold', 'sold', 'sale date', 'sell date', 'close date',
    'date of sale', 'disposition date',
  ],
  proceeds: [
    'proceeds', 'sales price', 'sale price', 'gross proceeds',
    'total proceeds', 'amount realized',
  ],
  costBasis: [
    'cost basis', 'basis', 'cost', 'cost or other basis',
    'adjusted cost basis', 'purchase price',
  ],
  gainLoss: [
    'gain/loss', 'gain or loss', 'gain loss', 'gain(loss)',
    'realized gain/loss', 'net gain/loss', 'profit/loss',
  ],
};

/**
 * Normalize a column header for matching.
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9\s/()]/g, '')
    .trim();
}

/**
 * Find the canonical field name for a given column header.
 */
function matchColumn(header: string): string | null {
  const normalized = normalizeHeader(header);
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
      return canonical;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parse a CSV string into rows of string arrays.
 * Handles quoted fields with commas inside them.
 */
function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (line.trim() === '') continue;

    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++; // Skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    rows.push(fields);
  }

  return rows;
}

/**
 * Parse a dollar amount string to cents.
 * Handles: "$1,234.56", "1234.56", "(1,234.56)" (negative), "-1234.56"
 */
function parseDollarsToCents(value: string): number {
  if (!value || value.trim() === '') return 0;
  let cleaned = value.trim();

  // Handle parenthesized negatives: (1,234.56) -> -1234.56
  const isNegativeParens = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegativeParens) {
    cleaned = cleaned.slice(1, -1);
  }

  // Remove $, commas, spaces
  cleaned = cleaned.replace(/[$,\s]/g, '');

  const parsed = parseFloat(cleaned);
  if (Number.isNaN(parsed)) return 0;

  const cents = Math.round(parsed * 100);
  return isNegativeParens ? -cents : cents;
}

/**
 * Parse a date string into ISO format (YYYY-MM-DD) or 'VARIOUS'.
 */
function parseDate(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (trimmed === 'VARIOUS' || trimmed === '') return trimmed || '';

  // Try MM/DD/YYYY
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(trimmed);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    let year = slashMatch[3];
    if (year.length === 2) {
      year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // Try YYYY-MM-DD (already ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return value.trim();
}

/**
 * Determine the holding period from dates.
 */
function isLongTermHolding(dateAcquired: string, dateSold: string): boolean {
  if (dateAcquired === 'VARIOUS' || dateAcquired === '') return false;
  const acquired = new Date(dateAcquired);
  const sold = new Date(dateSold);
  if (Number.isNaN(acquired.getTime()) || Number.isNaN(sold.getTime())) return false;

  // Long-term = held for more than one year
  const oneYearLater = new Date(acquired);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  return sold > oneYearLater;
}

/**
 * Determine the Form 8949 category.
 * Default: basis reported to IRS (category A for short-term, D for long-term).
 */
function determineCategory(isLongTerm: boolean, basisReported: boolean): Form8949Category {
  if (isLongTerm) {
    return basisReported ? '8949_D' : '8949_E';
  }
  return basisReported ? '8949_A' : '8949_B';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a brokerage CSV file into an array of Form1099B records.
 * Returns results sorted by date sold (ascending).
 */
export function parseBrokerageCSV(csvText: string): Form1099B[] {
  const rows = parseCSVRows(csvText);
  if (rows.length < 2) return []; // Need at least header + 1 data row

  const headers = rows[0];
  const columnMap = new Map<string, number>();

  // Map headers to column indices
  for (let i = 0; i < headers.length; i++) {
    const canonical = matchColumn(headers[i]);
    if (canonical && !columnMap.has(canonical)) {
      columnMap.set(canonical, i);
    }
  }

  // We need at minimum description/proceeds/cost to be useful
  if (!columnMap.has('proceeds') && !columnMap.has('costBasis')) {
    return [];
  }

  const results: Form1099B[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < 2) continue; // Skip empty/malformed rows

    const getValue = (field: string): string => {
      const idx = columnMap.get(field);
      if (idx === undefined || idx >= row.length) return '';
      return row[idx];
    };

    const description = getValue('description');
    const dateAcquired = parseDate(getValue('dateAcquired'));
    const dateSold = parseDate(getValue('dateSold'));
    const proceeds = parseDollarsToCents(getValue('proceeds'));
    const costBasis = parseDollarsToCents(getValue('costBasis'));

    // Use provided gain/loss or compute it
    const gainLossRaw = getValue('gainLoss');
    const gainLoss = gainLossRaw
      ? parseDollarsToCents(gainLossRaw)
      : proceeds - costBasis;

    const isLongTerm = isLongTermHolding(dateAcquired, dateSold);
    const basisReportedToIRS = true; // Default assumption for CSV imports
    const category = determineCategory(isLongTerm, basisReportedToIRS);

    results.push({
      description,
      dateAcquired,
      dateSold,
      proceeds,
      costBasis,
      gainLoss,
      isLongTerm,
      basisReportedToIRS,
      category,
    });
  }

  // Sort by date sold ascending
  results.sort((a, b) => {
    if (a.dateSold === '' || a.dateSold === 'VARIOUS') return 1;
    if (b.dateSold === '' || b.dateSold === 'VARIOUS') return -1;
    return a.dateSold.localeCompare(b.dateSold);
  });

  return results;
}

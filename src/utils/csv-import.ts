/**
 * Parse brokerage CSV files into Form1099B arrays.
 *
 * Handles common CSV formats from major brokerages (Fidelity, Schwab,
 * TD Ameritrade, etc.) by being lenient with column name matching.
 * All dollar amounts are converted to cents (integers).
 */

import type { Form1099B } from '../engine/types';
import {
  parseDollarsToCents,
  parseDate,
  isLongTermHolding,
  determineCategory,
} from './parse-helpers';

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

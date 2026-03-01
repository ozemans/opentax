/**
 * Parse broker holdings CSV exports into TaxLot arrays.
 *
 * Supports the three most common US brokerage formats:
 *   - Fidelity  (Portfolio_Positions_*.csv)
 *   - Schwab    (Positions_*.csv)
 *   - Vanguard  (offerholdings*.csv)
 *
 * Column headers are matched case-insensitively via an alias table.
 * Quantities may be fractional (mutual fund shares, DRIPs).
 * All monetary values are converted to integer cents.
 */

import type { TaxLot } from '../engine/types';
import { parseDollarsToCents, parseDate } from './parse-helpers';

// ---------------------------------------------------------------------------
// Column alias map
// ---------------------------------------------------------------------------

/** Maps canonical field name → list of known column header variations */
const COLUMN_ALIASES: Record<string, string[]> = {
  symbol: [
    'symbol', 'ticker', 'ticker symbol', 'security symbol', 'fund symbol',
    'cusip', // fallback; not ideal but sometimes used
  ],
  description: [
    'description', 'security', 'security name', 'security description',
    'investment name', 'fund name', 'name', 'asset',
  ],
  quantity: [
    'quantity', 'shares', 'number of shares', 'units', 'share quantity',
    'shares held', 'number of units', 'unit qty',
  ],
  unitCostBasis: [
    'cost basis/share', 'cost per share', 'avg cost basis', 'average cost basis',
    'average cost', 'avg cost', 'price paid', 'unit cost', 'cost/share',
    'per share cost', 'adjusted cost basis/share',
  ],
  totalCostBasis: [
    'total cost basis', 'cost basis', 'cost basis total', 'total basis',
    'adjusted cost basis', 'original cost', 'total cost',
  ],
  dateAcquired: [
    'date acquired', 'acquisition date', 'purchase date', 'date purchased',
    'buy date', 'open date', 'date bought', 'acquired',
  ],
};

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Split a single CSV line into fields, respecting double-quoted values.
 */
function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Normalize a column header string for alias matching.
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, '') // strip punctuation except /
    .replace(/\s+/g, ' ')
    .trim();
}

/** Map from column index → canonical field name */
type ColumnMap = Record<number, string>;

/**
 * Match raw CSV headers to canonical field names.
 * Returns a map from column index to canonical field name.
 */
function buildColumnMap(rawHeaders: string[]): ColumnMap {
  const map: ColumnMap = {};

  for (let i = 0; i < rawHeaders.length; i++) {
    const normalized = normalizeHeader(rawHeaders[i]);
    for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(normalized)) {
        // First match wins; don't overwrite a column already assigned to this canonical field
        const alreadyAssigned = Object.values(map).includes(canonical);
        if (!alreadyAssigned) {
          map[i] = canonical;
        }
        break;
      }
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a date string represents a long-term holding.
 * Returns null if dateAcquired is 'VARIOUS'.
 * Compares against `referenceDate` (today when parsing).
 */
function computeIsLongTerm(dateAcquired: string, referenceDate: Date): boolean | null {
  if (dateAcquired === 'VARIOUS') return null;
  const acquired = new Date(dateAcquired);
  if (isNaN(acquired.getTime())) return null;
  const oneYearAgo = new Date(referenceDate);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return acquired <= oneYearAgo;
}

// ---------------------------------------------------------------------------
// Row → TaxLot
// ---------------------------------------------------------------------------

function buildTaxLot(
  fields: string[],
  colMap: ColumnMap,
  referenceDate: Date,
): TaxLot | null {
  const get = (canonical: string): string => {
    const idx = Object.entries(colMap).find(([, c]) => c === canonical)?.[0];
    if (idx === undefined) return '';
    return fields[Number(idx)] ?? '';
  };

  const symbol = get('symbol').toUpperCase();
  if (!symbol) return null; // skip blank rows

  const description = get('description') || symbol;

  const quantityStr = get('quantity').replace(/[,$]/g, '');
  const quantity = parseFloat(quantityStr);
  if (!isFinite(quantity) || quantity <= 0) return null; // skip zero/invalid rows

  // Cost basis — prefer unit if available; derive from total if needed
  const unitStr = get('unitCostBasis');
  const totalStr = get('totalCostBasis');

  let unitCostBasis: number;
  let totalCostBasis: number;

  if (unitStr) {
    unitCostBasis = parseDollarsToCents(unitStr);
    totalCostBasis = totalStr ? parseDollarsToCents(totalStr) : Math.round(unitCostBasis * quantity);
  } else if (totalStr) {
    totalCostBasis = parseDollarsToCents(totalStr);
    unitCostBasis = quantity > 0 ? Math.round(totalCostBasis / quantity) : 0;
  } else {
    // No cost basis data — skip or create lot with zero basis
    unitCostBasis = 0;
    totalCostBasis = 0;
  }

  const rawDateStr = get('dateAcquired');
  const dateAcquired = rawDateStr
    ? rawDateStr.toUpperCase() === 'VARIOUS'
      ? 'VARIOUS'
      : parseDate(rawDateStr)
    : 'VARIOUS';

  const isLongTerm = computeIsLongTerm(dateAcquired, referenceDate);

  return {
    id: crypto.randomUUID(),
    symbol,
    description,
    dateAcquired,
    quantity,
    unitCostBasis,
    totalCostBasis,
    isLongTerm,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface HoldingsParseResult {
  lots: TaxLot[];
  /** Rows that could not be parsed (for UI error display) */
  skippedRows: number;
  /** Warning messages (e.g. missing columns) */
  warnings: string[];
}

/**
 * Parse a brokerage holdings CSV string into an array of TaxLot objects.
 *
 * Accepts CSV content from Fidelity, Schwab, or Vanguard.
 * Rows without a valid symbol or quantity are silently skipped.
 * Rows without cost basis data produce lots with zero basis and a warning.
 *
 * @param csvText  Raw CSV file content as a string
 * @param referenceDate  Date to use for long-term determination (defaults to today)
 */
export function parseHoldingsCSV(
  csvText: string,
  referenceDate: Date = new Date(),
): HoldingsParseResult {
  const warnings: string[] = [];
  const lots: TaxLot[] = [];
  let skippedRows = 0;

  const rawLines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length < 2) {
    warnings.push('CSV appears empty or has only one row');
    return { lots, skippedRows, warnings };
  }

  // Skip Fidelity/Schwab preamble lines (e.g. "Account Name", "Date:") before the real header
  let headerLineIndex = 0;
  for (let i = 0; i < Math.min(10, rawLines.length); i++) {
    const cols = splitCSVLine(rawLines[i]);
    // A real header row has at least one alias match for 'symbol' or 'quantity'
    const normalized = cols.map(normalizeHeader);
    const hasSymbolCol = normalized.some((n) =>
      COLUMN_ALIASES.symbol.includes(n) ||
      COLUMN_ALIASES.description.includes(n),
    );
    const hasQuantityCol = normalized.some((n) => COLUMN_ALIASES.quantity.includes(n));
    if (hasSymbolCol && hasQuantityCol) {
      headerLineIndex = i;
      break;
    }
  }

  const headerFields = splitCSVLine(rawLines[headerLineIndex]);
  const colMap = buildColumnMap(headerFields);

  // Validate that we found essential columns
  const canonicals = Object.values(colMap);
  if (!canonicals.includes('symbol') && !canonicals.includes('description')) {
    warnings.push('Could not find a symbol/description column — check that this is a holdings CSV');
  }
  if (!canonicals.includes('quantity')) {
    warnings.push('Could not find a quantity/shares column — rows will be skipped');
  }
  if (!canonicals.includes('unitCostBasis') && !canonicals.includes('totalCostBasis')) {
    warnings.push('No cost basis column found — lots will have $0 basis');
  }

  const dataLines = rawLines.slice(headerLineIndex + 1);

  for (const line of dataLines) {
    // Skip section-separator lines common in Fidelity exports ("Brokerage", "401(k)", etc.)
    if (line.startsWith('"') && !line.includes(',')) continue;
    // Skip summary/total lines
    const lower = line.toLowerCase();
    if (lower.startsWith('total') || lower.startsWith('subtotal') || lower.startsWith('account total')) {
      continue;
    }

    const fields = splitCSVLine(line);
    if (fields.length < 2) {
      skippedRows++;
      continue;
    }

    const lot = buildTaxLot(fields, colMap, referenceDate);
    if (lot) {
      lots.push(lot);
    } else {
      skippedRows++;
    }
  }

  return { lots, skippedRows, warnings };
}

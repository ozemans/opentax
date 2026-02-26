/**
 * Parse extracted PDF text into structured 1099 data.
 *
 * Handles consolidated 1099 documents from brokerages that contain
 * 1099-INT, 1099-DIV, 1099-B, and 1099-NEC sections.
 *
 * Parsing is best-effort: if a section is detected but amounts cannot
 * be parsed, a warning is added rather than throwing.
 *
 * All dollar amounts are in cents (integers).
 */

import type {
  Form1099INT,
  Form1099DIV,
  Form1099B,
  Form1099NEC,
} from '@/engine/types';
import type { ExtractedTextItem } from '@/utils/pdf-extract';
import {
  parseDollarsToCents,
  parseDate,
  isLongTermHolding,
  determineCategory,
} from '@/utils/parse-helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Parsed1099Result {
  form1099INTs: Form1099INT[];
  form1099DIVs: Form1099DIV[];
  form1099Bs: Form1099B[];
  form1099NECs: Form1099NEC[];
  brokerName: string;
  taxYear: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Y-tolerance for considering two items on the "same line" */
const Y_TOLERANCE = 3;

/**
 * Check if a string is a 1099 section header.
 *
 * Strict rules:
 * - Must be short text (not a full sentence or legal paragraph)
 * - Must contain "1099-X" with an explicit hyphen (rejects "20251099")
 * - Must have the section type as a whole word (rejects "1099-BROKERAGE")
 */
function matchesSectionHeader(text: string, sectionType: string): boolean {
  const trimmed = text.trim();
  // Section headers are short — reject long text (legal disclaimers, etc.)
  if (trimmed.length > 50) return false;

  const upper = trimmed.toUpperCase();
  // Require explicit hyphen between 1099 and type, with type as whole word
  const pattern = new RegExp(
    `(?:FORM\\s+)?1099\\s*-\\s*${sectionType}\\b`,
  );
  return pattern.test(upper);
}

/**
 * Check if a text string looks like a formatted dollar amount.
 *
 * Requires at least one monetary indicator: $ sign, decimal point
 * with 1-2 trailing digits, or comma-separated thousands.
 * Rejects bare integers (form numbers, dates, page numbers, etc.).
 */
function looksLikeDollarAmount(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === '') return false;

  // Strip outer parens for negative-amount check
  const inner = trimmed.startsWith('(') && trimmed.endsWith(')')
    ? trimmed.slice(1, -1).trim()
    : trimmed;

  return (
    // Has a $ sign
    /\$/.test(inner) ||
    // Has decimal point followed by 1-2 digits at end (e.g., "1234.56")
    /\d\.\d{1,2}\s*$/.test(inner) ||
    // Has comma-formatted thousands (e.g., "1,234" or "1,234,567")
    /\d{1,3},\d{3}/.test(inner)
  );
}

/**
 * Parse a dollar amount from PDF text, with stricter validation
 * than the CSV parser. Only parses text that looks like a formatted
 * monetary value (has $, decimals, or comma-separated thousands).
 */
function parsePdfDollarAmount(text: string): number {
  if (!looksLikeDollarAmount(text)) return 0;
  return parseDollarsToCents(text);
}

/**
 * Find all items on a similar y-line (within tolerance) from a subset of items.
 */
function getItemsOnLine(
  items: ExtractedTextItem[],
  targetY: number,
  tolerance: number = Y_TOLERANCE,
): ExtractedTextItem[] {
  return items.filter((item) => Math.abs(item.y - targetY) <= tolerance);
}

/**
 * Find the nearest dollar value on the same line or immediately following.
 * Scans items to the right of the label on the same y-line first,
 * then checks the line below. Uses strict dollar validation.
 */
function findNearestDollarOnLine(
  items: ExtractedTextItem[],
  labelIndex: number,
): number | null {
  const label = items[labelIndex];

  // Look for dollar values on the same line (to the right of the label)
  const sameLine = getItemsOnLine(items, label.y).filter(
    (item) => item.x > label.x,
  );
  for (const item of sameLine) {
    const cents = parsePdfDollarAmount(item.text);
    if (cents !== 0 || /^\$?0(\.00)?$/.test(item.text.trim())) {
      return cents;
    }
  }

  // Try items immediately below (next line — higher index, lower y)
  for (let i = labelIndex + 1; i < Math.min(labelIndex + 5, items.length); i++) {
    if (items[i].page !== label.page) break;
    if (Math.abs(items[i].y - label.y) > Y_TOLERANCE) {
      // We're now on a different line — check it
      const cents = parsePdfDollarAmount(items[i].text);
      if (cents !== 0 || /^\$?0(\.00)?$/.test(items[i].text.trim())) {
        return cents;
      }
      break;
    }
  }

  return null;
}

/**
 * Match a box label in IRS 1099 forms (e.g., "Box 1a", "1a.", "Box 2").
 *
 * Strict rules:
 * - "Box X" or "BoxX" always matches
 * - Standalone box IDs (like "1a") only match if followed by a period,
 *   colon, space+text, or another indicator — not bare numbers
 */
function matchesBoxLabel(text: string, boxId: string): boolean {
  const upper = text.toUpperCase().replace(/\s+/g, ' ').trim();
  const boxUpper = boxId.toUpperCase();

  // "Box 1a", "BOX 1A", "Box1a"
  if (upper.includes(`BOX ${boxUpper}`) || upper.includes(`BOX${boxUpper}`)) {
    return true;
  }

  // "1a Ordinary dividends", "1a. Interest income", "1a:"
  // Must start with the box ID and be followed by separator + more text
  const escaped = boxUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (
    new RegExp(`^${escaped}[.:,\\s]`).test(upper) &&
    upper.length > boxUpper.length + 1
  ) {
    return true;
  }

  return false;
}

/**
 * Find a box value within a section of items.
 * Returns the value in cents, or 0 if not found.
 */
function findBoxValue(
  sectionItems: ExtractedTextItem[],
  boxId: string,
): number {
  for (let i = 0; i < sectionItems.length; i++) {
    if (matchesBoxLabel(sectionItems[i].text, boxId)) {
      const value = findNearestDollarOnLine(sectionItems, i);
      if (value !== null) return value;
    }
  }
  return 0;
}

/**
 * Extract a range of items belonging to a section (between two section headers).
 */
function extractSectionItems(
  items: ExtractedTextItem[],
  sectionStart: number,
  sectionEnd: number,
): ExtractedTextItem[] {
  return items.slice(sectionStart, sectionEnd);
}

/**
 * Try to detect broker name from the first page header area.
 */
function detectBrokerName(items: ExtractedTextItem[]): string {
  const firstPageItems = items.filter((item) => item.page === 1);
  if (firstPageItems.length === 0) return '';

  // Common broker identifiers
  const knownBrokers = [
    'FIDELITY', 'SCHWAB', 'CHARLES SCHWAB', 'TD AMERITRADE',
    'VANGUARD', 'E*TRADE', 'ETRADE', 'ROBINHOOD', 'INTERACTIVE BROKERS',
    'MERRILL', 'MERRILL LYNCH', 'MORGAN STANLEY', 'WELLS FARGO',
    'JP MORGAN', 'JPMORGAN', 'EDWARD JONES', 'AMERIPRISE',
    'RAYMOND JAMES', 'BETTERMENT', 'WEALTHFRONT', 'SOFI',
  ];

  // Look for "PAYER'S name" field first
  for (let i = 0; i < firstPageItems.length; i++) {
    const text = firstPageItems[i].text.toUpperCase();
    if (text.includes("PAYER") && text.includes("NAME")) {
      // Check items to the right on the same line
      const sameLine = getItemsOnLine(firstPageItems, firstPageItems[i].y)
        .filter((item) => item.x > firstPageItems[i].x);
      if (sameLine.length > 0) {
        return sameLine[0].text.trim();
      }
      // Check next line
      for (let j = i + 1; j < Math.min(i + 3, firstPageItems.length); j++) {
        if (Math.abs(firstPageItems[j].y - firstPageItems[i].y) > Y_TOLERANCE) {
          const candidate = firstPageItems[j].text.trim();
          if (candidate.length > 2) return candidate;
          break;
        }
      }
    }
  }

  // Fall back to known broker name scanning in top items
  for (const item of firstPageItems.slice(0, 30)) {
    const upper = item.text.toUpperCase();
    for (const broker of knownBrokers) {
      if (upper.includes(broker)) {
        return item.text.trim();
      }
    }
  }

  return '';
}

/**
 * Try to detect the tax year from the document.
 */
function detectTaxYear(items: ExtractedTextItem[]): string {
  const firstPageItems = items.filter((item) => item.page === 1).slice(0, 50);
  for (const item of firstPageItems) {
    const yearMatch = /\b(20[2-3]\d)\b/.exec(item.text);
    if (yearMatch) return yearMatch[1];
  }
  return '';
}

// ---------------------------------------------------------------------------
// Section indices
// ---------------------------------------------------------------------------

interface SectionRange {
  type: 'INT' | 'DIV' | 'B' | 'NEC';
  startIndex: number;
  endIndex: number; // exclusive
}

/**
 * Detect section boundaries within the extracted text items.
 *
 * Uses strict header matching and filters out false positives:
 * - Deduplicates sections of the same type that are close together
 *   (e.g., repeated "1099-INT" on the same page from headers/footers)
 * - Filters out sections with too few items (< 3) as likely false matches
 */
function detectSections(items: ExtractedTextItem[]): SectionRange[] {
  const sectionTypes = ['INT', 'DIV', 'B', 'NEC'] as const;
  const rawSections: Array<{ type: typeof sectionTypes[number]; index: number }> = [];

  for (let i = 0; i < items.length; i++) {
    for (const sType of sectionTypes) {
      if (matchesSectionHeader(items[i].text, sType)) {
        // Deduplicate: skip if we already have this type from the same page
        // within 20 items (likely a repeated header or TOC entry)
        const lastOfType = rawSections.filter((s) => s.type === sType).pop();
        if (lastOfType) {
          const prevItem = items[lastOfType.index];
          const currItem = items[i];
          // Skip if same page and within 20 items (likely duplicate header)
          if (
            prevItem.page === currItem.page &&
            i - lastOfType.index < 20
          ) {
            continue;
          }
          // Skip if on adjacent pages and very close in index
          // (header/footer repeats across pages)
          if (
            Math.abs(prevItem.page - currItem.page) === 1 &&
            i - lastOfType.index < 10
          ) {
            continue;
          }
        }
        rawSections.push({ type: sType, index: i });
      }
    }
  }

  // Sort by index to establish ordering
  rawSections.sort((a, b) => a.index - b.index);

  // Convert to ranges
  const sections: SectionRange[] = [];
  for (let i = 0; i < rawSections.length; i++) {
    const endIndex = i + 1 < rawSections.length
      ? rawSections[i + 1].index
      : items.length;

    // Filter out sections with too few items (likely false positives)
    if (endIndex - rawSections[i].index < 3) continue;

    sections.push({
      type: rawSections[i].type,
      startIndex: rawSections[i].index,
      endIndex,
    });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

function parse1099INTSection(
  sectionItems: ExtractedTextItem[],
  brokerName: string,
  warnings: string[],
): Form1099INT | null {
  const interest = findBoxValue(sectionItems, '1');
  const earlyWithdrawalPenalty = findBoxValue(sectionItems, '2');
  const federalWithheld = findBoxValue(sectionItems, '4');
  const taxExemptInterest = findBoxValue(sectionItems, '8');

  if (interest === 0 && earlyWithdrawalPenalty === 0 && taxExemptInterest === 0) {
    warnings.push('1099-INT section found but no amounts could be extracted.');
    return null;
  }

  return {
    payerName: brokerName,
    interest,
    earlyWithdrawalPenalty: earlyWithdrawalPenalty || undefined,
    federalWithheld: federalWithheld || undefined,
    taxExemptInterest: taxExemptInterest || undefined,
  };
}

function parse1099DIVSection(
  sectionItems: ExtractedTextItem[],
  brokerName: string,
  warnings: string[],
): Form1099DIV | null {
  const ordinaryDividends = findBoxValue(sectionItems, '1a');
  const qualifiedDividends = findBoxValue(sectionItems, '1b');
  const totalCapitalGain = findBoxValue(sectionItems, '2a');
  const federalWithheld = findBoxValue(sectionItems, '4');
  const foreignTaxPaid = findBoxValue(sectionItems, '7');
  const exemptInterestDividends = findBoxValue(sectionItems, '12');

  if (ordinaryDividends === 0 && totalCapitalGain === 0 && exemptInterestDividends === 0) {
    warnings.push('1099-DIV section found but no amounts could be extracted.');
    return null;
  }

  return {
    payerName: brokerName,
    ordinaryDividends,
    qualifiedDividends,
    totalCapitalGain,
    federalWithheld: federalWithheld || undefined,
    foreignTaxPaid: foreignTaxPaid || undefined,
    exemptInterestDividends: exemptInterestDividends || undefined,
  };
}

function parse1099NECSection(
  sectionItems: ExtractedTextItem[],
  brokerName: string,
  warnings: string[],
): Form1099NEC | null {
  const nonemployeeCompensation = findBoxValue(sectionItems, '1');
  const federalWithheld = findBoxValue(sectionItems, '4');

  if (nonemployeeCompensation === 0) {
    warnings.push('1099-NEC section found but no compensation amount could be extracted.');
    return null;
  }

  return {
    payerName: brokerName,
    nonemployeeCompensation,
    federalWithheld: federalWithheld || undefined,
  };
}

// ---------------------------------------------------------------------------
// 1099-B table parsing
// ---------------------------------------------------------------------------

/** Known column labels for 1099-B tables */
const B_COLUMN_LABELS: Record<string, string[]> = {
  description: ['description', 'security', 'name', 'asset'],
  dateAcquired: ['date acquired', 'acquired', 'acquisition'],
  dateSold: ['date sold', 'sold', 'sale date', 'date of sale', 'disposition'],
  proceeds: ['proceeds', 'sales price', 'gross proceeds'],
  costBasis: ['cost basis', 'basis', 'cost or other basis', 'cost'],
  gainLoss: ['gain/loss', 'gain or loss', 'gain(loss)', 'profit/loss', 'gain'],
};

interface ColumnBoundary {
  field: string;
  xMin: number;
  xMax: number;
}

/**
 * Parse a 1099-B section that contains tabular transaction data.
 */
function parse1099BSection(
  sectionItems: ExtractedTextItem[],
  warnings: string[],
): Form1099B[] {
  if (sectionItems.length < 5) return [];

  // Step 1: Find header row — scan for items that match column labels
  const columnPositions: Array<{ field: string; x: number; y: number }> = [];

  for (const item of sectionItems) {
    const lower = item.text.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(B_COLUMN_LABELS)) {
      if (aliases.some((alias) => lower.includes(alias))) {
        columnPositions.push({ field, x: item.x, y: item.y });
        break;
      }
    }
  }

  if (columnPositions.length < 2) {
    // No table structure found — try to extract from line-by-line data
    return parseBSectionLineByLine(sectionItems, warnings);
  }

  // Find the y-position that has the most column header matches (the header row)
  const yGroups = new Map<number, typeof columnPositions>();
  for (const pos of columnPositions) {
    let foundGroup = false;
    for (const [groupY, group] of yGroups) {
      if (Math.abs(groupY - pos.y) <= Y_TOLERANCE) {
        group.push(pos);
        foundGroup = true;
        break;
      }
    }
    if (!foundGroup) {
      yGroups.set(pos.y, [pos]);
    }
  }

  let bestGroup: typeof columnPositions = [];
  for (const group of yGroups.values()) {
    if (group.length > bestGroup.length) {
      bestGroup = group;
    }
  }

  if (bestGroup.length < 2) {
    return parseBSectionLineByLine(sectionItems, warnings);
  }

  const headerRowY = bestGroup[0].y;

  // Step 2: Establish column boundaries from header positions
  const sortedHeaders = [...bestGroup].sort((a, b) => a.x - b.x);
  const boundaries: ColumnBoundary[] = [];
  for (let i = 0; i < sortedHeaders.length; i++) {
    const xMin = i === 0 ? 0 : (sortedHeaders[i - 1].x + sortedHeaders[i].x) / 2;
    const xMax = i === sortedHeaders.length - 1 ? Infinity : (sortedHeaders[i].x + sortedHeaders[i + 1].x) / 2;
    boundaries.push({ field: sortedHeaders[i].field, xMin, xMax });
  }

  // Step 3: Extract data rows (items below the header row)
  const dataItems = sectionItems.filter(
    (item) =>
      (item.page > sectionItems[0].page ||
        (item.page === sectionItems[0].page && item.y < headerRowY - Y_TOLERANCE)) &&
      item.text.trim() !== '',
  );

  if (dataItems.length === 0) return [];

  // Step 4: Group data items into rows by y-proximity
  const rows: ExtractedTextItem[][] = [];
  let currentRow: ExtractedTextItem[] = [];
  let currentRowY = dataItems[0].y;

  for (const item of dataItems) {
    if (Math.abs(item.y - currentRowY) <= Y_TOLERANCE) {
      currentRow.push(item);
    } else {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [item];
      currentRowY = item.y;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  // Step 5: Map row items to columns and build Form1099B records
  const results: Form1099B[] = [];

  for (const row of rows) {
    const fieldValues: Record<string, string> = {};
    for (const item of row) {
      for (const boundary of boundaries) {
        if (item.x >= boundary.xMin && item.x < boundary.xMax) {
          fieldValues[boundary.field] = fieldValues[boundary.field]
            ? `${fieldValues[boundary.field]} ${item.text}`
            : item.text;
          break;
        }
      }
    }

    // Need at least proceeds or cost basis to constitute a transaction
    const proceedsStr = fieldValues['proceeds'] ?? '';
    const costBasisStr = fieldValues['costBasis'] ?? '';
    if (!proceedsStr && !costBasisStr) continue;

    const proceeds = parsePdfDollarAmount(proceedsStr);
    const costBasis = parsePdfDollarAmount(costBasisStr);

    // Skip rows where neither proceeds nor cost is a real dollar amount
    if (proceeds === 0 && costBasis === 0) continue;

    const description = fieldValues['description'] ?? '';
    const dateAcquired = parseDate(fieldValues['dateAcquired'] ?? '');
    const dateSold = parseDate(fieldValues['dateSold'] ?? '');
    const gainLossStr = fieldValues['gainLoss'] ?? '';
    const gainLoss = gainLossStr
      ? parsePdfDollarAmount(gainLossStr)
      : proceeds - costBasis;

    const isLongTerm = isLongTermHolding(dateAcquired, dateSold);
    const basisReportedToIRS = true; // Default assumption for broker 1099s
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

  if (results.length === 0) {
    warnings.push('1099-B section found but no transactions could be parsed from the table.');
  }

  return results;
}

/**
 * Fallback: parse 1099-B data from a non-tabular layout.
 * Some PDFs list transactions line by line without a clear table structure.
 */
function parseBSectionLineByLine(
  sectionItems: ExtractedTextItem[],
  warnings: string[],
): Form1099B[] {
  const results: Form1099B[] = [];

  // Look for patterns of dollar amounts grouped together
  // that could represent proceeds/cost basis pairs
  const dollarItems: Array<{ index: number; cents: number; item: ExtractedTextItem }> = [];

  for (let i = 0; i < sectionItems.length; i++) {
    const cents = parsePdfDollarAmount(sectionItems[i].text);
    if (cents !== 0) {
      dollarItems.push({ index: i, cents, item: sectionItems[i] });
    }
  }

  // Try to find proceeds/cost basis pairs on the same or adjacent lines
  for (let i = 0; i < dollarItems.length - 1; i++) {
    const first = dollarItems[i];
    const second = dollarItems[i + 1];

    // If two dollar amounts are on the same line, treat as proceeds/basis
    if (
      first.item.page === second.item.page &&
      Math.abs(first.item.y - second.item.y) <= Y_TOLERANCE
    ) {
      const proceeds = first.cents;
      const costBasis = second.cents;
      const gainLoss = proceeds - costBasis;

      // Try to find a description on the line above
      let description = '';
      for (let j = first.index - 1; j >= Math.max(0, first.index - 5); j--) {
        if (sectionItems[j].page !== first.item.page) break;
        if (Math.abs(sectionItems[j].y - first.item.y) > Y_TOLERANCE) {
          description = sectionItems[j].text;
          break;
        }
      }

      results.push({
        description,
        dateAcquired: '',
        dateSold: '',
        proceeds,
        costBasis,
        gainLoss,
        isLongTerm: false,
        basisReportedToIRS: true,
        category: '8949_A',
      });
      i++; // Skip the second item since we used it
    }
  }

  if (results.length === 0) {
    warnings.push('1099-B section found but could not parse transaction data from the layout.');
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse extracted PDF text items into structured 1099 data.
 *
 * Detects 1099-INT, 1099-DIV, 1099-B, and 1099-NEC sections,
 * extracts box values and transaction tables, and returns
 * a consolidated result with warnings for any parsing issues.
 */
export function parse1099Pdf(items: ExtractedTextItem[]): Parsed1099Result {
  const warnings: string[] = [];
  const brokerName = detectBrokerName(items);
  const taxYear = detectTaxYear(items);

  const form1099INTs: Form1099INT[] = [];
  const form1099DIVs: Form1099DIV[] = [];
  const form1099Bs: Form1099B[] = [];
  const form1099NECs: Form1099NEC[] = [];

  const sections = detectSections(items);

  if (sections.length === 0) {
    warnings.push('No 1099 sections detected in this PDF. Make sure this is a 1099 tax document.');
    return { form1099INTs, form1099DIVs, form1099Bs, form1099NECs, brokerName, taxYear, warnings };
  }

  for (const section of sections) {
    const sectionItems = extractSectionItems(items, section.startIndex, section.endIndex);

    switch (section.type) {
      case 'INT': {
        const result = parse1099INTSection(sectionItems, brokerName, warnings);
        if (result) form1099INTs.push(result);
        break;
      }
      case 'DIV': {
        const result = parse1099DIVSection(sectionItems, brokerName, warnings);
        if (result) form1099DIVs.push(result);
        break;
      }
      case 'B': {
        const transactions = parse1099BSection(sectionItems, warnings);
        form1099Bs.push(...transactions);
        break;
      }
      case 'NEC': {
        const result = parse1099NECSection(sectionItems, brokerName, warnings);
        if (result) form1099NECs.push(result);
        break;
      }
    }
  }

  // Sort 1099-B transactions by date sold
  form1099Bs.sort((a, b) => {
    if (a.dateSold === '' || a.dateSold === 'VARIOUS') return 1;
    if (b.dateSold === '' || b.dateSold === 'VARIOUS') return -1;
    return a.dateSold.localeCompare(b.dateSold);
  });

  return {
    form1099INTs,
    form1099DIVs,
    form1099Bs,
    form1099NECs,
    brokerName,
    taxYear,
    warnings,
  };
}

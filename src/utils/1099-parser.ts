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
// Spatial section detection types
// ---------------------------------------------------------------------------

interface SectionBounds {
  type: 'INT' | 'DIV' | 'B' | 'NEC' | 'MISC' | 'OID';
  page: number;
  headerX: number;
  headerY: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  subType?: 'short-term' | 'long-term' | 'noncovered' | 'futures' | 'detail';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Y-tolerance for considering two items on the "same line" */
const Y_TOLERANCE = 3;

/** Y-tolerance for grouping section headers into the same row */
const HEADER_ROW_TOLERANCE = 30;

/** Approximate page width for bounding box calculations */
const PAGE_WIDTH = 620;

/** Approximate page top (maximum y in PDF coords) */
const PAGE_TOP = 800;

/**
 * Check if a string is a 1099 section header.
 *
 * Strict rules:
 * - Must be short text (not a full sentence or legal paragraph)
 * - Must contain "YYYY 1099-X" with a 4-digit year prefix and explicit hyphen
 * - Must have the section type as a whole word (rejects "1099-BROKERAGE")
 * - The year prefix prevents matching instruction text like "1099-INT · Interest Income"
 *
 * Also detects IB-specific sub-section headers like "1099-B Short-Term Covered"
 * and "Form 8949 Worksheet" (mapped to type B).
 */
function matchesSectionHeader(text: string, sectionType: string): boolean {
  const trimmed = text.trim();
  // Section headers are short — reject long text (legal disclaimers, etc.)
  if (trimmed.length > 80) return false;

  const upper = trimmed.toUpperCase();

  // Special case: "Form 8949 Worksheet" or similar section titles → treat as 1099-B
  // Requires "Form 8949" to be at the start (rejects "Applicable check box on Form 8949")
  if (sectionType === 'B') {
    if (/^(?:WORKSHEET\s+FOR\s+)?FORM\s*8949\b/.test(upper)) {
      return true;
    }
  }

  // Require 4-digit year prefix before "1099-TYPE" to reject instruction page text.
  // Pattern: "2025 1099-INT", "2025 Form 1099-DIV", etc.
  const pattern = new RegExp(
    `\\b\\d{4}\\s+(?:FORM\\s+)?1099\\s*-\\s*${sectionType}\\b`,
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
 * Match a box/line label in IRS 1099 forms.
 *
 * Handles multiple labeling conventions used by different brokers:
 * - "Box 1a" / "Box1a" (standard IRS)
 * - "Line 1a" / "Line1a" (Interactive Brokers uses this for 1099-INT/DIV)
 * - "1a Ordinary dividends" / "1a. Interest income" (standalone with separator)
 */
function matchesBoxLabel(text: string, boxId: string): boolean {
  const upper = text.toUpperCase().replace(/\s+/g, ' ').trim();
  const boxUpper = boxId.toUpperCase();

  // "Box 1a", "BOX 1A", "Box1a"
  if (upper.includes(`BOX ${boxUpper}`) || upper.includes(`BOX${boxUpper}`)) {
    return true;
  }

  // "Line 1a", "LINE 1A", "Line1a" (IB convention)
  if (upper.includes(`LINE ${boxUpper}`) || upper.includes(`LINE${boxUpper}`)) {
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
// Instruction page detection
// ---------------------------------------------------------------------------

/**
 * Scan all items for "Instructions for Recipients" text and return
 * the set of page numbers that contain instruction content.
 * These pages should be excluded from section detection to prevent
 * false positives on text like "1099-INT · Interest Income".
 */
function getInstructionPages(items: ExtractedTextItem[]): Set<number> {
  const pages = new Set<number>();
  for (const item of items) {
    // Only match standalone instruction headings, NOT footer text like
    // "Please consult the "Instructions for Recipients"..." which appears
    // on every page including data pages.
    const trimmed = item.text.trim();
    if (/^instructions\s+for\s+recipients/i.test(trimmed)) {
      pages.add(item.page);
    }
  }
  // Also mark continuation pages (heading: "Instructions for Recipients ... (continued)")
  // These share the same pattern and will be caught by the regex above.
  return pages;
}

// ---------------------------------------------------------------------------
// Spatial section detection
// ---------------------------------------------------------------------------

/**
 * Detect section boundaries using spatial bounding boxes.
 *
 * Instead of index-based ranges (which fail for side-by-side sections),
 * this assigns each section a 2D bounding box on its page. Items are
 * then scoped to sections by checking spatial containment.
 *
 * Algorithm:
 * 1. Find section headers matching "YYYY 1099-XXX" pattern
 * 2. Skip items on instruction pages
 * 3. Group headers by page
 * 4. Within each page, identify rows of headers (similar y within tolerance)
 * 5. Within each row, assign x-boundaries (header x to next header x, or page edge)
 * 6. Assign y-boundaries (header y to next row's y, or page bottom)
 */
function detectSectionsWithBounds(
  items: ExtractedTextItem[],
  instructionPages: Set<number>,
): SectionBounds[] {
  const sectionTypes = ['INT', 'DIV', 'B', 'NEC', 'MISC', 'OID'] as const;
  type SType = typeof sectionTypes[number];

  // Step 1: Find all section headers (excluding instruction pages)
  const headers: Array<{
    type: SType;
    page: number;
    x: number;
    y: number;
    text: string;
  }> = [];

  for (const item of items) {
    if (instructionPages.has(item.page)) continue;
    for (const sType of sectionTypes) {
      if (matchesSectionHeader(item.text, sType)) {
        headers.push({
          type: sType,
          page: item.page,
          x: item.x,
          y: item.y,
          text: item.text,
        });
        break; // Each item matches at most one section type
      }
    }
  }

  if (headers.length === 0) return [];

  // Step 2: Group headers by page
  const byPage = new Map<number, typeof headers>();
  for (const h of headers) {
    const arr = byPage.get(h.page) ?? [];
    arr.push(h);
    byPage.set(h.page, arr);
  }

  const bounds: SectionBounds[] = [];

  for (const [page, pageHeaders] of byPage) {
    // Step 3: Within each page, identify rows (similar y within tolerance)
    const rows: Array<typeof headers> = [];
    const sortedByY = [...pageHeaders].sort((a, b) => b.y - a.y); // descending y (top first)

    for (const h of sortedByY) {
      let placed = false;
      for (const row of rows) {
        if (Math.abs(row[0].y - h.y) <= HEADER_ROW_TOLERANCE) {
          row.push(h);
          placed = true;
          break;
        }
      }
      if (!placed) {
        rows.push([h]);
      }
    }

    // Sort rows top-to-bottom (descending y)
    rows.sort((a, b) => b[0].y - a[0].y);

    // Sort headers within each row left-to-right
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
    }

    // Step 4: Assign bounding boxes
    // IB format: section headers sit at the BOTTOM of their data sections.
    // Data extends UPWARD from the header (higher y values).
    // So yMin is at/below the header, and yMax extends up to the previous
    // row's header y (or page top for the uppermost row).
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      // yMin: slightly below the header (include box labels just beneath)
      const yMin = row[0].y - HEADER_ROW_TOLERANCE;
      // yMax: extends upward to the previous row's header y, or page top
      const yMax = rowIdx === 0
        ? PAGE_TOP
        : rows[rowIdx - 1][0].y - HEADER_ROW_TOLERANCE;

      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const h = row[colIdx];
        // Use header x-positions directly as boundaries (data starts near header x)
        const xLeft = colIdx === 0 ? 0 : h.x - 15;
        const xRight = colIdx === row.length - 1
          ? PAGE_WIDTH
          : row[colIdx + 1].x - 15;

        // Detect 1099-B sub-type from header text
        let subType: SectionBounds['subType'];
        if (h.type === 'B') {
          const upper = h.text.toUpperCase();
          if (/SHORT.?TERM/.test(upper)) subType = 'short-term';
          else if (/LONG.?TERM/.test(upper)) subType = 'long-term';
          else if (/NONCOVERED|NON.?COVERED/.test(upper)) subType = 'noncovered';
          else if (/FUTURES|REGULATED/.test(upper)) subType = 'futures';
        }

        bounds.push({
          type: h.type,
          page,
          headerX: h.x,
          headerY: h.y,
          xMin: xLeft,
          xMax: xRight,
          yMin,
          yMax,
          subType,
        });
      }
    }
  }

  return bounds;
}

/**
 * Filter items that fall within a spatial bounding box.
 */
function getItemsInBounds(
  items: ExtractedTextItem[],
  bounds: SectionBounds,
): ExtractedTextItem[] {
  return items.filter(
    (item) =>
      item.page === bounds.page &&
      item.x >= bounds.xMin &&
      item.x <= bounds.xMax &&
      item.y >= bounds.yMin &&
      item.y <= bounds.yMax,
  );
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

/**
 * Find a dollar amount associated with a descriptive label (e.g., "Interest income").
 * Scans the section for text matching the label, then looks for a dollar value nearby.
 */
function findLabeledValue(
  sectionItems: ExtractedTextItem[],
  labelPatterns: string[],
): number {
  for (let i = 0; i < sectionItems.length; i++) {
    const lower = sectionItems[i].text.toLowerCase().trim();
    if (labelPatterns.some((p) => lower.includes(p))) {
      const value = findNearestDollarOnLine(sectionItems, i);
      if (value !== null) return value;
    }
  }
  return 0;
}

function parse1099INTSection(
  sectionItems: ExtractedTextItem[],
  brokerName: string,
  warnings: string[],
): Form1099INT | null {
  // Try Box/Line labels first, then descriptive labels as fallback
  let interest = findBoxValue(sectionItems, '1');
  if (interest === 0) {
    interest = findLabeledValue(sectionItems, ['interest income']);
  }

  let earlyWithdrawalPenalty = findBoxValue(sectionItems, '2');
  if (earlyWithdrawalPenalty === 0) {
    earlyWithdrawalPenalty = findLabeledValue(sectionItems, ['early withdrawal penalty']);
  }

  let federalWithheld = findBoxValue(sectionItems, '4');
  if (federalWithheld === 0) {
    federalWithheld = findLabeledValue(sectionItems, [
      'federal income tax withheld', 'federal tax withheld', 'fed tax w/h',
    ]);
  }

  let taxExemptInterest = findBoxValue(sectionItems, '8');
  if (taxExemptInterest === 0) {
    taxExemptInterest = findLabeledValue(sectionItems, ['tax-exempt interest', 'tax exempt interest']);
  }

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
  // Try Box/Line labels first, then descriptive labels as fallback
  let ordinaryDividends = findBoxValue(sectionItems, '1a');
  if (ordinaryDividends === 0) {
    ordinaryDividends = findLabeledValue(sectionItems, [
      'total ordinary dividends', 'ordinary dividends',
    ]);
  }

  let qualifiedDividends = findBoxValue(sectionItems, '1b');
  if (qualifiedDividends === 0) {
    qualifiedDividends = findLabeledValue(sectionItems, ['qualified dividends']);
  }

  let totalCapitalGain = findBoxValue(sectionItems, '2a');
  if (totalCapitalGain === 0) {
    totalCapitalGain = findLabeledValue(sectionItems, [
      'total capital gain', 'capital gain distributions',
    ]);
  }

  let federalWithheld = findBoxValue(sectionItems, '4');
  if (federalWithheld === 0) {
    federalWithheld = findLabeledValue(sectionItems, [
      'federal income tax withheld', 'federal tax withheld', 'fed tax w/h',
    ]);
  }

  let foreignTaxPaid = findBoxValue(sectionItems, '7');
  if (foreignTaxPaid === 0) {
    foreignTaxPaid = findLabeledValue(sectionItems, ['foreign tax paid']);
  }

  let exemptInterestDividends = findBoxValue(sectionItems, '12');
  if (exemptInterestDividends === 0) {
    exemptInterestDividends = findLabeledValue(sectionItems, [
      'exempt-interest dividends', 'exempt interest dividends',
    ]);
  }

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
  let nonemployeeCompensation = findBoxValue(sectionItems, '1');
  if (nonemployeeCompensation === 0) {
    nonemployeeCompensation = findLabeledValue(sectionItems, [
      'nonemployee compensation', 'non-employee compensation',
    ]);
  }

  let federalWithheld = findBoxValue(sectionItems, '4');
  if (federalWithheld === 0) {
    federalWithheld = findLabeledValue(sectionItems, [
      'federal income tax withheld', 'federal tax withheld',
    ]);
  }

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

/**
 * Parse 1099-MISC section (used by Interactive Brokers instead of 1099-NEC).
 * Extracts "Other income" (Line 3) which includes stock loan fees, and
 * "Substitute payments in lieu of dividends" (Line 8).
 * Maps to 1099-NEC format for compatibility with the engine.
 */
function parse1099MISCSection(
  sectionItems: ExtractedTextItem[],
  brokerName: string,
  _warnings: string[],
): Form1099NEC | null {
  let otherIncome = findBoxValue(sectionItems, '3');
  if (otherIncome === 0) {
    otherIncome = findLabeledValue(sectionItems, [
      'other income', 'stock loan fees',
    ]);
  }

  let substitutePayments = findBoxValue(sectionItems, '8');
  if (substitutePayments === 0) {
    substitutePayments = findLabeledValue(sectionItems, [
      'substitute payments', 'payments in lieu',
    ]);
  }

  const totalMisc = otherIncome + substitutePayments;
  if (totalMisc === 0) {
    // 1099-MISC with no relevant amounts — silently skip
    return null;
  }

  return {
    payerName: brokerName,
    nonemployeeCompensation: totalMisc,
  };
}

// ---------------------------------------------------------------------------
// 1099-B table parsing
// ---------------------------------------------------------------------------

/** Known column labels for 1099-B tables */
const B_COLUMN_LABELS: Record<string, string[]> = {
  description: ['description', 'security', 'name', 'asset', '(a)'],
  dateAcquired: ['date acquired', 'acquired', 'acquisition', '(b)'],
  dateSold: ['date sold', 'sold', 'sale date', 'date of sale', 'disposition', '(c)'],
  proceeds: ['proceeds', 'sales price', 'gross proceeds', '(d)'],
  costBasis: ['cost basis', 'basis', 'cost or other basis', 'cost', '(e)'],
  gainLoss: ['gain/loss', 'gain or loss', 'gain(loss)', 'profit/loss', 'gain', '(h)'],
};

interface ColumnBoundary {
  field: string;
  xMin: number;
  xMax: number;
}

/**
 * Parse a 1099-B section that contains tabular transaction data.
 *
 * IB splits 1099-B into sub-sections by holding period:
 * "Short-Term Covered", "Long-Term Covered", etc.
 * The section header text is checked to determine the default holding period.
 */
function parse1099BSection(
  sectionItems: ExtractedTextItem[],
  warnings: string[],
): Form1099B[] {
  if (sectionItems.length < 5) return [];

  // Check if the section header indicates short-term or long-term
  const headerText = sectionItems.slice(0, 3).map((i) => i.text.toUpperCase()).join(' ');
  const sectionIsLongTerm = /LONG.?TERM/i.test(headerText);
  const sectionIsShortTerm = /SHORT.?TERM/i.test(headerText);
  const sectionIsNoncovered = /NONCOVERED|NON.?COVERED/i.test(headerText);

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

    // Use section header to determine holding period if available,
    // otherwise fall back to date comparison
    const isLongTerm = sectionIsLongTerm
      ? true
      : sectionIsShortTerm
        ? false
        : isLongTermHolding(dateAcquired, dateSold);
    const basisReportedToIRS = !sectionIsNoncovered;
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
// 1099-B detail table parsing (IB-specific)
// ---------------------------------------------------------------------------

/**
 * Detect pages that contain a 1099-B detail transaction table.
 *
 * IB places individual transactions on a separate page (e.g., page 3)
 * with column headers containing "(Box 1d)", "(Box 1e)", etc.
 * This is distinct from the summary sections on page 2 which show totals.
 */
function findBDetailTablePages(
  items: ExtractedTextItem[],
  instructionPages: Set<number>,
): number[] {
  const pages = new Set<number>();
  for (const item of items) {
    if (instructionPages.has(item.page)) continue;
    const lower = item.text.toLowerCase();
    // Look for "(Box 1d)" or "Proceeds (Box" — distinctive markers of the detail table
    if (
      /\(box\s*1d\)/i.test(lower) ||
      /proceeds\s*\(box/i.test(lower) ||
      /\(box\s*1e\)/i.test(lower)
    ) {
      pages.add(item.page);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

/**
 * Parse a 1099-B detail transaction table from IB-format PDFs.
 *
 * IB uses a TRANSPOSED table layout:
 * - Each COLUMN is a security (INDY, SMIN, SPLG, VOO, etc.)
 * - Each ROW is a field (Proceeds, Cost, Date Acquired, etc.)
 * - Row labels on the left side contain "(Box 1d)", "(Box 1e)", etc.
 * - Column positions identified from the "Symbol" row
 *
 * The holding period (short-term vs long-term) is determined from
 * page text (e.g., "Short-Term" in a section title).
 */
function parse1099BDetailTable(
  items: ExtractedTextItem[],
  detailPages: number[],
  _sectionBounds: SectionBounds[],
  warnings: string[],
): Form1099B[] {
  const results: Form1099B[] = [];
  const X_COL_TOLERANCE = 5;
  const Y_FIELD_TOLERANCE = 30;

  for (const page of detailPages) {
    const pageItems = items.filter((item) => item.page === page);
    if (pageItems.length === 0) continue;

    // Step 1: Find "Symbol" row to identify column (security) positions
    const symbolLabel = pageItems.find(
      (i) => i.text.toLowerCase().trim() === 'symbol',
    );
    if (!symbolLabel) {
      warnings.push(`1099-B detail table on page ${page}: could not find Symbol row.`);
      continue;
    }

    const symbolY = symbolLabel.y;
    const symbolItems = pageItems
      .filter(
        (i) =>
          Math.abs(i.y - symbolY) <= Y_TOLERANCE &&
          i.x > symbolLabel.x + 10 &&
          i.text.trim() !== '' &&
          !/^total$/i.test(i.text.trim()),
      )
      .sort((a, b) => a.x - b.x);

    if (symbolItems.length === 0) {
      warnings.push(`1099-B detail table on page ${page}: no security symbols found.`);
      continue;
    }

    // Step 2: Find field label y-positions using "(Box XX)" patterns
    const fieldLabels: Array<{
      field: string;
      pattern: RegExp;
    }> = [
      { field: 'description', pattern: /\(box\s*1a\)/i },
      { field: 'dateAcquired', pattern: /\(box\s*1b\)/i },
      { field: 'dateSold', pattern: /\(box\s*1c\)/i },
      { field: 'proceeds', pattern: /\(box\s*1d\)/i },
      { field: 'costBasis', pattern: /\(box\s*1e\)/i },
      { field: 'washSale', pattern: /\(box\s*1g\)/i },
    ];

    const fieldYPositions: Record<string, number> = {};
    for (const item of pageItems) {
      for (const fl of fieldLabels) {
        if (fl.pattern.test(item.text) && fieldYPositions[fl.field] === undefined) {
          fieldYPositions[fl.field] = item.y;
        }
      }
    }

    // Must have at least proceeds and cost basis labels
    if (
      fieldYPositions['proceeds'] === undefined &&
      fieldYPositions['costBasis'] === undefined
    ) {
      warnings.push(`1099-B detail table on page ${page}: could not find Proceeds/Cost labels.`);
      continue;
    }

    // Step 3: Determine holding period from page text
    let isLongTerm = false;
    let isNoncovered = false;
    for (const item of pageItems) {
      const upper = item.text.toUpperCase();
      if (/LONG.?TERM/.test(upper)) isLongTerm = true;
      if (/SHORT.?TERM/.test(upper)) isLongTerm = false;
      if (/NONCOVERED|NON.?COVERED/.test(upper)) isNoncovered = true;
    }

    const basisReportedToIRS = !isNoncovered;
    const category = determineCategory(isLongTerm, basisReportedToIRS);

    // Step 4: For each security column, extract field values
    for (const sym of symbolItems) {
      const colX = sym.x;

      // Get all items at this column's x-position
      const colItems = pageItems.filter(
        (i) => Math.abs(i.x - colX) <= X_COL_TOLERANCE,
      );

      // Helper: find item(s) near a field's y-position, concatenate if multiple
      function findFieldValue(fieldY: number | undefined): string {
        if (fieldY === undefined) return '';
        const matches = colItems
          .filter((i) => Math.abs(i.y - fieldY) <= Y_FIELD_TOLERANCE)
          .sort((a, b) => a.x - b.x);
        if (matches.length === 0) return '';
        return matches.map((m) => m.text.trim()).join(' ');
      }

      const proceedsStr = findFieldValue(fieldYPositions['proceeds']);
      const costBasisStr = findFieldValue(fieldYPositions['costBasis']);
      const proceeds = parsePdfDollarAmount(proceedsStr);
      const costBasis = parsePdfDollarAmount(costBasisStr);

      // Skip if neither is a real dollar amount
      if (proceeds === 0 && costBasis === 0) continue;

      const descriptionStr = findFieldValue(fieldYPositions['description']);
      const dateAcquiredStr = findFieldValue(fieldYPositions['dateAcquired']);
      const dateSoldStr = findFieldValue(fieldYPositions['dateSold']);
      const washSaleStr = findFieldValue(fieldYPositions['washSale']);

      const dateAcquired = parseDate(dateAcquiredStr);
      const dateSold = parseDate(dateSoldStr);
      const washSaleDisallowed = washSaleStr
        ? parsePdfDollarAmount(washSaleStr)
        : 0;

      // Use symbol as fallback description
      const description = descriptionStr || sym.text.trim();

      results.push({
        description,
        dateAcquired,
        dateSold,
        proceeds,
        costBasis,
        gainLoss: proceeds - costBasis,
        isLongTerm,
        basisReportedToIRS,
        washSaleDisallowed: washSaleDisallowed || undefined,
        category,
      });
    }
  }

  if (detailPages.length > 0 && results.length === 0) {
    warnings.push('1099-B detail table found but no transactions could be parsed.');
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse extracted PDF text items into structured 1099 data.
 *
 * Uses spatial bounding boxes to scope items to sections, which handles
 * side-by-side section layouts (e.g., Interactive Brokers). Excludes
 * instruction pages to prevent false section detection.
 *
 * For 1099-B: prefers the detail transaction table (individual trades)
 * over summary sections (totals only).
 */
export function parse1099Pdf(items: ExtractedTextItem[]): Parsed1099Result {
  const warnings: string[] = [];
  const brokerName = detectBrokerName(items);
  const taxYear = detectTaxYear(items);

  const form1099INTs: Form1099INT[] = [];
  const form1099DIVs: Form1099DIV[] = [];
  const form1099Bs: Form1099B[] = [];
  const form1099NECs: Form1099NEC[] = [];

  // Step 1: Identify instruction pages to exclude
  const instructionPages = getInstructionPages(items);

  // Step 2: Detect sections using spatial bounding boxes
  const sections = detectSectionsWithBounds(items, instructionPages);

  if (sections.length === 0) {
    warnings.push('No 1099 sections detected in this PDF. Make sure this is a 1099 tax document.');
    return { form1099INTs, form1099DIVs, form1099Bs, form1099NECs, brokerName, taxYear, warnings };
  }

  // Step 3: Parse non-B sections using spatial bounds
  for (const section of sections) {
    const sectionItems = getItemsInBounds(items, section);

    switch (section.type) {
      case 'INT': {
        const result = parse1099INTSection(sectionItems, brokerName, []);
        // Suppress warnings for all-zero sections — return null silently
        if (result) form1099INTs.push(result);
        break;
      }
      case 'DIV': {
        const result = parse1099DIVSection(sectionItems, brokerName, []);
        if (result) form1099DIVs.push(result);
        break;
      }
      case 'NEC': {
        const result = parse1099NECSection(sectionItems, brokerName, []);
        if (result) form1099NECs.push(result);
        break;
      }
      case 'MISC': {
        // IB uses 1099-MISC instead of 1099-NEC — map to NEC for the engine
        const result = parse1099MISCSection(sectionItems, brokerName, []);
        if (result) form1099NECs.push(result);
        break;
      }
      case 'OID':
        // OID sections are detected but ignored (not supported by the engine)
        break;
      case 'B':
        // 1099-B handled separately via detail table below
        break;
    }
  }

  // Step 4: Parse 1099-B from detail table pages (preferred over summary sections)
  const detailPages = findBDetailTablePages(items, instructionPages);
  if (detailPages.length > 0) {
    const transactions = parse1099BDetailTable(items, detailPages, sections, warnings);
    form1099Bs.push(...transactions);
  } else {
    // Fallback: parse 1099-B from the summary/table sections
    const bSections = sections.filter((s) => s.type === 'B');
    for (const section of bSections) {
      const sectionItems = getItemsInBounds(items, section);
      const transactions = parse1099BSection(sectionItems, warnings);
      form1099Bs.push(...transactions);
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

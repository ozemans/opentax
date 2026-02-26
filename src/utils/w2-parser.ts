/**
 * Parse extracted PDF text into structured W-2 data.
 *
 * Handles standard IRS W-2 forms (including ADP-generated PDFs)
 * with the typical left-side box grid layout.
 *
 * IMPORTANT: The right-side "Earnings Summary" table is excluded
 * to prevent double-counting of values.
 *
 * All dollar amounts are in cents (integers).
 */

import type { W2 } from '@/engine/types';
import type { ExtractedTextItem } from '@/utils/pdf-extract';
import { parseDollarsToCents } from '@/utils/parse-helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedW2Result {
  w2s: W2[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Y-tolerance for considering two items on the "same line" */
const Y_TOLERANCE = 3;

/**
 * X-coordinate threshold to exclude the right-side Earnings Summary.
 * Items to the right of this are likely in the summary table, not the
 * W-2 box grid. Adjusted dynamically if "Earnings Summary" header is found.
 */
const DEFAULT_RIGHT_CUTOFF = 450;

/**
 * Check if a string looks like a formatted dollar amount.
 * Requires at least one monetary indicator: $ sign, decimal point
 * with 1-2 trailing digits, or comma-separated thousands.
 */
function looksLikeDollarAmount(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === '') return false;

  const inner = trimmed.startsWith('(') && trimmed.endsWith(')')
    ? trimmed.slice(1, -1).trim()
    : trimmed;

  return (
    /\$/.test(inner) ||
    /\d\.\d{1,2}\s*$/.test(inner) ||
    /\d{1,3},\d{3}/.test(inner)
  );
}

/**
 * Parse a dollar amount from PDF text with strict validation.
 */
function parsePdfDollarAmount(text: string): number {
  if (!looksLikeDollarAmount(text)) return 0;
  return parseDollarsToCents(text);
}

/**
 * Find all items on a similar y-line (within tolerance).
 */
function getItemsOnLine(
  items: ExtractedTextItem[],
  targetY: number,
  tolerance: number = Y_TOLERANCE,
): ExtractedTextItem[] {
  return items.filter((item) => Math.abs(item.y - targetY) <= tolerance);
}

/**
 * Find the nearest dollar value on the same line (to the right of the label).
 * Falls back to checking the line below if nothing found on the same line.
 */
function findNearestDollarOnLine(
  items: ExtractedTextItem[],
  labelIndex: number,
): number | null {
  const label = items[labelIndex];

  // Look for dollar values on the same line to the right
  const sameLine = getItemsOnLine(items, label.y).filter(
    (item) => item.x > label.x,
  );
  for (const item of sameLine) {
    const cents = parsePdfDollarAmount(item.text);
    if (cents !== 0 || /^\$?0(\.00)?$/.test(item.text.trim())) {
      return cents;
    }
  }

  // Try items immediately below (next line)
  for (let i = labelIndex + 1; i < Math.min(labelIndex + 5, items.length); i++) {
    if (items[i].page !== label.page) break;
    if (Math.abs(items[i].y - label.y) > Y_TOLERANCE) {
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
 * Detect if the document is a W-2 by looking at the first 30 items.
 */
function isW2Document(items: ExtractedTextItem[]): boolean {
  const firstItems = items.slice(0, 30);
  for (const item of firstItems) {
    const upper = item.text.toUpperCase();
    if (upper.includes('W-2') || upper.includes('WAGE AND TAX')) {
      return true;
    }
  }
  return false;
}

/**
 * Determine the x-coordinate cutoff to exclude the Earnings Summary section.
 * If the "Earnings Summary" header is found, use its x position.
 * Otherwise, fall back to the default cutoff.
 */
function findRightCutoff(items: ExtractedTextItem[]): number {
  for (const item of items) {
    if (item.text.toUpperCase().includes('EARNINGS SUMMARY')) {
      // Use a position slightly left of the header to exclude the entire column
      return item.x - 10;
    }
  }
  return DEFAULT_RIGHT_CUTOFF;
}

/**
 * Filter items to exclude the right-side Earnings Summary section.
 */
function filterLeftSideItems(items: ExtractedTextItem[]): ExtractedTextItem[] {
  const cutoff = findRightCutoff(items);
  return items.filter((item) => item.x < cutoff);
}

/**
 * Find the employer name from the W-2 form.
 * Looks for "Employer's name" or "employer" label and extracts nearby text.
 */
function findEmployerName(items: ExtractedTextItem[]): string {
  for (let i = 0; i < items.length; i++) {
    const lower = items[i].text.toLowerCase();
    if (
      lower.includes("employer's name") ||
      lower.includes('employer name') ||
      (lower.includes('employer') && lower.includes('address'))
    ) {
      // Check items on the same line to the right
      const sameLine = getItemsOnLine(items, items[i].y)
        .filter((item) => item.x > items[i].x);
      if (sameLine.length > 0) {
        const candidate = sameLine[0].text.trim();
        if (candidate.length > 1 && !/^\d/.test(candidate)) {
          return candidate;
        }
      }

      // Check items below (the next distinct line)
      for (let j = i + 1; j < Math.min(i + 8, items.length); j++) {
        if (items[j].page !== items[i].page) break;
        if (Math.abs(items[j].y - items[i].y) > Y_TOLERANCE) {
          const candidate = items[j].text.trim();
          // Skip small text that looks like a label/number
          if (candidate.length > 2 && !/^[0-9$.]/.test(candidate)) {
            return candidate;
          }
          break;
        }
      }
    }
  }

  // Fallback: look for text near "c " label (Box c = employer name)
  for (let i = 0; i < items.length; i++) {
    const text = items[i].text.trim();
    if (/^c\s/i.test(text) && text.length > 3) {
      return text.slice(2).trim();
    }
  }

  return '';
}

/**
 * Find the employer EIN (XX-XXXXXXX format).
 * Looks near "Employer" + "identification" or "EIN" labels.
 */
function findEmployerEIN(items: ExtractedTextItem[]): string {
  const einPattern = /\d{2}-\d{7}/;

  // First, look for EIN near labeled areas
  for (let i = 0; i < items.length; i++) {
    const lower = items[i].text.toLowerCase();
    if (
      (lower.includes('employer') && (lower.includes('id') || lower.includes('ein'))) ||
      lower.includes('identification number')
    ) {
      // Check same line to the right
      const sameLine = getItemsOnLine(items, items[i].y)
        .filter((item) => item.x > items[i].x);
      for (const item of sameLine) {
        const match = einPattern.exec(item.text);
        if (match) return match[0];
      }

      // Check lines below
      for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
        if (items[j].page !== items[i].page) break;
        const match = einPattern.exec(items[j].text);
        if (match) return match[0];
      }
    }
  }

  // Fallback: look near "b " label (Box b = EIN)
  for (let i = 0; i < items.length; i++) {
    const text = items[i].text.trim();
    if (/^b\s/i.test(text)) {
      const match = einPattern.exec(text);
      if (match) return match[0];
      // Check next items
      for (let j = i + 1; j < Math.min(i + 3, items.length); j++) {
        const m = einPattern.exec(items[j].text);
        if (m) return m[0];
      }
    }
  }

  // Last resort: scan all items for EIN pattern
  for (const item of items) {
    const match = einPattern.exec(item.text);
    if (match) return match[0];
  }

  return '';
}

// ---------------------------------------------------------------------------
// Box-specific finders
// ---------------------------------------------------------------------------

interface BoxConfig {
  boxNumber: string;
  /** Label patterns to confirm the box (lowercase, checked via includes) */
  labelPatterns: string[];
}

const W2_BOX_CONFIGS: Record<string, BoxConfig> = {
  wages: {
    boxNumber: '1',
    labelPatterns: ['wages', 'tips', 'other comp'],
  },
  federalWithheld: {
    boxNumber: '2',
    labelPatterns: ['federal income tax', 'federal', 'withheld'],
  },
  socialSecurityWages: {
    boxNumber: '3',
    labelPatterns: ['social security wages'],
  },
  socialSecurityWithheld: {
    boxNumber: '4',
    labelPatterns: ['social security tax'],
  },
  medicareWages: {
    boxNumber: '5',
    labelPatterns: ['medicare wages'],
  },
  medicareWithheld: {
    boxNumber: '6',
    labelPatterns: ['medicare tax'],
  },
  stateWages: {
    boxNumber: '16',
    labelPatterns: ['state wages'],
  },
  stateWithheld: {
    boxNumber: '17',
    labelPatterns: ['state income tax'],
  },
  localWages: {
    boxNumber: '18',
    labelPatterns: ['local wages'],
  },
  localWithheld: {
    boxNumber: '19',
    labelPatterns: ['local income tax'],
  },
};

/**
 * Find a W-2 box value by matching either:
 * 1. A box number label (e.g., text "1" near a confirming description)
 * 2. A descriptive label (e.g., "Wages, tips, other compensation")
 *
 * Returns the dollar value in cents, or 0 if not found.
 */
function findW2BoxValue(
  items: ExtractedTextItem[],
  config: BoxConfig,
): number {
  // Strategy 1: Find box number near a confirming description label
  for (let i = 0; i < items.length; i++) {
    const text = items[i].text.trim();
    // Check if this item IS the box number (exact or near-exact match)
    if (text === config.boxNumber || text === `${config.boxNumber}.`) {
      // Look for a confirming description within nearby items (same line or adjacent)
      let hasConfirmation = false;
      for (
        let j = Math.max(0, i - 5);
        j < Math.min(i + 5, items.length);
        j++
      ) {
        if (j === i) continue;
        if (items[j].page !== items[i].page) continue;
        const lower = items[j].text.toLowerCase();
        if (config.labelPatterns.some((p) => lower.includes(p))) {
          hasConfirmation = true;
          break;
        }
      }

      if (hasConfirmation) {
        const value = findNearestDollarOnLine(items, i);
        if (value !== null) return value;
      }
    }
  }

  // Strategy 2: Find the descriptive label and look for a dollar amount nearby
  for (let i = 0; i < items.length; i++) {
    const lower = items[i].text.toLowerCase();
    if (config.labelPatterns.some((p) => lower.includes(p))) {
      const value = findNearestDollarOnLine(items, i);
      if (value !== null) return value;
    }
  }

  return 0;
}

/**
 * Find the state code (2-letter abbreviation) from Box 15.
 * Looks in the bottom section of the form near "State" / "Employer's state ID" labels.
 */
function findStateCode(items: ExtractedTextItem[]): string {
  const statePattern = /^[A-Z]{2}$/;

  // Look for state label in the bottom area
  for (let i = 0; i < items.length; i++) {
    const lower = items[i].text.toLowerCase();
    if (
      lower.includes('employer\'s state id') ||
      (lower.includes('state') && lower.includes('15'))
    ) {
      // Check items on the same line and below
      const candidates = [
        ...getItemsOnLine(items, items[i].y).filter((item) => item.x > items[i].x),
      ];
      // Also check items below
      for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
        if (items[j].page !== items[i].page) break;
        candidates.push(items[j]);
      }

      for (const candidate of candidates) {
        const trimmed = candidate.text.trim();
        if (statePattern.test(trimmed)) {
          return trimmed;
        }
        // State code might be at the start of a longer string (e.g., "CA 123-456-789")
        const match = /^([A-Z]{2})\s/.exec(trimmed);
        if (match) return match[1];
      }
    }
  }

  // Fallback: look near box 15 label
  for (let i = 0; i < items.length; i++) {
    const text = items[i].text.trim();
    if (text === '15' || text === '15.') {
      for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
        if (items[j].page !== items[i].page) break;
        const trimmed = items[j].text.trim();
        if (statePattern.test(trimmed)) return trimmed;
        const match = /^([A-Z]{2})\s/.exec(trimmed);
        if (match) return match[1];
      }
    }
  }

  // Last resort: scan for a two-letter state abbreviation near the bottom
  // (lower y values in PDF coordinates, later items in sorted order)
  const bottomItems = items.slice(Math.max(0, items.length - 30));
  for (const item of bottomItems) {
    const trimmed = item.text.trim();
    if (statePattern.test(trimmed) && isValidStateCode(trimmed)) {
      return trimmed;
    }
  }

  return '';
}

/**
 * Find locality name from Box 20.
 */
function findLocality(items: ExtractedTextItem[]): string {
  for (let i = 0; i < items.length; i++) {
    const lower = items[i].text.toLowerCase();
    if (lower.includes('locality') || (lower.includes('20') && lower.includes('local'))) {
      // Check items on the same line to the right
      const sameLine = getItemsOnLine(items, items[i].y)
        .filter((item) => item.x > items[i].x);
      for (const item of sameLine) {
        const trimmed = item.text.trim();
        if (trimmed.length > 1 && !/^\$?[\d,.]/.test(trimmed)) {
          return trimmed;
        }
      }
      // Check the line below
      for (let j = i + 1; j < Math.min(i + 3, items.length); j++) {
        if (items[j].page !== items[i].page) break;
        if (Math.abs(items[j].y - items[i].y) > Y_TOLERANCE) {
          const trimmed = items[j].text.trim();
          if (trimmed.length > 1 && !/^\$?[\d,.]/.test(trimmed)) {
            return trimmed;
          }
          break;
        }
      }
    }
  }
  return '';
}

/** Common US state codes for validation */
const VALID_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
]);

function isValidStateCode(code: string): boolean {
  return VALID_STATE_CODES.has(code.toUpperCase());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse extracted PDF text items into structured W-2 data.
 *
 * Detects W-2 documents, excludes the Earnings Summary section,
 * and extracts all standard W-2 box values.
 *
 * Returns a result with the parsed W-2(s) and any warnings.
 */
export function parseW2Pdf(items: ExtractedTextItem[]): ParsedW2Result {
  const warnings: string[] = [];

  if (items.length === 0) {
    warnings.push('No text items found in PDF.');
    return { w2s: [], warnings };
  }

  // Step 1: Detect W-2 document
  if (!isW2Document(items)) {
    warnings.push('This does not appear to be a W-2 document. Look for "W-2" or "Wage and Tax Statement" text.');
    return { w2s: [], warnings };
  }

  // Step 2: Filter out right-side Earnings Summary to avoid double-counting
  const filteredItems = filterLeftSideItems(items);

  if (filteredItems.length === 0) {
    warnings.push('No text items remained after filtering. The PDF layout may not be supported.');
    return { w2s: [], warnings };
  }

  // Step 3: Extract employer info
  const employerName = findEmployerName(filteredItems);
  const employerEIN = findEmployerEIN(filteredItems);

  if (!employerName) {
    warnings.push('Could not extract employer name from the W-2.');
  }
  if (!employerEIN) {
    warnings.push('Could not extract employer EIN from the W-2.');
  }

  // Step 4: Extract box values
  const wages = findW2BoxValue(filteredItems, W2_BOX_CONFIGS.wages);
  const federalWithheld = findW2BoxValue(filteredItems, W2_BOX_CONFIGS.federalWithheld);
  const socialSecurityWages = findW2BoxValue(filteredItems, W2_BOX_CONFIGS.socialSecurityWages);
  const socialSecurityWithheld = findW2BoxValue(filteredItems, W2_BOX_CONFIGS.socialSecurityWithheld);
  const medicareWages = findW2BoxValue(filteredItems, W2_BOX_CONFIGS.medicareWages);
  const medicareWithheld = findW2BoxValue(filteredItems, W2_BOX_CONFIGS.medicareWithheld);
  const stateWages = findW2BoxValue(filteredItems, W2_BOX_CONFIGS.stateWages);
  const stateWithheld = findW2BoxValue(filteredItems, W2_BOX_CONFIGS.stateWithheld);
  const localWages = findW2BoxValue(filteredItems, W2_BOX_CONFIGS.localWages);
  const localWithheld = findW2BoxValue(filteredItems, W2_BOX_CONFIGS.localWithheld);
  const stateCode = findStateCode(filteredItems);
  const locality = findLocality(filteredItems);

  // Validate: at least wages or some monetary value should be present
  if (wages === 0 && socialSecurityWages === 0 && medicareWages === 0) {
    if (items.length < 30) {
      warnings.push(
        'This PDF appears to contain a scanned image or non-text W-2 form. ' +
        'Only W-2 PDFs with embedded text (not scanned images) can be imported. ' +
        'Please enter your W-2 data manually.',
      );
    } else {
      warnings.push('No wage amounts could be extracted from the W-2. The PDF layout may not be supported.');
    }
    return { w2s: [], warnings };
  }

  if (wages === 0) {
    warnings.push('Box 1 (Wages) could not be extracted. Please verify manually.');
  }

  const w2: W2 = {
    employerEIN,
    employerName,
    wages,
    federalWithheld,
    socialSecurityWages,
    socialSecurityWithheld,
    medicareWages,
    medicareWithheld,
    stateWages,
    stateWithheld,
    stateCode,
    ...(localWages > 0 ? { localWages } : {}),
    ...(localWithheld > 0 ? { localWithheld } : {}),
    ...(locality ? { locality } : {}),
  };

  return { w2s: [w2], warnings };
}

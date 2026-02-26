/**
 * Shared parsing utilities for importing tax data from CSVs and PDFs.
 *
 * All dollar amounts are converted to cents (integers).
 */

import type { Form8949Category } from '../engine/types';

/**
 * Parse a dollar amount string to cents.
 * Handles: "$1,234.56", "1234.56", "(1,234.56)" (negative), "-1234.56"
 */
export function parseDollarsToCents(value: string): number {
  if (!value || value.trim() === '') return 0;
  let cleaned = value.trim();

  // Handle parenthesized negatives: (1,234.56) -> -1234.56
  const isNegativeParens = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegativeParens) {
    cleaned = cleaned.slice(1, -1);
  }

  // Check for leading minus sign before stripping
  const isNegativeMinus = cleaned.startsWith('-');

  // Remove $, commas, spaces
  cleaned = cleaned.replace(/[$,\s]/g, '');

  const parsed = parseFloat(cleaned);
  if (Number.isNaN(parsed)) return 0;

  const cents = Math.round(Math.abs(parsed) * 100);
  return isNegativeParens || isNegativeMinus ? -cents : cents;
}

/**
 * Parse a date string into ISO format (YYYY-MM-DD) or 'VARIOUS'.
 * Handles MM/DD/YYYY, YYYY-MM-DD, and 2-digit years.
 */
export function parseDate(value: string): string {
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
 * Long-term = held for more than one year.
 */
export function isLongTermHolding(dateAcquired: string, dateSold: string): boolean {
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
export function determineCategory(isLongTerm: boolean, basisReported: boolean): Form8949Category {
  if (isLongTerm) {
    return basisReported ? '8949_D' : '8949_E';
  }
  return basisReported ? '8949_A' : '8949_B';
}

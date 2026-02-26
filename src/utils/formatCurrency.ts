/**
 * Currency formatting utilities.
 * All internal values are integers in CENTS. These functions convert
 * between cents and human-readable dollar strings.
 */

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Convert cents to a formatted dollar string without currency symbol.
 * 500000 -> "5,000.00"
 */
export function centsToDollars(cents: number): string {
  const dollars = Math.round(cents) / 100;
  return numberFormatter.format(dollars);
}

/**
 * Parse a dollar string back to cents.
 * "5,000.00" -> 500000
 * "$5,000" -> 500000
 * "5000" -> 500000
 */
export function dollarsToCents(dollars: string): number {
  // Strip everything except digits, decimal point, and minus sign
  const cleaned = dollars.replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-') return 0;
  const parsed = parseFloat(cleaned);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

/**
 * Format cents as USD with currency symbol, rounded to whole dollars.
 * 500000 -> "$5,000"
 * -500000 -> "-$5,000"
 */
export function formatUSD(cents: number): string {
  const dollars = Math.round(cents) / 100;
  const rounded = Math.round(dollars);
  const isNegative = rounded < 0;
  const formatted = wholeFormatter.format(Math.abs(rounded));
  return isNegative ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format cents as USD with currency symbol and cents.
 * 500000 -> "$5,000.00"
 * -500000 -> "-$5,000.00"
 */
export function formatUSDCents(cents: number): string {
  const dollars = Math.round(cents) / 100;
  const isNegative = dollars < 0;
  const formatted = numberFormatter.format(Math.abs(dollars));
  return isNegative ? `-$${formatted}` : `$${formatted}`;
}

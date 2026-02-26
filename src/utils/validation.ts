/**
 * Input validation utilities for tax form fields.
 */

/**
 * Validate SSN format: XXX-XX-XXXX (9 digits with dashes).
 * Also accepts 9 consecutive digits without dashes.
 */
export function isValidSSN(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 9) return false;
  // Cannot be all zeros in any group
  const g1 = digits.slice(0, 3);
  const g2 = digits.slice(3, 5);
  const g3 = digits.slice(5, 9);
  if (g1 === '000' || g2 === '00' || g3 === '0000') return false;
  // Cannot start with 9 (reserved for ITINs, which have different validation)
  if (digits[0] === '9') return false;
  return true;
}

/**
 * Validate EIN format: XX-XXXXXXX (9 digits with dash after 2nd digit).
 */
export function isValidEIN(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 9;
}

/**
 * Validate date format: YYYY-MM-DD, must be a real date and not in the future.
 */
export function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Validate actual date (handles Feb, leap years, etc.)
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false;
  }

  // Not in the future
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date <= today;
}

/**
 * Validate ZIP code: 5 digits or 9 digits (ZIP+4 with or without dash).
 */
export function isValidZip(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 5 || digits.length === 9;
}

/**
 * Validate ABA routing number: 9 digits with checksum.
 * The ABA checksum formula: 3(d1+d4+d7) + 7(d2+d5+d8) + (d3+d6+d9) mod 10 === 0
 */
export function isValidRoutingNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 9) return false;

  const d = digits.split('').map(Number);
  const checksum =
    3 * (d[0] + d[3] + d[6]) +
    7 * (d[1] + d[4] + d[7]) +
    (d[2] + d[5] + d[8]);

  return checksum % 10 === 0;
}

/**
 * Check that a cents value is non-negative.
 */
export function isNonNegativeCents(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Auto-format a string of digits into SSN format: XXX-XX-XXXX.
 */
export function formatSSN(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/**
 * Auto-format a string of digits into EIN format: XX-XXXXXXX.
 */
export function formatEIN(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

/**
 * Mask SSN for display: XXX-XX-1234 (only show last 4 digits).
 */
export function maskSSN(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return value;
  const last4 = digits.slice(-4);
  return `\u2022\u2022\u2022-\u2022\u2022-${last4}`;
}

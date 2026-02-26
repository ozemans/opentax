// Federal Tax Bracket Computations
//
// Implements progressive bracket math, the Qualified Dividends and Capital
// Gain Tax Worksheet (Form 1040, line 16 — ref IRS Instructions for Form 1040),
// and marginal rate lookup.
//
// All monetary values are integers in CENTS. $50,000 = 5_000_000 cents.
// NEVER use floating point for money — only integers + Math.round().

import type { FilingStatus, FederalConfig } from '../types';

// ───────────────────────────────────────────────────────────────────────────
// computeOrdinaryTax
// ───────────────────────────────────────────────────────────────────────────
/**
 * Computes federal income tax using progressive brackets.
 * Ref: IRS Form 1040, line 16 (Tax); Tax Table / Tax Computation Worksheet.
 *
 * @param taxableIncome  Taxable income in cents (Form 1040, line 15)
 * @param filingStatus   Filing status
 * @param config         Federal tax year config
 * @returns Tax in cents (rounded to nearest cent)
 */
export function computeOrdinaryTax(
  taxableIncome: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): number {
  if (taxableIncome <= 0) return 0;

  const brackets = config.brackets[filingStatus];
  let tax = 0;

  for (const bracket of brackets) {
    const lower = bracket.min;
    const upper = bracket.max ?? Infinity;

    if (taxableIncome <= lower) break;

    const taxableInBracket = Math.min(taxableIncome, upper) - lower;
    tax += taxableInBracket * bracket.rate;
  }

  return Math.round(tax);
}

// ───────────────────────────────────────────────────────────────────────────
// getMarginalRate
// ───────────────────────────────────────────────────────────────────────────
/**
 * Returns the marginal tax rate as a decimal for a given taxable income.
 * The marginal rate is the rate that applies to the next dollar of income.
 *
 * At income 0, the marginal rate is the first bracket's rate (10%).
 * At an exact bracket boundary, the marginal rate is the next bracket's rate.
 *
 * @param taxableIncome  Taxable income in cents
 * @param filingStatus   Filing status
 * @param config         Federal tax year config
 * @returns Marginal rate as decimal (e.g. 0.22 for 22%)
 */
export function getMarginalRate(
  taxableIncome: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): number {
  const brackets = config.brackets[filingStatus];

  // Walk brackets to find which one contains this income level.
  // At an exact boundary (income === bracket.min for some bracket),
  // the marginal rate is that bracket's rate (the next dollar falls here).
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncome >= brackets[i].min) {
      return brackets[i].rate;
    }
  }

  // Fallback: lowest bracket rate
  return brackets[0].rate;
}

// ───────────────────────────────────────────────────────────────────────────
// computeQualifiedDividendAndCapGainTax
// ───────────────────────────────────────────────────────────────────────────

/** Parameters for the Qualified Dividends and Capital Gain Tax computation. */
export interface QDCGTaxParams {
  /** Total taxable income in cents (Form 1040, line 15) */
  taxableIncome: number;
  /** Ordinary income portion in cents (wages, interest, short-term CG, etc.) */
  ordinaryIncome: number;
  /** Qualified dividends in cents (Form 1040, line 3a) */
  qualifiedDividends: number;
  /** Net long-term capital gain in cents (Schedule D, line 15 if positive, else 0) */
  netLTCG: number;
  /** Collectibles (28% rate) gain in cents — a subset of netLTCG */
  collectiblesGain: number;
  /** Unrecaptured Section 1250 gain in cents — a subset of netLTCG */
  section1250Gain: number;
  /** Filing status */
  filingStatus: FilingStatus;
  /** Federal config */
  config: FederalConfig;
}

/**
 * Implements the IRS "Qualified Dividends and Capital Gain Tax Worksheet"
 * (Schedule D Tax Worksheet when collectibles/1250 gains are present).
 *
 * This splits income into layers and applies the appropriate rate to each:
 * 1. Ordinary income → regular progressive rates
 * 2. Collectibles gain → min(28%, applicable ordinary rate)
 * 3. Section 1250 gain → min(25%, applicable ordinary rate)
 * 4. Qualified dividends + remaining LTCG → 0% / 15% / 20% preferential rates
 *
 * The result is the LESSER of this worksheet's tax or straight ordinary rates
 * on everything (the "regular method").
 *
 * Ref: IRS Form 1040 Instructions, "Qualified Dividends and Capital Gain
 * Tax Worksheet—Line 16" and Schedule D Tax Worksheet.
 *
 * @returns Tax in cents
 */
export function computeQualifiedDividendAndCapGainTax(params: QDCGTaxParams): number {
  const {
    taxableIncome,
    ordinaryIncome: _ordinaryIncome,
    qualifiedDividends,
    netLTCG,
    collectiblesGain,
    section1250Gain,
    filingStatus,
    config,
  } = params;

  if (taxableIncome <= 0) return 0;

  // ── Regular method: ordinary rates on everything ──────────────────────
  const regularTax = computeOrdinaryTax(taxableIncome, filingStatus, config);

  // If no preferential income, short-circuit
  const totalPreferential = qualifiedDividends + netLTCG;
  if (totalPreferential <= 0) return regularTax;

  // ── Capital gains rate thresholds ─────────────────────────────────────
  const cgBrackets = config.capitalGainsRates[filingStatus];
  // The brackets are: [{max, rate: 0.00}, {max, rate: 0.15}, {max: null, rate: 0.20}]
  const threshold0pct = cgBrackets[0].max ?? 0;    // Upper limit for 0% rate
  const threshold15pct = cgBrackets[1].max ?? Infinity; // Upper limit for 15% rate

  // ── Determine the income layers ───────────────────────────────────────

  // Ordinary portion of income (non-preferential)
  const ordinaryPortion = Math.max(0, taxableIncome - totalPreferential);

  // Preferential LTCG excluding collectibles and section 1250
  // (these get 0%/15%/20% rates)
  const preferentialLTCG = Math.max(0, netLTCG - collectiblesGain - section1250Gain);
  const adjustedPreferential = qualifiedDividends + preferentialLTCG;

  // ── Step 1: Tax on ordinary income at progressive rates ───────────────
  // Ref: Schedule D Tax Worksheet, line 42
  let worksheetTax = computeOrdinaryTax(ordinaryPortion, filingStatus, config);

  // Track the income "stack" — we layer income types on top of ordinary
  let stackedIncome = ordinaryPortion;

  // ── Step 2: Collectibles gain at min(28%, applicable rate) ────────────
  // Ref: Schedule D Tax Worksheet, lines 43-44
  if (collectiblesGain > 0) {
    worksheetTax += computeSpecialRateLayerTax(
      collectiblesGain,
      stackedIncome,
      config.collectiblesRate,
      filingStatus,
      config,
    );
    stackedIncome += collectiblesGain;
  }

  // ── Step 3: Section 1250 gain at min(25%, applicable rate) ────────────
  // Ref: Schedule D Tax Worksheet, lines 45-46
  if (section1250Gain > 0) {
    worksheetTax += computeSpecialRateLayerTax(
      section1250Gain,
      stackedIncome,
      config.section1250Rate,
      filingStatus,
      config,
    );
    stackedIncome += section1250Gain;
  }

  // ── Step 4: 0% / 15% / 20% on qualified dividends + remaining LTCG ───
  // Ref: Qualified Dividends and Capital Gain Tax Worksheet, lines 6-21
  if (adjustedPreferential > 0) {
    let remaining = adjustedPreferential;

    // Amount that fits in the 0% zone
    const roomIn0pct = Math.max(0, threshold0pct - stackedIncome);
    const amountAt0pct = Math.min(remaining, roomIn0pct);
    remaining -= amountAt0pct;
    stackedIncome += amountAt0pct;
    // 0% tax — nothing to add

    // Amount that fits in the 15% zone
    const roomIn15pct = Math.max(0, threshold15pct - stackedIncome);
    const amountAt15pct = Math.min(remaining, roomIn15pct);
    remaining -= amountAt15pct;
    stackedIncome += amountAt15pct;
    worksheetTax += Math.round(amountAt15pct * 0.15);

    // Everything else at 20%
    if (remaining > 0) {
      worksheetTax += Math.round(remaining * 0.20);
    }
  }

  // ── Return the lesser of worksheet tax or regular method ──────────────
  // Ref: Form 1040 Instructions, Qualified Dividends and Capital Gain Tax
  // Worksheet, line 25
  return Math.min(worksheetTax, regularTax);
}

// ───────────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────────

/**
 * Computes tax on a layer of income (e.g. collectibles, section 1250)
 * that is taxed at the lesser of a special max rate or the ordinary rate
 * that would apply given the income stack.
 *
 * The layer is "stacked" on top of `baseIncome` in the bracket schedule.
 * For each portion of the layer that falls in a bracket, the tax is:
 *   portion * min(specialRate, bracket.rate)
 *
 * @param layerAmount   Amount of this income layer in cents
 * @param baseIncome    Income already stacked below this layer in cents
 * @param specialRate   The maximum rate for this layer (e.g. 0.28, 0.25)
 * @param filingStatus  Filing status
 * @param config        Federal config
 * @returns Tax on this layer in cents (rounded)
 */
function computeSpecialRateLayerTax(
  layerAmount: number,
  baseIncome: number,
  specialRate: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): number {
  if (layerAmount <= 0) return 0;

  const brackets = config.brackets[filingStatus];
  let tax = 0;
  let remaining = layerAmount;
  let currentStack = baseIncome;

  for (const bracket of brackets) {
    if (remaining <= 0) break;

    const upper = bracket.max ?? Infinity;

    // Skip brackets entirely below our current stack position
    if (upper <= currentStack) continue;

    // How much room is left in this bracket above our current stack
    const roomInBracket = upper - Math.max(currentStack, bracket.min);
    const amountInBracket = Math.min(remaining, roomInBracket);

    if (amountInBracket > 0) {
      const applicableRate = Math.min(specialRate, bracket.rate);
      tax += amountInBracket * applicableRate;
      remaining -= amountInBracket;
      currentStack += amountInBracket;
    }
  }

  return Math.round(tax);
}

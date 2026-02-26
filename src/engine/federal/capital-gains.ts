// capital-gains.ts — Capital gains/losses computation for Schedule D / Form 8949
//
// All monetary values are integers in CENTS. $3,000 = 300_000.
// Pure functions, no side effects.
//
// References:
//   - IRS Schedule D (Form 1040)
//   - IRS Form 8949, Sales and Other Dispositions of Capital Assets
//   - IRS Publication 550, Investment Income and Expenses
//   - IRS Capital Loss Carryover Worksheet (Schedule D Instructions)

import type {
  Form1099B,
  Form8949Category,
  FilingStatus,
  FederalConfig,
  CapitalGainsResult,
} from '../types.ts';

// ---------------------------------------------------------------------------
// categorizeTransactions
// ---------------------------------------------------------------------------

/**
 * Sort 1099-B transactions into the 6 Form 8949 categories (A–F) based on
 * their `category` field. Each transaction already carries its category
 * assignment (derived from isLongTerm + basisReportedToIRS upstream).
 *
 * Categories:
 *   A — Short-term, basis reported to IRS
 *   B — Short-term, basis NOT reported to IRS
 *   C — Short-term, no 1099-B received
 *   D — Long-term, basis reported to IRS
 *   E — Long-term, basis NOT reported to IRS
 *   F — Long-term, no 1099-B received
 */
export function categorizeTransactions(
  transactions: Form1099B[],
): Record<Form8949Category, Form1099B[]> {
  const result: Record<Form8949Category, Form1099B[]> = {
    '8949_A': [],
    '8949_B': [],
    '8949_C': [],
    '8949_D': [],
    '8949_E': [],
    '8949_F': [],
  };

  for (const tx of transactions) {
    result[tx.category].push(tx);
  }

  return result;
}

// ---------------------------------------------------------------------------
// computeCapitalGains
// ---------------------------------------------------------------------------

/**
 * Compute the full capital gains result for Schedule D.
 *
 * Steps (per IRS Schedule D instructions):
 *   1. Net all short-term gains and losses.
 *   2. Net all long-term gains and losses.
 *   3. Apply prior-year capital loss carryforward (short-term first, then long-term).
 *   4. Combine net short-term and net long-term into overall net capital gain/loss.
 *   5. If net loss, limit the deductible loss to $3,000 ($1,500 for MFS).
 *   6. Excess loss beyond the limit carries forward to next year.
 *   7. Track collectibles gains and section 1250 gains (section 1250 comes
 *      from 1099-DIV, not 1099-B, so it will be 0 here unless extended).
 *
 * @param transactions           - Array of Form 1099-B transactions
 * @param priorYearSTCarryforward - Prior year ST capital loss carryforward (positive cents)
 * @param priorYearLTCarryforward - Prior year LT capital loss carryforward (positive cents)
 * @param filingStatus            - Filing status (affects the loss limitation amount)
 * @param config                  - Federal tax config with capitalLossLimit values
 */
export function computeCapitalGains(
  transactions: Form1099B[],
  priorYearSTCarryforward: number,
  priorYearLTCarryforward: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): CapitalGainsResult {
  // --- Step 1: Tally raw short-term and long-term gains and losses -----------

  let shortTermGains = 0;   // Sum of positive gainLoss for ST transactions
  let shortTermLosses = 0;  // Sum of |gainLoss| for negative ST transactions (stored positive)
  let longTermGains = 0;    // Sum of positive gainLoss for LT transactions
  let longTermLosses = 0;   // Sum of |gainLoss| for negative LT transactions (stored positive)
  let collectiblesGain = 0; // Only positive collectibles gains count
  const section1250Gain = 0;  // From 1099-DIV, not 1099-B; always 0 here

  for (const tx of transactions) {
    // Wash sale handling: washSaleDisallowed is informational only.
    // The gainLoss field already reflects the wash sale adjustment,
    // so we just use gainLoss directly.
    if (tx.isLongTerm) {
      if (tx.gainLoss >= 0) {
        longTermGains += tx.gainLoss;
        // Track collectibles gains (only positive, per Schedule D line 18)
        if (tx.isCollectible && tx.gainLoss > 0) {
          collectiblesGain += tx.gainLoss;
        }
      } else {
        longTermLosses += Math.abs(tx.gainLoss);
      }
    } else {
      if (tx.gainLoss >= 0) {
        shortTermGains += tx.gainLoss;
      } else {
        shortTermLosses += Math.abs(tx.gainLoss);
      }
    }
  }

  // Raw nets before carryforward
  let netShortTerm = shortTermGains - shortTermLosses;
  let netLongTerm = longTermGains - longTermLosses;

  // --- Step 2: Apply prior-year carryforward -----------------------------------
  // Per IRS Capital Loss Carryover Worksheet (Schedule D Instructions):
  //   - Short-term carryforward reduces the net short-term column (Part I)
  //   - Long-term carryforward reduces the net long-term column (Part II)
  // Each component is applied independently to its respective column.

  if (priorYearSTCarryforward > 0) netShortTerm -= priorYearSTCarryforward;
  if (priorYearLTCarryforward > 0) netLongTerm -= priorYearLTCarryforward;

  // --- Step 3: Combine net short-term and long-term ---------------------------

  const netCapitalGainLoss = netShortTerm + netLongTerm;

  // --- Step 4: Loss limitation ------------------------------------------------
  // Per IRC §1211(b), the deductible capital loss is limited to:
  //   - $3,000 for all filing statuses except MFS
  //   - $1,500 for MFS
  // This limit comes from config.capitalLossLimit[filingStatus].

  const lossLimit = config.capitalLossLimit[filingStatus]; // positive number in cents

  let deductibleLoss = 0;
  let carryforwardLoss = 0;

  if (netCapitalGainLoss < 0) {
    const absLoss = Math.abs(netCapitalGainLoss);
    if (absLoss <= lossLimit) {
      // Full loss is deductible
      deductibleLoss = netCapitalGainLoss; // negative number
      carryforwardLoss = 0;
    } else {
      // Capped at the limit
      deductibleLoss = -lossLimit; // negative number
      carryforwardLoss = absLoss - lossLimit; // positive number for next year
    }
  }
  // If netCapitalGainLoss >= 0, deductibleLoss and carryforwardLoss stay 0.

  // --- Step 5: Categorize transactions for Form 8949 --------------------------

  const categorized = categorizeTransactions(transactions);

  // --- Assemble result --------------------------------------------------------

  return {
    shortTermGains,
    shortTermLosses,
    netShortTerm,
    longTermGains,
    longTermLosses,
    netLongTerm,
    netCapitalGainLoss,
    deductibleLoss,
    carryforwardLoss,
    collectiblesGain,
    section1250Gain,
    categorized,
  };
}

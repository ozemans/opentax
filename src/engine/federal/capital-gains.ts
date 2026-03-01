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
  Form1099DIV,
  AdjustedForm1099B,
  Form8949Category,
  FilingStatus,
  FederalConfig,
  CapitalGainsResult,
} from '../types.ts';

// ---------------------------------------------------------------------------
// applyWashSaleAdjustments
// ---------------------------------------------------------------------------

/**
 * Apply wash sale basis adjustments to raw Form1099B transactions.
 *
 * Per IRC §1091 and Form 8949 instructions:
 *   column g = washSaleDisallowed (Box 1g)
 *   column h = proceeds - basis + adjustments = gainLoss + washSaleDisallowed
 *
 * The adjustment code 'W' must appear in column f when Box 1g is nonzero.
 */
export function applyWashSaleAdjustments(
  transactions: Form1099B[],
): AdjustedForm1099B[] {
  return transactions.map((tx) => {
    const disallowed = tx.washSaleDisallowed ?? 0;
    return {
      ...tx,
      effectiveGainLoss: tx.gainLoss + disallowed,
      adjustmentCode: disallowed > 0 ? 'W' : '',
    };
  });
}

// ---------------------------------------------------------------------------
// categorizeTransactions
// ---------------------------------------------------------------------------

/**
 * Sort adjusted 1099-B transactions into the 6 Form 8949 categories (A–F)
 * based on their `category` field.
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
  transactions: AdjustedForm1099B[],
): Record<Form8949Category, AdjustedForm1099B[]> {
  const result: Record<Form8949Category, AdjustedForm1099B[]> = {
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
 *   1. Apply wash sale adjustments to get effectiveGainLoss per transaction.
 *   2. Net all short-term gains and losses using effectiveGainLoss.
 *   3. Net all long-term gains and losses using effectiveGainLoss.
 *   4. Add 1099-DIV capital gain distributions to long-term (Box 2a).
 *   5. Capture rawNetShortTerm and rawNetLongTerm (pre-carryforward, Form 8949 totals for Sched D lines 2/9).
 *   6. Apply prior-year capital loss carryforward (short-term first, then long-term).
 *   7. Combine net short-term and net long-term into overall net capital gain/loss.
 *   8. If net loss, limit the deductible loss to $3,000 ($1,500 for MFS).
 *   9. Excess loss beyond the limit carries forward to next year.
 *  10. Track collectibles gains (28%) and section 1250 gains (25%) from both 1099-B and 1099-DIV.
 *
 * @param transactions            - Array of Form 1099-B transactions (raw, pre-adjustment)
 * @param priorYearSTCarryforward - Prior year ST capital loss carryforward (positive cents)
 * @param priorYearLTCarryforward - Prior year LT capital loss carryforward (positive cents)
 * @param filingStatus            - Filing status (affects the loss limitation amount)
 * @param config                  - Federal tax config with capitalLossLimit values
 * @param divForms                - Optional 1099-DIV forms (Box 2a adds to long-term gains)
 */
export function computeCapitalGains(
  transactions: Form1099B[],
  priorYearSTCarryforward: number,
  priorYearLTCarryforward: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
  divForms?: Form1099DIV[],
): CapitalGainsResult {
  // --- Step 1: Apply wash sale adjustments ------------------------------------
  const adjusted = applyWashSaleAdjustments(transactions);

  // --- Step 2 & 3: Tally short-term and long-term using effectiveGainLoss ----

  let shortTermGains = 0;   // Sum of positive effectiveGainLoss for ST transactions
  let shortTermLosses = 0;  // Sum of |effectiveGainLoss| for negative ST transactions
  let longTermGains = 0;    // Sum of positive effectiveGainLoss for LT transactions
  let longTermLosses = 0;   // Sum of |effectiveGainLoss| for negative LT transactions
  let collectiblesGain = 0; // Only positive collectibles gains count
  let section1250Gain = 0;  // From 1099-DIV Box 2b; 0 from 1099-B

  for (const tx of adjusted) {
    if (tx.isLongTerm) {
      if (tx.effectiveGainLoss >= 0) {
        longTermGains += tx.effectiveGainLoss;
        // Track collectibles gains (only positive, per Schedule D line 18)
        if (tx.isCollectible && tx.effectiveGainLoss > 0) {
          collectiblesGain += tx.effectiveGainLoss;
        }
      } else {
        longTermLosses += Math.abs(tx.effectiveGainLoss);
      }
    } else {
      if (tx.effectiveGainLoss >= 0) {
        shortTermGains += tx.effectiveGainLoss;
      } else {
        shortTermLosses += Math.abs(tx.effectiveGainLoss);
      }
    }
  }

  // --- Step 4: Add 1099-DIV capital gain distributions to long-term ----------
  // Box 2a (totalCapitalGain) goes to Schedule D line 13 as additional LT gains.
  // Box 2b (section1250Gain) and Box 2d (collectiblesGain) are sub-components.
  if (divForms && divForms.length > 0) {
    for (const div of divForms) {
      if (div.totalCapitalGain > 0) {
        longTermGains += div.totalCapitalGain;
      }
      if (div.section1250Gain && div.section1250Gain > 0) {
        section1250Gain += div.section1250Gain;
      }
      if (div.collectiblesGain && div.collectiblesGain > 0) {
        collectiblesGain += div.collectiblesGain;
      }
    }
  }

  // Raw nets before carryforward — these are the Form 8949 transfer totals
  // used on Schedule D lines 2 (ST) and 9 (LT).
  const rawNetShortTerm = shortTermGains - shortTermLosses;
  const rawNetLongTerm = longTermGains - longTermLosses;

  // --- Step 5: Apply prior-year carryforward -----------------------------------
  // Per IRS Capital Loss Carryover Worksheet (Schedule D Instructions):
  //   - Short-term carryforward reduces the net short-term column (Part I, line 5)
  //   - Long-term carryforward reduces the net long-term column (Part II, line 12)
  // Each component is applied independently to its respective column.

  let netShortTerm = rawNetShortTerm;
  let netLongTerm = rawNetLongTerm;

  if (priorYearSTCarryforward > 0) netShortTerm -= priorYearSTCarryforward;
  if (priorYearLTCarryforward > 0) netLongTerm -= priorYearLTCarryforward;

  // --- Step 6: Combine net short-term and long-term ---------------------------

  const netCapitalGainLoss = netShortTerm + netLongTerm;

  // --- Step 7: Loss limitation ------------------------------------------------
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

  // --- Step 8: Categorize transactions for Form 8949 --------------------------

  const categorized = categorizeTransactions(adjusted);

  // --- Assemble result --------------------------------------------------------

  return {
    shortTermGains,
    shortTermLosses,
    rawNetShortTerm,
    netShortTerm,
    longTermGains,
    longTermLosses,
    rawNetLongTerm,
    netLongTerm,
    netCapitalGainLoss,
    deductibleLoss,
    carryforwardLoss,
    collectiblesGain,
    section1250Gain,
    categorized,
  };
}

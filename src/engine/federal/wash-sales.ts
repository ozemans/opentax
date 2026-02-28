// Wash Sale Rule Analysis
// IRS Publication 550 / IRC §1091
//
// A wash sale occurs when you sell a security at a loss and buy the same (or substantially
// identical) security within 30 days before or after the sale. The loss is "disallowed" and
// instead added to the cost basis of the repurchased shares.
//
// NOTE: This module performs advisory-level detection from transaction data. The broker's
// Form 1099-B Box 1g is the authoritative source of disallowed loss amounts. These alerts
// are supplementary — for transactions where the broker may not have reported Box 1g.
//
// All monetary values are integers in CENTS.

import type { Form1099B } from '../types';

export interface WashSaleAlert {
  transactionIndex: number;    // Index in the original transactions array
  security: string;            // Security name/description
  dateSold: string;            // Sale date (ISO)
  lossAmount: number;          // Loss on this transaction (positive cents)
  triggerDate: string;         // Date of matching repurchase within 30-day window
  note: string;
}

/**
 * Detect potential wash sales from a list of transactions.
 *
 * Finds loss transactions where the same security (matched by assetDescription)
 * was purchased within 30 calendar days before or after the sale date.
 *
 * Returns advisory alerts only — broker's Box 1g is authoritative.
 */
export function detectWashSales(transactions: Form1099B[]): WashSaleAlert[] {
  const alerts: WashSaleAlert[] = [];

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];

    // Only analyze loss transactions where Box 1g wasn't already reported
    if (!tx.gainLoss || tx.gainLoss >= 0) continue;
    if (!tx.dateSold || !tx.description) continue;

    // Skip if broker already reported wash sale disallowance — already handled
    if ((tx.washSaleDisallowed ?? 0) > 0) continue;

    const saleDate = new Date(tx.dateSold);
    if (isNaN(saleDate.getTime())) continue;

    const lossAmount = Math.abs(tx.gainLoss);
    const securityKey = normalizeSecurityName(tx.description);

    // Search for a matching purchase of the same security within ±30 days
    for (let j = 0; j < transactions.length; j++) {
      if (i === j) continue;

      const candidate = transactions[j];
      if (!candidate.dateAcquired || !candidate.description) continue;

      // Match on normalized security name
      if (normalizeSecurityName(candidate.description) !== securityKey) continue;

      const acquireDate = new Date(candidate.dateAcquired);
      if (isNaN(acquireDate.getTime())) continue;

      const daysDiff = Math.abs(
        (acquireDate.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff <= 30) {
        alerts.push({
          transactionIndex: i,
          security: tx.description,
          dateSold: tx.dateSold,
          lossAmount,
          triggerDate: candidate.dateAcquired,
          note: `Potential wash sale: ${tx.description} sold ${tx.dateSold} at a loss; repurchased ${candidate.dateAcquired} (${Math.round(daysDiff)} days apart). Verify with your broker's 1099-B Box 1g.`,
        });
        break; // One alert per loss transaction
      }
    }
  }

  return alerts;
}

/**
 * Normalize a security name for matching.
 * Strips common suffixes, extra spaces, and lowercases.
 */
function normalizeSecurityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*(common stock|cl [a-z]|class [a-z]|inc\.?|corp\.?|ltd\.?)\s*/gi, '')
    .trim();
}

/**
 * Compute the total wash sale disallowed amount from broker-reported Box 1g values.
 * This is the authoritative figure from the 1099-B.
 */
export function computeTotalWashSaleDisallowed(transactions: Form1099B[]): number {
  return transactions.reduce((sum, t) => sum + (t.washSaleDisallowed ?? 0), 0);
}

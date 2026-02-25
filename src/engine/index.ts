// OpenTax Engine — Main Entry Point
//
// Orchestrates both federal and state tax computation.
// Returns a complete TaxResult with federal results and state results populated.
//
// All monetary values are integers in CENTS.

import type { TaxInput, TaxResult, FederalConfig } from './types';
import { computeFederalTax } from './federal/index';
import { computeStateTaxes } from './states/index';

/**
 * Compute a complete tax return (federal + state).
 *
 * @param input  Tax return input data
 * @param config Federal tax year config
 * @returns Complete TaxResult with both federal and state results
 */
export function computeFullReturn(input: TaxInput, config: FederalConfig): TaxResult {
  const federalResult = computeFederalTax(input, config);
  const stateResults = computeStateTaxes(input, federalResult);
  return { ...federalResult, stateResults };
}

// Re-export for convenience
export { computeFederalTax } from './federal/index';
export { computeStateTaxes, getSupportedStates, getStateModule, getStateConfig } from './states/index';

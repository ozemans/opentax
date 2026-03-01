import type { TaxInput } from '../../engine/types';
import { createDefaultTaxInput } from '../state/defaults';

/**
 * Current schema version for stored TaxInput data.
 * Increment this when TaxInput shape changes between releases.
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Migrate stored data from an older schema version to the current one.
 * If the data can't be migrated, returns a fresh default TaxInput.
 *
 * @param data   The raw data loaded from storage
 * @param version  The schema version the data was saved with
 * @returns A TaxInput conforming to the current schema
 */
export function migrateIfNeeded(data: unknown, version: number): TaxInput {
  // If we can't determine the data shape at all, start fresh
  if (data === null || typeof data !== 'object') {
    return createDefaultTaxInput();
  }

  let migrated = data as Record<string, unknown>;

  // Version 0 or unknown → version 1
  // This is the initial schema, so no structural changes needed.
  // Future migrations would be added as chained if-blocks:
  //
  // if (version < 2) {
  //   migrated = migrateV1ToV2(migrated);
  // }
  // if (version < 3) {
  //   migrated = migrateV2ToV3(migrated);
  // }

  if (version < 1) {
    // Ensure all required arrays exist (in case data was saved before arrays were added)
    const defaults = createDefaultTaxInput();
    migrated = {
      ...defaults,
      ...migrated,
      // Ensure arrays are arrays, not undefined
      w2s: Array.isArray(migrated.w2s) ? migrated.w2s : [],
      form1099INTs: Array.isArray(migrated.form1099INTs) ? migrated.form1099INTs : [],
      form1099DIVs: Array.isArray(migrated.form1099DIVs) ? migrated.form1099DIVs : [],
      form1099Bs: Array.isArray(migrated.form1099Bs) ? migrated.form1099Bs : [],
      form1099NECs: Array.isArray(migrated.form1099NECs) ? migrated.form1099NECs : [],
      form1099Gs: Array.isArray(migrated.form1099Gs) ? migrated.form1099Gs : [],
      form1099Rs: Array.isArray(migrated.form1099Rs) ? migrated.form1099Rs : [],
      form1099Ks: Array.isArray(migrated.form1099Ks) ? migrated.form1099Ks : [],
      dependents: Array.isArray(migrated.dependents) ? migrated.dependents : [],
    };
  }

  if (version < 2) {
    // Phase 2: add taxLots array for lot-level tax optimization
    migrated = {
      ...migrated,
      taxLots: Array.isArray(migrated.taxLots) ? migrated.taxLots : [],
    };
  }

  return migrated as unknown as TaxInput;
}

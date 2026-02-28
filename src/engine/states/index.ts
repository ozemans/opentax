// State Tax Engine — Registry & Orchestrator
//
// Registers all 11 state modules and their configs, provides lookup functions,
// and orchestrates state tax computation from federal results.
//
// All monetary values are integers in CENTS.

import type { TaxInput, TaxResult, StateTaxResult } from '../types';
import type { StateModule, StateConfig } from './interface';
import { buildStateTaxInput } from './common';

// State modules
import { texas } from './texas';
import { florida } from './florida';
import { pennsylvania } from './pennsylvania';
import { illinois } from './illinois';
import { newHampshire } from './new-hampshire';
import { virginia } from './virginia';
import { ohio } from './ohio';
import { massachusetts } from './massachusetts';
import { newJersey } from './new-jersey';
import { newYork } from './new-york';
import { california } from './california';
import { georgia } from './georgia';
import { northCarolina } from './north-carolina';
import { michigan } from './michigan';
import { washington } from './washington';
import { arizona } from './arizona';
import { tennessee } from './tennessee';
import { indiana } from './indiana';
import { missouri } from './missouri';
import { maryland } from './maryland';
import { wisconsin } from './wisconsin';

// State configs
import txConfig from '../../../config/states/state-TX-2025.json';
import flConfig from '../../../config/states/state-FL-2025.json';
import paConfig from '../../../config/states/state-PA-2025.json';
import ilConfig from '../../../config/states/state-IL-2025.json';
import nhConfig from '../../../config/states/state-NH-2025.json';
import vaConfig from '../../../config/states/state-VA-2025.json';
import ohConfig from '../../../config/states/state-OH-2025.json';
import maConfig from '../../../config/states/state-MA-2025.json';
import njConfig from '../../../config/states/state-NJ-2025.json';
import nyConfig from '../../../config/states/state-NY-2025.json';
import caConfig from '../../../config/states/state-CA-2025.json';
import gaConfig from '../../../config/states/state-GA-2025.json';
import ncConfig from '../../../config/states/state-NC-2025.json';
import miConfig from '../../../config/states/state-MI-2025.json';
import waConfig from '../../../config/states/state-WA-2025.json';
import azConfig from '../../../config/states/state-AZ-2025.json';
import tnConfig from '../../../config/states/state-TN-2025.json';
import inConfig from '../../../config/states/state-IN-2025.json';
import moConfig from '../../../config/states/state-MO-2025.json';
import mdConfig from '../../../config/states/state-MD-2025.json';
import wiConfig from '../../../config/states/state-WI-2025.json';

// ---------------------------------------------------------------------------
// State Module Registry
// ---------------------------------------------------------------------------

const stateModuleRegistry: Record<string, StateModule> = {
  TX: texas,
  FL: florida,
  PA: pennsylvania,
  IL: illinois,
  NH: newHampshire,
  VA: virginia,
  OH: ohio,
  MA: massachusetts,
  NJ: newJersey,
  NY: newYork,
  CA: california,
  GA: georgia,
  NC: northCarolina,
  MI: michigan,
  WA: washington,
  AZ: arizona,
  TN: tennessee,
  IN: indiana,
  MO: missouri,
  MD: maryland,
  WI: wisconsin,
};

// ---------------------------------------------------------------------------
// State Config Registry
// ---------------------------------------------------------------------------

const stateConfigRegistry: Record<string, StateConfig> = {
  TX: txConfig as unknown as StateConfig,
  FL: flConfig as unknown as StateConfig,
  PA: paConfig as unknown as StateConfig,
  IL: ilConfig as unknown as StateConfig,
  NH: nhConfig as unknown as StateConfig,
  VA: vaConfig as unknown as StateConfig,
  OH: ohConfig as unknown as StateConfig,
  MA: maConfig as unknown as StateConfig,
  NJ: njConfig as unknown as StateConfig,
  NY: nyConfig as unknown as StateConfig,
  CA: caConfig as unknown as StateConfig,
  GA: gaConfig as unknown as StateConfig,
  NC: ncConfig as unknown as StateConfig,
  MI: miConfig as unknown as StateConfig,
  WA: waConfig as unknown as StateConfig,
  AZ: azConfig as unknown as StateConfig,
  TN: tnConfig as unknown as StateConfig,
  IN: inConfig as unknown as StateConfig,
  MO: moConfig as unknown as StateConfig,
  MD: mdConfig as unknown as StateConfig,
  WI: wiConfig as unknown as StateConfig,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a state module by state code.
 * Returns undefined if the state is not supported.
 */
export function getStateModule(stateCode: string): StateModule | undefined {
  return stateModuleRegistry[stateCode.toUpperCase()];
}

/**
 * Get a state config by state code.
 * Returns undefined if the state is not supported.
 */
export function getStateConfig(stateCode: string): StateConfig | undefined {
  return stateConfigRegistry[stateCode.toUpperCase()];
}

/**
 * Get all supported state codes.
 */
export function getSupportedStates(): string[] {
  return Object.keys(stateModuleRegistry);
}

/**
 * Compute state taxes for a filer's state of residence and any additional states.
 * Returns a Record mapping state codes to StateTaxResult.
 *
 * @param input         Original tax input
 * @param federalResult Computed federal tax result
 * @returns Record<string, StateTaxResult> keyed by state code
 */
export function computeStateTaxes(
  input: TaxInput,
  federalResult: TaxResult,
): Record<string, StateTaxResult> {
  const results: Record<string, StateTaxResult> = {};

  // Collect all states to compute
  const stateCodes = new Set<string>();
  if (input.stateOfResidence) {
    stateCodes.add(input.stateOfResidence.toUpperCase());
  }
  if (input.additionalStates) {
    for (const s of input.additionalStates) {
      // NYC is a locality within NY, not a separate state module
      if (s === 'NYC') continue;
      stateCodes.add(s.toUpperCase());
    }
  }

  for (const stateCode of stateCodes) {
    const module = getStateModule(stateCode);
    const config = getStateConfig(stateCode);

    if (!module || !config) {
      // Unsupported state — skip silently
      continue;
    }

    const stateInput = buildStateTaxInput(input, federalResult, stateCode);
    results[stateCode] = module.compute(stateInput, config);
  }

  return results;
}

// Re-export types and utilities
export type { StateModule, StateConfig, StateTaxInput, StateTaxResult } from './interface';
export { buildStateTaxInput, buildNoTaxResult } from './common';

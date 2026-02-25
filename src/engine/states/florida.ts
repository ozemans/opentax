// Florida State Tax Module
// Florida has no state income tax.

import type { StateModule } from './interface';
import { buildNoTaxResult } from './common';

export const florida: StateModule = {
  stateCode: 'FL',
  stateName: 'Florida',
  hasIncomeTax: false,
  compute: (input) => buildNoTaxResult('FL', 'Florida', input),
};

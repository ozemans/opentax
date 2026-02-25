// Texas State Tax Module
// Texas has no state income tax.

import type { StateModule } from './interface';
import { buildNoTaxResult } from './common';

export const texas: StateModule = {
  stateCode: 'TX',
  stateName: 'Texas',
  hasIncomeTax: false,
  compute: (input) => buildNoTaxResult('TX', 'Texas', input),
};

// Washington State Tax Module
// Washington has no state income tax.

import type { StateModule } from './interface';
import { buildNoTaxResult } from './common';

export const washington: StateModule = {
  stateCode: 'WA',
  stateName: 'Washington',
  hasIncomeTax: false,
  compute: (input) => buildNoTaxResult('WA', 'Washington', input),
};

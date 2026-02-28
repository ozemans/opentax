// Tennessee State Tax Module
// Tennessee has no state income tax (Hall Tax repealed effective 2021).

import type { StateModule } from './interface';
import { buildNoTaxResult } from './common';

export const tennessee: StateModule = {
  stateCode: 'TN',
  stateName: 'Tennessee',
  hasIncomeTax: false,
  compute: (input) => buildNoTaxResult('TN', 'Tennessee', input),
};

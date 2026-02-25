# Adding a New State Module — Contributor Guide

## Overview

Each state is a plug-in module implementing the `StateModuleInterface`. Follow these steps to add support for a new state.

## Step-by-Step

### 1. Research

Before writing code, gather:
- [ ] Current year tax brackets (or flat rate)
- [ ] Filing statuses recognized (some states differ from federal)
- [ ] Standard deduction amounts (if applicable)
- [ ] Personal exemption amounts (if applicable)
- [ ] How the state starts its computation (from federal AGI? Own gross income?)
- [ ] Additions to federal AGI
- [ ] Subtractions from federal AGI
- [ ] State-specific credits (especially state EITC)
- [ ] Capital gains treatment (preferential rates or ordinary income?)
- [ ] Social Security taxation (most states exempt it)
- [ ] Retirement income treatment
- [ ] Form name and number (e.g., CA Form 540, NY IT-201)
- [ ] Fillable PDF availability from state tax agency website

**Sources:**
- State Department of Revenue / Taxation website
- State tax form instructions (primary source of truth)
- State tax law statutes (for edge cases)

### 2. Create Config File

Create `config/state-XX-YYYY.json`:

```json
{
  "stateCode": "XX",
  "stateName": "Your State",
  "taxYear": 2024,
  "hasIncomeTax": true,
  "startingPoint": "federal_agi",
  "brackets": {
    "single": [
      { "min": 0, "max": 1000000, "rate": 0.02 },
      { "min": 1000000, "max": 5000000, "rate": 0.04 },
      { "min": 5000000, "max": null, "rate": 0.06 }
    ],
    "married_filing_jointly": [ ... ]
  },
  "standardDeduction": {
    "single": 500000,
    "married_filing_jointly": 1000000
  },
  "personalExemption": {
    "taxpayer": 100000,
    "spouse": 100000,
    "dependent": 50000
  },
  "socialSecurityExempt": true,
  "capitalGainsTreatment": "ordinary",
  "credits": {
    "eitc": {
      "percentOfFederal": 0.20,
      "refundable": true
    }
  }
}
```

### 3. Implement State Module

Create `src/engine/states/your-state.ts`:

```typescript
import type { StateModuleInterface, StateTaxInput, StateTaxResult } from './interface';
import stateConfig from '../../../config/state-XX-2024.json';

export const yourState: StateModuleInterface = {
  stateCode: 'XX',
  stateName: 'Your State',
  hasIncomeTax: true,
  taxYear: 2024,

  compute(input: StateTaxInput): StateTaxResult {
    // 1. Start from federal AGI (or compute own gross income)
    let stateAGI = input.federalAGI;

    // 2. Apply state additions
    // e.g., add back interest from other states' bonds
    const additions = computeAdditions(input);
    stateAGI += additions;

    // 3. Apply state subtractions
    // e.g., subtract Social Security if state exempts it
    const subtractions = computeSubtractions(input);
    stateAGI -= subtractions;

    // 4. Apply deductions (standard or itemized)
    const deduction = computeStateDeduction(input, stateConfig);
    const exemptions = computeExemptions(input, stateConfig);
    const stateTaxableIncome = Math.max(0, stateAGI - deduction - exemptions);

    // 5. Compute tax from brackets
    const stateTax = computeStateBrackets(stateTaxableIncome, input.filingStatus, stateConfig);

    // 6. Apply credits
    const credits = computeStateCredits(input, stateTax, stateConfig);
    const taxAfterCredits = Math.max(0, stateTax - credits);

    // 7. Compute refund/owed
    const payments = input.stateWithheld + input.stateEstimatedPayments;
    const refundOrOwed = payments - taxAfterCredits;

    return {
      stateCode: 'XX',
      stateName: 'Your State',
      hasIncomeTax: true,
      stateAGI,
      stateAdjustments: additions - subtractions,
      stateTaxableIncome,
      stateTax,
      stateCredits: credits,
      stateTaxAfterCredits: taxAfterCredits,
      stateWithheld: input.stateWithheld,
      stateEstimatedPayments: input.stateEstimatedPayments,
      stateRefundOrOwed: refundOrOwed,
      effectiveRate: stateAGI > 0 ? taxAfterCredits / stateAGI : 0,
      formData: buildFormData(/* ... */),
      formId: 'xx-form-name',
    };
  }
};
```

### 4. Register the Module

In `src/engine/states/index.ts`, add:

```typescript
import { yourState } from './your-state';

// Add to the registry
const stateModules: Record<string, StateModuleInterface> = {
  // ... existing states
  'XX': yourState,
};
```

### 5. Write Tests

Create `tests/states/your-state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { yourState } from '../../src/engine/states/your-state';

describe('Your State Tax', () => {
  it('should compute basic tax correctly', () => { ... });
  it('should apply standard deduction', () => { ... });
  it('should exempt Social Security', () => { ... });
  it('should compute state EITC', () => { ... });
  it('should handle $0 income', () => { ... });
  it('should handle high income bracket', () => { ... });
});
```

Use examples from the state's form instructions as test cases.

### 6. Add PDF Field Map

If a fillable PDF is available:
1. Download the state form PDF
2. Run the field discovery script to get field names
3. Create `src/pdf/field-maps/state-XX.json`
4. Map your computed fields to PDF field names

### 7. Update Documentation

- Add the state to the supported states list in the main README
- Add any important notes about state-specific quirks
- Document known limitations

## Checklist

- [ ] Config file created with correct year's constants
- [ ] Module implements StateModuleInterface
- [ ] Module registered in index.ts
- [ ] Tests written covering basic cases, edge cases, and published examples
- [ ] PDF field map created (if fillable form available)
- [ ] README updated
- [ ] All tests passing

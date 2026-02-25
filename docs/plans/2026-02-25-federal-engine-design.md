# OpenTax Federal Engine Design — 2025 Tax Year

Date: 2026-02-25
Scope: Phase 1 (Foundation) + Phase 2 (Full Federal Tax Engine)
Tax Year: 2025 (with OBBBA changes)

## Goal

Build the complete federal tax computation engine as a pure TypeScript library with strict TDD, using real IRS 2025 figures. No UI, no PDF — just the math.

## Key Decisions

### Tax Year: 2025 (not 2024)

The original specs reference 2024 values. We target 2025, which includes changes from the One Big Beautiful Bill Act (OBBBA):
- CTC increased from $2,000 to $2,200 per child
- SALT cap raised from $10,000 to $40,000 with MAGI-based phase-down
- Standard deduction: $15,000 single / $30,000 MFJ
- SS wage base: $176,100
- All brackets inflation-adjusted

### Architecture

- Pure functions, no classes, no state
- All money in cents (integers)
- Config-driven: every threshold/rate/limit from `config/federal-2025.json`
- Sequential module build in dependency order
- Strict TDD: tests first, then implementation

### Type System

- String union types (no enums): `FilingStatus = 'single' | ...`
- `FederalConfig` type mirrors the JSON config structure
- No branded types for cents — convention enforced by tests
- `TaxInput` includes address/directDeposit for passthrough to forms.ts

### Module Dependency Chain

```
self-employment.ts → SE tax (needs only Schedule C data)
         ↓ half-SE deduction
income.ts → totalIncome, AGI
         ↓
deductions.ts → deduction amount (needs AGI)
         ↓
capital-gains.ts → net gain/loss, categorized (independent of AGI)
         ↓
brackets.ts → tax on ordinary + preferential income
         ↓
credits.ts → all credits (needs AGI, tax liability)
         ↓
amt.ts → AMT (needs taxable income, regular tax)
         ↓
niit.ts → NIIT (needs AGI, investment income)
         ↓
forms.ts → field maps for PDF generation
```

### SALT Cap (New for 2025)

The OBBBA SALT cap is no longer a simple constant. It requires:
- Base cap: $40,000 ($20,000 MFS)
- Phase-down: 30% per dollar of MAGI over $500,000 ($250,000 MFS)
- Floor: $10,000 ($5,000 MFS) at $600,000 MAGI ($300,000 MFS)

Implemented as `computeSaltCap(magi, filingStatus, config)` in deductions.ts.

### Testing Strategy

- Write tests first for every module
- Known-answer tests from IRS tax tables
- Boundary tests at bracket/phase-out edges
- Property-based tests (fast-check) for brackets: monotonicity, non-negativity
- Integration tests: 6 full-return scenarios
- Target: 95%+ coverage, 100% on brackets.ts

## 2025 Tax Constants (IRS.gov sourced)

### Brackets (Single)
10%: $0–$11,925 | 12%: $11,926–$48,475 | 22%: $48,476–$103,350
24%: $103,351–$197,300 | 32%: $197,301–$250,525 | 35%: $250,526–$626,350 | 37%: $626,351+

### Standard Deduction
Single: $15,000 | MFJ: $30,000 | MFS: $15,000 | HoH: $22,500
Additional 65+/blind: $2,000 (single/HoH) / $1,600 (married)

### Capital Gains (0%/15%/20% thresholds)
Single: $48,350 / $533,400 | MFJ: $96,700 / $600,050

### Key Limits
SS wage base: $176,100 | SALT cap: $40,000 (phased) | CTC: $2,200/child
EITC max (3+ kids): $8,046 | AMT exemption (single): $88,100

## Build Order

1. Project init (Vite + React-TS + deps)
2. `src/engine/types.ts`
3. `config/federal-2025.json`
4. `src/engine/federal/brackets.ts` + tests
5. `src/engine/federal/income.ts` + tests
6. `src/engine/federal/deductions.ts` + tests
7. `src/engine/federal/capital-gains.ts` + tests
8. `src/engine/federal/credits.ts` + tests
9. `src/engine/federal/self-employment.ts` + tests
10. `src/engine/federal/amt.ts` + tests
11. `src/engine/federal/niit.ts` + tests
12. `src/engine/federal/forms.ts` + tests
13. `src/engine/federal/index.ts` + integration tests
14. Final verification

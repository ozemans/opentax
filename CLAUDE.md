# CLAUDE.md — Instructions for Claude Code

## Project Overview

You are building **OpenTax**, a privacy-first, 100% client-side tax filing web application. Read all README files in this project before starting any implementation.

## Key Files to Read First

1. `README.md` — Project overview, architecture, tech stack
2. `TAX-VERIFICATION.md` — **MANDATORY** verification protocol for all tax constants (READ BEFORE ANY TAX WORK)
3. `src/engine/federal/README.md` — Federal tax engine specification (MOST IMPORTANT)
4. `src/engine/states/README.md` — State tax modules for 11 states
5. `src/ui/README.md` — Interview-style UI specification
6. `src/pdf/README.md` — PDF generation specification
7. `tests/README.md` — Testing strategy
8. `docs/ARCHITECTURE.md` — System architecture and data flow
9. `docs/PRIVACY.md` — Privacy guarantees and security model

## Build Order

Follow this implementation sequence:

### Phase 1: Foundation
1. Initialize the project: `npm create vite@latest . -- --template react-ts`
2. Install dependencies: `react`, `react-dom`, `pdf-lib`, `idb`, `tailwindcss`
3. Install dev deps: `vitest`, `@vitest/coverage-v8`, `fast-check`
4. Create `src/engine/types.ts` with ALL TypeScript interfaces from the federal README
5. Create config files: `config/federal-2024.json` with all tax constants (IN CENTS)

### Phase 2: Federal Tax Engine (Pure TypeScript, NO UI)
6. `src/engine/federal/brackets.ts` + `tests/federal/brackets.test.ts`
7. `src/engine/federal/income.ts` + tests
8. `src/engine/federal/deductions.ts` + tests
9. `src/engine/federal/capital-gains.ts` + tests
10. `src/engine/federal/credits.ts` + tests
11. `src/engine/federal/self-employment.ts` + tests
12. `src/engine/federal/amt.ts` + tests
13. `src/engine/federal/niit.ts` + tests
14. `src/engine/federal/forms.ts` (form field mapping)
15. `src/engine/federal/index.ts` (main computeFederalTax entry point)
16. Integration tests: full return scenarios

### Phase 3: State Tax Modules
17. `src/engine/states/interface.ts` (common interface)
18. Texas + Florida (no income tax — trivial, validates interface)
19. Pennsylvania + Illinois (flat tax)
20. New Hampshire (interest/dividends only for 2024, nothing for 2025+)
21. Virginia (simple graduated brackets)
22. Ohio (graduated with quirks)
23. Massachusetts (flat + short-term CG surcharge + millionaire surtax)
24. New Jersey (computes own gross income)
25. New York (graduated + NYC additional tax)
26. California (highest complexity — own brackets, CG as ordinary income, Mental Health Tax)
27. State config files for each

### Phase 4: UI
28. React app shell with routing (React Router)
29. `useTaxState.ts` hook (central state management with useReducer)
30. Interview flow pages: Welcome → Filing Status → Personal Info → Income → Adjustments → Deductions → Credits → State → Review → Results
31. `RefundTracker.tsx` — persistent component showing live refund/owed estimate
32. `CapitalGainsImport.tsx` — CSV upload + manual entry for 1099-B transactions
33. Responsive layout (mobile-first, Tailwind breakpoints)

### Phase 5: PDF Generation
34. Fetch IRS PDF templates and put them in `public/pdf-templates/`
35. Build field discovery script to enumerate PDF field names
36. Create field map JSON files in `src/pdf/field-maps/`
37. `src/pdf/generator.ts` — main PDF fill + merge logic using pdf-lib
38. Multi-page Form 8949 handling for many transactions
39. Combined PDF packet download (1040 + all needed schedules)

### Phase 6: Local Storage & Encryption
40. `useLocalStorage.ts` — auto-save to IndexedDB via `idb` library
41. `useEncryptedExport.ts` — AES-256-GCM encryption via WebCrypto API
42. Import/export .opentax files
43. "Clear all data" functionality

### Phase 7: Polish
44. Accessibility audit (keyboard nav, ARIA labels, screen reader)
45. Error handling and validation on all form inputs
46. Loading states and transitions
47. Help tooltips on every tax form field
48. Privacy badge component

## Critical Rules

### Money
- **ALL monetary values are integers in cents.** $50,000.00 = 5000000.
- **NEVER use floating point for money.** Use `Math.round()` when converting to dollars for display/forms.
- Rounding on IRS forms: round to nearest dollar (half-up).

### Architecture
- The tax engine is a **pure function**. No side effects, no DOM access, no network calls.
- The engine NEVER imports from `ui/`. Dependencies flow one way: types → engine → pdf → ui.
- State modules implement the common `StateModuleInterface`.
- All tax-year-specific constants live in config JSON files, not hardcoded in source.

### Testing
- Write tests BEFORE or alongside implementation (TDD preferred).
- Every tax computation function must have tests.
- Use IRS-published examples as test fixtures.
- Property-based tests for bracket math (monotonicity, non-negativity).
- Minimum 90% coverage on all engine modules.

### Privacy
- ZERO network requests with user data. The app is static files only.
- No third-party scripts. No analytics. No tracking.
- CSP headers: `connect-src 'none'` to enforce at browser level.
- No `eval()`, no dynamic script loading.

### Code Style
- TypeScript strict mode.
- Explicit types on all function signatures (no `any`).
- Descriptive variable names matching IRS terminology where possible.
- Comment complex tax logic with references to IRS form line numbers and publication sections.

## Common Pitfalls to Avoid

1. **Don't use floats for money.** Even $0.01 rounding errors compound across a tax return.
2. **Don't hardcode tax constants.** They change every year. Use config files.
3. **Don't forget the SALT cap** ($10,000 on state/local tax deductions).
4. **Don't forget that qualified dividends and LTCG have preferential rates** — they're NOT taxed at ordinary rates.
5. **Don't forget the $3,000 capital loss limitation** — excess carries forward.
6. **Don't forget half of SE tax is an above-the-line deduction** — it reduces AGI.
7. **Don't forget California taxes capital gains as ordinary income** — no preferential rates.
8. **Don't forget Massachusetts taxes short-term capital gains at 12%** — different from ordinary rate.
9. **Don't forget New Hampshire's I&D tax is repealed starting 2025.**
10. **Don't forget NYC residents pay BOTH NYS and NYC income tax.**

## Tax Constant Verification (MANDATORY)

**Before implementing or modifying ANY tax computation module, you MUST follow the protocol in `TAX-VERIFICATION.md`.** This is non-negotiable.

Summary of the protocol:
1. **FETCH** the authoritative IRS/state source document (use `curl` or `WebFetch`)
2. **EXTRACT** the relevant constants (brackets, thresholds, limits, rates)
3. **WRITE** them into config JSON with `_source` and `_verifiedDate` citations
4. **IMPLEMENT** the computation logic
5. **TEST** using IRS-published examples from the fetched instructions
6. **CROSS-CHECK** results against IRS tax tables or an online calculator

**Never use constants from training data. Always fetch and verify from the primary source.**

If a source cannot be fetched, flag the constant as `UNVERIFIED` in the config file with `_action_required: "Human must verify this value before release"`. Never ship unverified constants without flagging them.

See `TAX-VERIFICATION.md` for:
- Complete list of authoritative source URLs for every tax module
- Exact `curl` commands to fetch each data source
- Config file citation format with `_source` and `_verifiedDate` fields
- Test verification patterns using IRS-published examples
- Annual update checklist for new tax years

## Verification

After building each module, verify by:
1. Running the test suite: `npm run test`
2. Checking a simple scenario by hand against IRS tax tables
3. Comparing results against a known-good tax calculator (e.g., SmartAsset, TaxAct)

## Questions?

If any specification is unclear, refer to:
- `TAX-VERIFICATION.md` — verification protocol and authoritative source URLs
- The relevant README in that directory
- IRS Form Instructions (available at irs.gov/forms-instructions)
- State tax agency websites
- IRS Publication 17 (comprehensive individual tax guide)

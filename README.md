# OpenTax — Privacy-First, Client-Side Tax Filing

## Overview

OpenTax is a **100% client-side** web application for filing US federal and state income taxes. No tax data ever leaves the user's browser. The server hosts only static files — there is no backend, no database, no analytics capturing PII.

Think of it as a very sophisticated calculator that produces IRS-compliant PDFs.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 User's Browser                   │
│                                                  │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │  Interview   │  │   Tax Engine (TS lib)    │  │
│  │  UI (React)  │──│  - Federal computation   │  │
│  │              │  │  - State modules          │  │
│  │              │  │  - Capital gains engine   │  │
│  └─────────────┘  └──────────────────────────┘  │
│         │                    │                    │
│  ┌──────▼────────────────────▼──────────────┐   │
│  │        PDF Generator (pdf-lib)            │   │
│  │   Fills official IRS/state PDF forms      │   │
│  └───────────────────────────────────────────┘   │
│         │                                        │
│  ┌──────▼──────────────────────────────┐        │
│  │  Local Storage (IndexedDB)           │        │
│  │  + Encrypted file export (AES-256)   │        │
│  └──────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
        │
   Static hosting only (Cloudflare Pages / Vercel)
   Zero user data on server
```

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | React 18 + TypeScript | Vite for bundling |
| Tax Engine | Pure TypeScript library | Zero dependencies, fully testable |
| PDF | pdf-lib | Client-side, fills real IRS PDF templates |
| Local Storage | IndexedDB via idb | Structured tax data, never leaves browser |
| Encrypted Export | WebCrypto API (AES-256-GCM) | User-password-protected .opentax files |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Testing | Vitest | Unit + integration tests for tax math |
| Hosting | Cloudflare Pages | Free, global CDN, static only |

## Project Structure

```
opentax/
├── README.md                    # This file
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
│
├── config/
│   ├── federal-2024.json        # Federal tax constants (brackets, deductions, etc.)
│   ├── federal-2025.json
│   ├── state-ca-2024.json       # Per-state constants
│   ├── state-ny-2024.json
│   └── ...
│
├── src/
│   ├── engine/                  # Pure computation — NO UI dependencies
│   │   ├── federal/             # Federal tax computation
│   │   │   ├── README.md        # Detailed spec for federal engine
│   │   │   ├── income.ts        # AGI computation
│   │   │   ├── deductions.ts    # Standard vs itemized
│   │   │   ├── credits.ts       # All federal credits
│   │   │   ├── brackets.ts      # Tax bracket computation
│   │   │   ├── capital-gains.ts # Schedule D / Form 8949 logic
│   │   │   ├── self-employment.ts # Schedule C / SE
│   │   │   ├── amt.ts           # Alternative Minimum Tax
│   │   │   ├── niit.ts          # Net Investment Income Tax
│   │   │   ├── forms.ts         # Form field mapping (1040, schedules)
│   │   │   └── index.ts         # Main federal compute() entry point
│   │   │
│   │   ├── states/              # State tax modules
│   │   │   ├── README.md        # Detailed spec for state engines
│   │   │   ├── interface.ts     # Common state module interface
│   │   │   ├── california.ts
│   │   │   ├── new-york.ts
│   │   │   ├── new-jersey.ts
│   │   │   ├── pennsylvania.ts
│   │   │   ├── illinois.ts
│   │   │   ├── massachusetts.ts
│   │   │   ├── virginia.ts
│   │   │   ├── ohio.ts
│   │   │   ├── new-hampshire.ts
│   │   │   ├── texas.ts         # No income tax — flag only
│   │   │   ├── florida.ts       # No income tax — flag only
│   │   │   └── index.ts         # State module registry
│   │   │
│   │   ├── types.ts             # All TypeScript interfaces/types
│   │   └── index.ts             # Main TaxEngine.compute() entry point
│   │
│   ├── ui/                      # React UI layer
│   │   ├── README.md            # Detailed spec for UI
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Welcome.tsx
│   │   │   ├── FilingStatus.tsx
│   │   │   ├── Income.tsx
│   │   │   ├── W2Entry.tsx
│   │   │   ├── Investments.tsx
│   │   │   ├── CapitalGainsImport.tsx
│   │   │   ├── Deductions.tsx
│   │   │   ├── Credits.tsx
│   │   │   ├── StateSelection.tsx
│   │   │   ├── Review.tsx
│   │   │   └── Results.tsx
│   │   ├── components/
│   │   │   ├── InterviewNav.tsx
│   │   │   ├── RefundTracker.tsx  # Live refund/owed estimate
│   │   │   ├── FormField.tsx
│   │   │   ├── HelpTooltip.tsx
│   │   │   └── PrivacyBadge.tsx
│   │   └── hooks/
│   │       ├── useTaxState.ts    # Central tax data state
│   │       ├── useLocalStorage.ts
│   │       └── useEncryptedExport.ts
│   │
│   ├── pdf/                     # PDF generation
│   │   ├── README.md            # Detailed spec for PDF generation
│   │   ├── generator.ts         # Main PDF generation logic
│   │   ├── templates/           # IRS PDF form templates (downloaded at build)
│   │   └── field-maps/          # JSON mapping: our field names → PDF field coords
│   │       ├── f1040.json
│   │       ├── schedule-a.json
│   │       ├── schedule-b.json
│   │       ├── schedule-c.json
│   │       ├── schedule-d.json
│   │       ├── f8949.json
│   │       └── ...
│   │
│   └── utils/
│       ├── currency.ts          # Money math (use integers/cents, never floats)
│       ├── crypto.ts            # AES-256-GCM encrypt/decrypt for exports
│       ├── csv-import.ts        # Parse brokerage CSVs
│       └── validation.ts        # Input validation (SSN format, EIN, etc.)
│
├── tests/
│   ├── README.md                # Testing strategy and IRS scenario sources
│   ├── federal/
│   │   ├── brackets.test.ts
│   │   ├── standard-deduction.test.ts
│   │   ├── capital-gains.test.ts
│   │   ├── credits.test.ts
│   │   ├── amt.test.ts
│   │   └── integration.test.ts  # Full return scenarios from IRS publications
│   └── states/
│       ├── california.test.ts
│       ├── new-york.test.ts
│       └── ...
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── TAX-LOGIC.md             # Detailed tax computation reference
│   ├── ADDING-A-STATE.md        # Guide for contributors adding state modules
│   ├── PRIVACY.md               # Privacy architecture documentation
│   └── LEGAL-DISCLAIMER.md
│
└── public/
    ├── index.html
    └── pdf-templates/           # IRS PDF forms (fetched at build time)
```

## Key Design Principles

1. **Privacy by architecture** — not by policy. There is no server to breach.
2. **Tax engine is a pure function** — input data in, computed forms out. No side effects. Fully testable.
3. **Year-specific constants in config files** — updating for a new tax year is mostly data entry, not code changes.
4. **State modules are plug-ins** — each state implements a common interface. Easy to add new states.
5. **Money is always in cents (integers)** — never use floating point for currency.
6. **Every computation must have a test** — tax math errors are unacceptable.

## Getting Started (Development)

```bash
npm install
npm run dev          # Start dev server
npm run test         # Run all tests
npm run test:tax     # Run only tax computation tests
npm run build        # Production build
npm run pdf:fetch    # Download latest IRS PDF templates
```

## Supported Tax Situations (MVP → V3)

### MVP
- Filing status: Single, Married Filing Jointly
- W-2 income only
- Standard deduction
- Federal only
- PDF output

### V1
- All filing statuses (MFJ, MFS, HoH, QSS)
- 1099-INT, 1099-DIV income
- Capital gains (Schedule D, Form 8949)
- Itemized deductions (Schedule A)
- Priority states: CA, NY, NJ, PA, IL, MA, VA, OH, NH, TX, FL

### V2
- Self-employment (Schedule C, Schedule SE)
- Education credits
- Child Tax Credit, EITC
- Estimated tax payments
- Brokerage CSV import

### V3
- Crypto/prediction market transactions
- Multi-state returns
- Prior year loss carryforward
- Estimated tax penalty (Form 2210)
- Print-ready PDF packets with all schedules

## Legal Disclaimer

OpenTax is provided as-is for informational and educational purposes. It is NOT a substitute for professional tax advice. Users are responsible for verifying the accuracy of their tax returns. See docs/LEGAL-DISCLAIMER.md.

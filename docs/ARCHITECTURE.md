# Architecture Document

## System Architecture

OpenTax is a **static single-page application** with no backend. All tax computation, PDF generation, and data storage happen in the user's browser.

```
                    ┌─────────────────────────┐
                    │    Static File Host      │
                    │  (Cloudflare Pages)      │
                    │                          │
                    │  index.html              │
                    │  app.js (bundled React)   │
                    │  pdf-templates/*.pdf      │
                    │  config/*.json            │
                    │                          │
                    │  NO user data stored     │
                    │  NO database             │
                    │  NO API endpoints        │
                    └────────────┬────────────┘
                                 │
                         HTTPS (static files only)
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                        User's Browser                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    React Application                      │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │  Interview   │  │  Tax Engine   │  │  PDF Generator │  │   │
│  │  │  UI (React)  │──│  (TypeScript) │──│  (pdf-lib)     │  │   │
│  │  │              │  │              │  │                │  │   │
│  │  │  - Pages     │  │  - Federal   │  │  - Fill forms  │  │   │
│  │  │  - Forms     │  │  - States    │  │  - Merge PDFs  │  │   │
│  │  │  - Tracker   │  │  - Cap Gains │  │  - Download    │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  │         │                │                   │            │   │
│  │         ▼                ▼                   ▼            │   │
│  │  ┌─────────────────────────────────────────────────┐     │   │
│  │  │              State Management                    │     │   │
│  │  │  React Context + useReducer                      │     │   │
│  │  │  (central TaxState object)                       │     │   │
│  │  └──────────┬──────────────────────┬───────────┘     │   │
│  │             │                      │                  │   │
│  │    ┌────────▼────────┐    ┌───────▼──────────┐       │   │
│  │    │   IndexedDB      │    │  Encrypted Export │       │   │
│  │    │   (auto-save)    │    │  (.opentax file)  │       │   │
│  │    │                  │    │  AES-256-GCM      │       │   │
│  │    └──────────────────┘    └──────────────────┘       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Nothing leaves this box. No network requests with user data.    │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Input → TaxState (React Context)
                ↓ (on every change, debounced 300ms)
          Tax Engine computes
                ↓
          TaxResult object
           ↙         ↘
    UI Updates      Form Field Maps
    (refund tracker,    ↓
     review page)   PDF Generator
                        ↓
                   Download PDF
```

## Module Dependency Graph

```
types.ts (shared interfaces — NO dependencies)
    ↑
config/*.json (tax constants — NO code dependencies)
    ↑
engine/federal/*.ts (pure computation — depends only on types + config)
    ↑
engine/states/*.ts (pure computation — depends on types + config + federal AGI)
    ↑
pdf/generator.ts (depends on engine output types)
    ↑
ui/ (depends on engine + pdf — ONLY layer that touches the DOM)
```

**Rule:** Dependencies flow upward only. The engine NEVER imports from ui/. The pdf module NEVER imports from ui/. This keeps the engine testable in isolation.

## Security Model

### Threat Model

Since no data leaves the browser, the primary threats are:
1. **Supply chain attacks** — malicious npm packages
2. **XSS** — if we ever add any dynamic content loading
3. **Browser storage exposure** — if someone gains physical access to the device

### Mitigations

1. **Minimal dependencies.** The tax engine has ZERO npm dependencies. UI uses React + Tailwind. PDF uses pdf-lib. That's it.
2. **Content Security Policy** headers via Cloudflare Pages:
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
   ```
3. **No eval(), no dynamic script loading, no inline scripts.**
4. **Encrypted export** uses WebCrypto API (PBKDF2 + AES-256-GCM) — browser-native, audited crypto.
5. **Auto-clear option** — user can configure auto-wipe of IndexedDB after export.
6. **Subresource Integrity (SRI)** on all script tags.
7. **No third-party scripts.** No Google Analytics, no tracking pixels, no CDN-loaded libraries (everything bundled).

## Performance Targets

| Operation | Target |
|-----------|--------|
| Tax computation (full federal + 1 state) | < 50ms |
| PDF generation (1040 + 3 schedules) | < 2 seconds |
| Page load (first paint) | < 1.5 seconds |
| CSV import (1,000 transactions) | < 500ms |
| Encrypted export | < 1 second |

The tax engine operates on simple arithmetic over arrays of objects. It should be extremely fast. If it isn't, profile and optimize — never sacrifice correctness for speed.

## Deployment

```bash
npm run build    # Produces dist/ folder with static files
# Deploy dist/ to Cloudflare Pages, Vercel, Netlify, or GitHub Pages
```

No environment variables. No secrets. No build-time configuration beyond the tax year config files. The entire app is a folder of static files.

## Year-Over-Year Updates

Each tax year requires:
1. New config files (`config/federal-YYYY.json`, `config/state-XX-YYYY.json`)
2. Updated PDF templates (IRS publishes new forms each November-December)
3. Updated field maps (PDF field names may change between years)
4. Code changes only if tax law introduces new concepts (e.g., a new credit)

Target: **80% of year-over-year updates are config/data only, not code changes.**

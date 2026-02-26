# TAX-VERIFICATION.md — Self-Verification Protocol for Claude Code

## Overview

Claude Code has network access and can fetch pages from IRS.gov and state tax agency websites. This document establishes a **mandatory verification protocol**: before implementing any tax computation module, Claude Code MUST fetch the authoritative source, extract the correct constants, and embed them in config files with source citations.

**Rule: Never use constants from training data. Always fetch and verify from the primary source.**

---

## Verification Workflow

For EVERY tax module, Claude Code must follow this sequence:

```
1. FETCH the authoritative IRS/state source document
2. EXTRACT the relevant constants (brackets, thresholds, limits, rates)
3. WRITE them into the config JSON file with source citations
4. IMPLEMENT the computation logic
5. WRITE tests using IRS-published examples from the fetched instructions
6. CROSS-CHECK results against the IRS tax tables or an online calculator
```

Never skip steps 1–3. Never assume constants from memory.

---

## How to Fetch and Verify

Claude Code can use `curl` or `wget` to fetch web pages, and can parse HTML/text output. Use these patterns:

### Fetching IRS Pages

```bash
# Fetch an IRS newsroom page for inflation adjustments
curl -s "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' | head -300

# Fetch IRS form instructions (PDF → extract text)
curl -s -o /tmp/i1040gi.pdf "https://www.irs.gov/pub/irs-pdf/i1040gi.pdf"
pdftotext /tmp/i1040gi.pdf /tmp/i1040gi.txt
grep -A5 "Tax Rate Schedule" /tmp/i1040gi.txt

# Fetch a specific tax topic page
curl -s "https://www.irs.gov/taxtopics/tc409" | sed 's/<[^>]*>//g' | tr -s ' \n'

# Fetch Social Security wage base from SSA
curl -s "https://www.ssa.gov/oact/cola/cbb.html" | sed 's/<[^>]*>//g' | grep -i "2025"

# Fetch state tax info
curl -s "https://www.ftb.ca.gov/file/personal/tax-rates.html" | sed 's/<[^>]*>//g' | tr -s ' \n'
```

### Fetching IRS PDF Form Instructions

Many IRS constants live in form instruction PDFs. Claude Code should:

```bash
# Download form instructions
curl -s -o /tmp/instructions.pdf "https://www.irs.gov/pub/irs-pdf/i1040gi.pdf"

# Convert to text (pdftotext is available in most Linux environments)
# If pdftotext isn't available: pip install pdfminer.six && python -m pdfminer.six /tmp/instructions.pdf
pdftotext /tmp/instructions.pdf /tmp/instructions.txt

# Search for specific constants
grep -i -A10 "standard deduction" /tmp/instructions.txt
grep -i -A20 "tax rate schedule" /tmp/instructions.txt
grep -i -A10 "earned income credit" /tmp/instructions.txt
```

### Cross-Checking Against Tax Tables

The IRS publishes tax computation worksheets in the 1040 instructions. After implementing bracket math, verify:

```bash
# Fetch the tax table from 1040 instructions
curl -s -o /tmp/i1040tt.pdf "https://www.irs.gov/pub/irs-pdf/i1040tt.pdf"
pdftotext /tmp/i1040tt.pdf /tmp/taxtable.txt

# Look up specific income amounts to compare against your computation
# Example: What's the tax on $50,000 taxable income, single?
grep -A2 "50,000" /tmp/taxtable.txt
```

### Cross-Checking Against Online Calculators

As a secondary verification, Claude Code can fetch results from tax calculators:

```bash
# SmartAsset income tax calculator (parse the page for results)
curl -s "https://smartasset.com/taxes/income-taxes" | sed 's/<[^>]*>//g' | head -200

# NerdWallet tax calculator
curl -s "https://www.nerdwallet.com/taxes/tax-calculator" | sed 's/<[^>]*>//g' | head -200
```

Note: Online calculators are secondary sources. Always trust IRS publications over third-party calculators. Use calculators only as a sanity check.

---

## Authoritative Sources — Complete Reference

### Federal Tax Constants

| Topic | Primary Source URL | What to Extract |
|-------|-------------------|-----------------|
| **Brackets, standard deduction, personal exemption** | `https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025` | All 7 bracket thresholds × 5 filing statuses, standard deduction amounts, additional amounts for age/blind |
| **Same for 2024** | `https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2024` | Same as above for prior year |
| **Capital gains rate thresholds** | `https://www.irs.gov/taxtopics/tc409` + Schedule D instructions | 0%/15%/20% threshold amounts by filing status |
| **EITC tables** | `https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit/earned-income-and-earned-income-tax-credit-eitc-tables` | Phase-in/plateau/phase-out ranges, max credit by # of children, investment income limit |
| **Child Tax Credit** | `https://www.irs.gov/credits-deductions/individuals/child-tax-credit` | Credit amount, refundable portion, phase-out thresholds |
| **AMT exemptions and rates** | `https://www.irs.gov/taxtopics/tc556` + Form 6251 instructions (`https://www.irs.gov/pub/irs-pdf/i6251.pdf`) | Exemption amounts, phase-out thresholds, 26%/28% breakpoint |
| **Social Security wage base** | `https://www.ssa.gov/oact/cola/cbb.html` | Contribution and benefit base for target year |
| **Additional Medicare Tax thresholds** | `https://www.irs.gov/businesses/small-businesses-self-employed/questions-and-answers-for-the-additional-medicare-tax` | $200k/$250k thresholds (not inflation-adjusted) |
| **NIIT thresholds** | `https://www.irs.gov/individuals/net-investment-income-tax` | $200k/$250k thresholds (not inflation-adjusted) |
| **Self-employment tax** | `https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes` | 92.35% factor, SS rate, Medicare rate |
| **HSA contribution limits** | `https://www.irs.gov/publications/p969` | Self-only and family limits, catch-up amount, HDHP minimum deductible |
| **Section 199A QBI thresholds** | `https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025` (same page as brackets) | Taxable income thresholds for QBI phase-out |
| **SALT cap** | Confirm $10,000 / $5,000 MFS is still in effect (check for any legislative changes) | Static unless Congress changes it |
| **Education credits** | `https://www.irs.gov/credits-deductions/individuals/education-credits-aotc-llc` | AOC/LLC max amounts, phase-out ranges |
| **Saver's credit** | `https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-savings-contributions-savers-credit` | Income limits by filing status, credit percentages |
| **Estimated tax penalty** | `https://www.irs.gov/taxtopics/tc306` + Form 2210 instructions | Safe harbor thresholds (90% current / 100% prior / 110% high income) |
| **Energy credits** | `https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit` and `https://www.irs.gov/credits-deductions/credits-for-new-clean-vehicles-purchased-in-2023-or-after` | Annual caps, per-item limits, income limits, MSRP caps |
| **Premium Tax Credit** | `https://www.irs.gov/affordable-care-act/individuals-and-families/premium-tax-credit` + Form 8962 instructions | FPL amounts, applicable percentage table, repayment caps |
| **1040 form instructions** | `https://www.irs.gov/pub/irs-pdf/i1040gi.pdf` | Tax computation worksheets, qualified dividends worksheet, EITC worksheet |

### State Tax Sources

| State | Tax Rate Source | Form Instructions |
|-------|----------------|-------------------|
| **California** | `https://www.ftb.ca.gov/file/personal/tax-rates.html` | `https://www.ftb.ca.gov/forms/search/index.aspx` → 540 Booklet |
| **New York** | `https://www.tax.ny.gov/pit/file/tax_tables.htm` | `https://www.tax.ny.gov/forms/income_cur_forms.htm` → IT-201 Instructions |
| **New Jersey** | `https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf` | NJ-1040 instructions (same PDF) |
| **Pennsylvania** | `https://www.revenue.pa.gov/TaxTypes/PIT/Pages/default.aspx` | PA-40 instructions |
| **Illinois** | `https://tax.illinois.gov/forms/incometax/individual.html` | IL-1040 instructions |
| **Massachusetts** | `https://www.mass.gov/info-details/massachusetts-personal-income-tax-rates` | Form 1 instructions |
| **Virginia** | `https://www.tax.virginia.gov/individual-income-tax` | Form 760 instructions |
| **Ohio** | `https://tax.ohio.gov/individual/resources/annual-tax-rates` | IT 1040 instructions |
| **New Hampshire** | `https://www.revenue.nh.gov/forms/interest-dividends-tax.htm` | Confirm I&D tax repeal for 2025 |
| **NYC tax rates** | `https://www.tax.ny.gov/pit/file/tax_tables.htm` (NYC section) | IT-201 instructions, NYC section |

### Verification Commands by Module

Here are the exact commands Claude Code should run before implementing each module:

#### Before implementing brackets.ts:
```bash
echo "=== FETCHING 2025 FEDERAL TAX BRACKETS ==="
curl -sL "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' | \
  grep -i -A50 "marginal rates"

echo "=== FETCHING STANDARD DEDUCTION ==="
curl -sL "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' | \
  grep -i -A10 "standard deduction"
```

#### Before implementing capital-gains.ts:
```bash
echo "=== FETCHING CAPITAL GAINS RATE THRESHOLDS ==="
curl -sL "https://www.irs.gov/taxtopics/tc409" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' | \
  grep -i -A30 "capital gains rate"

echo "=== FETCHING SCHEDULE D INSTRUCTIONS ==="
curl -s -o /tmp/i1040sd.pdf "https://www.irs.gov/pub/irs-pdf/i1040sd.pdf"
pdftotext /tmp/i1040sd.pdf /tmp/sched_d.txt 2>/dev/null
grep -i -A20 "28% Rate Gain" /tmp/sched_d.txt
```

#### Before implementing credits.ts:
```bash
echo "=== FETCHING EITC TABLES ==="
curl -sL "https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit/earned-income-and-earned-income-tax-credit-eitc-tables" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' | \
  grep -i -A50 "maximum credit"

echo "=== FETCHING CTC INFO ==="
curl -sL "https://www.irs.gov/credits-deductions/individuals/child-tax-credit" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' | \
  grep -i -A20 "2025"
```

#### Before implementing state modules:
```bash
echo "=== FETCHING CALIFORNIA TAX RATES ==="
curl -sL "https://www.ftb.ca.gov/file/personal/tax-rates.html" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' | \
  grep -i -A50 "tax rate schedule"

echo "=== FETCHING NEW YORK TAX RATES ==="
curl -sL "https://www.tax.ny.gov/pit/file/tax_tables.htm" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' | \
  grep -i -A30 "rate"

echo "=== CONFIRMING NH I&D TAX REPEAL ==="
curl -sL "https://www.revenue.nh.gov/forms/interest-dividends-tax.htm" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' | \
  grep -i -A10 "repeal\|2025\|no longer"
```

#### Before implementing AMT:
```bash
echo "=== FETCHING AMT EXEMPTION AMOUNTS ==="
curl -sL "https://www.irs.gov/taxtopics/tc556" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' | \
  grep -i -A20 "exemption"

echo "=== FETCHING FORM 6251 INSTRUCTIONS ==="
curl -s -o /tmp/i6251.pdf "https://www.irs.gov/pub/irs-pdf/i6251.pdf"
pdftotext /tmp/i6251.pdf /tmp/i6251.txt 2>/dev/null
grep -i -A10 "exemption amount" /tmp/i6251.txt
```

#### Before implementing Social Security / Medicare:
```bash
echo "=== FETCHING SS WAGE BASE ==="
curl -sL "https://www.ssa.gov/oact/cola/cbb.html" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' | \
  grep -i -A5 "2025"
```

---

## Config File Citation Format

Every constant in a config file MUST include a source citation. Use this format:

```json
{
  "taxYear": 2025,
  "_source": "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025",
  "_verifiedDate": "2026-02-25",
  "_notes": "Revenue Procedure 2024-40",

  "standardDeduction": {
    "_source": "Same as above, 'Standard Deduction' section",
    "single": 1520000,
    "married_filing_jointly": 3040000,
    "married_filing_separately": 1520000,
    "head_of_household": 2280000,
    "qualifying_surviving_spouse": 3040000
  },

  "brackets": {
    "_source": "Same as above, 'Marginal Rates' section",
    "single": [
      { "min": 0, "max": 1183500, "rate": 0.10 },
      { "min": 1183500, "max": 4812500, "rate": 0.12 }
    ]
  }
}
```

**The `_source` and `_verifiedDate` fields serve two purposes:**
1. They document where the number came from (audit trail)
2. They tell future maintainers where to re-fetch when updating for next year

---

## Test Verification Protocol

After implementing each module, Claude Code must verify results against IRS-published examples.

### Where to Find IRS Examples

```bash
# 1040 General Instructions (contains worked examples)
curl -s -o /tmp/i1040gi.pdf "https://www.irs.gov/pub/irs-pdf/i1040gi.pdf"
pdftotext /tmp/i1040gi.pdf /tmp/i1040gi.txt

# Publication 17 — Your Federal Income Tax (comprehensive examples)
curl -s -o /tmp/p17.pdf "https://www.irs.gov/pub/irs-pdf/p17.pdf"
pdftotext /tmp/p17.pdf /tmp/p17.txt

# Publication 505 — Tax Withholding and Estimated Tax
curl -s -o /tmp/p505.pdf "https://www.irs.gov/pub/irs-pdf/p505.pdf"
pdftotext /tmp/p505.pdf /tmp/p505.txt

# Publication 596 — EITC (detailed examples)
curl -s -o /tmp/p596.pdf "https://www.irs.gov/pub/irs-pdf/p596.pdf"
pdftotext /tmp/p596.pdf /tmp/p596.txt

# Specific form instructions (replace XXXX with form number)
curl -s -o /tmp/iXXXX.pdf "https://www.irs.gov/pub/irs-pdf/iXXXX.pdf"
```

### Verification Test Pattern

For each module, write at least one test that reproduces an IRS-published example:

```typescript
describe('IRS Publication Verification', () => {
  it('matches IRS 2025 Tax Table for $50,000 single filer', () => {
    // Source: 2025 Form 1040 Tax Table, page XX
    // Verified from: https://www.irs.gov/pub/irs-pdf/i1040tt.pdf
    const result = computeOrdinaryTax(5000000, 'single', config2025);
    
    // IRS table says tax on $50,000 single = $X,XXX
    // Allow $1 rounding tolerance (IRS tables round to nearest dollar)
    expect(Math.abs(result - EXPECTED_FROM_IRS)).toBeLessThanOrEqual(100); // 100 cents = $1
  });

  it('matches IRS EITC table for qualifying scenario', () => {
    // Source: Publication 596, Example X
    // Single, 2 qualifying children, earned income $20,000
    // Expected EITC from table: $X,XXX
  });
});
```

---

## Annual Update Checklist

When updating OpenTax for a new tax year (e.g., 2025 → 2026), Claude Code should:

### Step 1: Fetch all new constants
```bash
# Replace YYYY with new tax year
echo "=== FETCHING FEDERAL CONSTANTS FOR TAX YEAR YYYY ==="
curl -sL "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-YYYY" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' > /tmp/federal_adjustments.txt

echo "=== FETCHING NEW SS WAGE BASE ==="
curl -sL "https://www.ssa.gov/oact/cola/cbb.html" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' | grep "YYYY"

echo "=== FETCHING NEW EITC TABLES ==="
curl -sL "https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit/earned-income-and-earned-income-tax-credit-eitc-tables" | \
  sed 's/<[^>]*>//g' | tr -s ' \n' > /tmp/eitc_tables.txt

# Repeat for each state...
```

### Step 2: Create new config files
```bash
# Copy prior year as starting point
cp config/federal-2025.json config/federal-2026.json
# Then update all constants from fetched sources
```

### Step 3: Update and re-run all tests
```bash
# Update expected values in tests based on new constants
npm run test
```

### Step 4: Fetch updated PDF form templates
```bash
# IRS typically publishes new forms in November-December
# Check https://www.irs.gov/forms-pubs for current year forms
curl -s -o public/pdf-templates/f1040.pdf "https://www.irs.gov/pub/irs-pdf/f1040.pdf"
curl -s -o public/pdf-templates/f1040s1.pdf "https://www.irs.gov/pub/irs-pdf/f1040s1.pdf"
# ... etc for all forms
```

### Step 5: Check for legislative changes
```bash
# Search for any new tax law changes
curl -sL "https://www.irs.gov/newsroom" | sed 's/<[^>]*>//g' | grep -i "tax changes\|new law\|tax reform" | head -20
```

---

## Handling Fetch Failures

If a URL returns an error or the page structure has changed:

1. Try the IRS sitemap: `https://www.irs.gov/sitemap`
2. Try the IRS forms/publications page: `https://www.irs.gov/forms-pubs`
3. Try the IRS newsroom archive: `https://www.irs.gov/newsroom`
4. Download the PDF form instructions directly (these are the most stable URLs): `https://www.irs.gov/pub/irs-pdf/i{formname}.pdf`
5. If all else fails, flag the constant as UNVERIFIED in the config file:

```json
{
  "standardDeduction": {
    "_source": "UNVERIFIED — could not fetch from IRS.gov on 2026-02-25",
    "_action_required": "Human must verify this value before release",
    "single": 1520000
  }
}
```

**Never ship unverified constants without flagging them.**

---

## Pre-Implementation Checklist

Before Claude Code writes ANY computation code for a module, it must confirm:

- [ ] Fetched the authoritative IRS/state source
- [ ] Extracted all relevant constants for the target tax year
- [ ] Written constants into config JSON with `_source` and `_verifiedDate`
- [ ] Flagged any constants it could not verify as `UNVERIFIED`
- [ ] Downloaded the relevant form instructions PDF
- [ ] Identified at least one IRS-published example for test verification
- [ ] Written a test that reproduces that example

Only after all boxes are checked should implementation proceed.

---

## Quick Reference: IRS PDF URL Patterns

IRS PDFs follow a consistent URL pattern:

```
Form:         https://www.irs.gov/pub/irs-pdf/f{number}.pdf
Instructions: https://www.irs.gov/pub/irs-pdf/i{number}.pdf
Publication:  https://www.irs.gov/pub/irs-pdf/p{number}.pdf
Schedule:     https://www.irs.gov/pub/irs-pdf/f1040s{letter}.pdf
```

Examples:
```
Form 1040:          https://www.irs.gov/pub/irs-pdf/f1040.pdf
1040 Instructions:  https://www.irs.gov/pub/irs-pdf/i1040gi.pdf
1040 Tax Table:     https://www.irs.gov/pub/irs-pdf/i1040tt.pdf
Schedule A:         https://www.irs.gov/pub/irs-pdf/f1040sa.pdf
Schedule D:         https://www.irs.gov/pub/irs-pdf/f1040sd.pdf
Schedule D Instr:   https://www.irs.gov/pub/irs-pdf/i1040sd.pdf
Form 8949:          https://www.irs.gov/pub/irs-pdf/f8949.pdf
Publication 17:     https://www.irs.gov/pub/irs-pdf/p17.pdf
Publication 596:    https://www.irs.gov/pub/irs-pdf/p596.pdf
```

These URLs update in-place each year when new forms are published (usually November–January). Prior year forms move to: `https://www.irs.gov/pub/irs-prior/f{number}--{year}.pdf`

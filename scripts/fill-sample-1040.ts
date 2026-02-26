// Fill a sample Form 1040 with the Wilson family data.
// Usage: npx tsx scripts/fill-sample-1040.ts

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { computeFederalTax } from '../src/engine/federal/index';
import { generateFormMappings } from '../src/engine/federal/forms';
import { getFieldMap } from '../src/pdf/field-maps/index';
import type { TaxInput, FederalConfig } from '../src/engine/types';

import federalConfig from '../config/federal-2025.json';

const config = federalConfig as unknown as FederalConfig;

const ROOT = join(__dirname, '..');
const TEMPLATE_DIR = join(ROOT, 'public/pdf-templates');

// --- Sample taxpayer: The Wilson Family ---
const input: TaxInput = {
  taxYear: 2025,
  filingStatus: 'married_filing_jointly',
  taxpayer: {
    firstName: 'James',
    lastName: 'Wilson',
    ssn: '412687593',
    dateOfBirth: '1982-04-15',
  },
  spouse: {
    firstName: 'Sarah',
    lastName: 'Wilson',
    ssn: '523798641',
    dateOfBirth: '1984-09-22',
  },
  dependents: [
    {
      firstName: 'Emma',
      lastName: 'Wilson',
      ssn: '634819752',
      dateOfBirth: '2015-06-10',
      relationship: 'daughter',
      qualifiesForCTC: true,
    },
    {
      firstName: 'Liam',
      lastName: 'Wilson',
      ssn: '745920863',
      dateOfBirth: '2018-01-28',
      relationship: 'son',
      qualifiesForCTC: true,
    },
  ],
  address: {
    street: '742 Evergreen Terrace',
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
  },
  w2s: [
    {
      employerEIN: '36-1234567',
      employerName: 'Springfield Nuclear Power Plant',
      wages: 9_500_000,            // $95,000
      federalWithheld: 1_100_000,  // $11,000
      socialSecurityWages: 9_500_000,
      socialSecurityWithheld: 589_000,
      medicareWages: 9_500_000,
      medicareWithheld: 137_750,
      stateWages: 9_500_000,
      stateWithheld: 450_000,
      stateCode: 'IL',
    },
    {
      employerEIN: '36-7654321',
      employerName: 'Springfield Elementary PTA',
      wages: 3_200_000,           // $32,000
      federalWithheld: 280_000,   // $2,800
      socialSecurityWages: 3_200_000,
      socialSecurityWithheld: 198_400,
      medicareWages: 3_200_000,
      medicareWithheld: 46_400,
      stateWages: 3_200_000,
      stateWithheld: 150_000,
      stateCode: 'IL',
    },
  ],
  form1099INTs: [
    { payerName: 'First National Bank', interest: 85_000 },  // $850
  ],
  form1099DIVs: [
    { payerName: 'Vanguard S&P 500', ordinaryDividends: 120_000, qualifiedDividends: 95_000 },
  ],
  form1099Bs: [],
  form1099NECs: [],
  form1099Gs: [],
  form1099Rs: [],
  form1099Ks: [],
  estimatedTaxPayments: 0,
  useItemizedDeductions: false,
  stateOfResidence: 'IL',
};

async function main() {
  const result = computeFederalTax(input, config);
  const forms = generateFormMappings(input, result);

  const fmt = (cents: number) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 });

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     2025 Federal Tax Return — Form 1040      ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('Taxpayer:    James & Sarah Wilson (MFJ)');
  console.log('Address:     742 Evergreen Terrace, Springfield, IL 62704');
  console.log('Dependents:  Emma (10), Liam (7)');
  console.log('');
  console.log('─── Income ───────────────────────────────────');
  console.log(`  Line 1   Wages (2 W-2s):      ${fmt(result.incomeBreakdown.wages)}`);
  console.log(`  Line 2b  Taxable interest:     ${fmt(result.incomeBreakdown.interest)}`);
  console.log(`  Line 3a  Qualified dividends:  ${fmt(result.incomeBreakdown.qualifiedDividends)}`);
  console.log(`  Line 3b  Ordinary dividends:   ${fmt(result.incomeBreakdown.ordinaryDividends)}`);
  console.log(`  Line 9   Total income:         ${fmt(result.totalIncome)}`);
  console.log(`  Line 11  AGI:                  ${fmt(result.adjustedGrossIncome)}`);
  console.log('');
  console.log('─── Deductions ───────────────────────────────');
  console.log(`  Line 12  ${result.deductionBreakdown.type} deduction: ${fmt(result.deductionBreakdown.amount)}`);
  console.log(`  Line 15  Taxable income:       ${fmt(result.taxableIncome)}`);
  console.log('');
  console.log('─── Tax ──────────────────────────────────────');
  console.log(`  Line 16  Tax:                  ${fmt(result.taxBreakdown.ordinaryIncomeTax + result.taxBreakdown.capitalGainsTax)}`);
  console.log(`  Line 19  Nonrefundable credits: ${fmt(result.creditBreakdown.childTaxCredit + result.creditBreakdown.otherDependentCredit)}`);
  console.log(`  Line 24  Total tax:            ${fmt(result.totalTax)}`);
  console.log('');
  console.log('─── Credits ──────────────────────────────────');
  console.log(`  Child Tax Credit:              ${fmt(result.creditBreakdown.childTaxCredit)}`);
  console.log(`  Additional CTC:                ${fmt(result.creditBreakdown.additionalChildTaxCredit)}`);
  console.log('');
  console.log('─── Payments ─────────────────────────────────');
  console.log(`  Line 25  Withholding:          ${fmt(result.totalPayments)}`);
  console.log(`  Line 27  EITC:                 ${fmt(result.creditBreakdown.earnedIncomeCredit)}`);
  console.log(`  Line 28  Additional CTC:       ${fmt(result.creditBreakdown.additionalChildTaxCredit)}`);

  const refund = result.refundOrOwed;
  console.log('');
  if (refund > 0) {
    console.log(`  ▶ Line 34  REFUND:            ${fmt(refund)}`);
  } else {
    console.log(`  ▶ Line 37  AMOUNT OWED:       ${fmt(Math.abs(refund))}`);
  }
  console.log('');
  console.log(`  Effective rate: ${result.effectiveTaxRate}%    Marginal rate: ${result.marginalTaxRate}%`);

  // ── Fill the PDF ──
  const templateBytes = new Uint8Array(readFileSync(join(TEMPLATE_DIR, 'f1040.pdf')));
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const fieldMap = getFieldMap('f1040');

  let filled = 0;
  let warnings: string[] = [];
  for (const [engineField, value] of Object.entries(forms.f1040)) {
    const mapping = fieldMap[engineField];
    if (!mapping) continue;

    const displayValue = mapping.transform ? mapping.transform(value) : String(value);

    try {
      const pdfField = form.getField(mapping.pdfFieldName);
      if (mapping.type === 'text' && pdfField instanceof PDFTextField) {
        pdfField.setText(displayValue);
        filled++;
      } else if (mapping.type === 'checkbox' && pdfField instanceof PDFCheckBox) {
        if (displayValue === 'X' || displayValue === 'true' || displayValue === '1') {
          pdfField.check();
        }
        filled++;
      }
    } catch {
      warnings.push(engineField);
    }
  }

  console.log('');
  console.log('─── PDF Generation ───────────────────────────');
  console.log(`  Fields filled: ${filled}`);
  if (warnings.length > 0) {
    console.log(`  Warnings: ${warnings.join(', ')}`);
  }

  const outPath = join(ROOT, 'wilson-family-1040.pdf');
  const pdfBytes = await pdfDoc.save();
  writeFileSync(outPath, pdfBytes);
  console.log(`  Saved to: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });

// PDF Verification Integration Tests
//
// End-to-end tests that compute taxes for specific scenarios, generate form
// mappings, fill real IRS PDF templates, and verify the filled field values
// match IRS instructions.
//
// These tests don't just check that PDFs generate — they verify correctness
// of the data written to each form line.
//
// All monetary values in the engine are CENTS. Form mappings convert to DOLLARS
// via toDollars() (Math.round(cents / 100)).

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';

import { computeFullReturn, computeFederalTax } from '../../src/engine/index';
import { generateFormMappings } from '../../src/engine/federal/forms';
import { fillForm } from '../../src/pdf/fill';
import { getFieldMap } from '../../src/pdf/field-maps/index';
import type { TaxInput, TaxResult, FederalConfig } from '../../src/engine/types';
import type { FormId, TemplateLoader } from '../../src/pdf/types';

import federalConfig from '../../config/federal-2025.json';

const config = federalConfig as unknown as FederalConfig;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMPLATE_DIR = join(__dirname, '../../public/pdf-templates');

/** Map FormId to filename (mirrors template-loader.ts). */
const formFilenames: Record<string, string> = {
  f1040: 'f1040',
  schedule1: 'schedule-1',
  schedule2: 'schedule-2',
  schedule3: 'schedule-3',
  scheduleA: 'schedule-a',
  scheduleB: 'schedule-b',
  scheduleC: 'schedule-c',
  scheduleD: 'schedule-d',
  scheduleSE: 'schedule-se',
  f8949: 'f8949',
  f8959: 'f8959',
  f8960: 'f8960',
  it201: 'it-201',
  ftb540: 'ftb540',
  va760: 'va760',
  il1040: 'il1040',
  pa40: 'pa40',
  nj1040: 'nj1040',
  maForm1: 'ma-form1',
};

/** File-based template loader for Node.js test environment. */
const fileTemplateLoader: TemplateLoader = async (formId: FormId): Promise<Uint8Array> => {
  const filename = formFilenames[formId];
  if (!filename) throw new Error(`Unknown form ID: ${formId}`);
  const path = join(TEMPLATE_DIR, `${filename}.pdf`);
  return new Uint8Array(readFileSync(path));
};

/** Create a minimal TaxInput with sensible defaults. */
function makeInput(overrides: Partial<TaxInput> = {}): TaxInput {
  return {
    taxYear: 2025,
    filingStatus: 'single',
    taxpayer: {
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
    },
    dependents: [],
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '90210',
    },
    w2s: [],
    form1099INTs: [],
    form1099DIVs: [],
    form1099Bs: [],
    form1099NECs: [],
    form1099Gs: [],
    form1099Rs: [],
    form1099Ks: [],
    estimatedTaxPayments: 0,
    useItemizedDeductions: false,
    stateOfResidence: 'CA',
    ...overrides,
  };
}

/**
 * Fill a real PDF template WITHOUT flattening so we can read back field values.
 * Returns the loaded PDFDocument for field inspection.
 */
async function fillAndReadBack(
  formId: FormId,
  fields: Record<string, string | number>,
): Promise<PDFDocument> {
  const templateBytes = await fileTemplateLoader(formId);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const fieldMap = getFieldMap(formId);

  for (const [engineField, value] of Object.entries(fields)) {
    const mapping = fieldMap[engineField];
    if (!mapping) continue;

    const displayValue = mapping.transform
      ? mapping.transform(value)
      : String(value);

    try {
      const pdfField = form.getField(mapping.pdfFieldName);
      if (mapping.type === 'text' && pdfField instanceof PDFTextField) {
        pdfField.setText(displayValue);
      } else if (mapping.type === 'checkbox' && pdfField instanceof PDFCheckBox) {
        if (displayValue === 'X' || displayValue === 'true' || displayValue === '1') {
          pdfField.check();
        } else {
          pdfField.uncheck();
        }
      }
    } catch {
      // Field not found — will be caught by the warning-free tests
    }
  }

  return pdfDoc;
}

/** Read a text field value from a filled (non-flattened) PDF document. */
function getTextFieldValue(doc: PDFDocument, pdfFieldName: string): string | undefined {
  try {
    const field = doc.getForm().getField(pdfFieldName);
    if (field instanceof PDFTextField) {
      return field.getText() ?? undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** Read a checkbox value from a filled (non-flattened) PDF document. */
function getCheckboxValue(doc: PDFDocument, pdfFieldName: string): boolean | undefined {
  try {
    const field = doc.getForm().getField(pdfFieldName);
    if (field instanceof PDFCheckBox) {
      return field.isChecked();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Fill a PDF and assert zero "field not found" warnings from our fillForm code.
 * Filters out pdf-lib's built-in XFA warning which is expected for IRS templates.
 */
async function fillWithoutFieldWarnings(
  formId: FormId,
  fields: Record<string, string | number>,
): Promise<Uint8Array> {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const pdfBytes = await fillForm(formId, fields, fileTemplateLoader);

  // Filter to only "field not found" warnings (our code), ignoring XFA warnings (pdf-lib)
  const fieldWarnings = warnSpy.mock.calls
    .map(c => String(c[0]))
    .filter(msg => msg.includes('not found in'));

  warnSpy.mockRestore();

  expect(pdfBytes).toBeInstanceOf(Uint8Array);
  expect(pdfBytes.length).toBeGreaterThan(0);

  if (fieldWarnings.length > 0) {
    // Fail with descriptive message showing which fields weren't found
    expect(fieldWarnings).toEqual([]);
  }

  return pdfBytes;
}

/** Shorthand for Page 1 field names. */
const p1 = (name: string) => `topmostSubform[0].Page1[0].${name}`;
const p1Addr = (name: string) => `topmostSubform[0].Page1[0].Address_ReadOrder[0].${name}`;
const p2 = (name: string) => `topmostSubform[0].Page2[0].${name}`;

// ---------------------------------------------------------------------------
// Scenario 1: Simple W-2 Single Filer ($50k)
// ---------------------------------------------------------------------------

describe('PDF Verification: Simple W-2 single filer ($50k)', () => {
  const input = makeInput({
    filingStatus: 'single',
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Acme Corp',
      wages: 5_000_000,           // $50,000
      federalWithheld: 600_000,   // $6,000
      socialSecurityWages: 5_000_000,
      socialSecurityWithheld: 310_000,
      medicareWages: 5_000_000,
      medicareWithheld: 72_500,
      stateWages: 5_000_000,
      stateWithheld: 200_000,
      stateCode: 'CA',
    }],
  });

  const result = computeFederalTax(input, config);
  const forms = generateFormMappings(input, result);

  it('form mapping Line 1 (wages) = $50,000', () => {
    expect(forms.f1040.line1).toBe(50000);
  });

  it('form mapping Line 11 (AGI) = $50,000', () => {
    expect(forms.f1040.line11).toBe(50000);
  });

  it('form mapping Line 12 (standard deduction) = $15,750', () => {
    // OBBBA 2025 single standard deduction = $15,750
    // Single, under 65, no special deductions → $15,750
    expect(forms.f1040.line12).toBe(15750);
  });

  it('form mapping Line 15 (taxable income) = $34,250', () => {
    // $50,000 - $15,750 = $34,250
    expect(forms.f1040.line15).toBe(34250);
  });

  it('form mapping Line 16 (tax) matches engine computation', () => {
    const engineTax = Math.round(
      (result.taxBreakdown.ordinaryIncomeTax + result.taxBreakdown.capitalGainsTax) / 100,
    );
    expect(forms.f1040.line16).toBe(engineTax);
  });

  it('form mapping Line 24 (total tax) matches engine', () => {
    expect(forms.f1040.line24).toBe(Math.round(result.totalTax / 100));
  });

  it('form mapping Line 25 (withholding) = $6,000', () => {
    expect(forms.f1040.line25).toBe(6000);
  });

  it('form mapping personal info is correct', () => {
    expect(forms.f1040.firstName).toBe('John');
    expect(forms.f1040.lastName).toBe('Doe');
    expect(forms.f1040.ssn).toBe('123-45-6789');
    expect(forms.f1040.filingStatusSingle).toBe('X');
    expect(forms.f1040.filingStatusMFJ).toBe('');
  });

  it('form mapping address is correct', () => {
    expect(forms.f1040.address).toBe('123 Main St');
    expect(forms.f1040.city).toBe('Anytown');
    expect(forms.f1040.state).toBe('CA');
    expect(forms.f1040.zip).toBe('90210');
  });

  it('fills real f1040.pdf template without field warnings', async () => {
    await fillWithoutFieldWarnings('f1040', forms.f1040);
  });

  it('filled PDF has correct field values', async () => {
    const doc = await fillAndReadBack('f1040', forms.f1040);

    // Personal info
    expect(getTextFieldValue(doc, p1('f1_11[0]'))).toBe('John');
    expect(getTextFieldValue(doc, p1('f1_12[0]'))).toBe('Doe');

    // Filing status
    expect(getCheckboxValue(doc, p1('c1_5[0]'))).toBe(true);   // Single checked
    expect(getCheckboxValue(doc, p1('c1_6[0]'))).toBe(false);  // MFJ not checked

    // Income
    expect(getTextFieldValue(doc, p1('f1_47[0]'))).toBe('50000');  // Line 1
    expect(getTextFieldValue(doc, p1('f1_71[0]'))).toBe('50000');  // Line 9
    expect(getTextFieldValue(doc, p1('f1_73[0]'))).toBe('50000');  // Line 11

    // Page 2
    expect(getTextFieldValue(doc, p2('f2_02[0]'))).toBe('15750');  // Line 12 (std deduction)
    expect(getTextFieldValue(doc, p2('f2_06[0]'))).toBe('34250');  // Line 15 (taxable income)
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: MFJ with Dependents
// ---------------------------------------------------------------------------

describe('PDF Verification: MFJ with 2 dependents', () => {
  const input = makeInput({
    filingStatus: 'married_filing_jointly',
    taxpayer: {
      firstName: 'Alice',
      lastName: 'Smith',
      ssn: '111223333',
      dateOfBirth: '1985-05-15',
    },
    spouse: {
      firstName: 'Bob',
      lastName: 'Smith',
      ssn: '444556666',
      dateOfBirth: '1983-08-20',
    },
    dependents: [
      {
        firstName: 'Charlie',
        lastName: 'Smith',
        ssn: '777889999',
        dateOfBirth: '2015-03-10',
        relationship: 'son',
        qualifiesForCTC: true,
      },
      {
        firstName: 'Diana',
        lastName: 'Smith',
        ssn: '888990000',
        dateOfBirth: '2018-11-22',
        relationship: 'daughter',
        qualifiesForCTC: true,
      },
    ],
    w2s: [{
      employerEIN: '98-7654321',
      employerName: 'Big Corp',
      wages: 12_000_000,          // $120,000
      federalWithheld: 1_500_000, // $15,000
      socialSecurityWages: 12_000_000,
      socialSecurityWithheld: 744_000,
      medicareWages: 12_000_000,
      medicareWithheld: 174_000,
      stateWages: 12_000_000,
      stateWithheld: 500_000,
      stateCode: 'CA',
    }],
  });

  const result = computeFederalTax(input, config);
  const forms = generateFormMappings(input, result);

  it('filing status MFJ checkbox set', () => {
    expect(forms.f1040.filingStatusMFJ).toBe('X');
    expect(forms.f1040.filingStatusSingle).toBe('');
  });

  it('spouse info populated', () => {
    expect(forms.f1040.spouseFirstName).toBe('Bob');
    expect(forms.f1040.spouseLastName).toBe('Smith');
    expect(forms.f1040.spouseSSN).toBe('444-55-6666');
  });

  it('dependent rows populated', () => {
    expect(forms.f1040.dependent1_name).toBe('Charlie Smith');
    expect(forms.f1040.dependent1_ssn).toBe('777-88-9999');
    expect(forms.f1040.dependent1_relationship).toBe('son');
    expect(forms.f1040.dependent1_ctc).toBe('X');
    expect(forms.f1040.dependent2_name).toBe('Diana Smith');
    expect(forms.f1040.dependent2_ctc).toBe('X');
  });

  it('Line 1 (wages) = $120,000', () => {
    expect(forms.f1040.line1).toBe(120000);
  });

  it('Line 11 (AGI) = $120,000', () => {
    expect(forms.f1040.line11).toBe(120000);
  });

  it('Line 12 (MFJ standard deduction) = $31,500', () => {
    // OBBBA 2025 MFJ = $31,500
    expect(forms.f1040.line12).toBe(31500);
  });

  it('Line 15 (taxable income) = $88,500', () => {
    // $120,000 - $31,500 = $88,500
    expect(forms.f1040.line15).toBe(88500);
  });

  it('CTC credited for 2 qualifying children', () => {
    // 2 children × $2,200 (OBBBA 2025 CTC) = $4,400 max
    const totalNonrefundable = result.creditBreakdown.childTaxCredit +
      result.creditBreakdown.otherDependentCredit +
      result.creditBreakdown.childCareCareCredit +
      result.creditBreakdown.educationCredits +
      result.creditBreakdown.saversCredit;
    expect(Math.round(totalNonrefundable / 100)).toBeGreaterThan(0);
    expect(forms.f1040.line19).toBe(Math.round(totalNonrefundable / 100));
  });

  it('fills real f1040.pdf template without field warnings', async () => {
    await fillWithoutFieldWarnings('f1040', forms.f1040);
  });

  it('filled PDF has correct dependent and spouse fields', async () => {
    const doc = await fillAndReadBack('f1040', forms.f1040);

    expect(getTextFieldValue(doc, p1('f1_13[0]'))).toBe('Bob');
    expect(getTextFieldValue(doc, p1('f1_14[0]'))).toBe('Smith');
    expect(getCheckboxValue(doc, p1('c1_6[0]'))).toBe(true); // MFJ
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Self-Employed Filer
// ---------------------------------------------------------------------------

describe('PDF Verification: Self-employed filer', () => {
  const input = makeInput({
    filingStatus: 'single',
    scheduleCData: {
      businessName: 'Doe Consulting',
      businessCode: '541990',
      grossReceipts: 15_000_000,  // $150,000
      expenses: {
        officeExpenses: 500_000,   // $5,000
        supplies: 200_000,         // $2,000
        utilities: 100_000,        // $1,000
      },
    },
  });

  const result = computeFederalTax(input, config);
  const forms = generateFormMappings(input, result);

  it('Schedule C net profit', () => {
    // $150,000 - $8,000 = $142,000
    expect(forms.scheduleC!.netProfit).toBe(142000);
  });

  it('Schedule C gross receipts', () => {
    expect(forms.scheduleC!.grossReceipts).toBe(150000);
  });

  it('Schedule C business name', () => {
    expect(forms.scheduleC!.businessName).toBe('Doe Consulting');
  });

  it('Schedule SE self-employment tax computed', () => {
    expect(forms.scheduleSE!.totalSETax).toBeGreaterThan(0);
    expect(forms.scheduleSE!.deductibleHalf).toBeGreaterThan(0);
  });

  it('Schedule 1 has SE deduction', () => {
    // Half of SE tax as adjustment
    expect(forms.schedule1!.line15).toBe(forms.scheduleSE!.deductibleHalf);
  });

  it('Line 8 (other income) includes self-employment income', () => {
    expect(forms.f1040.line8).toBeGreaterThan(0);
  });

  it('Line 23 (other taxes) includes SE tax', () => {
    expect(forms.f1040.line23).toBeGreaterThan(0);
  });

  it('fills Schedule C template without field warnings', async () => {
    await fillWithoutFieldWarnings('scheduleC', forms.scheduleC!);
  });

  it('fills Schedule SE template without field warnings', async () => {
    await fillWithoutFieldWarnings('scheduleSE', forms.scheduleSE!);
  });

  it('fills Schedule 1 template without field warnings', async () => {
    await fillWithoutFieldWarnings('schedule1', forms.schedule1!);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Capital Gains Filer
// ---------------------------------------------------------------------------

describe('PDF Verification: Capital gains filer', () => {
  const input = makeInput({
    filingStatus: 'single',
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Acme Corp',
      wages: 8_000_000,           // $80,000
      federalWithheld: 1_000_000, // $10,000
      socialSecurityWages: 8_000_000,
      socialSecurityWithheld: 496_000,
      medicareWages: 8_000_000,
      medicareWithheld: 116_000,
      stateWages: 8_000_000,
      stateWithheld: 300_000,
      stateCode: 'CA',
    }],
    form1099Bs: [
      {
        description: '100 AAPL',
        dateAcquired: '2023-01-15',
        dateSold: '2025-06-20',
        proceeds: 2_000_000,      // $20,000
        costBasis: 1_500_000,     // $15,000
        gainLoss: 500_000,        // $5,000
        isLongTerm: true,
        basisReportedToIRS: true,
        category: '8949_D',
      },
      {
        description: '50 TSLA',
        dateAcquired: '2025-01-10',
        dateSold: '2025-04-15',
        proceeds: 1_000_000,      // $10,000
        costBasis: 800_000,       // $8,000
        gainLoss: 200_000,        // $2,000
        isLongTerm: false,
        basisReportedToIRS: true,
        category: '8949_A',
      },
    ],
  });

  const result = computeFederalTax(input, config);
  const forms = generateFormMappings(input, result);

  it('Schedule D short-term gain = $2,000', () => {
    expect(forms.scheduleD!.shortTermGainLoss).toBe(2000);
  });

  it('Schedule D long-term gain = $5,000', () => {
    expect(forms.scheduleD!.longTermGainLoss).toBe(5000);
  });

  it('Schedule D net gain = $7,000', () => {
    expect(forms.scheduleD!.netGainLoss).toBe(7000);
  });

  it('Line 7 (capital gain) = $7,000', () => {
    expect(forms.f1040.line7).toBe(7000);
  });

  it('Form 8949 has 2 transactions', () => {
    const f8949 = forms.f8949 as Record<string, string | number>[];
    expect(f8949).toHaveLength(2);
  });

  it('Form 8949 transaction details correct', () => {
    const f8949 = forms.f8949 as Record<string, string | number>[];
    const appleTx = f8949.find(tx => tx.description === '100 AAPL');
    expect(appleTx).toBeDefined();
    expect(appleTx!.proceeds).toBe(20000);
    expect(appleTx!.basis).toBe(15000);
    expect(appleTx!.gainLoss).toBe(5000);
  });

  it('fills Schedule D template without field warnings', async () => {
    await fillWithoutFieldWarnings('scheduleD', forms.scheduleD!);
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Itemized Deductions
// ---------------------------------------------------------------------------

describe('PDF Verification: Itemized deductions', () => {
  const input = makeInput({
    filingStatus: 'single',
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Acme Corp',
      wages: 10_000_000,          // $100,000
      federalWithheld: 1_200_000, // $12,000
      socialSecurityWages: 10_000_000,
      socialSecurityWithheld: 620_000,
      medicareWages: 10_000_000,
      medicareWithheld: 145_000,
      stateWages: 10_000_000,
      stateWithheld: 400_000,
      stateCode: 'CA',
    }],
    useItemizedDeductions: true,
    itemizedDeductions: {
      medicalExpenses: 1_500_000,       // $15,000
      stateLocalTaxesPaid: 800_000,     // $8,000
      realEstateTaxes: 600_000,         // $6,000
      mortgageInterest: 1_200_000,      // $12,000
      charitableCash: 300_000,          // $3,000
      charitableNonCash: 100_000,       // $1,000
    },
  });

  const result = computeFederalTax(input, config);
  const forms = generateFormMappings(input, result);

  it('Schedule A generated', () => {
    expect(forms.scheduleA).toBeDefined();
  });

  it('Schedule A Line 1 (medical expenses) = $15,000', () => {
    expect(forms.scheduleA!.line1).toBe(15000);
  });

  it('Schedule A Line 4 (medical deduction after 7.5% AGI threshold)', () => {
    // Medical threshold: 7.5% of $100,000 = $7,500
    // Deductible: $15,000 - $7,500 = $7,500
    expect(forms.scheduleA!.line4).toBe(7500);
  });

  it('Schedule A Line 5d (SALT capped)', () => {
    // Total SALT: $8,000 + $6,000 = $14,000
    // OBBBA 2025 SALT cap for single at $100k AGI: $40,000 (no phase-out below $500k)
    // $14,000 < $40,000, so no cap hit
    expect(forms.scheduleA!.line5d).toBe(14000);
  });

  it('Schedule A Line 8a (mortgage interest) = $12,000', () => {
    expect(forms.scheduleA!.line8a).toBe(12000);
  });

  it('Schedule A Line 11 (charitable cash) = $3,000', () => {
    expect(forms.scheduleA!.line11).toBe(3000);
  });

  it('Schedule A Line 12 (charitable non-cash) = $1,000', () => {
    expect(forms.scheduleA!.line12).toBe(1000);
  });

  it('Schedule A Line 17 (total itemized) matches engine', () => {
    expect(forms.scheduleA!.line17).toBe(
      Math.round(result.deductionBreakdown.itemizedAmount / 100),
    );
  });

  it('Form 1040 Line 12 uses itemized deduction (greater than standard)', () => {
    // Standard deduction (single) = $15,750
    // Itemized should be more: 7500 + 14000 + 12000 + 3000 + 1000 = $37,500
    expect(forms.f1040.line12).toBeGreaterThan(15750);
  });

  it('fills Schedule A template without field warnings', async () => {
    await fillWithoutFieldWarnings('scheduleA', forms.scheduleA!);
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: High-Income Filer (Additional Medicare + NIIT)
// ---------------------------------------------------------------------------

describe('PDF Verification: High-income filer ($400k)', () => {
  const input = makeInput({
    filingStatus: 'single',
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Big Corp',
      wages: 35_000_000,          // $350,000
      federalWithheld: 7_000_000, // $70,000
      socialSecurityWages: 17_640_000, // up to SS wage base
      socialSecurityWithheld: 1_093_680,
      medicareWages: 35_000_000,
      medicareWithheld: 507_500,
      stateWages: 35_000_000,
      stateWithheld: 2_000_000,
      stateCode: 'CA',
    }],
    form1099DIVs: [{
      payerName: 'Vanguard',
      ordinaryDividends: 3_000_000, // $30,000
      qualifiedDividends: 2_500_000, // $25,000
    }],
    form1099INTs: [{
      payerName: 'Chase Bank',
      interest: 2_000_000, // $20,000
    }],
  });

  const result = computeFederalTax(input, config);
  const forms = generateFormMappings(input, result);

  it('AGI = $400,000', () => {
    expect(forms.f1040.line11).toBe(400000);
  });

  it('Form 8959 generated (Additional Medicare Tax)', () => {
    expect(forms.f8959).toBeDefined();
    expect(forms.f8959!.additionalMedicareTax).toBeGreaterThan(0);
  });

  it('Form 8959 Medicare wages correct', () => {
    expect(forms.f8959!.medicareWages).toBe(350000);
  });

  it('Additional Medicare Tax = 0.9% of wages over $200k', () => {
    // ($350,000 - $200,000) × 0.9% = $1,350
    expect(forms.f8959!.additionalMedicareTax).toBe(1350);
  });

  it('Form 8960 generated (NIIT)', () => {
    expect(forms.f8960).toBeDefined();
    expect(forms.f8960!.niitAmount).toBeGreaterThan(0);
  });

  it('Form 8960 investment income components', () => {
    expect(forms.f8960!.interestIncome).toBe(20000);
    expect(forms.f8960!.dividendIncome).toBe(30000);
  });

  it('NIIT = 3.8% of lesser(investment income, AGI-threshold)', () => {
    // Investment income: $20,000 + $30,000 = $50,000
    // AGI - threshold: $400,000 - $200,000 = $200,000
    // Lesser = $50,000
    // NIIT = $50,000 × 3.8% = $1,900
    expect(forms.f8960!.niitAmount).toBe(1900);
  });

  it('Schedule 2 Line 11 (Additional Medicare) matches', () => {
    expect(forms.schedule2!.line11).toBe(1350);
  });

  it('Schedule 2 Line 12 (NIIT) matches', () => {
    expect(forms.schedule2!.line12).toBe(1900);
  });

  it('fills Form 8959 template without field warnings', async () => {
    await fillWithoutFieldWarnings('f8959', forms.f8959!);
  });

  it('fills Form 8960 template without field warnings', async () => {
    await fillWithoutFieldWarnings('f8960', forms.f8960!);
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: Interest & Dividends (Schedule B)
// ---------------------------------------------------------------------------

describe('PDF Verification: Schedule B (Interest & Dividends)', () => {
  const input = makeInput({
    filingStatus: 'single',
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Acme Corp',
      wages: 6_000_000,
      federalWithheld: 700_000,
      socialSecurityWages: 6_000_000,
      socialSecurityWithheld: 372_000,
      medicareWages: 6_000_000,
      medicareWithheld: 87_000,
      stateWages: 6_000_000,
      stateWithheld: 200_000,
      stateCode: 'CA',
    }],
    form1099INTs: [
      { payerName: 'Chase Bank', interest: 200_000 },
      { payerName: 'Ally Bank', interest: 150_000 },
    ],
    form1099DIVs: [
      { payerName: 'Vanguard', ordinaryDividends: 300_000, qualifiedDividends: 250_000 },
    ],
  });

  const result = computeFederalTax(input, config);
  const forms = generateFormMappings(input, result);

  it('Schedule B generated', () => {
    expect(forms.scheduleB).toBeDefined();
  });

  it('Schedule B interest payers listed', () => {
    expect(forms.scheduleB!['interest_payer_1']).toBe('Chase Bank');
    expect(forms.scheduleB!['interest_amount_1']).toBe(2000);
    expect(forms.scheduleB!['interest_payer_2']).toBe('Ally Bank');
    expect(forms.scheduleB!['interest_amount_2']).toBe(1500);
  });

  it('Schedule B total interest = $3,500', () => {
    expect(forms.scheduleB!.totalInterest).toBe(3500);
  });

  it('Schedule B dividend payers listed', () => {
    expect(forms.scheduleB!['dividend_payer_1']).toBe('Vanguard');
    expect(forms.scheduleB!['dividend_amount_1']).toBe(3000);
  });

  it('Schedule B total dividends = $3,000', () => {
    expect(forms.scheduleB!.totalDividends).toBe(3000);
  });

  it('Form 1040 Line 2b (taxable interest) = $3,500', () => {
    expect(forms.f1040.line2b).toBe(3500);
  });

  it('Form 1040 Line 3a (qualified dividends) = $2,500', () => {
    expect(forms.f1040.line3a).toBe(2500);
  });

  it('Form 1040 Line 3b (ordinary dividends) = $3,000', () => {
    expect(forms.f1040.line3b).toBe(3000);
  });

  it('fills Schedule B template without field warnings', async () => {
    await fillWithoutFieldWarnings('scheduleB', forms.scheduleB!);
  });
});

// ---------------------------------------------------------------------------
// Scenario 8: Refund vs. Amount Owed
// ---------------------------------------------------------------------------

describe('PDF Verification: Refund and amount owed', () => {
  it('shows refund when overpaid', () => {
    const input = makeInput({
      w2s: [{
        employerEIN: '12-3456789',
        employerName: 'Acme',
        wages: 5_000_000,           // $50,000
        federalWithheld: 1_200_000, // $12,000 (overpaid)
        socialSecurityWages: 5_000_000,
        socialSecurityWithheld: 310_000,
        medicareWages: 5_000_000,
        medicareWithheld: 72_500,
        stateWages: 5_000_000,
        stateWithheld: 200_000,
        stateCode: 'CA',
      }],
    });

    const result = computeFederalTax(input, config);
    const forms = generateFormMappings(input, result);

    // Should get a refund
    expect(result.refundOrOwed).toBeGreaterThan(0);
    expect(forms.f1040.line34).toBeGreaterThan(0);
    expect(forms.f1040.line35a).toBe(forms.f1040.line34);
    // line37 should NOT be set (no amount owed)
    expect(forms.f1040.line37).toBeUndefined();
  });

  it('shows amount owed when underpaid', () => {
    const input = makeInput({
      w2s: [{
        employerEIN: '12-3456789',
        employerName: 'Acme',
        wages: 10_000_000,         // $100,000
        federalWithheld: 500_000,  // $5,000 (underpaid)
        socialSecurityWages: 10_000_000,
        socialSecurityWithheld: 620_000,
        medicareWages: 10_000_000,
        medicareWithheld: 145_000,
        stateWages: 10_000_000,
        stateWithheld: 400_000,
        stateCode: 'CA',
      }],
    });

    const result = computeFederalTax(input, config);
    const forms = generateFormMappings(input, result);

    // Should owe money
    expect(result.refundOrOwed).toBeLessThan(0);
    expect(forms.f1040.line37).toBeGreaterThan(0);
    // line34/35a should NOT be set (no refund)
    expect(forms.f1040.line34).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Scenario 9: CA State Form (FTB 540)
// ---------------------------------------------------------------------------

describe('PDF Verification: CA state form (FTB 540)', () => {
  const input = makeInput({
    filingStatus: 'single',
    stateOfResidence: 'CA',
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Acme Corp',
      wages: 8_000_000,
      federalWithheld: 1_000_000,
      socialSecurityWages: 8_000_000,
      socialSecurityWithheld: 496_000,
      medicareWages: 8_000_000,
      medicareWithheld: 116_000,
      stateWages: 8_000_000,
      stateWithheld: 300_000,
      stateCode: 'CA',
    }],
  });

  const fullResult = computeFullReturn(input, config);
  const caResult = fullResult.stateResults?.CA;

  it('CA state result computed', () => {
    expect(caResult).toBeDefined();
    expect(caResult!.stateCode).toBe('CA');
    expect(caResult!.hasIncomeTax).toBe(true);
  });

  it('CA state AGI matches federal AGI', () => {
    expect(caResult!.stateAGI).toBe(fullResult.adjustedGrossIncome);
  });

  it('CA state taxable income > 0', () => {
    expect(caResult!.stateTaxableIncome).toBeGreaterThan(0);
  });

  it('CA state tax computed', () => {
    expect(caResult!.stateTaxBeforeCredits).toBeGreaterThan(0);
  });

  it('CA formData has expected fields', () => {
    const fd = caResult!.formData;
    expect(fd.federalAGI).toBe(fullResult.adjustedGrossIncome);
    expect(fd.standardDeduction).toBeGreaterThan(0);
    expect(fd.taxableIncome).toBeGreaterThan(0);
  });

  it('fills FTB 540 template', async () => {
    const stateFormData = caResult!.formData;
    // State forms may have unmapped fields — just verify the fill doesn't crash
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pdfBytes = await fillForm('ftb540', stateFormData, fileTemplateLoader);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Scenario 10: All Federal Templates Fill Without Warnings
// ---------------------------------------------------------------------------

describe('PDF Verification: All federal templates accept mapped fields', () => {
  // Complex scenario that triggers most forms
  const input = makeInput({
    filingStatus: 'single',
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'BigCo',
      wages: 30_000_000,
      federalWithheld: 5_000_000,
      socialSecurityWages: 17_640_000,
      socialSecurityWithheld: 1_093_680,
      medicareWages: 30_000_000,
      medicareWithheld: 435_000,
      stateWages: 30_000_000,
      stateWithheld: 1_500_000,
      stateCode: 'CA',
    }],
    scheduleCData: {
      businessName: 'Side Gig',
      businessCode: '541000',
      grossReceipts: 5_000_000,
      expenses: { officeExpenses: 100_000 },
    },
    form1099INTs: [{ payerName: 'Bank', interest: 500_000 }],
    form1099DIVs: [{
      payerName: 'Vanguard',
      ordinaryDividends: 1_000_000,
      qualifiedDividends: 800_000,
    }],
    form1099Bs: [{
      description: '50 GOOG',
      dateAcquired: '2023-06-01',
      dateSold: '2025-06-01',
      proceeds: 3_000_000,
      costBasis: 2_000_000,
      gainLoss: 1_000_000,
      isLongTerm: true,
      basisReportedToIRS: true,
      category: '8949_D',
    }],
    useItemizedDeductions: true,
    itemizedDeductions: {
      medicalExpenses: 3_000_000,
      stateLocalTaxesPaid: 1_000_000,
      realEstateTaxes: 500_000,
      mortgageInterest: 2_000_000,
      charitableCash: 500_000,
      charitableNonCash: 200_000,
    },
  });

  const result = computeFederalTax(input, config);
  const forms = generateFormMappings(input, result);

  const federalFormIds: FormId[] = [
    'f1040', 'schedule1', 'schedule2',
    'scheduleA', 'scheduleB', 'scheduleC', 'scheduleD',
    'scheduleSE', 'f8959', 'f8960',
  ];

  for (const formId of federalFormIds) {
    it(`fills ${formId} template without field-not-found warnings`, async () => {
      const formFields = forms[formId];
      if (!formFields || Array.isArray(formFields)) return; // Skip f8949 (array format)
      await fillWithoutFieldWarnings(formId, formFields);
    });
  }
});

// ---------------------------------------------------------------------------
// Scenario 11: Cross-form consistency
// ---------------------------------------------------------------------------

describe('PDF Verification: Cross-form consistency', () => {
  const input = makeInput({
    filingStatus: 'single',
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Acme',
      wages: 7_500_000,
      federalWithheld: 900_000,
      socialSecurityWages: 7_500_000,
      socialSecurityWithheld: 465_000,
      medicareWages: 7_500_000,
      medicareWithheld: 108_750,
      stateWages: 7_500_000,
      stateWithheld: 300_000,
      stateCode: 'CA',
    }],
    scheduleCData: {
      businessName: 'Freelance',
      businessCode: '541000',
      grossReceipts: 3_000_000,
      expenses: { officeExpenses: 200_000 },
    },
  });

  const result = computeFederalTax(input, config);
  const forms = generateFormMappings(input, result);

  it('Schedule C netProfit flows to Schedule 1 line3', () => {
    expect(forms.schedule1!.line3).toBe(forms.scheduleC!.netProfit);
  });

  it('Schedule SE deductible half flows to Schedule 1 line15', () => {
    expect(forms.schedule1!.line15).toBe(forms.scheduleSE!.deductibleHalf);
  });

  it('Schedule 2 SE tax matches Schedule SE total', () => {
    expect(forms.schedule2!.line6).toBe(forms.scheduleSE!.totalSETax);
  });

  it('1040 Line 24 = total tax from engine', () => {
    expect(forms.f1040.line24).toBe(Math.round(result.totalTax / 100));
  });

  it('1040 Line 33 = total payments (withholding + estimated + refundable credits)', () => {
    const totalPayments = Math.round(result.totalPayments / 100);
    const eitc = Math.round(result.creditBreakdown.earnedIncomeCredit / 100);
    const actc = Math.round(result.creditBreakdown.additionalChildTaxCredit / 100);
    expect(forms.f1040.line33).toBe(totalPayments + eitc + actc);
  });

  it('refund/owed is consistent: line33 - line24 = refund, or line24 - line33 = owed', () => {
    const line24 = forms.f1040.line24 as number;
    const line33 = forms.f1040.line33 as number;

    if (line33 > line24) {
      // Refund
      expect(forms.f1040.line34).toBe(line33 - line24);
    } else if (line24 > line33) {
      // Owed
      expect(forms.f1040.line37).toBe(line24 - line33);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateReturnPackage } from '../../src/pdf/generator';
import { createSyntheticTemplate, createMockTemplateLoader, getPageCount } from './helpers';
import type {
  TaxInput,
  TaxResult,
  CapitalGainsResult,
  Form1099B,
  AdjustedForm1099B,
  Form8949Category,
} from '../../src/engine/types';
import type { FormId } from '../../src/pdf/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<TaxInput> = {}): TaxInput {
  return {
    taxYear: 2025,
    filingStatus: 'single',
    taxpayer: { firstName: 'Test', lastName: 'User', ssn: '123456789', dateOfBirth: '1990-01-01' },
    dependents: [],
    address: { street: '123 Main St', city: 'Anytown', state: 'TX', zip: '75001' },
    w2s: [],
    form1099INTs: [],
    form1099DIVs: [],
    form1099Bs: [],
    form1099NECs: [],
    form1099Gs: [],
    form1099Rs: [],
    form1099Ks: [],
    useItemizedDeductions: false,
    estimatedTaxPayments: 0,
    stateOfResidence: 'TX',
    ...overrides,
  };
}

function emptyCapitalGains(): CapitalGainsResult {
  return {
    shortTermGains: 0,
    shortTermLosses: 0,
    rawNetShortTerm: 0,
    netShortTerm: 0,
    longTermGains: 0,
    longTermLosses: 0,
    rawNetLongTerm: 0,
    netLongTerm: 0,
    netCapitalGainLoss: 0,
    deductibleLoss: 0,
    carryforwardLoss: 0,
    collectiblesGain: 0,
    section1250Gain: 0,
    categorized: {
      '8949_A': [], '8949_B': [], '8949_C': [],
      '8949_D': [], '8949_E': [], '8949_F': [],
    },
  };
}

/** Build a minimal AdjustedForm1099B for tests. */
function makeAdjustedTx(
  category: Form8949Category,
  overrides: Partial<AdjustedForm1099B> = {},
): AdjustedForm1099B {
  const gainLoss = overrides.gainLoss ?? 500_000;
  return {
    description: 'TEST STOCK',
    dateAcquired: '2023-01-15',
    dateSold: '2025-06-20',
    proceeds: 2_000_000,
    costBasis: 1_500_000,
    gainLoss,
    isLongTerm: category.startsWith('8949_D') || category.startsWith('8949_E') || category.startsWith('8949_F'),
    basisReportedToIRS: category === '8949_A' || category === '8949_D',
    category,
    effectiveGainLoss: gainLoss + (overrides.washSaleDisallowed ?? 0),
    adjustmentCode: (overrides.washSaleDisallowed ?? 0) > 0 ? 'W' : '',
    ...overrides,
  };
}

function makeResult(overrides: Partial<TaxResult> = {}): TaxResult {
  return {
    totalIncome: 5_000_000,
    adjustedGrossIncome: 5_000_000,
    taxableIncome: 3_500_000,
    totalTax: 400_000,
    totalCredits: 0,
    totalPayments: 500_000,
    refundOrOwed: 100_000,
    effectiveTaxRate: 8,
    marginalTaxRate: 12,
    incomeBreakdown: {
      wages: 5_000_000,
      interest: 0,
      ordinaryDividends: 0,
      qualifiedDividends: 0,
      shortTermCapitalGains: 0,
      longTermCapitalGains: 0,
      selfEmploymentIncome: 0,
      unemployment: 0,
      retirementDistributions: 0,
      otherIncome: 0,
    },
    deductionBreakdown: {
      type: 'standard',
      amount: 1_500_000,
      standardAmount: 1_500_000,
      itemizedAmount: 0,
    },
    taxBreakdown: {
      ordinaryIncomeTax: 400_000,
      capitalGainsTax: 0,
      selfEmploymentTax: 0,
      additionalMedicareTax: 0,
      netInvestmentIncomeTax: 0,
      amt: 0,
    },
    creditBreakdown: {
      childTaxCredit: 0,
      additionalChildTaxCredit: 0,
      otherDependentCredit: 0,
      earnedIncomeCredit: 0,
      childCareCareCredit: 0,
      educationCredits: 0,
      saversCredit: 0,
    },
    capitalGainsResult: emptyCapitalGains(),
    forms: {
      f1040: {
        firstName: 'Test',
        lastName: 'User',
        ssn: '123-45-6789',
        line1: 50000,
        line9: 50000,
        line11: 50000,
        line15: 35000,
        line24: 4000,
      },
    },
    needsSchedule1: false,
    needsSchedule2: false,
    needsSchedule3: false,
    needsScheduleA: false,
    needsScheduleB: false,
    needsScheduleC: false,
    needsScheduleD: false,
    needsScheduleSE: false,
    needsForm8949: false,
    needsForm8959: false,
    needsForm8960: false,
    stateResults: {},
    ...overrides,
  };
}

/**
 * Create a set of synthetic templates for all requested form IDs.
 */
async function createTemplates(
  formIds: FormId[],
): Promise<Partial<Record<FormId, Uint8Array>>> {
  const templates: Partial<Record<FormId, Uint8Array>> = {};
  for (const id of formIds) {
    // Each template has a few placeholder fields
    templates[id] = await createSyntheticTemplate([`${id}_field1`, `${id}_field2`]);
  }
  return templates;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateReturnPackage', () => {
  it('should generate a PDF for a simple W-2 filer (only f1040)', async () => {
    const templates = await createTemplates(['f1040']);
    const loader = createMockTemplateLoader(templates);

    const input = makeInput({
      w2s: [{
        employerEIN: '12-3456789', employerName: 'Employer',
        wages: 5_000_000, federalWithheld: 500_000,
        socialSecurityWages: 5_000_000, socialSecurityWithheld: 310_000,
        medicareWages: 5_000_000, medicareWithheld: 72_500,
        stateWages: 5_000_000, stateWithheld: 200_000, stateCode: 'TX',
      }],
    });
    const result = makeResult();

    const pdfBytes = await generateReturnPackage(input, result, loader);

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(0);

    // Should be a single-page PDF (just f1040)
    const pageCount = await getPageCount(pdfBytes);
    expect(pageCount).toBe(1);
  });

  it('should generate multiple forms for a self-employed filer', async () => {
    const templates = await createTemplates([
      'f1040', 'schedule1', 'scheduleC', 'scheduleSE', 'schedule2',
    ]);
    const loader = createMockTemplateLoader(templates);

    const input = makeInput({
      scheduleCData: {
        businessName: 'Test Biz',
        businessCode: '541000',
        grossReceipts: 10_000_000,
        expenses: { officeExpenses: 200_000 },
      },
    });
    const result = makeResult({
      needsSchedule1: true,
      needsSchedule2: true,
      needsScheduleC: true,
      needsScheduleSE: true,
      selfEmploymentResult: {
        scheduleCNetProfit: 9_800_000,
        homeOfficeDeduction: 0,
        seTaxableIncome: 9_050_300,
        socialSecurityTax: 1_122_237,
        medicareTax: 262_459,
        totalSETax: 1_384_696,
        halfSETaxDeduction: 692_348,
        qbiDeduction: 0,
      },
      forms: {
        f1040: { firstName: 'Test', line1: 0 },
        schedule1: { line3: 98000 },
        scheduleC: { businessName: 'Test Biz', grossReceipts: 100000 },
        scheduleSE: { netEarnings: 90503, totalSETax: 13847 },
        schedule2: { line6: 13847 },
      },
    });

    const pdfBytes = await generateReturnPackage(input, result, loader);

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    const pageCount = await getPageCount(pdfBytes);
    expect(pageCount).toBe(5); // f1040 + schedule1 + schedule2 + scheduleC + scheduleSE
  });

  it('should generate forms for a capital gains filer', async () => {
    const templates = await createTemplates([
      'f1040', 'scheduleD', 'f8949',
    ]);
    const loader = createMockTemplateLoader(templates);

    const tx: Form1099B = {
      description: '100 AAPL',
      dateAcquired: '2023-01-15',
      dateSold: '2025-06-20',
      proceeds: 2_000_000,
      costBasis: 1_500_000,
      gainLoss: 500_000,
      isLongTerm: true,
      basisReportedToIRS: true,
      category: '8949_D' as Form8949Category,
    };

    const input = makeInput({ form1099Bs: [tx] });
    const result = makeResult({
      needsScheduleD: true,
      needsForm8949: true,
      capitalGainsResult: {
        ...emptyCapitalGains(),
        longTermGains: 500_000,
        rawNetLongTerm: 500_000,
        netLongTerm: 500_000,
        netCapitalGainLoss: 500_000,
        categorized: {
          '8949_A': [], '8949_B': [], '8949_C': [],
          '8949_D': [makeAdjustedTx('8949_D', { description: '100 AAPL', gainLoss: 500_000 })],
          '8949_E': [], '8949_F': [],
        },
      },
      forms: {
        f1040: { firstName: 'Test', line7: 5000 },
        scheduleD: { shortTermGainLoss: 0, longTermGainLoss: 5000, netGainLoss: 5000 },
        f8949: [
          { description: '100 AAPL', dateAcquired: '2023-01-15', dateSold: '2025-06-20', proceeds: 20000, basis: 15000, gainLoss: 5000, category: '8949_D' },
        ],
      },
    });

    const pdfBytes = await generateReturnPackage(input, result, loader);

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    const pageCount = await getPageCount(pdfBytes);
    // f1040 (1) + scheduleD (1) + f8949 (1 page for 1 transaction)
    expect(pageCount).toBe(3);
  });

  it('should generate a full return with all forms', async () => {
    const allForms: FormId[] = [
      'f1040', 'schedule1', 'schedule2', 'schedule3',
      'scheduleA', 'scheduleB', 'scheduleC', 'scheduleD',
      'scheduleSE', 'f8949', 'f8959', 'f8960',
    ];
    const templates = await createTemplates(allForms);
    const loader = createMockTemplateLoader(templates);

    const result = makeResult({
      needsSchedule1: true,
      needsSchedule2: true,
      needsSchedule3: true,
      needsScheduleA: true,
      needsScheduleB: true,
      needsScheduleC: true,
      needsScheduleD: true,
      needsScheduleSE: true,
      needsForm8949: true,
      needsForm8959: true,
      needsForm8960: true,
      capitalGainsResult: {
        ...emptyCapitalGains(),
        longTermGains: 300_000,
        rawNetLongTerm: 300_000,
        netLongTerm: 300_000,
        netCapitalGainLoss: 300_000,
        categorized: {
          '8949_A': [], '8949_B': [], '8949_C': [],
          '8949_D': [makeAdjustedTx('8949_D', { description: 'Stock A', gainLoss: 300_000 })],
          '8949_E': [], '8949_F': [],
        },
      },
      selfEmploymentResult: {
        scheduleCNetProfit: 5_000_000,
        homeOfficeDeduction: 0,
        seTaxableIncome: 4_617_500,
        socialSecurityTax: 572_570,
        medicareTax: 133_908,
        totalSETax: 706_478,
        halfSETaxDeduction: 353_239,
        qbiDeduction: 0,
      },
      deductionBreakdown: {
        type: 'itemized',
        amount: 2_000_000,
        standardAmount: 1_500_000,
        itemizedAmount: 2_000_000,
        itemizedDetails: {
          medicalExpenses: 500_000,
          stateLocalTaxesPaid: 500_000,
          realEstateTaxes: 300_000,
          mortgageInterest: 400_000,
          charitableCash: 200_000,
          charitableNonCash: 100_000,
          saltCapped: 800_000,
        },
      },
      forms: {
        f1040: { firstName: 'Test' },
        schedule1: { line3: 50000 },
        schedule2: { line1: 0, line6: 7065 },
        schedule3: { line2: 2000 },
        scheduleA: { line1: 5000, line17: 20000 },
        scheduleB: { totalInterest: 2000, totalDividends: 3000 },
        scheduleC: { businessName: 'Biz', grossReceipts: 100000 },
        scheduleD: { netGainLoss: 3000 },
        scheduleSE: { totalSETax: 7065 },
        f8949: [
          { description: 'Stock A', proceeds: 10000, basis: 7000, gainLoss: 3000, dateAcquired: '2023-01-01', dateSold: '2025-01-01', category: '8949_D' },
        ],
        f8959: { medicareWages: 300000, additionalMedicareTax: 900 },
        f8960: { totalInvestmentIncome: 10000, niitAmount: 380 },
      },
    });

    const pdfBytes = await generateReturnPackage(makeInput(), result, loader);

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    const pageCount = await getPageCount(pdfBytes);
    // 11 standard forms + 1 f8949 page = 12 total pages
    expect(pageCount).toBe(12);
  });

  it('should produce valid PDF that can be loaded', async () => {
    const templates = await createTemplates(['f1040']);
    const loader = createMockTemplateLoader(templates);

    const pdfBytes = await generateReturnPackage(makeInput(), makeResult(), loader);

    // Verify the output is a loadable PDF
    const doc = await PDFDocument.load(pdfBytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('should handle Form 8949 with multiple pages', async () => {
    const templates = await createTemplates(['f1040', 'scheduleD', 'f8949']);
    const loader = createMockTemplateLoader(templates);

    // Create 20 LT transactions (Cat D) -> 2 pages of Form 8949
    const ltTransactions = Array.from({ length: 20 }, (_, i) =>
      makeAdjustedTx('8949_D', {
        description: `Stock ${i + 1}`,
        gainLoss: 200_000 + i * 50_000,
      }),
    );

    const result = makeResult({
      needsScheduleD: true,
      needsForm8949: true,
      capitalGainsResult: {
        ...emptyCapitalGains(),
        categorized: {
          '8949_A': [], '8949_B': [], '8949_C': [],
          '8949_D': ltTransactions,
          '8949_E': [], '8949_F': [],
        },
      },
      forms: {
        f1040: { firstName: 'Test' },
        scheduleD: { netGainLoss: 50000 },
        f8949: ltTransactions.map(tx => ({
          description: tx.description,
          proceeds: tx.proceeds / 100,
          basis: tx.costBasis / 100,
          gainLoss: tx.effectiveGainLoss / 100,
          category: tx.category,
        })),
      },
    });

    const pdfBytes = await generateReturnPackage(makeInput(), result, loader);

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    const pageCount = await getPageCount(pdfBytes);
    // f1040 (1) + scheduleD (1) + f8949 (2 pages for 20 txs) = 4
    expect(pageCount).toBe(4);
  });
});

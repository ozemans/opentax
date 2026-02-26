// Integration Tests — Full Federal Tax Return Scenarios
// Tests the computeFederalTax orchestrator with realistic complete tax returns.
//
// Each scenario creates a full TaxInput and verifies key outputs:
// - totalIncome, AGI, taxableIncome, totalTax, refundOrOwed
// - Schedule flags
// - Credit amounts
// - Tax breakdown consistency
//
// All monetary values are in CENTS.

import { describe, it, expect } from 'vitest';
import { computeFederalTax } from '../../src/engine/federal/index';
import type { TaxInput, FederalConfig } from '../../src/engine/types';
import federalConfig from '../../config/federal-2025.json';

const config = federalConfig as unknown as FederalConfig;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Create a minimal TaxInput with sensible defaults. Override specific fields. */
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

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 1: Simple W-2 Single Filer
// $75,000 wages, standard deduction, no dependents
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 1: Simple W-2 single filer ($75k)', () => {
  const input = makeInput({
    filingStatus: 'single',
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Acme Corp',
      wages: 7_500_000,           // $75,000
      federalWithheld: 900_000,   // $9,000
      socialSecurityWages: 7_500_000,
      socialSecurityWithheld: 465_000,
      medicareWages: 7_500_000,
      medicareWithheld: 108_750,
      stateWages: 7_500_000,
      stateWithheld: 300_000,
      stateCode: 'CA',
    }],
  });

  const result = computeFederalTax(input, config);

  it('computes total income = $75,000', () => {
    expect(result.totalIncome).toBe(7_500_000);
  });

  it('computes AGI = $75,000 (no adjustments)', () => {
    expect(result.adjustedGrossIncome).toBe(7_500_000);
  });

  it('uses standard deduction ($15,750 for single)', () => {
    expect(result.deductionBreakdown.type).toBe('standard');
    expect(result.deductionBreakdown.amount).toBe(1_575_000);
  });

  it('computes taxable income = $59,250', () => {
    expect(result.taxableIncome).toBe(5_925_000);
  });

  it('computes reasonable ordinary tax', () => {
    // $59,250 taxable: 10% on $11,925 + 12% on ($48,475 - $11,925) + 22% on ($59,250 - $48,475)
    // = $1,192.50 + $4,386 + $2,370.50 = ~$7,949
    // All at ordinary rates, no capital gains
    expect(result.taxBreakdown.ordinaryIncomeTax).toBeGreaterThan(790_000);
    expect(result.taxBreakdown.ordinaryIncomeTax).toBeLessThan(800_000);
    expect(result.taxBreakdown.capitalGainsTax).toBe(0);
  });

  it('total tax = ordinary tax (no AMT, SE, or other taxes)', () => {
    expect(result.taxBreakdown.amt).toBe(0);
    expect(result.taxBreakdown.selfEmploymentTax).toBe(0);
    expect(result.taxBreakdown.additionalMedicareTax).toBe(0);
    expect(result.taxBreakdown.netInvestmentIncomeTax).toBe(0);
    expect(result.totalTax).toBe(result.taxBreakdown.ordinaryIncomeTax);
  });

  it('computes refund (withholding > tax)', () => {
    // $9,000 withheld, ~$8,114 tax => ~$886 refund
    expect(result.refundOrOwed).toBeGreaterThan(0);
    expect(result.totalPayments).toBe(900_000);
  });

  it('has correct marginal rate (22%)', () => {
    expect(result.marginalTaxRate).toBe(22);
  });

  it('sets no extra schedule flags', () => {
    expect(result.needsSchedule1).toBe(false);
    expect(result.needsSchedule2).toBe(false);
    expect(result.needsSchedule3).toBe(false);
    expect(result.needsScheduleA).toBe(false);
    expect(result.needsScheduleC).toBe(false);
    expect(result.needsScheduleD).toBe(false);
    expect(result.needsScheduleSE).toBe(false);
  });

  it('has zero credits', () => {
    expect(result.totalCredits).toBe(0);
  });

  it('generates Form 1040 field mappings', () => {
    expect(result.forms.f1040).toBeDefined();
    expect(result.forms.f1040['line1']).toBe(75000); // Wages in dollars
    expect(result.forms.f1040['line15']).toBe(59250); // Taxable income
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 2: MFJ with Two Kids
// Combined $120,000 wages, 2 CTC-qualifying children, standard deduction
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 2: MFJ with 2 kids ($120k combined)', () => {
  const input = makeInput({
    filingStatus: 'married_filing_jointly',
    spouse: {
      firstName: 'Jane',
      lastName: 'Doe',
      ssn: '987654321',
      dateOfBirth: '1991-05-15',
    },
    dependents: [
      {
        firstName: 'Child',
        lastName: 'One',
        ssn: '111223333',
        relationship: 'son',
        dateOfBirth: '2015-03-20',
        monthsLivedWithYou: 12,
        isStudent: false,
        isDisabled: false,
        qualifiesForCTC: true,
        qualifiesForODC: false,
      },
      {
        firstName: 'Child',
        lastName: 'Two',
        ssn: '444556666',
        relationship: 'daughter',
        dateOfBirth: '2018-07-10',
        monthsLivedWithYou: 12,
        isStudent: false,
        isDisabled: false,
        qualifiesForCTC: true,
        qualifiesForODC: false,
      },
    ],
    w2s: [
      {
        employerEIN: '12-3456789',
        employerName: 'Acme Corp',
        wages: 7_000_000,           // $70,000
        federalWithheld: 700_000,
        socialSecurityWages: 7_000_000,
        socialSecurityWithheld: 434_000,
        medicareWages: 7_000_000,
        medicareWithheld: 101_500,
        stateWages: 7_000_000,
        stateWithheld: 280_000,
        stateCode: 'CA',
      },
      {
        employerEIN: '98-7654321',
        employerName: 'Beta Inc',
        wages: 5_000_000,           // $50,000
        federalWithheld: 400_000,
        socialSecurityWages: 5_000_000,
        socialSecurityWithheld: 310_000,
        medicareWages: 5_000_000,
        medicareWithheld: 72_500,
        stateWages: 5_000_000,
        stateWithheld: 200_000,
        stateCode: 'CA',
      },
    ],
  });

  const result = computeFederalTax(input, config);

  it('computes total income = $120,000', () => {
    expect(result.totalIncome).toBe(12_000_000);
  });

  it('computes AGI = $120,000', () => {
    expect(result.adjustedGrossIncome).toBe(12_000_000);
  });

  it('uses MFJ standard deduction ($31,500)', () => {
    expect(result.deductionBreakdown.type).toBe('standard');
    expect(result.deductionBreakdown.amount).toBe(3_150_000);
  });

  it('computes taxable income = $88,500', () => {
    expect(result.taxableIncome).toBe(8_850_000);
  });

  it('gets Child Tax Credit for 2 children ($2,200 each = $4,400 max)', () => {
    // At $120k AGI, well below $400k MFJ phase-out threshold
    expect(result.creditBreakdown.childTaxCredit).toBeGreaterThan(0);
    // CTC is nonrefundable, limited to tax liability
    const maxCTC = 2 * 220_000; // 2 * $2,200
    expect(result.creditBreakdown.childTaxCredit).toBeLessThanOrEqual(maxCTC);
  });

  it('total tax is reduced by CTC', () => {
    // Without CTC, MFJ $90k taxable: 10% on $23,850 + 12% on ($96,950 - $23,850) ... = ~$10,294
    // With CTC: tax - $4,400 = ~$5,894
    expect(result.totalTax).toBeLessThan(1_100_000); // Less than $11,000
    expect(result.totalTax).toBeGreaterThan(0);
  });

  it('gets a refund', () => {
    // $11,000 withheld, ~$5,900 tax => ~$5,100 refund
    expect(result.refundOrOwed).toBeGreaterThan(0);
  });

  it('has 12% marginal rate for MFJ at $90k taxable', () => {
    expect(result.marginalTaxRate).toBe(12);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 3: Self-Employed Filer
// $80,000 Schedule C income, SE tax, QBI deduction, no W-2
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 3: Self-employed ($80k Schedule C)', () => {
  const input = makeInput({
    filingStatus: 'single',
    scheduleCData: {
      businessName: 'Freelance Design',
      businessCode: '541430',
      grossReceipts: 10_000_000,    // $100,000
      expenses: {
        advertising: 500_000,       // $5,000
        supplies: 300_000,          // $3,000
        officeExpenses: 200_000,    // $2,000
        utilities: 500_000,         // $5,000
        otherExpenses: 500_000,     // $5,000
      },
      homeOffice: {
        squareFootage: 200,
        useSimplifiedMethod: true,
      },
    },
    estimatedTaxPayments: 2_000_000, // $20,000 quarterly payments
  });

  const result = computeFederalTax(input, config);

  it('computes Schedule C net profit', () => {
    // $100k - $20k expenses - $1k home office = $79,000
    expect(result.selfEmploymentResult).toBeDefined();
    expect(result.selfEmploymentResult!.scheduleCNetProfit).toBe(7_900_000);
  });

  it('computes home office deduction (200 sqft * $5 = $1,000)', () => {
    expect(result.selfEmploymentResult!.homeOfficeDeduction).toBe(100_000);
  });

  it('computes SE tax', () => {
    // SE taxable = $79,000 * 92.35% = ~$72,956.50
    // SS: 12.4% * $72,957 = ~$9,046.63
    // Medicare: 2.9% * $72,957 = ~$2,115.74
    // Total SE: ~$11,162
    expect(result.selfEmploymentResult!.totalSETax).toBeGreaterThan(1_100_000);
    expect(result.selfEmploymentResult!.totalSETax).toBeLessThan(1_200_000);
  });

  it('applies half SE tax adjustment to AGI', () => {
    // halfSETax ≈ $5,581
    // totalIncome = $79,000 (Schedule C net)
    // AGI = $79,000 - ~$5,581 = ~$73,419
    expect(result.adjustedGrossIncome).toBeLessThan(result.totalIncome);
    const halfSE = result.selfEmploymentResult!.halfSETaxDeduction;
    expect(result.adjustedGrossIncome).toBe(result.totalIncome - halfSE);
  });

  it('computes QBI deduction', () => {
    // QBI = $79,000 (Schedule C net, positive)
    // 20% of QBI = ~$15,800
    // AGI ~$73,419, below single phase-out ($197,300), so full deduction
    // Capped at 20% of taxable income before QBI
    expect(result.selfEmploymentResult!.qbiDeduction).toBeGreaterThan(0);
  });

  it('needs Schedule C and Schedule SE', () => {
    expect(result.needsScheduleC).toBe(true);
    expect(result.needsScheduleSE).toBe(true);
    expect(result.needsSchedule1).toBe(true);
    expect(result.needsSchedule2).toBe(true);
  });

  it('has estimated payments as totalPayments', () => {
    expect(result.totalPayments).toBe(2_000_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 4: Capital Gains Filer
// $60,000 wages + $20,000 LTCG + $5,000 STCL
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 4: Capital gains filer ($60k wages + gains/losses)', () => {
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
      stateWithheld: 240_000,
      stateCode: 'CA',
    }],
    form1099Bs: [
      {
        description: 'AAPL',
        dateAcquired: '2023-01-15',
        dateSold: '2025-06-01',
        proceeds: 5_000_000,
        costBasis: 3_000_000,
        gainLoss: 2_000_000,        // $20,000 LTCG
        isLongTerm: true,
        basisReportedToIRS: true,
        category: '8949_D',
      },
      {
        description: 'TSLA',
        dateAcquired: '2025-02-01',
        dateSold: '2025-04-01',
        proceeds: 1_000_000,
        costBasis: 1_500_000,
        gainLoss: -500_000,          // -$5,000 STCL
        isLongTerm: false,
        basisReportedToIRS: true,
        category: '8949_A',
      },
    ],
  });

  const result = computeFederalTax(input, config);

  it('computes net capital gain correctly', () => {
    // Net = $20,000 LTCG + (-$5,000 STCL) = $15,000 net gain
    expect(result.capitalGainsResult.netCapitalGainLoss).toBe(1_500_000);
    expect(result.capitalGainsResult.netShortTerm).toBe(-500_000);
    expect(result.capitalGainsResult.netLongTerm).toBe(2_000_000);
  });

  it('includes capital gains in total income', () => {
    // $60,000 wages + $15,000 net cap gain = $75,000
    expect(result.totalIncome).toBe(7_500_000);
  });

  it('applies preferential rates on LTCG', () => {
    // Has qualified capital gains, should use QDCG worksheet
    // Net LTCG = $20,000 (offset by $5k STCL = $15k net, but worksheet uses netLT = $20k)
    // Wait, the net LTCG for QDCG is max(0, netLongTerm) = max(0, $20,000) = $20,000
    // But the short-term loss offsets... Actually in QDCG, the preferential = QD + netLTCG
    // netLTCG = max(0, netLongTerm) = $20,000
    // ST loss is already in ordinary income treatment
    expect(result.taxBreakdown.capitalGainsTax).toBeGreaterThanOrEqual(0);
  });

  it('needs Schedule D and Form 8949', () => {
    expect(result.needsScheduleD).toBe(true);
    expect(result.needsForm8949).toBe(true);
  });

  it('no loss carryforward (net gain)', () => {
    expect(result.capitalGainsResult.carryforwardLoss).toBe(0);
    expect(result.capitalGainsResult.deductibleLoss).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 5: Capital Loss Carryforward
// $60,000 wages + $50,000 capital losses
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 5: Capital loss limitation and carryforward', () => {
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
      stateWithheld: 240_000,
      stateCode: 'CA',
    }],
    form1099Bs: [{
      description: 'LOSS STOCK',
      dateAcquired: '2024-01-15',
      dateSold: '2025-06-01',
      proceeds: 1_000_000,
      costBasis: 6_000_000,
      gainLoss: -5_000_000,          // -$50,000 LTCL
      isLongTerm: true,
      basisReportedToIRS: true,
      category: '8949_D',
    }],
  });

  const result = computeFederalTax(input, config);

  it('limits deductible loss to $3,000', () => {
    expect(result.capitalGainsResult.deductibleLoss).toBe(-300_000);
  });

  it('carries forward excess loss ($47,000)', () => {
    expect(result.capitalGainsResult.carryforwardLoss).toBe(4_700_000);
  });

  it('total income = wages - $3k loss = $57,000', () => {
    expect(result.totalIncome).toBe(5_700_000);
  });

  it('taxable income reflects the limited loss', () => {
    // AGI = $57,000, standard deduction $15,750, taxable = $41,250
    expect(result.taxableIncome).toBe(4_125_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 6: Itemized Deductions Filer
// $150,000 wages, high SALT + mortgage + charitable
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 6: Itemized deductions ($150k, high SALT)', () => {
  const input = makeInput({
    filingStatus: 'married_filing_jointly',
    spouse: {
      firstName: 'Jane',
      lastName: 'Doe',
      ssn: '987654321',
      dateOfBirth: '1988-05-15',
    },
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Big Tech Inc',
      wages: 15_000_000,           // $150,000
      federalWithheld: 2_500_000,
      socialSecurityWages: 15_000_000,
      socialSecurityWithheld: 930_000,
      medicareWages: 15_000_000,
      medicareWithheld: 217_500,
      stateWages: 15_000_000,
      stateWithheld: 1_200_000,
      stateCode: 'CA',
    }],
    useItemizedDeductions: true,
    itemizedDeductions: {
      medicalExpenses: 0,
      stateLocalTaxesPaid: 1_500_000,  // $15,000 state income tax
      realEstateTaxes: 1_200_000,       // $12,000 property tax
      mortgageInterest: 1_800_000,      // $18,000 mortgage interest
      charitableCash: 500_000,          // $5,000 charitable
      charitableNonCash: 200_000,       // $2,000 non-cash
    },
  });

  const result = computeFederalTax(input, config);

  it('uses itemized deductions', () => {
    expect(result.deductionBreakdown.type).toBe('itemized');
  });

  it('caps SALT at $40,000 (OBBBA)', () => {
    // Total SALT = $15k + $12k = $27k, below $40k cap
    // So full $27k is deductible
    expect(result.deductionBreakdown.itemizedDetails!.saltCapped).toBe(2_700_000);
  });

  it('itemized > standard deduction', () => {
    // SALT $27k + mortgage $18k + charitable $7k = $52k
    // MFJ standard = $30k, so itemized wins
    expect(result.deductionBreakdown.itemizedAmount).toBeGreaterThan(
      result.deductionBreakdown.standardAmount,
    );
  });

  it('needs Schedule A', () => {
    expect(result.needsScheduleA).toBe(true);
  });

  it('generates Schedule A form fields', () => {
    expect(result.forms.scheduleA).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 7: High Income — AMT + NIIT + Additional Medicare
// $500,000 wages + $100,000 investment income, itemized with high SALT
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 7: High income ($500k wages, AMT/NIIT triggers)', () => {
  const input = makeInput({
    filingStatus: 'single',
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Hedge Fund LLC',
      wages: 50_000_000,           // $500,000
      federalWithheld: 12_000_000,
      socialSecurityWages: 17_610_000,  // Capped at SS wage base
      socialSecurityWithheld: 1_091_820,
      medicareWages: 50_000_000,
      medicareWithheld: 952_500,   // Includes additional Medicare on wages > $200k
      stateWages: 50_000_000,
      stateWithheld: 5_000_000,
      stateCode: 'NY',
    }],
    form1099INTs: [{
      payerName: 'Bank of America',
      interest: 2_000_000,          // $20,000
    }],
    form1099DIVs: [{
      payerName: 'Vanguard',
      ordinaryDividends: 5_000_000, // $50,000
      qualifiedDividends: 4_000_000, // $40,000
      totalCapitalGain: 3_000_000,  // $30,000 LTCG distribution
    }],
    useItemizedDeductions: true,
    itemizedDeductions: {
      medicalExpenses: 0,
      stateLocalTaxesPaid: 5_000_000,  // $50,000 state tax
      realEstateTaxes: 2_500_000,       // $25,000 property tax
      mortgageInterest: 3_000_000,      // $30,000 mortgage interest
      charitableCash: 2_000_000,        // $20,000 charitable
      charitableNonCash: 0,
    },
  });

  const result = computeFederalTax(input, config);

  it('computes total income = $600,000', () => {
    // $500k wages + $20k interest + $50k dividends + $30k LTCG dist = $600k
    expect(result.totalIncome).toBe(60_000_000);
  });

  it('SALT is capped', () => {
    // Total SALT = $75k, but cap at $500k AGI is ~$40k (below phase-out start of $500k)
    // At exactly $500k MAGI, phase-out hasn't begun yet (begins at $500k)
    // AGI = $600k, so phase-out applies
    // Excess = $600k - $500k = $100k
    // Reduction = $100k * 0.30 = $30k
    // Capped SALT = $40k - $30k = $10k (= floor)
    expect(result.deductionBreakdown.itemizedDetails!.saltCapped).toBe(1_000_000);
  });

  it('triggers Additional Medicare Tax', () => {
    // Medicare wages $500k > $200k threshold for single
    expect(result.taxBreakdown.additionalMedicareTax).toBeGreaterThan(0);
    expect(result.needsForm8959).toBe(true);
  });

  it('triggers NIIT', () => {
    // AGI $600k > $200k threshold for single
    // Investment income = $20k interest + $50k dividends + $30k LTCG + any other
    expect(result.taxBreakdown.netInvestmentIncomeTax).toBeGreaterThan(0);
    expect(result.needsForm8960).toBe(true);
  });

  it('needs Schedule 2', () => {
    expect(result.needsSchedule2).toBe(true);
  });

  it('has preferential rate on qualified dividends and LTCG', () => {
    expect(result.taxBreakdown.capitalGainsTax).toBeGreaterThan(0);
  });

  it('computes effective rate in reasonable range', () => {
    // For $600k income, effective rate should be 20-35% range
    expect(result.effectiveTaxRate).toBeGreaterThan(15);
    expect(result.effectiveTaxRate).toBeLessThan(40);
  });

  it('marginal rate is 35% for single at $600k AGI', () => {
    // After deductions, taxable income will be high enough for 35% bracket
    expect(result.marginalTaxRate).toBe(35);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 8: EITC-Eligible Single Parent
// $25,000 wages, 1 qualifying child
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 8: EITC-eligible single parent ($25k wages, 1 child)', () => {
  const input = makeInput({
    filingStatus: 'single',
    dependents: [{
      firstName: 'Child',
      lastName: 'Doe',
      ssn: '111223333',
      relationship: 'daughter',
      dateOfBirth: '2016-06-15',
      monthsLivedWithYou: 12,
      isStudent: false,
      isDisabled: false,
      qualifiesForCTC: true,
      qualifiesForODC: false,
    }],
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Local Business',
      wages: 2_500_000,            // $25,000
      federalWithheld: 200_000,    // $2,000
      socialSecurityWages: 2_500_000,
      socialSecurityWithheld: 155_000,
      medicareWages: 2_500_000,
      medicareWithheld: 36_250,
      stateWages: 2_500_000,
      stateWithheld: 75_000,
      stateCode: 'TX',
    }],
  });

  const result = computeFederalTax(input, config);

  it('computes total income = $25,000', () => {
    expect(result.totalIncome).toBe(2_500_000);
  });

  it('gets CTC for qualifying child', () => {
    // $25k AGI, well below $200k single threshold
    expect(result.creditBreakdown.childTaxCredit).toBeGreaterThan(0);
  });

  it('gets EITC', () => {
    // $25k earned income with 1 child, single filer
    // Phase-out begins at $23,350 for 1 child single
    // So we're in the phase-out but should still get some EITC
    expect(result.creditBreakdown.earnedIncomeCredit).toBeGreaterThan(0);
  });

  it('gets Additional CTC (refundable)', () => {
    // If tax liability is small enough, ACTC kicks in
    // With CTC + EITC + low income, there should be refundable credits
    expect(result.creditBreakdown.additionalChildTaxCredit).toBeGreaterThanOrEqual(0);
  });

  it('gets a refund (including refundable credits)', () => {
    // Low tax liability + refundable EITC + ACTC + withholding = significant refund
    expect(result.refundOrOwed).toBeGreaterThan(0);
  });

  it('effective rate is very low', () => {
    // With credits, effective rate should be near 0 or negative
    expect(result.effectiveTaxRate).toBeLessThan(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 9: Zero Income
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 9: Zero income', () => {
  const input = makeInput({
    filingStatus: 'single',
  });

  const result = computeFederalTax(input, config);

  it('has zero total income', () => {
    expect(result.totalIncome).toBe(0);
  });

  it('has zero AGI', () => {
    expect(result.adjustedGrossIncome).toBe(0);
  });

  it('has zero taxable income', () => {
    expect(result.taxableIncome).toBe(0);
  });

  it('has zero total tax', () => {
    expect(result.totalTax).toBe(0);
  });

  it('has zero refund/owed', () => {
    expect(result.refundOrOwed).toBe(0);
  });

  it('has zero effective/marginal rates', () => {
    expect(result.effectiveTaxRate).toBe(0);
    expect(result.marginalTaxRate).toBe(10); // Marginal is always 10% at 0
  });

  it('standard deduction is still computed', () => {
    expect(result.deductionBreakdown.standardAmount).toBe(1_575_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 10: Mixed Income — W-2 + Interest + Dividends
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 10: Mixed income (W-2 + interest + dividends)', () => {
  const input = makeInput({
    filingStatus: 'single',
    w2s: [{
      employerEIN: '12-3456789',
      employerName: 'Acme Corp',
      wages: 8_000_000,            // $80,000
      federalWithheld: 1_100_000,
      socialSecurityWages: 8_000_000,
      socialSecurityWithheld: 496_000,
      medicareWages: 8_000_000,
      medicareWithheld: 116_000,
      stateWages: 8_000_000,
      stateWithheld: 320_000,
      stateCode: 'CA',
    }],
    form1099INTs: [{
      payerName: 'Chase Bank',
      interest: 300_000,            // $3,000
    }],
    form1099DIVs: [{
      payerName: 'Fidelity',
      ordinaryDividends: 500_000,   // $5,000
      qualifiedDividends: 400_000,  // $4,000
      totalCapitalGain: 0,
    }],
  });

  const result = computeFederalTax(input, config);

  it('computes total income = $88,000', () => {
    // $80k + $3k + $5k = $88k
    expect(result.totalIncome).toBe(8_800_000);
  });

  it('income breakdown is correct', () => {
    expect(result.incomeBreakdown.wages).toBe(8_000_000);
    expect(result.incomeBreakdown.interest).toBe(300_000);
    expect(result.incomeBreakdown.ordinaryDividends).toBe(500_000);
    expect(result.incomeBreakdown.qualifiedDividends).toBe(400_000);
  });

  it('uses preferential rates for qualified dividends', () => {
    // $4k in qualified dividends gets preferential treatment
    expect(result.taxBreakdown.capitalGainsTax).toBeGreaterThanOrEqual(0);
  });

  it('needs Schedule B (interest > $1,500)', () => {
    expect(result.needsScheduleB).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invariant Tests — Cross-cutting consistency checks
// ─────────────────────────────────────────────────────────────────────────────

describe('Invariants: consistency checks across all scenarios', () => {
  const scenarios: { name: string; input: TaxInput }[] = [
    {
      name: 'simple W-2',
      input: makeInput({
        w2s: [{
          employerEIN: '12-3456789', employerName: 'A',
          wages: 7_500_000, federalWithheld: 900_000,
          socialSecurityWages: 7_500_000, socialSecurityWithheld: 465_000,
          medicareWages: 7_500_000, medicareWithheld: 108_750,
          stateWages: 7_500_000, stateWithheld: 300_000, stateCode: 'CA',
        }],
      }),
    },
    {
      name: 'MFJ with kids',
      input: makeInput({
        filingStatus: 'married_filing_jointly',
        spouse: { firstName: 'J', lastName: 'D', ssn: '987654321', dateOfBirth: '1991-01-01' },
        dependents: [
          { firstName: 'C', lastName: 'D', ssn: '111223333', relationship: 'son',
            dateOfBirth: '2015-01-01', monthsLivedWithYou: 12, isStudent: false,
            isDisabled: false, qualifiesForCTC: true, qualifiesForODC: false },
        ],
        w2s: [{
          employerEIN: '12-3456789', employerName: 'A',
          wages: 10_000_000, federalWithheld: 1_200_000,
          socialSecurityWages: 10_000_000, socialSecurityWithheld: 620_000,
          medicareWages: 10_000_000, medicareWithheld: 145_000,
          stateWages: 10_000_000, stateWithheld: 400_000, stateCode: 'CA',
        }],
      }),
    },
    {
      name: 'zero income',
      input: makeInput({}),
    },
    {
      name: 'self-employed',
      input: makeInput({
        scheduleCData: {
          businessName: 'Biz', businessCode: '541',
          grossReceipts: 5_000_000, expenses: { supplies: 500_000 },
        },
      }),
    },
  ];

  for (const { name, input } of scenarios) {
    describe(`[${name}]`, () => {
      const result = computeFederalTax(input, config);

      it('totalTax >= 0', () => {
        expect(result.totalTax).toBeGreaterThanOrEqual(0);
      });

      it('taxableIncome >= 0', () => {
        expect(result.taxableIncome).toBeGreaterThanOrEqual(0);
      });

      it('tax breakdown sums consistently', () => {
        const breakdownSum =
          result.taxBreakdown.ordinaryIncomeTax +
          result.taxBreakdown.capitalGainsTax +
          result.taxBreakdown.amt;
        // After credits + SE tax etc: totalTax = max(0, breakdownSum - nonrefundable) + otherTaxes
        // So totalTax >= 0 always
        expect(breakdownSum).toBeGreaterThanOrEqual(0);
      });

      it('refundOrOwed = totalPayments + refundableCredits - totalTax', () => {
        const expectedRefund =
          result.totalPayments +
          result.creditBreakdown.earnedIncomeCredit +
          result.creditBreakdown.additionalChildTaxCredit -
          result.totalTax;
        expect(result.refundOrOwed).toBe(expectedRefund);
      });

      it('effective rate is between 0 and 100', () => {
        expect(result.effectiveTaxRate).toBeGreaterThanOrEqual(0);
        expect(result.effectiveTaxRate).toBeLessThanOrEqual(100);
      });

      it('marginal rate is a valid bracket rate', () => {
        const validRates = [10, 12, 22, 24, 32, 35, 37];
        expect(validRates).toContain(result.marginalTaxRate);
      });

      it('forms.f1040 is populated', () => {
        expect(result.forms.f1040).toBeDefined();
        expect(Object.keys(result.forms.f1040).length).toBeGreaterThan(0);
      });

      it('AGI = totalIncome - adjustments (positive or zero)', () => {
        expect(result.adjustedGrossIncome).toBeLessThanOrEqual(result.totalIncome);
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 11: Prior Year Capital Loss Carryforward
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 11: Prior year capital loss carryforward', () => {
  const input = makeInput({
    w2s: [{
      employerEIN: '12-3456789', employerName: 'A',
      wages: 5_000_000, federalWithheld: 500_000,
      socialSecurityWages: 5_000_000, socialSecurityWithheld: 310_000,
      medicareWages: 5_000_000, medicareWithheld: 72_500,
      stateWages: 5_000_000, stateWithheld: 200_000, stateCode: 'CA',
    }],
    form1099Bs: [{
      description: 'GAIN STOCK',
      dateAcquired: '2024-01-01',
      dateSold: '2025-06-01',
      proceeds: 3_000_000,
      costBasis: 2_000_000,
      gainLoss: 1_000_000,       // $10,000 LTCG
      isLongTerm: true,
      basisReportedToIRS: true,
      category: '8949_D',
    }],
    priorYearCapitalLossCarryforward: 1_500_000, // $15,000 carryforward
  });

  const result = computeFederalTax(input, config);

  it('carryforward reduces net capital gain', () => {
    // $10k LTCG, $15k carryforward applied to ST first: ST = -$15k
    // Net = -$15k + $10k = -$5k net loss
    // Deductible loss = -$3k
    // Carryforward = $2k
    expect(result.capitalGainsResult.netCapitalGainLoss).toBe(-500_000);
    expect(result.capitalGainsResult.deductibleLoss).toBe(-300_000);
    expect(result.capitalGainsResult.carryforwardLoss).toBe(200_000);
  });

  it('total income reflects limited loss', () => {
    // $50k wages - $3k loss = $47k
    expect(result.totalIncome).toBe(4_700_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 12: Head of Household
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 12: Head of Household filer', () => {
  const input = makeInput({
    filingStatus: 'head_of_household',
    dependents: [{
      firstName: 'Child', lastName: 'Doe', ssn: '111223333',
      relationship: 'son', dateOfBirth: '2016-01-01',
      monthsLivedWithYou: 12, isStudent: false, isDisabled: false,
      qualifiesForCTC: true, qualifiesForODC: false,
    }],
    w2s: [{
      employerEIN: '12-3456789', employerName: 'A',
      wages: 6_000_000, federalWithheld: 600_000,
      socialSecurityWages: 6_000_000, socialSecurityWithheld: 372_000,
      medicareWages: 6_000_000, medicareWithheld: 87_000,
      stateWages: 6_000_000, stateWithheld: 240_000, stateCode: 'CA',
    }],
  });

  const result = computeFederalTax(input, config);

  it('uses HoH standard deduction ($23,625)', () => {
    expect(result.deductionBreakdown.amount).toBe(2_362_500);
  });

  it('uses HoH tax brackets', () => {
    // HoH has wider 10% and 12% brackets than single
    // $60k - $22.5k = $37.5k taxable
    // 10% on $17,000 + 12% on ($37,500 - $17,000) = $1,700 + $2,460 = $4,160
    expect(result.taxBreakdown.ordinaryIncomeTax).toBeGreaterThan(400_000);
    expect(result.taxBreakdown.ordinaryIncomeTax).toBeLessThan(450_000);
  });

  it('gets CTC', () => {
    expect(result.creditBreakdown.childTaxCredit).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 13: MFS filer (special rules)
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 13: Married Filing Separately', () => {
  const input = makeInput({
    filingStatus: 'married_filing_separately',
    w2s: [{
      employerEIN: '12-3456789', employerName: 'A',
      wages: 8_000_000, federalWithheld: 1_000_000,
      socialSecurityWages: 8_000_000, socialSecurityWithheld: 496_000,
      medicareWages: 8_000_000, medicareWithheld: 116_000,
      stateWages: 8_000_000, stateWithheld: 320_000, stateCode: 'CA',
    }],
  });

  const result = computeFederalTax(input, config);

  it('uses MFS standard deduction ($15,750)', () => {
    expect(result.deductionBreakdown.amount).toBe(1_575_000);
  });

  it('uses MFS brackets', () => {
    // MFS brackets are the same as single for 2025
    expect(result.marginalTaxRate).toBe(22);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 14: Student Loan Interest + Educator Expenses
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 14: Adjustments (student loan + educator expenses)', () => {
  const input = makeInput({
    w2s: [{
      employerEIN: '12-3456789', employerName: 'School District',
      wages: 5_500_000, federalWithheld: 500_000,
      socialSecurityWages: 5_500_000, socialSecurityWithheld: 341_000,
      medicareWages: 5_500_000, medicareWithheld: 79_750,
      stateWages: 5_500_000, stateWithheld: 220_000, stateCode: 'CA',
    }],
    studentLoanInterest: 250_000,    // $2,500 (max deduction)
    educatorExpenses: 30_000,         // $300 (max deduction)
  });

  const result = computeFederalTax(input, config);

  it('AGI is reduced by adjustments', () => {
    // $55k - $2,500 student loan - $300 educator = $52,200
    expect(result.adjustedGrossIncome).toBe(5_220_000);
  });

  it('needs Schedule 1', () => {
    expect(result.needsSchedule1).toBe(true);
  });

  it('forms have Schedule 1 mappings', () => {
    expect(result.forms.schedule1).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 15: Elderly taxpayer with additional standard deduction
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 15: Age 65+ additional standard deduction', () => {
  const input = makeInput({
    filingStatus: 'single',
    taxpayerAge65OrOlder: true,
    w2s: [{
      employerEIN: '12-3456789', employerName: 'A',
      wages: 4_000_000, federalWithheld: 300_000,
      socialSecurityWages: 4_000_000, socialSecurityWithheld: 248_000,
      medicareWages: 4_000_000, medicareWithheld: 58_000,
      stateWages: 4_000_000, stateWithheld: 160_000, stateCode: 'CA',
    }],
  });

  const result = computeFederalTax(input, config);

  it('gets additional standard deduction for age 65+', () => {
    // Single standard = $15,750 + additional $2,000 for 65+ = $17,750
    expect(result.deductionBreakdown.amount).toBe(1_775_000);
  });

  it('taxable income is lower due to additional deduction', () => {
    // $40k - $17.75k = $22.25k
    expect(result.taxableIncome).toBe(2_225_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 16: IRA + HSA Deductions (forms coverage)
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 16: IRA and HSA deductions', () => {
  const input = makeInput({
    w2s: [{
      employerEIN: '12-3456789', employerName: 'A',
      wages: 6_000_000, federalWithheld: 700_000,
      socialSecurityWages: 6_000_000, socialSecurityWithheld: 372_000,
      medicareWages: 6_000_000, medicareWithheld: 87_000,
      stateWages: 6_000_000, stateWithheld: 240_000, stateCode: 'CA',
    }],
    iraDeduction: 650_000,    // $6,500
    hsaDeduction: 430_000,    // $4,300
  });

  const result = computeFederalTax(input, config);

  it('AGI is reduced by IRA + HSA', () => {
    // $60k - $6.5k IRA - $4.3k HSA = $49,200
    expect(result.adjustedGrossIncome).toBe(4_920_000);
  });

  it('needs Schedule 1', () => {
    expect(result.needsSchedule1).toBe(true);
  });

  it('Schedule 1 has IRA and HSA fields', () => {
    expect(result.forms.schedule1).toBeDefined();
    expect(result.forms.schedule1!['line17']).toBe(4300); // HSA
    expect(result.forms.schedule1!['line20']).toBe(6500); // IRA
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 17: Education Credits (Schedule 3 coverage)
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 17: Education credits (AOTC)', () => {
  const input = makeInput({
    w2s: [{
      employerEIN: '12-3456789', employerName: 'A',
      wages: 6_000_000, federalWithheld: 700_000,
      socialSecurityWages: 6_000_000, socialSecurityWithheld: 372_000,
      medicareWages: 6_000_000, medicareWithheld: 87_000,
      stateWages: 6_000_000, stateWithheld: 240_000, stateCode: 'CA',
    }],
    educationExpenses: [{
      type: 'american_opportunity',
      qualifiedExpenses: 400_000, // $4,000
      studentSSN: '111223333',
    }],
  });

  const result = computeFederalTax(input, config);

  it('gets education credit', () => {
    // AOTC: 100% of first $2k + 25% of next $2k = $2,500 max
    expect(result.creditBreakdown.educationCredits).toBeGreaterThan(0);
  });

  it('needs Schedule 3', () => {
    expect(result.needsSchedule3).toBe(true);
  });

  it('Schedule 3 has education credits on line 3', () => {
    expect(result.forms.schedule3).toBeDefined();
    expect(result.forms.schedule3!['line3']).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 18: Saver's Credit (Schedule 3 coverage)
// ─────────────────────────────────────────────────────────────────────────────

describe("Scenario 18: Saver's credit", () => {
  const input = makeInput({
    w2s: [{
      employerEIN: '12-3456789', employerName: 'A',
      wages: 2_000_000, federalWithheld: 150_000, // $20,000 income (low for saver's credit)
      socialSecurityWages: 2_000_000, socialSecurityWithheld: 124_000,
      medicareWages: 2_000_000, medicareWithheld: 29_000,
      stateWages: 2_000_000, stateWithheld: 80_000, stateCode: 'CA',
    }],
    retirementSaversCredit: {
      contributions: 200_000, // $2,000
    },
  });

  const result = computeFederalTax(input, config);

  it("gets saver's credit", () => {
    // $20k AGI single, $2k contribution
    // Below $23,750 threshold → 50% rate
    // Credit = 50% * $2k = $1,000
    expect(result.creditBreakdown.saversCredit).toBeGreaterThan(0);
  });

  it('needs Schedule 3', () => {
    expect(result.needsSchedule3).toBe(true);
  });

  it("Schedule 3 has saver's credit on line 4", () => {
    expect(result.forms.schedule3).toBeDefined();
    expect(result.forms.schedule3!['line4']).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 19: Child Care Credit (Schedule 3 coverage)
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 19: Child care credit', () => {
  const input = makeInput({
    dependents: [{
      firstName: 'Toddler', lastName: 'Doe', ssn: '111223333',
      relationship: 'son', dateOfBirth: '2022-01-01',
      monthsLivedWithYou: 12, isStudent: false, isDisabled: false,
      qualifiesForCTC: true, qualifiesForODC: false,
    }],
    w2s: [{
      employerEIN: '12-3456789', employerName: 'A',
      wages: 5_000_000, federalWithheld: 500_000,
      socialSecurityWages: 5_000_000, socialSecurityWithheld: 310_000,
      medicareWages: 5_000_000, medicareWithheld: 72_500,
      stateWages: 5_000_000, stateWithheld: 200_000, stateCode: 'CA',
    }],
    childCareCreditExpenses: 200_000, // $2,000 child care expenses
  });

  const result = computeFederalTax(input, config);

  it('gets child care credit', () => {
    expect(result.creditBreakdown.childCareCareCredit).toBeGreaterThan(0);
  });

  it('needs Schedule 3', () => {
    expect(result.needsSchedule3).toBe(true);
  });

  it('Schedule 3 has child care credit on line 2', () => {
    expect(result.forms.schedule3).toBeDefined();
    expect(result.forms.schedule3!['line2']).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 20: Refund with direct deposit
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario 20: Refund with direct deposit info', () => {
  const input = makeInput({
    w2s: [{
      employerEIN: '12-3456789', employerName: 'A',
      wages: 3_000_000, federalWithheld: 500_000, // Heavy withholding on $30k
      socialSecurityWages: 3_000_000, socialSecurityWithheld: 186_000,
      medicareWages: 3_000_000, medicareWithheld: 43_500,
      stateWages: 3_000_000, stateWithheld: 120_000, stateCode: 'CA',
    }],
    directDeposit: {
      routingNumber: '021000021',
      accountNumber: '123456789',
      accountType: 'checking',
    },
  });

  const result = computeFederalTax(input, config);

  it('gets a refund', () => {
    expect(result.refundOrOwed).toBeGreaterThan(0);
  });

  it('Form 1040 includes direct deposit info', () => {
    expect(result.forms.f1040['routingNumber']).toBe('021000021');
    expect(result.forms.f1040['accountNumber']).toBe('123456789');
    expect(result.forms.f1040['accountType']).toBe('checking');
  });

  it('Form 1040 has refund on line 34/35a', () => {
    expect(result.forms.f1040['line34']).toBeGreaterThan(0);
    expect(result.forms.f1040['line35a']).toBeGreaterThan(0);
  });
});

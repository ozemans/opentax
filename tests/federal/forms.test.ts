import { describe, it, expect } from 'vitest';
import { generateFormMappings } from '../../src/engine/federal/forms';
import type {
  TaxInput,
  TaxResult,
  CapitalGainsResult,
  Form8949Category,
  Form1099B,
} from '../../src/engine/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<TaxInput> = {}): TaxInput {
  return {
    taxYear: 2025,
    filingStatus: 'single',
    taxpayer: { firstName: 'Jane', lastName: 'Doe', ssn: '123456789', dateOfBirth: '1990-01-01' },
    dependents: [],
    address: { street: '100 Main St', city: 'Testville', state: 'TX', zip: '75001' },
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
    netShortTerm: 0,
    longTermGains: 0,
    longTermLosses: 0,
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

function makeResult(overrides: Partial<TaxResult> = {}): TaxResult {
  return {
    totalIncome: 5_000_000,
    adjustedGrossIncome: 5_000_000,
    taxableIncome: 4_000_000,
    totalTax: 500_000,
    totalCredits: 0,
    totalPayments: 600_000,
    refundOrOwed: 100_000,
    effectiveTaxRate: 10,
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
      ordinaryIncomeTax: 500_000,
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
    forms: { f1040: {} },
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

// ---------------------------------------------------------------------------
// Form 1040
// ---------------------------------------------------------------------------

describe('mapForm1040 (via generateFormMappings)', () => {
  it('should map personal info correctly', () => {
    const input = makeInput();
    const result = makeResult();
    const forms = generateFormMappings(input, result);

    expect(forms.f1040['firstName']).toBe('Jane');
    expect(forms.f1040['lastName']).toBe('Doe');
    expect(forms.f1040['ssn']).toBe('123-45-6789');
    expect(forms.f1040['address']).toBe('100 Main St');
    expect(forms.f1040['city']).toBe('Testville');
    expect(forms.f1040['state']).toBe('TX');
    expect(forms.f1040['zip']).toBe('75001');
  });

  it('should map income lines to dollars', () => {
    const result = makeResult({
      incomeBreakdown: {
        wages: 7_500_000, // $75,000
        interest: 100_000, // $1,000
        ordinaryDividends: 200_000,
        qualifiedDividends: 150_000,
        shortTermCapitalGains: 0,
        longTermCapitalGains: 0,
        selfEmploymentIncome: 0,
        unemployment: 0,
        retirementDistributions: 0,
        otherIncome: 0,
      },
    });
    const forms = generateFormMappings(makeInput(), result);

    expect(forms.f1040['line1']).toBe(75_000);
    expect(forms.f1040['line2b']).toBe(1_000);
    expect(forms.f1040['line3a']).toBe(1_500);
    expect(forms.f1040['line3b']).toBe(2_000);
  });

  it('should map spouse info when present', () => {
    const input = makeInput({
      spouse: { firstName: 'John', lastName: 'Doe', ssn: '987654321', dateOfBirth: '1988-05-15' },
    });
    const forms = generateFormMappings(input, makeResult());

    expect(forms.f1040['spouseFirstName']).toBe('John');
    expect(forms.f1040['spouseLastName']).toBe('Doe');
    expect(forms.f1040['spouseSSN']).toBe('987-65-4321');
  });

  it('should map refund with direct deposit', () => {
    const input = makeInput({
      directDeposit: {
        routingNumber: '021000021',
        accountNumber: '123456789',
        accountType: 'checking',
      },
    });
    const result = makeResult({ refundOrOwed: 250_000 }); // $2,500 refund
    const forms = generateFormMappings(input, result);

    expect(forms.f1040['line34']).toBe(2_500);
    expect(forms.f1040['line35a']).toBe(2_500);
    expect(forms.f1040['routingNumber']).toBe('021000021');
    expect(forms.f1040['accountType']).toBe('checking');
  });

  it('should map amount owed when negative refundOrOwed', () => {
    const result = makeResult({ refundOrOwed: -100_000 }); // $1,000 owed
    const forms = generateFormMappings(makeInput(), result);

    expect(forms.f1040['line37']).toBe(1_000);
    expect(forms.f1040['line34']).toBeUndefined();
  });

  it('should include dependents', () => {
    const input = makeInput({
      dependents: [
        {
          firstName: 'Child', lastName: 'Doe', ssn: '111223333',
          relationship: 'son', dateOfBirth: '2015-01-01', monthsLivedWithYou: 12,
          isStudent: false, isDisabled: false, qualifiesForCTC: true, qualifiesForODC: false,
        },
      ],
    });
    const forms = generateFormMappings(input, makeResult());

    expect(forms.f1040['dependent1_name']).toBe('Child Doe');
    expect(forms.f1040['dependent1_ssn']).toBe('111-22-3333');
    expect(forms.f1040['dependent1_relationship']).toBe('son');
    expect(forms.f1040['dependent1_ctc']).toBe('X');
  });
});

// ---------------------------------------------------------------------------
// Schedule 1
// ---------------------------------------------------------------------------

describe('mapSchedule1', () => {
  it('should map self-employment income and adjustments', () => {
    const result = makeResult({
      needsSchedule1: true,
      incomeBreakdown: {
        wages: 0,
        interest: 0,
        ordinaryDividends: 0,
        qualifiedDividends: 0,
        shortTermCapitalGains: 0,
        longTermCapitalGains: 0,
        selfEmploymentIncome: 10_000_000, // $100,000
        unemployment: 0,
        retirementDistributions: 0,
        otherIncome: 0,
      },
      selfEmploymentResult: {
        scheduleCNetProfit: 10_000_000,
        homeOfficeDeduction: 0,
        seTaxableIncome: 9_235_000,
        socialSecurityTax: 1_145_140,
        medicareTax: 267_815,
        totalSETax: 1_412_955,
        halfSETaxDeduction: 706_478,
        qbiDeduction: 0,
      },
    });
    const forms = generateFormMappings(makeInput(), result);

    expect(forms.schedule1).toBeDefined();
    expect(forms.schedule1!['line3']).toBe(100_000);
    expect(forms.schedule1!['line15']).toBe(7_065); // $706,478 cents → $7,065
  });

  it('should map unemployment and other income on Schedule 1', () => {
    const result = makeResult({
      needsSchedule1: true,
      incomeBreakdown: {
        wages: 5_000_000,
        interest: 0,
        ordinaryDividends: 0,
        qualifiedDividends: 0,
        shortTermCapitalGains: 0,
        longTermCapitalGains: 0,
        selfEmploymentIncome: 0,
        unemployment: 1_200_000, // $12,000
        retirementDistributions: 0,
        otherIncome: 500_000, // $5,000
      },
    });
    const forms = generateFormMappings(makeInput(), result);

    expect(forms.schedule1).toBeDefined();
    expect(forms.schedule1!['line7']).toBe(12_000);
    expect(forms.schedule1!['line10']).toBe(5_000);
  });

  it('should map HSA, IRA, student loan, and educator adjustments', () => {
    const input = makeInput({
      hsaDeduction: 350_000,
      iraDeduction: 600_000,
      studentLoanInterest: 200_000,
      educatorExpenses: 25_000,
    });
    const result = makeResult({ needsSchedule1: true });
    const forms = generateFormMappings(input, result);

    expect(forms.schedule1).toBeDefined();
    expect(forms.schedule1!['line17']).toBe(3_500);
    expect(forms.schedule1!['line20']).toBe(6_000);
    expect(forms.schedule1!['line21']).toBe(2_000);
    expect(forms.schedule1!['line11']).toBe(250);
  });

  it('should not generate schedule1 when not needed', () => {
    const forms = generateFormMappings(makeInput(), makeResult());
    expect(forms.schedule1).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Schedule A
// ---------------------------------------------------------------------------

describe('mapScheduleA', () => {
  it('should map itemized deduction details', () => {
    const result = makeResult({
      needsScheduleA: true,
      adjustedGrossIncome: 10_000_000,
      deductionBreakdown: {
        type: 'itemized',
        amount: 2_500_000,
        standardAmount: 1_500_000,
        itemizedAmount: 2_500_000,
        itemizedDetails: {
          medicalExpenses: 1_200_000,
          stateLocalTaxesPaid: 800_000,
          realEstateTaxes: 200_000,
          mortgageInterest: 500_000,
          charitableCash: 300_000,
          charitableNonCash: 100_000,
          saltCapped: 1_000_000,
        },
      },
    });
    const forms = generateFormMappings(makeInput(), result);

    expect(forms.scheduleA).toBeDefined();
    expect(forms.scheduleA!['line1']).toBe(12_000); // $1,200,000 → $12,000
    expect(forms.scheduleA!['line5d']).toBe(10_000); // SALT capped
    expect(forms.scheduleA!['line8a']).toBe(5_000);
    expect(forms.scheduleA!['line11']).toBe(3_000);
    expect(forms.scheduleA!['line12']).toBe(1_000);
    expect(forms.scheduleA!['line17']).toBe(25_000);
  });
});

// ---------------------------------------------------------------------------
// Schedule B
// ---------------------------------------------------------------------------

describe('mapScheduleB', () => {
  it('should map interest and dividend payer details', () => {
    const input = makeInput({
      form1099INTs: [
        { payerName: 'First Bank', interest: 100_000 },
        { payerName: 'Second Bank', interest: 75_000 },
      ],
      form1099DIVs: [
        { payerName: 'Vanguard Fund', ordinaryDividends: 200_000, qualifiedDividends: 150_000, totalCapitalGain: 0 },
      ],
    });
    const result = makeResult({
      needsScheduleB: true,
      incomeBreakdown: {
        wages: 0,
        interest: 175_000, // $1,750
        ordinaryDividends: 200_000,
        qualifiedDividends: 150_000,
        shortTermCapitalGains: 0,
        longTermCapitalGains: 0,
        selfEmploymentIncome: 0,
        unemployment: 0,
        retirementDistributions: 0,
        otherIncome: 0,
      },
    });
    const forms = generateFormMappings(input, result);

    expect(forms.scheduleB).toBeDefined();
    expect(forms.scheduleB!['interest_payer_1']).toBe('First Bank');
    expect(forms.scheduleB!['interest_amount_1']).toBe(1_000);
    expect(forms.scheduleB!['interest_payer_2']).toBe('Second Bank');
    expect(forms.scheduleB!['interest_amount_2']).toBe(750);
    expect(forms.scheduleB!['totalInterest']).toBe(1_750);
    expect(forms.scheduleB!['dividend_payer_1']).toBe('Vanguard Fund');
    expect(forms.scheduleB!['dividend_amount_1']).toBe(2_000);
    expect(forms.scheduleB!['totalDividends']).toBe(2_000);
  });

  it('should not generate scheduleB when not needed', () => {
    const forms = generateFormMappings(makeInput(), makeResult());
    expect(forms.scheduleB).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Schedule C
// ---------------------------------------------------------------------------

describe('mapScheduleC', () => {
  it('should map business income and expenses', () => {
    const input = makeInput({
      scheduleCData: {
        businessName: 'Doe Consulting',
        businessCode: '541990',
        grossReceipts: 15_000_000,
        costOfGoodsSold: 500_000,
        expenses: {
          advertising: 100_000,
          officeExpenses: 200_000,
          supplies: 50_000,
          utilities: 75_000,
        },
      },
    });
    const result = makeResult({
      needsScheduleC: true,
      selfEmploymentResult: {
        scheduleCNetProfit: 14_075_000, // $15M - $500K - $425K
        homeOfficeDeduction: 0,
        seTaxableIncome: 12_994_263,
        socialSecurityTax: 0,
        medicareTax: 0,
        totalSETax: 0,
        halfSETaxDeduction: 0,
        qbiDeduction: 0,
      },
    });
    const forms = generateFormMappings(input, result);

    expect(forms.scheduleC).toBeDefined();
    expect(forms.scheduleC!['businessName']).toBe('Doe Consulting');
    expect(forms.scheduleC!['businessCode']).toBe('541990');
    expect(forms.scheduleC!['grossReceipts']).toBe(150_000);
    expect(forms.scheduleC!['costOfGoodsSold']).toBe(5_000);
    expect(forms.scheduleC!['grossIncome']).toBe(145_000); // (15M - 500K) / 100
    expect(forms.scheduleC!['advertising']).toBe(1_000);
    expect(forms.scheduleC!['officeExpenses']).toBe(2_000);
    expect(forms.scheduleC!['supplies']).toBe(500);
    expect(forms.scheduleC!['utilities']).toBe(750);
    expect(forms.scheduleC!['totalExpenses']).toBe(4_250);
    expect(forms.scheduleC!['netProfit']).toBe(140_750);
  });

  it('should include home office deduction when present', () => {
    const input = makeInput({
      scheduleCData: {
        businessName: 'Test Biz',
        businessCode: '541000',
        grossReceipts: 5_000_000,
        expenses: {},
        homeOffice: { squareFootage: 200, useSimplifiedMethod: true },
      },
    });
    const result = makeResult({
      needsScheduleC: true,
      selfEmploymentResult: {
        scheduleCNetProfit: 4_900_000,
        homeOfficeDeduction: 100_000, // $1,000 (200 sqft * $5)
        seTaxableIncome: 0,
        socialSecurityTax: 0,
        medicareTax: 0,
        totalSETax: 0,
        halfSETaxDeduction: 0,
        qbiDeduction: 0,
      },
    });
    const forms = generateFormMappings(input, result);

    expect(forms.scheduleC!['homeOfficeDeduction']).toBe(1_000);
  });

  it('should include otherIncome when present on Schedule C', () => {
    const input = makeInput({
      scheduleCData: {
        businessName: 'Other Biz',
        businessCode: '541000',
        grossReceipts: 5_000_000,
        otherIncome: 200_000,
        expenses: {},
      },
    });
    const result = makeResult({
      needsScheduleC: true,
      selfEmploymentResult: {
        scheduleCNetProfit: 5_200_000,
        homeOfficeDeduction: 0,
        seTaxableIncome: 0,
        socialSecurityTax: 0,
        medicareTax: 0,
        totalSETax: 0,
        halfSETaxDeduction: 0,
        qbiDeduction: 0,
      },
    });
    const forms = generateFormMappings(input, result);

    expect(forms.scheduleC!['otherIncome']).toBe(2_000);
  });

  it('should not generate scheduleC when not needed', () => {
    const forms = generateFormMappings(makeInput(), makeResult());
    expect(forms.scheduleC).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Schedule D
// ---------------------------------------------------------------------------

describe('mapScheduleD', () => {
  it('should map capital gains fields', () => {
    const result = makeResult({
      needsScheduleD: true,
      capitalGainsResult: {
        ...emptyCapitalGains(),
        netShortTerm: -200_000,
        netLongTerm: 500_000,
        netCapitalGainLoss: 300_000,
      },
    });
    const forms = generateFormMappings(makeInput(), result);

    expect(forms.scheduleD).toBeDefined();
    expect(forms.scheduleD!['shortTermGainLoss']).toBe(-2_000);
    expect(forms.scheduleD!['longTermGainLoss']).toBe(5_000);
    expect(forms.scheduleD!['netGainLoss']).toBe(3_000);
  });

  it('should map deductible loss and carryforward', () => {
    const result = makeResult({
      needsScheduleD: true,
      capitalGainsResult: {
        ...emptyCapitalGains(),
        netShortTerm: -500_000,
        netLongTerm: 0,
        netCapitalGainLoss: -500_000,
        deductibleLoss: -300_000, // $3,000 limit
        carryforwardLoss: 200_000,
      },
    });
    const forms = generateFormMappings(makeInput(), result);

    expect(forms.scheduleD!['deductibleLoss']).toBe(-3_000);
    expect(forms.scheduleD!['carryforward']).toBe(2_000);
  });

  it('should not generate scheduleD when not needed', () => {
    const forms = generateFormMappings(makeInput(), makeResult());
    expect(forms.scheduleD).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Schedule SE
// ---------------------------------------------------------------------------

describe('mapScheduleSE', () => {
  it('should map self-employment tax fields', () => {
    const result = makeResult({
      needsScheduleSE: true,
      selfEmploymentResult: {
        scheduleCNetProfit: 10_000_000,
        homeOfficeDeduction: 0,
        seTaxableIncome: 9_235_000,
        socialSecurityTax: 1_145_140,
        medicareTax: 267_815,
        totalSETax: 1_412_955,
        halfSETaxDeduction: 706_478,
        qbiDeduction: 0,
      },
    });
    const forms = generateFormMappings(makeInput(), result);

    expect(forms.scheduleSE).toBeDefined();
    expect(forms.scheduleSE!['netEarnings']).toBe(92_350);
    expect(forms.scheduleSE!['socialSecurityTax']).toBe(11_451);
    expect(forms.scheduleSE!['medicareTax']).toBe(2_678);
    expect(forms.scheduleSE!['totalSETax']).toBe(14_130);
    expect(forms.scheduleSE!['deductibleHalf']).toBe(7_065);
  });

  it('should not generate scheduleSE when not needed', () => {
    const forms = generateFormMappings(makeInput(), makeResult());
    expect(forms.scheduleSE).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Form 8949
// ---------------------------------------------------------------------------

describe('mapForm8949', () => {
  it('should map transactions as an array of records', () => {
    const tx1: Form1099B = {
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
    const tx2: Form1099B = {
      description: '50 GOOG',
      dateAcquired: '2025-03-01',
      dateSold: '2025-04-15',
      proceeds: 1_000_000,
      costBasis: 1_200_000,
      gainLoss: -200_000,
      isLongTerm: false,
      basisReportedToIRS: true,
      category: '8949_A' as Form8949Category,
    };
    const input = makeInput({ form1099Bs: [tx1, tx2] });
    const result = makeResult({ needsForm8949: true });
    const forms = generateFormMappings(input, result);

    expect(forms.f8949).toBeDefined();
    expect(forms.f8949).toHaveLength(2);
    expect(forms.f8949![0]['description']).toBe('100 AAPL');
    expect(forms.f8949![0]['proceeds']).toBe(20_000);
    expect(forms.f8949![0]['basis']).toBe(15_000);
    expect(forms.f8949![0]['gainLoss']).toBe(5_000);
    expect(forms.f8949![1]['description']).toBe('50 GOOG');
    expect(forms.f8949![1]['gainLoss']).toBe(-2_000);
  });

  it('should not generate f8949 when not needed', () => {
    const forms = generateFormMappings(makeInput(), makeResult());
    expect(forms.f8949).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Form 8959
// ---------------------------------------------------------------------------

describe('mapForm8959', () => {
  it('should map additional medicare tax fields', () => {
    const input = makeInput({
      w2s: [{
        employerEIN: '12-3456789',
        employerName: 'Corp',
        wages: 30_000_000,
        federalWithheld: 5_000_000,
        socialSecurityWages: 17_600_000,
        socialSecurityWithheld: 1_092_800,
        medicareWages: 30_000_000,
        medicareWithheld: 435_000,
        stateWages: 30_000_000,
        stateWithheld: 1_500_000,
        stateCode: 'CA',
      }],
    });
    const result = makeResult({
      needsForm8959: true,
      taxBreakdown: {
        ordinaryIncomeTax: 5_000_000,
        capitalGainsTax: 0,
        selfEmploymentTax: 0,
        additionalMedicareTax: 90_000, // (300K - 200K) * 0.009 = $900
        netInvestmentIncomeTax: 0,
        amt: 0,
      },
    });
    const forms = generateFormMappings(input, result);

    expect(forms.f8959).toBeDefined();
    expect(forms.f8959!['medicareWages']).toBe(300_000);
    expect(forms.f8959!['additionalMedicareTax']).toBe(900);
    expect(forms.f8959!['w2MedicareWithheld']).toBe(4_350);
  });

  it('should include self-employment Medicare wages when present', () => {
    const input = makeInput({
      w2s: [{
        employerEIN: '12-3456789', employerName: 'Corp',
        wages: 20_000_000, federalWithheld: 3_000_000,
        socialSecurityWages: 17_600_000, socialSecurityWithheld: 1_092_800,
        medicareWages: 20_000_000, medicareWithheld: 290_000,
        stateWages: 20_000_000, stateWithheld: 1_000_000, stateCode: 'CA',
      }],
    });
    const result = makeResult({
      needsForm8959: true,
      selfEmploymentResult: {
        scheduleCNetProfit: 5_000_000,
        homeOfficeDeduction: 0,
        seTaxableIncome: 4_617_500,
        socialSecurityTax: 0,
        medicareTax: 0,
        totalSETax: 0,
        halfSETaxDeduction: 0,
        qbiDeduction: 0,
      },
      taxBreakdown: {
        ordinaryIncomeTax: 3_000_000,
        capitalGainsTax: 0,
        selfEmploymentTax: 500_000,
        additionalMedicareTax: 45_000,
        netInvestmentIncomeTax: 0,
        amt: 0,
      },
    });
    const forms = generateFormMappings(input, result);

    expect(forms.f8959).toBeDefined();
    expect(forms.f8959!['selfEmploymentMedicareWages']).toBe(46_175);
    expect(forms.f8959!['combinedMedicareWages']).toBe(246_175); // 200K + 46,175
  });

  it('should not generate f8959 when not needed', () => {
    const forms = generateFormMappings(makeInput(), makeResult());
    expect(forms.f8959).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Form 8960
// ---------------------------------------------------------------------------

describe('mapForm8960', () => {
  it('should map NIIT fields', () => {
    const input = makeInput({
      form1099INTs: [{ payerName: 'Bank', interest: 500_000 }],
      form1099DIVs: [{
        payerName: 'Fund', ordinaryDividends: 300_000,
        qualifiedDividends: 200_000, totalCapitalGain: 0,
      }],
    });
    const result = makeResult({
      needsForm8960: true,
      adjustedGrossIncome: 25_000_000,
      capitalGainsResult: {
        ...emptyCapitalGains(),
        netCapitalGainLoss: 200_000,
      },
      taxBreakdown: {
        ordinaryIncomeTax: 3_000_000,
        capitalGainsTax: 0,
        selfEmploymentTax: 0,
        additionalMedicareTax: 0,
        netInvestmentIncomeTax: 38_000, // 3.8% of investment income
        amt: 0,
      },
    });
    const forms = generateFormMappings(input, result);

    expect(forms.f8960).toBeDefined();
    expect(forms.f8960!['interestIncome']).toBe(5_000);
    expect(forms.f8960!['dividendIncome']).toBe(3_000);
    expect(forms.f8960!['capitalGainsIncome']).toBe(2_000);
    expect(forms.f8960!['magi']).toBe(250_000);
    expect(forms.f8960!['niitAmount']).toBe(380);
  });

  it('should not generate f8960 when not needed', () => {
    const forms = generateFormMappings(makeInput(), makeResult());
    expect(forms.f8960).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Schedule 2
// ---------------------------------------------------------------------------

describe('mapSchedule2', () => {
  it('should map AMT and additional taxes', () => {
    const result = makeResult({
      needsSchedule2: true,
      taxBreakdown: {
        ordinaryIncomeTax: 3_000_000,
        capitalGainsTax: 0,
        selfEmploymentTax: 1_000_000,
        additionalMedicareTax: 50_000,
        netInvestmentIncomeTax: 30_000,
        amt: 200_000,
      },
    });
    const forms = generateFormMappings(makeInput(), result);

    expect(forms.schedule2).toBeDefined();
    expect(forms.schedule2!['line1']).toBe(2_000); // AMT
    expect(forms.schedule2!['line6']).toBe(10_000); // SE tax
    expect(forms.schedule2!['line11']).toBe(500); // Additional Medicare
    expect(forms.schedule2!['line12']).toBe(300); // NIIT
    expect(forms.schedule2!['line21']).toBe(10_800); // Total: 10K + 500 + 300
  });
});

// ---------------------------------------------------------------------------
// Schedule 3
// ---------------------------------------------------------------------------

describe('mapSchedule3', () => {
  it('should map additional credits', () => {
    const result = makeResult({
      needsSchedule3: true,
      creditBreakdown: {
        childTaxCredit: 0,
        additionalChildTaxCredit: 0,
        otherDependentCredit: 0,
        earnedIncomeCredit: 0,
        childCareCareCredit: 200_000,
        educationCredits: 250_000,
        saversCredit: 100_000,
      },
    });
    const forms = generateFormMappings(makeInput(), result);

    expect(forms.schedule3).toBeDefined();
    expect(forms.schedule3!['line2']).toBe(2_000);
    expect(forms.schedule3!['line3']).toBe(2_500);
    expect(forms.schedule3!['line4']).toBe(1_000);
  });
});

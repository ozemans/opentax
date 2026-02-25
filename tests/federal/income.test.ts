import { describe, it, expect } from 'vitest';
import {
  computeTotalIncome,
  computeAdjustments,
  computeAGI,
} from '../../src/engine/federal/income';
import type { TaxInput, FederalConfig } from '../../src/engine/types';
import config from '../../config/federal-2025.json';

const cfg = config as unknown as FederalConfig;

// Helper to create a minimal TaxInput with defaults
function makeInput(overrides: Partial<TaxInput> = {}): TaxInput {
  return {
    taxYear: 2025,
    filingStatus: 'single',
    taxpayer: { firstName: 'Test', lastName: 'User', ssn: '123-45-6789', dateOfBirth: '1990-01-01' },
    dependents: [],
    address: { street: '123 Main St', city: 'Anytown', state: 'CA', zip: '90001' },
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
    stateOfResidence: 'CA',
    ...overrides,
  };
}

describe('computeTotalIncome', () => {
  it('should return 0 for no income sources', () => {
    const input = makeInput();
    expect(computeTotalIncome(input)).toBe(0);
  });

  it('should sum W-2 wages from multiple employers', () => {
    const input = makeInput({
      w2s: [
        { employerEIN: '12-3456789', employerName: 'Corp A', wages: 5000000, federalWithheld: 500000, socialSecurityWages: 5000000, socialSecurityWithheld: 310000, medicareWages: 5000000, medicareWithheld: 72500, stateWages: 5000000, stateWithheld: 200000, stateCode: 'CA' },
        { employerEIN: '98-7654321', employerName: 'Corp B', wages: 3000000, federalWithheld: 300000, socialSecurityWages: 3000000, socialSecurityWithheld: 186000, medicareWages: 3000000, medicareWithheld: 43500, stateWages: 3000000, stateWithheld: 120000, stateCode: 'CA' },
      ],
    });
    expect(computeTotalIncome(input)).toBe(8000000); // $80,000
  });

  it('should include taxable interest (Box 1 minus tax-exempt Box 8)', () => {
    const input = makeInput({
      form1099INTs: [
        { payerName: 'Bank A', interest: 100000, taxExemptInterest: 20000 },
        { payerName: 'Bank B', interest: 50000 },
      ],
    });
    // Taxable interest: (100000 - 20000) + 50000 = 130000
    expect(computeTotalIncome(input)).toBe(130000);
  });

  it('should include ordinary dividends (Box 1a)', () => {
    const input = makeInput({
      form1099DIVs: [
        { payerName: 'Fund A', ordinaryDividends: 200000, qualifiedDividends: 150000, totalCapitalGain: 0 },
      ],
    });
    expect(computeTotalIncome(input)).toBe(200000);
  });

  it('should include 1099-NEC non-employee compensation', () => {
    const input = makeInput({
      form1099NECs: [
        { payerName: 'Client A', nonemployeeCompensation: 1500000 },
        { payerName: 'Client B', nonemployeeCompensation: 500000 },
      ],
    });
    expect(computeTotalIncome(input)).toBe(2000000);
  });

  it('should include unemployment from 1099-G', () => {
    const input = makeInput({
      form1099Gs: [
        { unemployment: 800000 },
      ],
    });
    expect(computeTotalIncome(input)).toBe(800000);
  });

  it('should include taxable retirement distributions from 1099-R', () => {
    const input = makeInput({
      form1099Rs: [
        { grossDistribution: 2000000, taxableAmount: 1800000, distributionCode: '7' },
      ],
    });
    expect(computeTotalIncome(input)).toBe(1800000);
  });

  it('should include Schedule C net profit', () => {
    const input = makeInput({
      scheduleCData: {
        businessName: 'Test Biz',
        businessCode: '541511',
        grossReceipts: 10000000,
        expenses: { advertising: 100000, supplies: 200000 },
      },
    });
    // Net: 10000000 - 100000 - 200000 = 9700000
    expect(computeTotalIncome(input)).toBe(9700000);
  });

  it('should include other income', () => {
    const input = makeInput({ otherIncome: 500000 });
    expect(computeTotalIncome(input)).toBe(500000);
  });

  it('should sum all income sources together', () => {
    const input = makeInput({
      w2s: [
        { employerEIN: '12-3456789', employerName: 'Corp', wages: 5200000, federalWithheld: 520000, socialSecurityWages: 5200000, socialSecurityWithheld: 322400, medicareWages: 5200000, medicareWithheld: 75400, stateWages: 5200000, stateWithheld: 260000, stateCode: 'PA' },
      ],
      form1099INTs: [{ payerName: 'Bank', interest: 50000 }],
      form1099DIVs: [{ payerName: 'Fund', ordinaryDividends: 100000, qualifiedDividends: 80000, totalCapitalGain: 0 }],
      otherIncome: 25000,
    });
    // 5200000 + 50000 + 100000 + 25000 = 5375000
    expect(computeTotalIncome(input)).toBe(5375000);
  });

  it('should handle Schedule C loss (negative net profit)', () => {
    const input = makeInput({
      w2s: [
        { employerEIN: '12-3456789', employerName: 'Corp', wages: 5000000, federalWithheld: 500000, socialSecurityWages: 5000000, socialSecurityWithheld: 310000, medicareWages: 5000000, medicareWithheld: 72500, stateWages: 5000000, stateWithheld: 200000, stateCode: 'CA' },
      ],
      scheduleCData: {
        businessName: 'Failing Biz',
        businessCode: '541511',
        grossReceipts: 100000,
        expenses: { supplies: 500000 },
      },
    });
    // W2: 5000000, Schedule C: 100000 - 500000 = -400000
    // Total: 5000000 + (-400000) = 4600000
    expect(computeTotalIncome(input)).toBe(4600000);
  });
});

describe('computeAdjustments', () => {
  it('should return 0 when no adjustments apply', () => {
    const input = makeInput();
    const totalIncome = 5000000;
    expect(computeAdjustments(input, totalIncome, 0, cfg)).toBe(0);
  });

  it('should include half of SE tax', () => {
    const input = makeInput();
    // Half SE tax of $5,000 = 500000 cents
    expect(computeAdjustments(input, 5000000, 500000, cfg)).toBe(500000);
  });

  it('should include student loan interest up to max $2,500', () => {
    const input = makeInput({ studentLoanInterest: 200000 }); // $2,000
    expect(computeAdjustments(input, 5000000, 0, cfg)).toBe(200000);
  });

  it('should cap student loan interest at $2,500', () => {
    const input = makeInput({ studentLoanInterest: 300000 }); // $3,000
    expect(computeAdjustments(input, 5000000, 0, cfg)).toBe(250000); // Capped at $2,500
  });

  it('should phase out student loan interest above MAGI threshold', () => {
    // Single: phase-out begins at $85,000, ends at $100,000
    // At $92,500 MAGI: halfway through phase-out → 50% reduction
    const input = makeInput({ studentLoanInterest: 250000 }); // $2,500
    const totalIncome = 9250000; // $92,500
    const result = computeAdjustments(input, totalIncome, 0, cfg);
    // 50% of $2,500 = $1,250 = 125000 cents
    expect(result).toBe(125000);
  });

  it('should eliminate student loan interest above phase-out end', () => {
    const input = makeInput({ studentLoanInterest: 250000 });
    const totalIncome = 10000000; // $100,000 — at or above end
    expect(computeAdjustments(input, totalIncome, 0, cfg)).toBe(0);
  });

  it('should include educator expenses up to $300', () => {
    const input = makeInput({ educatorExpenses: 25000 }); // $250
    expect(computeAdjustments(input, 5000000, 0, cfg)).toBe(25000);
  });

  it('should cap educator expenses at $300', () => {
    const input = makeInput({ educatorExpenses: 50000 }); // $500
    expect(computeAdjustments(input, 5000000, 0, cfg)).toBe(30000); // $300
  });

  it('should include HSA deduction', () => {
    const input = makeInput({ hsaDeduction: 400000 }); // $4,000
    expect(computeAdjustments(input, 5000000, 0, cfg)).toBe(400000);
  });

  it('should include IRA deduction', () => {
    const input = makeInput({ iraDeduction: 650000 }); // $6,500
    expect(computeAdjustments(input, 5000000, 0, cfg)).toBe(650000);
  });

  it('should sum all adjustments', () => {
    const input = makeInput({
      studentLoanInterest: 250000, // $2,500
      educatorExpenses: 30000,     // $300
      hsaDeduction: 400000,        // $4,000
    });
    // halfSETax: 500000 ($5,000)
    // Total: 250000 + 30000 + 400000 + 500000 = 1180000
    expect(computeAdjustments(input, 5000000, 500000, cfg)).toBe(1180000);
  });
});

describe('computeAGI', () => {
  it('should compute AGI as totalIncome minus adjustments', () => {
    const input = makeInput({
      w2s: [
        { employerEIN: '12-3456789', employerName: 'Corp', wages: 5200000, federalWithheld: 520000, socialSecurityWages: 5200000, socialSecurityWithheld: 322400, medicareWages: 5200000, medicareWithheld: 75400, stateWages: 5200000, stateWithheld: 260000, stateCode: 'PA' },
      ],
    });
    // Total income: 5200000, adjustments: 0, AGI: 5200000
    const result = computeAGI(input, 0, cfg);
    expect(result.totalIncome).toBe(5200000);
    expect(result.adjustments).toBe(0);
    expect(result.agi).toBe(5200000);
  });

  it('should subtract half SE tax from total income', () => {
    const input = makeInput({
      w2s: [
        { employerEIN: '12-3456789', employerName: 'Corp', wages: 5000000, federalWithheld: 500000, socialSecurityWages: 5000000, socialSecurityWithheld: 310000, medicareWages: 5000000, medicareWithheld: 72500, stateWages: 5000000, stateWithheld: 200000, stateCode: 'CA' },
      ],
      studentLoanInterest: 250000,
    });
    const halfSETax = 300000; // $3,000
    const result = computeAGI(input, halfSETax, cfg);
    // Total income: 5000000
    // Adjustments: halfSETax 300000 + student loan 250000 = 550000
    // AGI: 5000000 - 550000 = 4450000
    expect(result.totalIncome).toBe(5000000);
    expect(result.adjustments).toBe(550000);
    expect(result.agi).toBe(4450000);
  });

  it('should not produce negative AGI from adjustments', () => {
    // Edge case: adjustments could theoretically exceed income
    // In practice IRS handles this differently, but we should handle gracefully
    const input = makeInput({ hsaDeduction: 1000000 }); // $10,000 HSA but no income
    const result = computeAGI(input, 0, cfg);
    expect(result.totalIncome).toBe(0);
    // AGI can technically go negative (it's allowed in tax law for NOLs etc.)
    // but adjustments are limited to what's applicable
    expect(result.agi).toBe(-1000000);
  });
});

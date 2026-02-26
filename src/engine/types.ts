// OpenTax Type Definitions
// All monetary values are integers representing cents.
// $50,000.00 = 5_000_000 cents. NEVER use floating point for money.

import type { StateTaxResult } from './states/interface';

export type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'qualifying_surviving_spouse';

// ---------------------------------------------------------------------------
// Income Document Types
// ---------------------------------------------------------------------------

export interface W2 {
  employerEIN: string;
  employerName: string;
  wages: number;                    // Box 1 (cents)
  federalWithheld: number;          // Box 2 (cents)
  socialSecurityWages: number;      // Box 3
  socialSecurityWithheld: number;   // Box 4
  medicareWages: number;            // Box 5
  medicareWithheld: number;         // Box 6
  stateWages: number;               // Box 16
  stateWithheld: number;            // Box 17
  stateCode: string;                // Box 15
  localWages?: number;              // Box 18
  localWithheld?: number;           // Box 19
  locality?: string;                // Box 20
}

export interface Form1099INT {
  payerName: string;
  interest: number;                 // Box 1 (cents)
  earlyWithdrawalPenalty?: number;  // Box 2
  usSavingsBondInterest?: number;   // Box 3
  federalWithheld?: number;         // Box 4
  taxExemptInterest?: number;       // Box 8
}

export interface Form1099DIV {
  payerName: string;
  ordinaryDividends: number;        // Box 1a (cents)
  qualifiedDividends: number;       // Box 1b
  totalCapitalGain: number;         // Box 2a
  section1250Gain?: number;         // Box 2b
  section1202Gain?: number;         // Box 2c
  collectiblesGain?: number;        // Box 2d
  nondividendDistributions?: number; // Box 3
  federalWithheld?: number;         // Box 4
  foreignTaxPaid?: number;          // Box 7
  exemptInterestDividends?: number; // Box 12
}

export type Form8949Category =
  | '8949_A'  // Short-term, basis reported to IRS
  | '8949_B'  // Short-term, basis NOT reported to IRS
  | '8949_C'  // Short-term, no 1099-B received
  | '8949_D'  // Long-term, basis reported to IRS
  | '8949_E'  // Long-term, basis NOT reported to IRS
  | '8949_F'; // Long-term, no 1099-B received

export interface Form1099B {
  description: string;
  dateAcquired: string;            // ISO date or 'VARIOUS'
  dateSold: string;                // ISO date
  proceeds: number;                // Box 1d (cents)
  costBasis: number;               // Box 1e (cents)
  gainLoss: number;                // Computed: proceeds - costBasis (cents)
  isLongTerm: boolean;             // Held > 1 year
  basisReportedToIRS: boolean;     // Box 12 checked
  washSaleDisallowed?: number;     // Box 1g (cents)
  isCollectible?: boolean;
  category: Form8949Category;
}

export interface Form1099NEC {
  payerName: string;
  nonemployeeCompensation: number; // Box 1 (cents)
  federalWithheld?: number;        // Box 4
}

export interface Form1099G {
  unemployment: number;            // Box 1 (cents)
  stateRefund?: number;            // Box 2
  federalWithheld?: number;        // Box 4
  stateWithheld?: number;          // Box 11
}

export interface Form1099R {
  grossDistribution: number;       // Box 1 (cents)
  taxableAmount: number;           // Box 2a
  federalWithheld?: number;        // Box 4
  distributionCode: string;        // Box 7
}

export interface Form1099K {
  grossAmount: number;             // Box 1a (cents)
  alreadyReportedOnScheduleC: boolean;
}

// ---------------------------------------------------------------------------
// Deduction & Business Types
// ---------------------------------------------------------------------------

export interface ItemizedDeductions {
  medicalExpenses: number;         // (cents)
  stateLocalTaxesPaid: number;     // Subject to SALT cap
  realEstateTaxes: number;         // Also under SALT cap
  mortgageInterest: number;        // Limited to $750k acquisition debt
  mortgageInsurancePremiums?: number;
  charitableCash: number;          // Limited to 60% AGI
  charitableNonCash: number;       // Limited to 30% AGI for most
  casualtyLosses?: number;         // Only federally declared disasters
  otherDeductions?: number;
}

export interface ScheduleCExpenses {
  advertising?: number;
  carAndTruck?: number;
  commissions?: number;
  insurance?: number;
  legalAndProfessional?: number;
  officeExpenses?: number;
  supplies?: number;
  utilities?: number;
  otherExpenses?: number;
}

export interface ScheduleCData {
  businessName: string;
  businessCode: string;            // NAICS code
  grossReceipts: number;           // (cents)
  costOfGoodsSold?: number;
  otherIncome?: number;
  expenses: ScheduleCExpenses;
  homeOffice?: {
    squareFootage: number;         // Max 300 sq ft for simplified method
    useSimplifiedMethod: boolean;
  };
}

export interface Dependent {
  firstName: string;
  lastName: string;
  ssn: string;
  relationship: string;
  dateOfBirth: string;
  monthsLivedWithYou: number;
  isStudent: boolean;
  isDisabled: boolean;
  qualifiesForCTC: boolean;        // Under 17 at end of tax year
  qualifiesForODC: boolean;        // Other dependents credit
}

// ---------------------------------------------------------------------------
// Main Input / Output Types
// ---------------------------------------------------------------------------

export interface TaxInput {
  taxYear: number;
  filingStatus: FilingStatus;
  taxpayer: {
    firstName: string;
    lastName: string;
    ssn: string;
    dateOfBirth: string;
  };
  spouse?: {
    firstName: string;
    lastName: string;
    ssn: string;
    dateOfBirth: string;
  };
  dependents: Dependent[];
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };

  // Income
  w2s: W2[];
  form1099INTs: Form1099INT[];
  form1099DIVs: Form1099DIV[];
  form1099Bs: Form1099B[];
  capitalGainsSummary?: {
    shortTermGainLoss: number;  // cents, negative = loss
    longTermGainLoss: number;   // cents, negative = loss
  };
  form1099NECs: Form1099NEC[];
  form1099Gs: Form1099G[];
  form1099Rs: Form1099R[];
  form1099Ks: Form1099K[];
  scheduleCData?: ScheduleCData;
  otherIncome?: number;
  otherIncomeDescription?: string;  // Description for Schedule 1 Line 8 (gambling, prizes, etc.)

  // Adjustments
  studentLoanInterest?: number;     // Max $2,500, phases out
  educatorExpenses?: number;        // Max $300
  hsaDeduction?: number;
  iraDeduction?: number;
  estimatedTaxPayments: number;     // Total 1040-ES payments made

  // Deductions
  useItemizedDeductions: boolean;   // false = standard deduction
  itemizedDeductions?: ItemizedDeductions;

  // Credits
  childCareCreditExpenses?: number;
  educationExpenses?: {
    type: 'american_opportunity' | 'lifetime_learning';
    qualifiedExpenses: number;
    studentSSN: string;
  }[];
  retirementSaversCredit?: {
    contributions: number;
  };

  // State
  stateOfResidence: string;
  additionalStates?: string[];

  // Refund
  directDeposit?: {
    routingNumber: string;
    accountNumber: string;
    accountType: 'checking' | 'savings';
  };

  // Prior year carryforward (IRS Capital Loss Carryover Worksheet)
  // Legacy single-field kept for backward compatibility (applied to ST column)
  priorYearCapitalLossCarryforward?: number;
  // Preferred: separate ST and LT components per Schedule D worksheet
  priorYearSTCapitalLossCarryforward?: number;
  priorYearLTCapitalLossCarryforward?: number;

  // Age flags (derived from dateOfBirth at runtime, but useful for tests)
  taxpayerAge65OrOlder?: boolean;
  taxpayerBlind?: boolean;
  spouseAge65OrOlder?: boolean;
  spouseBlind?: boolean;
}

export interface IncomeBreakdown {
  wages: number;
  interest: number;
  ordinaryDividends: number;
  qualifiedDividends: number;
  shortTermCapitalGains: number;
  longTermCapitalGains: number;
  selfEmploymentIncome: number;
  unemployment: number;
  retirementDistributions: number;
  otherIncome: number;
}

export interface DeductionBreakdown {
  type: 'standard' | 'itemized';
  amount: number;
  standardAmount: number;          // Always computed for comparison
  itemizedAmount: number;          // Always computed for comparison
  itemizedDetails?: ItemizedDeductions & { saltCapped: number };
}

export interface TaxBreakdown {
  ordinaryIncomeTax: number;
  capitalGainsTax: number;
  selfEmploymentTax: number;
  additionalMedicareTax: number;
  netInvestmentIncomeTax: number;
  amt: number;
}

export interface CreditBreakdown {
  childTaxCredit: number;
  additionalChildTaxCredit: number;  // Refundable portion
  otherDependentCredit: number;
  earnedIncomeCredit: number;
  childCareCareCredit: number;
  educationCredits: number;
  saversCredit: number;
}

export interface CapitalGainsResult {
  shortTermGains: number;
  shortTermLosses: number;
  netShortTerm: number;
  longTermGains: number;
  longTermLosses: number;
  netLongTerm: number;
  netCapitalGainLoss: number;
  deductibleLoss: number;          // Limited to -$3,000
  carryforwardLoss: number;        // Excess loss for next year
  collectiblesGain: number;
  section1250Gain: number;
  // Categorized transactions for Form 8949
  categorized: Record<Form8949Category, Form1099B[]>;
}

export interface SelfEmploymentResult {
  scheduleCNetProfit: number;
  homeOfficeDeduction: number;
  seTaxableIncome: number;         // 92.35% of net profit
  socialSecurityTax: number;
  medicareTax: number;
  totalSETax: number;
  halfSETaxDeduction: number;      // Above-the-line deduction
  qbiDeduction: number;            // Section 199A
}

export interface TaxResult {
  // Summary
  totalIncome: number;
  adjustedGrossIncome: number;
  taxableIncome: number;
  totalTax: number;
  totalCredits: number;
  totalPayments: number;           // Withholding + estimated payments
  refundOrOwed: number;            // Positive = refund, negative = owed
  effectiveTaxRate: number;        // Percentage (e.g., 22.5)
  marginalTaxRate: number;         // Percentage

  // Detailed breakdowns
  incomeBreakdown: IncomeBreakdown;
  deductionBreakdown: DeductionBreakdown;
  taxBreakdown: TaxBreakdown;
  creditBreakdown: CreditBreakdown;
  capitalGainsResult: CapitalGainsResult;
  selfEmploymentResult?: SelfEmploymentResult;

  // Form data — field name → value mappings for PDF generation
  forms: {
    f1040: Record<string, string | number>;
    scheduleA?: Record<string, string | number>;
    scheduleB?: Record<string, string | number>;
    scheduleC?: Record<string, string | number>;
    scheduleD?: Record<string, string | number>;
    scheduleSE?: Record<string, string | number>;
    schedule1?: Record<string, string | number>;
    schedule2?: Record<string, string | number>;
    schedule3?: Record<string, string | number>;
    f8949?: Record<string, string | number>[];
    f8959?: Record<string, string | number>;
    f8960?: Record<string, string | number>;
  };

  // Schedule flags
  needsSchedule1: boolean;
  needsSchedule2: boolean;
  needsSchedule3: boolean;
  needsScheduleA: boolean;
  needsScheduleB: boolean;
  needsScheduleC: boolean;
  needsScheduleD: boolean;
  needsScheduleSE: boolean;
  needsForm8949: boolean;
  needsForm8959: boolean;
  needsForm8960: boolean;

  // State results (populated by state modules, not federal engine)
  stateResults: Record<string, StateTaxResult>;
}

// ---------------------------------------------------------------------------
// Config Types
// ---------------------------------------------------------------------------

export interface TaxBracket {
  min: number;    // (cents) inclusive lower bound
  max: number | null;  // (cents) exclusive upper bound, null = no limit
  rate: number;   // decimal (e.g., 0.10 for 10%)
}

export interface CapitalGainsRateBracket {
  max: number | null;  // (cents) upper threshold, null = no limit
  rate: number;
}

export interface EITCParameters {
  phaseInRate: number;
  phaseOutRate: number;
  maxCredit: number;               // (cents)
  completedPhaseIn: number;        // Earned income where max credit reached (cents)
  phaseOutBeginsSingle: number;    // (cents)
  phaseOutBeginsMFJ: number;       // (cents)
  phaseOutEndsSingle: number;      // (cents)
  phaseOutEndsMFJ: number;         // (cents)
}

export interface SaversCreditBracket {
  rate: number;
  mfj: number;     // AGI threshold (cents)
  hoh: number;
  single: number;  // Also covers MFS
}

export interface SALTConfig {
  baseCap: Record<FilingStatus, number>;
  phaseOutBegins: Record<FilingStatus, number>;
  phaseOutRate: number;            // 0.30 = 30 cents per dollar
  floor: Record<FilingStatus, number>;
}

export interface FederalConfig {
  taxYear: number;

  standardDeduction: Record<FilingStatus, number>;
  additionalStandardDeduction: {
    married: number;               // Per qualifying individual
    single: number;                // Per qualifying individual (single/HoH)
  };

  seniorDeduction?: {
    amount: number;                // Per qualifying individual (cents)
    phaseOut: Record<FilingStatus, { begin: number; end: number }>;
    phaseOutRate: number;          // 0.06 = 6 cents per dollar over threshold
  };

  brackets: Record<FilingStatus, TaxBracket[]>;

  capitalGainsRates: Record<FilingStatus, CapitalGainsRateBracket[]>;
  collectiblesRate: number;        // 0.28
  section1250Rate: number;         // 0.25

  socialSecurity: {
    wageBase: number;              // (cents)
    employeeRate: number;
    selfEmployedRate: number;
  };

  medicare: {
    rate: number;
    selfEmployedRate: number;
    additionalRate: number;
    additionalThreshold: Record<FilingStatus, number>;
  };

  amt: {
    exemption: Record<FilingStatus, number>;
    phaseOutBegins: Record<FilingStatus, number>;
    rates: {
      low: number;                 // 0.26
      high: number;                // 0.28
      breakpoint: Record<FilingStatus, number>;
    };
  };

  niit: {
    rate: number;                  // 0.038
    threshold: Record<FilingStatus, number>;
  };

  ctc: {
    maxCreditPerChild: number;
    refundablePerChild: number;
    earnedIncomeThreshold: number;
    phaseInRate: number;
    phaseOutThreshold: Record<FilingStatus, number>;
    phaseOutRate: number;          // $50 per $1,000 over threshold
  };

  odc: {
    creditPerDependent: number;
    // Same phase-out as CTC
  };

  eitc: Record<string, EITCParameters>;  // Keys: '0', '1', '2', '3'
  eitcInvestmentIncomeLimit: number;

  educationCredits: {
    aotc: {
      maxCredit: number;
      firstTierExpenses: number;
      secondTierExpenses: number;
      secondTierRate: number;
      refundableRate: number;
      phaseOut: {
        single: { begin: number; end: number };
        mfj: { begin: number; end: number };
      };
    };
    llc: {
      maxCredit: number;
      rate: number;
      maxExpenses: number;
      phaseOut: {
        single: { begin: number; end: number };
        mfj: { begin: number; end: number };
      };
    };
  };

  saversCredit: {
    maxContribution: Record<FilingStatus, number>;
    brackets: SaversCreditBracket[];
  };

  childCareCredit: {
    maxExpensesOneChild: number;
    maxExpensesTwoPlus: number;
    minRate: number;
    maxRate: number;
    rateReductionPerIncrement: number;
    incomeIncrement: number;
    incomeThreshold: number;
  };

  salt: SALTConfig;

  charitableLimits: {
    cashPercentAGI: number;        // 0.60
    nonCashPercentAGI: number;     // 0.30
  };

  medicalExpenseThreshold: number;  // 0.075 (7.5% of AGI)

  mortgageInterestDebtLimit: number;  // (cents) $750,000

  capitalLossLimit: Record<FilingStatus, number>;

  studentLoanInterest: {
    maxDeduction: number;
    phaseOut: {
      single: { begin: number; end: number };
      mfj: { begin: number; end: number };
    };
  };

  educatorExpensesMax: number;

  hsaLimits: {
    selfOnly: number;
    family: number;
    catchUp55: number;
  };

  selfEmployment: {
    seTaxableRate: number;         // 0.9235
    socialSecurityRate: number;
    medicareRate: number;
    additionalMedicareRate: number;
    wageBase: number;
    homeOfficeSimplifiedRate: number;  // $5/sqft in cents = 500
    homeOfficeMaxSqFt: number;
  };

  qbi: {
    deductionRate: number;         // 0.20
    phaseOut: {
      single: { begin: number; end: number };
      mfj: { begin: number; end: number };
    };
  };
}

// Re-export state types for convenience
export type { StateTaxInput, StateTaxResult, StateConfig, StateModule } from './states/interface';
